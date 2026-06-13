// DUNAZOE OS — SEARCH SERVICE (Port 4022) — PostgreSQL FTS
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4022;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });

async function initSearchIndexes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_analytics(id SERIAL PRIMARY KEY,user_id INTEGER,query TEXT NOT NULL,entity_type TEXT NOT NULL,results_count INTEGER DEFAULT 0,search_at TIMESTAMP DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS idx_sa_query ON search_analytics(query);
    CREATE INDEX IF NOT EXISTS idx_sa_time ON search_analytics(search_at);
  `).catch(e=>logger.warn("Search analytics:", e.message));
  logger.info("Search indexes ready ✓");
}

function logSearch(uid,query,entity,count) {
  pool.query("INSERT INTO search_analytics(user_id,query,entity_type,results_count) VALUES($1,$2,$3,$4)",[uid||null,query,entity,count]).catch(()=>{});
}

app.get("/health",(req,res)=>res.json({service:"search-service",status:"ok",port:PORT,engine:"postgresql-fts"}));

app.get("/search/products", asyncHandler(async(req,res)=>{
  const {q,category,state,city,min_price,max_price,ajo_only,page=1,limit=20,sort="relevance"}=req.query;
  const offset=(parseInt(page)-1)*parseInt(limit);
  const has_q=q&&q.trim().length>0;
  const safe_q=(q||"").trim().substring(0,200);
  const params=[]; let idx=1;
  let sql=`SELECT p.id,p.name,p.description,p.category,p.price,p.ajo_enabled,p.ajo_weeks,p.images,p.ai_badge,p.demand_score,p.shareable_link,v.business_name,v.city,v.state,v.rating${has_q?`,ts_rank(p.search_vector,plainto_tsquery('english',$${idx})) AS relevance`:",p.demand_score AS relevance"} FROM products p JOIN vendors v ON p.vendor_id=v.id WHERE p.is_active=TRUE AND v.status='active'`;
  if(has_q){sql+=` AND p.search_vector@@plainto_tsquery('english',$${idx})`;params.push(safe_q);idx++;}
  if(category){sql+=` AND p.category=$${idx++}`;params.push(category);}
  if(state){sql+=` AND LOWER(v.state)=LOWER($${idx++})`;params.push(state);}
  if(city){sql+=` AND LOWER(v.city)=LOWER($${idx++})`;params.push(city);}
  if(min_price){sql+=` AND p.price>=$${idx++}`;params.push(parseFloat(min_price));}
  if(max_price){sql+=` AND p.price<=$${idx++}`;params.push(parseFloat(max_price));}
  if(ajo_only==="true") sql+=` AND p.ajo_enabled=TRUE`;
  const order=sort==="price_asc"?"ORDER BY p.price ASC":sort==="price_desc"?"ORDER BY p.price DESC":sort==="newest"?"ORDER BY p.created_at DESC":has_q?"ORDER BY relevance DESC,p.demand_score DESC":"ORDER BY p.demand_score DESC,p.created_at DESC";
  sql+=` ${order} LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(parseInt(limit),offset);
  const results=await pool.query(sql,params);
  if(has_q) logSearch(req.headers["x-user-id"],safe_q,"products",results.rows.length);
  res.json({success:true,query:safe_q||null,engine:"postgresql-fts",count:results.rows.length,page:parseInt(page),products:results.rows,sort});
}));

