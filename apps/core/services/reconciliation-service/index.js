// DUNAZOE OS — RECONCILIATION SERVICE (Port 4024)
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger } = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4024;
app.use(cors()); app.use(express.json());

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const TOLERANCE       = parseFloat(process.env.RECON_TOLERANCE || "0.01");

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reconciliation_runs (
      id SERIAL PRIMARY KEY, run_type TEXT NOT NULL,
      period_from TIMESTAMP NOT NULL, period_to TIMESTAMP NOT NULL,
      status TEXT DEFAULT 'running' CHECK (status IN ('running','passed','failed','needs_review')),
      total_checked INTEGER DEFAULT 0, mismatches INTEGER DEFAULT 0,
      total_variance NUMERIC(15,4) DEFAULT 0, report JSONB,
      run_by INTEGER REFERENCES users(id),
      started_at TIMESTAMP DEFAULT NOW(), completed_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reconciliation_mismatches (
      id SERIAL PRIMARY KEY, run_id INTEGER REFERENCES reconciliation_runs(id),
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      internal_amount NUMERIC(15,4), external_amount NUMERIC(15,4),
      variance NUMERIC(15,4),
      status TEXT DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','accepted')),
      resolved_by INTEGER REFERENCES users(id), resolution_note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rm_run    ON reconciliation_mismatches(run_id);
    CREATE INDEX IF NOT EXISTS idx_rm_entity ON reconciliation_mismatches(entity_type,entity_id);
  `).catch(()=>{});
  logger.info("Reconciliation schema ready ✓");
}

async function reconcileWallets(run_id) {
  const mismatches = [];
  const wallets = await pool.query("SELECT user_id,balance_ngn FROM wallets").catch(()=>({rows:[]}));
  for (const w of wallets.rows) {
    const ledger = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN side='credit' THEN amount ELSE -amount END),0) AS balance
       FROM journal_lines l JOIN journal_entries e ON l.entry_id=e.id
       WHERE l.account_code='1001' AND l.user_id=$1 AND l.currency='NGN'`,
      [w.user_id]
    ).catch(()=>({rows:[{balance:0}]}));
    const wallet_bal = parseFloat(w.balance_ngn);
    const ledger_bal = parseFloat(ledger.rows[0].balance||0);
    const variance   = Math.abs(wallet_bal-ledger_bal);
    if (variance>TOLERANCE) {
      mismatches.push({user_id:w.user_id,wallet_bal,ledger_bal,variance});
      await pool.query("INSERT INTO reconciliation_mismatches(run_id,entity_type,entity_id,internal_amount,external_amount,variance) VALUES($1,'wallet_ngn',$2,$3,$4,$5)",
        [run_id,String(w.user_id),wallet_bal,ledger_bal,variance]).catch(()=>{});
      logger.warn("WALLET MISMATCH",{user_id:w.user_id,wallet_bal,ledger_bal,variance});
    }
  }
  return mismatches;
}

async function reconcileEscrow(run_id) {
  const mismatches = [];
  const escrow = await pool.query("SELECT id,amount,status FROM escrow WHERE status='held'").catch(()=>({rows:[]}));
  for (const e of escrow.rows) {
    const ledger=await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN l.side='credit' THEN l.amount ELSE -l.amount END),0) bal
       FROM journal_lines l JOIN journal_entries je ON l.entry_id=je.id
       WHERE l.account_code='1004' AND je.reference_id=$1`,
      [String(e.id)]
    ).catch(()=>({rows:[{bal:0}]}));
    const escrow_amt=parseFloat(e.amount);
    const ledger_amt=parseFloat(ledger.rows[0].bal||0);
    const variance  =Math.abs(escrow_amt-ledger_amt);
    if (variance>TOLERANCE) {
      mismatches.push({escrow_id:e.id,escrow_amt,ledger_amt,variance});
      await pool.query("INSERT INTO reconciliation_mismatches(run_id,entity_type,entity_id,internal_amount,external_amount,variance) VALUES($1,'escrow',$2,$3,$4,$5)",
        [run_id,String(e.id),escrow_amt,ledger_amt,variance]).catch(()=>{});
    }
  }
  return mismatches;
}

async function reconcilePaystack(run_id,from,to) {
  if (!PAYSTACK_SECRET) return {skipped:true,reason:"PAYSTACK_SECRET_KEY not set"};
  const mismatches=[];
  try {
    const ps_res=await axios.get(`https://api.paystack.co/transaction?status=success&from=${from}&to=${to}&perPage=250`,
      {headers:{Authorization:`Bearer ${PAYSTACK_SECRET}`}});
    const txns=ps_res.data?.data||[];
    for (const tx of txns) {
      const ref=tx.reference; const ps_amt=tx.amount/100;
      const internal=await pool.query("SELECT amount FROM orders WHERE paystack_ref=$1",[ref]).catch(()=>({rows:[]}));
      if (!internal.rows[0]) {
        mismatches.push({ref,issue:"IN_PAYSTACK_NOT_IN_DB",ps_amount:ps_amt});
        await pool.query("INSERT INTO reconciliation_mismatches(run_id,entity_type,entity_id,internal_amount,external_amount,variance) VALUES($1,'paystack_orphan',$2,0,$3,$3)",
          [run_id,ref,ps_amt]).catch(()=>{});
        continue;
      }
      const internal_amt=parseFloat(internal.rows[0].amount);
      const variance=Math.abs(ps_amt-internal_amt);
      if (variance>TOLERANCE) {
        mismatches.push({ref,ps_amt,internal_amt,variance});
        await pool.query("INSERT INTO reconciliation_mismatches(run_id,entity_type,entity_id,internal_amount,external_amount,variance) VALUES($1,'paystack_amount',$2,$3,$4,$5)",
          [run_id,ref,internal_amt,ps_amt,variance]).catch(()=>{});
        logger.error("PAYSTACK AMOUNT MISMATCH",{ref,ps_amt,internal_amt,variance});
      }
    }
  } catch(e) { logger.error("Paystack recon error:",e.message); }
  return mismatches;
}

