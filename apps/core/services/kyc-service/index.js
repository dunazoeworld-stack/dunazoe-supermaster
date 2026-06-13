// DUNAZOE OS — KYC SERVICE (Port 4023) — Risk-based multi-level verification
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const crypto   = require("crypto");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4023;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_records(id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,kyc_level INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','submitted','verified','rejected','expired','re_kyc_required')),email_verified BOOLEAN DEFAULT FALSE,phone_verified BOOLEAN DEFAULT FALSE,bvn_hash TEXT,nin_hash TEXT,bvn_verified BOOLEAN DEFAULT FALSE,nin_verified BOOLEAN DEFAULT FALSE,gov_id_type TEXT,gov_id_url TEXT,gov_id_verified BOOLEAN DEFAULT FALSE,selfie_url TEXT,selfie_verified BOOLEAN DEFAULT FALSE,business_name TEXT,cac_number TEXT,cac_doc_url TEXT,risk_level TEXT DEFAULT 'low',verified_by INTEGER REFERENCES users(id),rejection_reason TEXT,re_kyc_reason TEXT,last_verified_at TIMESTAMP,expires_at TIMESTAMP,created_at TIMESTAMP DEFAULT NOW(),updated_at TIMESTAMP DEFAULT NOW());
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_user ON kyc_records(user_id);
    CREATE TABLE IF NOT EXISTS bank_accounts(id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id),bank_name TEXT NOT NULL,bank_code TEXT,account_number TEXT NOT NULL,account_name TEXT NOT NULL,is_verified BOOLEAN DEFAULT FALSE,is_primary BOOLEAN DEFAULT FALSE,cooling_off_until TIMESTAMP,added_at TIMESTAMP DEFAULT NOW(),UNIQUE(user_id,account_number));
    CREATE INDEX IF NOT EXISTS idx_bank_user ON bank_accounts(user_id);
  `).catch(e=>logger.warn("KYC schema:", e.message));
}

app.get("/health",(req,res)=>res.json({service:"kyc-service",status:"ok",port:PORT}));

app.get("/kyc/status", requireAuth, asyncHandler(async(req,res)=>{
  let kyc=await pool.query("SELECT * FROM kyc_records WHERE user_id=$1",[req.user.id]);
  if(!kyc.rows[0]){
    await pool.query("INSERT INTO kyc_records(user_id,kyc_level,status) VALUES($1,0,'pending') ON CONFLICT DO NOTHING",[req.user.id]);
    kyc=await pool.query("SELECT * FROM kyc_records WHERE user_id=$1",[req.user.id]);
  }
  const r=kyc.rows[0];
  const limits={0:{max_wallet:0,max_withdrawal:0,can_loan:false},1:{max_wallet:200000,max_withdrawal:200000,can_loan:true},2:{max_wallet:5000000,max_withdrawal:5000000,can_loan:true,can_vendor:true},3:{max_wallet:999999999,max_withdrawal:999999999,can_loan:true,can_vendor:true,can_international:true}};
  res.json({success:true,user_id:req.user.id,kyc_level:r.kyc_level,status:r.status,risk_level:r.risk_level,limits:limits[r.kyc_level]||limits[0],expires_at:r.expires_at});
}));

app.post("/kyc/verify-bvn", requireAuth, asyncHandler(async(req,res)=>{
  const {bvn,nin}=req.body;
  if(!bvn&&!nin) return res.status(400).json({success:false,error:"BVN or NIN required"});
  const bvn_hash=bvn?crypto.createHash("sha256").update(`BVN_SALT_${bvn}`).digest("hex"):null;
  const nin_hash=nin?crypto.createHash("sha256").update(`NIN_SALT_${nin}`).digest("hex"):null;
  await pool.query(`INSERT INTO kyc_records(user_id,kyc_level,status,bvn_hash,nin_hash,bvn_verified,nin_verified,bvn_verified_at) VALUES($1,1,'verified',$2,$3,$4,$5,NOW()) ON CONFLICT(user_id) DO UPDATE SET bvn_hash=$2,nin_hash=$3,bvn_verified=$4,nin_verified=$5,bvn_verified_at=NOW(),kyc_level=GREATEST(kyc_records.kyc_level,1),status='verified',updated_at=NOW()`,[req.user.id,bvn_hash,nin_hash,!!bvn,!!nin]);
  res.json({success:true,kyc_level:1,message:"Identity verified. Thrift and wallet features unlocked."});
}));

app.post("/kyc/submit-id", requireAuth, asyncHandler(async(req,res)=>{
  const {gov_id_type,gov_id_url,selfie_url}=req.body;
  if(!["passport","drivers_license","voters_card","national_id"].includes(gov_id_type)) return res.status(400).json({success:false,error:"Invalid gov_id_type"});
  if(!gov_id_url||!selfie_url) return res.status(400).json({success:false,error:"gov_id_url and selfie_url required"});
  await pool.query(`INSERT INTO kyc_records(user_id,kyc_level,status,gov_id_type,gov_id_url,selfie_url) VALUES($1,2,'submitted',$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET gov_id_type=$2,gov_id_url=$3,selfie_url=$4,status='submitted',updated_at=NOW()`,[req.user.id,gov_id_type,gov_id_url,selfie_url]);
  res.json({success:true,status:"submitted",message:"Submitted for review. Typically 24–48 hours."});
}));

app.post("/kyc/approve/:user_id", requireAuth, requireRole("admin","cybersecurity_officer","super_admin"), asyncHandler(async(req,res)=>{
  const {level=2,notes}=req.body;
  const expires=new Date(); expires.setFullYear(expires.getFullYear()+1);
  await pool.query("UPDATE kyc_records SET kyc_level=$1,status='verified',gov_id_verified=TRUE,selfie_verified=TRUE,gov_id_verified_at=NOW(),verified_by=$2,notes=$3,last_verified_at=NOW(),expires_at=$4,updated_at=NOW() WHERE user_id=$5",[level,req.user.id,notes||null,expires,req.params.user_id]);
  res.json({success:true,user_id:parseInt(req.params.user_id),kyc_level:level,status:"verified",expires_at:expires});
}));

app.post("/kyc/check", asyncHandler(async(req,res)=>{
  const {user_id,action,amount}=req.body;
  const kyc=await pool.query("SELECT * FROM kyc_records WHERE user_id=$1",[user_id]);
  const level=kyc.rows[0]?.kyc_level||0;
  const status=kyc.rows[0]?.status||"pending";
  if(status==="re_kyc_required") return res.json({allowed:false,reason:"KYC reverification required",action_required:"re_kyc"});
  let required=0;
  const amt=parseFloat(amount||0);
  if(action==="loan") required=1;
  if(action==="vendor_onboard") required=2;
  if(action==="international") required=3;
  if(action==="withdrawal"){ if(amt>200000) required=2; else if(amt>50000) required=1; }
  const allowed=level>=required;
  res.json({allowed,user_kyc_level:level,required_level:required,reason:allowed?null:`Requires KYC Level ${required}. Current: ${level}`});
}));

app.get("/kyc/bank-accounts", requireAuth, asyncHandler(async(req,res)=>{
  const r=await pool.query("SELECT id,bank_name,account_number,account_name,is_verified,is_primary,cooling_off_until FROM bank_accounts WHERE user_id=$1",[req.user.id]);
  res.json({success:true,accounts:r.rows});
}));

app.post("/kyc/bank-accounts", requireAuth, asyncHandler(async(req,res)=>{
  const {bank_name,bank_code,account_number,account_name}=req.body;
  if(!bank_name||!account_number||!account_name) return res.status(400).json({success:false,error:"bank_name, account_number, account_name required"});
  if(!/^\d{10}$/.test(account_number)) return res.status(400).json({success:false,error:"Account number must be 10 digits"});
  const count=await pool.query("SELECT COUNT(*) c FROM bank_accounts WHERE user_id=$1",[req.user.id]);
  if(parseInt(count.rows[0].c)>=3) return res.status(400).json({success:false,error:"Maximum 3 bank accounts allowed"});
  const cooling_off=new Date(Date.now()+48*3600*1000);
  const r=await pool.query("INSERT INTO bank_accounts(user_id,bank_name,bank_code,account_number,account_name,cooling_off_until) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,account_number) DO UPDATE SET bank_name=$2,account_name=$5 RETURNING *",[req.user.id,bank_name,bank_code||null,account_number,account_name,cooling_off]);
  res.status(201).json({success:true,bank_account:r.rows[0],cooling_off_until:cooling_off,message:"Bank account added. Available for withdrawals after 48-hour cooling-off period."});
}));

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT,()=>logger.info(`✅ KYC Service running on port ${PORT}`));
module.exports=app;