app.get("/search/vendors", asyncHandler(async(req,res)=>{
  const {q,state,city,category,pickup_only,page=1,limit=20}=req.query;
  const offset=(parseInt(page)-1)*parseInt(limit);
  const has_q=q&&q.trim().length>0;
  const safe_q=(q||"").trim().substring(0,200);
  const params=[]; let idx=1;
  let sql=`SELECT v.*,u.name owner_name${has_q?`,ts_rank(v.search_vector,plainto_tsquery('english',$${idx})) AS relevance`:",v.rating AS relevance"} FROM vendors v JOIN users u ON v.user_id=u.id WHERE v.status='active'`;
  if(has_q){sql+=` AND v.search_vector@@plainto_tsquery('english',$${idx})`;params.push(safe_q);idx++;}
  if(state){sql+=` AND LOWER(v.state)=LOWER($${idx++})`;params.push(state);}
  if(city){sql+=` AND LOWER(v.city)=LOWER($${idx++})`;params.push(city);}
  if(category){sql+=` AND v.category=$${idx++}`;params.push(category);}
  if(pickup_only==="true") sql+=` AND v.is_pickup_station=TRUE`;
  sql+=` ORDER BY ${has_q?"relevance DESC,":""}v.rating DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(parseInt(limit),offset);
  const results=await pool.query(sql,params);
  if(has_q) logSearch(req.headers["x-user-id"],safe_q,"vendors",results.rows.length);
  res.json({success:true,query:safe_q||null,count:results.rows.length,vendors:results.rows});
}));

app.get("/search/autocomplete", asyncHandler(async(req,res)=>{
  const {q="",type="products"}=req.query;
  if(q.trim().length<2) return res.json({success:true,suggestions:[]});
  const safe_q=q.trim().substring(0,100);
  const col=type==="vendors"?"business_name":"name";
  const tbl=type==="vendors"?"vendors":"products";
  const whr=type==="vendors"?"status='active'":"is_active=TRUE";
  const r=await pool.query(`SELECT DISTINCT ${col} AS suggestion FROM ${tbl} WHERE ${whr} AND LOWER(${col}) LIKE LOWER($1) ORDER BY ${col} LIMIT 8`,[`${safe_q}%`]);
  res.json({success:true,query:q,suggestions:r.rows});
}));

app.get("/search", asyncHandler(async(req,res)=>{
  const {q="",limit=5}=req.query;
  if(!q.trim()) return res.status(400).json({success:false,error:"q required"});
  const safe_q=q.trim().substring(0,200); const lim=Math.min(parseInt(limit),10);
  const [prods,vends]=await Promise.all([
    pool.query(`SELECT id,name,price,images,ai_badge,'product' AS type FROM products WHERE is_active=TRUE AND search_vector@@plainto_tsquery('english',$1) ORDER BY ts_rank(search_vector,plainto_tsquery('english',$1)) DESC LIMIT $2`,[safe_q,lim]),
    pool.query(`SELECT id,business_name AS name,city,rating,'vendor' AS type FROM vendors WHERE status='active' AND search_vector@@plainto_tsquery('english',$1) ORDER BY ts_rank(search_vector,plainto_tsquery('english',$1)) DESC LIMIT $2`,[safe_q,lim]),
  ]);
  const total=prods.rows.length+vends.rows.length;
  logSearch(req.headers["x-user-id"],safe_q,"global",total);
  res.json({success:true,query:safe_q,products:prods.rows,vendors:vends.rows,total});
}));

app.get("/search/analytics", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res)=>{
  const {days=7}=req.query; const d=parseInt(days);
  const [top,zero]=await Promise.all([
    pool.query(`SELECT query,COUNT(*) searches,AVG(results_count)::INT avg_results FROM search_analytics WHERE search_at>NOW()-INTERVAL '${d} days' GROUP BY query ORDER BY searches DESC LIMIT 20`),
    pool.query(`SELECT query,COUNT(*) searches FROM search_analytics WHERE results_count=0 AND search_at>NOW()-INTERVAL '${d} days' GROUP BY query ORDER BY searches DESC LIMIT 10`),
  ]);
  res.json({success:true,period_days:d,top_searches:top.rows,zero_results:zero.rows});
}));

initSearchIndexes().catch(console.error);
app.use(errorHandler);
app.listen(PORT,()=>logger.info(`✅ Search Service running on port ${PORT}`));
module.exports=app;