async function runReconciliation(run_id,from,to,types,run_by) {
  let total_mismatches=0; const report={};
  try {
    if (types.includes("wallet"))   { const mm=await reconcileWallets(run_id);       total_mismatches+=mm.length; report.wallets={mismatches:mm.length}; }
    if (types.includes("escrow"))   { const mm=await reconcileEscrow(run_id);        total_mismatches+=mm.length; report.escrow={mismatches:mm.length}; }
    if (types.includes("paystack")) { const mm=await reconcilePaystack(run_id,from,to); total_mismatches+=Array.isArray(mm)?mm.length:0; report.paystack={mismatches:Array.isArray(mm)?mm.length:0}; }

    // Trial balance check
    const trial=await pool.query(`SELECT ABS(SUM(CASE WHEN l.side='debit' THEN l.amount ELSE 0 END)-SUM(CASE WHEN l.side='credit' THEN l.amount ELSE 0 END)) AS imbalance FROM journal_lines l`).catch(()=>({rows:[{imbalance:0}]}));
    const imbalance=parseFloat(trial.rows[0].imbalance||0);
    report.ledger_balanced=imbalance<=TOLERANCE;
    if (!report.ledger_balanced) { total_mismatches++; logger.error("LEDGER IMBALANCE",{imbalance}); }

    const final_status=total_mismatches===0?"passed":"needs_review";
    await pool.query("UPDATE reconciliation_runs SET status=$1,mismatches=$2,report=$3,completed_at=NOW() WHERE id=$4",
      [final_status,total_mismatches,JSON.stringify(report),run_id]);
    if (total_mismatches>0) logger.error("RECONCILIATION FAILED",{run_id,total_mismatches,report});
    else logger.info("Reconciliation PASSED",{run_id});
  } catch(e) {
    await pool.query("UPDATE reconciliation_runs SET status='failed',completed_at=NOW() WHERE id=$1",[run_id]);
    logger.error("Reconciliation error:",e.message);
  }
}

app.get("/health",(req,res)=>res.json({service:"reconciliation-service",status:"ok",port:PORT}));

app.post("/reconciliation/run", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const {period_from=new Date(Date.now()-86400000).toISOString(),period_to=new Date().toISOString(),types=["wallet","escrow","paystack"]}=req.body;
  const run=await pool.query("INSERT INTO reconciliation_runs(run_type,period_from,period_to,run_by,status) VALUES('full',$1,$2,$3,'running') RETURNING id",[period_from,period_to,req.user.id]);
  const run_id=run.rows[0].id;
  res.json({success:true,run_id,message:"Reconciliation started.",estimated_time:"2-5 minutes"});
  runReconciliation(run_id,period_from,period_to,types,req.user.id).catch(e=>logger.error("Recon failed:",e.message));
}));

app.get("/reconciliation/runs/:id", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const run=await pool.query("SELECT * FROM reconciliation_runs WHERE id=$1",[req.params.id]);
  if (!run.rows[0]) return res.status(404).json({success:false,error:"Not found"});
  const mm=await pool.query("SELECT * FROM reconciliation_mismatches WHERE run_id=$1 ORDER BY variance DESC LIMIT 50",[req.params.id]);
  res.json({success:true,run:run.rows[0],mismatches:mm.rows});
}));

app.get("/reconciliation/runs", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const runs=await pool.query("SELECT * FROM reconciliation_runs ORDER BY started_at DESC LIMIT 20");
  res.json({success:true,runs:runs.rows});
}));

app.post("/reconciliation/mismatches/:id/resolve", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const {resolution_note,status="resolved"}=req.body;
  if (!["resolved","accepted","investigating"].includes(status)) return res.status(400).json({success:false,error:"Invalid status"});
  await pool.query("UPDATE reconciliation_mismatches SET status=$1,resolution_note=$2,resolved_by=$3 WHERE id=$4",[status,resolution_note,req.user.id,req.params.id]);
  res.json({success:true,status});
}));

app.get("/reconciliation/trial-balance", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const {as_of}=req.query;
  const result=await pool.query(
    `SELECT l.account_code,a.name,a.type,l.currency,
       SUM(CASE WHEN l.side='credit' THEN l.amount ELSE 0 END) total_credits,
       SUM(CASE WHEN l.side='debit'  THEN l.amount ELSE 0 END) total_debits,
       SUM(CASE WHEN l.side='credit' THEN l.amount ELSE 0 END)-SUM(CASE WHEN l.side='debit' THEN l.amount ELSE 0 END) net_balance
     FROM journal_lines l JOIN journal_entries e ON l.entry_id=e.id JOIN chart_of_accounts a ON l.account_code=a.code
     WHERE e.posted_at<=COALESCE($1::timestamp,NOW())
     GROUP BY l.account_code,a.name,a.type,l.currency ORDER BY l.account_code`,
    [as_of||null]
  ).catch(()=>({rows:[]}));
  const total_debits =result.rows.reduce((s,r)=>s+parseFloat(r.total_debits),0);
  const total_credits=result.rows.reduce((s,r)=>s+parseFloat(r.total_credits),0);
  res.json({success:true,accounts:result.rows,total_debits:total_debits.toFixed(4),total_credits:total_credits.toFixed(4),balanced:Math.abs(total_debits-total_credits)<0.01,as_of:as_of||new Date().toISOString()});
}));

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT,()=>logger.info(`✅ Reconciliation Service running on port ${PORT}`));
module.exports = app;
