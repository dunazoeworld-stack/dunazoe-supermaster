const crypto = require("crypto");
const factory = {
  user:(o={})=>({name:o.name||"Temidayo Folorunso",email:o.email||`test_${crypto.randomBytes(4).toString("hex")}@dunazoe.com`,password:o.password||"SecurePass2026!",phone:o.phone||"08012345678",role:o.role||"customer",state:o.state||"oyo",city:o.city||"ibadan",...o}),
  vendor:(o={})=>factory.user({name:"Adebayo Vendor",email:`vendor_${crypto.randomBytes(4).toString("hex")}@dunazoe.com`,role:"vendor",...o}),
  admin:(o={})=>factory.user({name:"Admin User",email:`admin_${crypto.randomBytes(4).toString("hex")}@dunazoe.com`,role:"admin",...o}),
  vendorProfile:(o={})=>({business_name:o.business_name||"Test Store",description:"Quality products",type:o.type||"direct",category:o.category||"fashion",state:o.state||"ondo",city:o.city||"akure",payout_method:"bank",...o}),
  product:(o={})=>({name:o.name||"Premium Ankara Dress",description:"Quality product",type:"physical",category:o.category||"fashion",price:o.price||18000,cost:o.cost||12000,ajo_enabled:o.ajo_enabled||false,ajo_weeks:o.ajo_weeks||0,...o}),
  order:(o={})=>({product_id:o.product_id||1,quantity:o.quantity||1,payment_type:o.payment_type||"full",delivery_address:"12 Bodija Estate, Ibadan",dest_city:"ibadan",...o}),
  deposit:(o={})=>({amount:o.amount||50000,currency:"NGN",reference:o.reference||`TEST_REF_${Date.now()}`,...o}),
  thriftAccount:(o={})=>({purpose:"personal",plan_type:"monthly",target_amount:100000,target_date:new Date(Date.now()+365*86400000).toISOString().split("T")[0],...o}),
  contribution:(o={})=>({amount:o.amount||15000,reference:o.reference||`CONTRIB_${Date.now()}`,...o}),
  loan:(o={})=>({amount:o.amount||25000,repayment_days:30,...o}),
  dispute:(o={})=>({order_id:o.order_id||1,reason:"Product not as described",evidence_urls:[],...o}),
  fraudCheck:(o={})=>({user_id:o.user_id||1,amount:o.amount||18000,quantity:o.quantity||1,ip_address:"192.168.1.1",...o}),
  highRiskFraud:()=>factory.fraudCheck({amount:750000}),
  suspiciousQty:()=>factory.fraudCheck({quantity:80}),
  idempotencyKey:()=>"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);}),
};

const seed = {
  async createUser(pool,o={}){
    const bcrypt=require("bcrypt"); const data=factory.user(o); const hash=await bcrypt.hash(data.password,10);
    const r=await pool.query("INSERT INTO users(name,email,phone,whatsapp,password_hash,role,state,city) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[data.name,data.email,data.phone||"08012345678",data.phone||"08012345678",hash,data.role,data.state||"oyo",data.city||"ibadan"]);
    r.rows[0]._password=data.password; return r.rows[0];
  },
  async createProduct(pool,vendor_id,o={}){
    const data=factory.product(o);
    const r=await pool.query("INSERT INTO products(vendor_id,name,description,type,category,price,cost,ajo_enabled,ajo_weeks,images,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING *",[vendor_id,data.name,data.description,data.type,data.category,data.price,data.cost,data.ajo_enabled,data.ajo_weeks,"https://res.cloudinary.com/dunazoe/test.jpg"]);
    return r.rows[0];
  },
  async createWallet(pool,user_id,balance=0){
    const r=await pool.query("INSERT INTO wallets(user_id,balance_ngn) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET balance_ngn=$2 RETURNING *",[user_id,balance]);
    return r.rows[0];
  },
  async cleanAll(pool){
    await pool.query(`
      DELETE FROM loan_repayments; DELETE FROM loans; DELETE FROM trust_scores;
      DELETE FROM thrift_contributions; DELETE FROM thrift_accounts;
      DELETE FROM wallet_transactions; DELETE FROM wallets;
      DELETE FROM escrow; DELETE FROM orders; DELETE FROM inventory;
      DELETE FROM products; DELETE FROM vendors; DELETE FROM fraud_log;
      DELETE FROM notifications;
      DELETE FROM users WHERE email LIKE 'test_%@dunazoe.com'
        OR email LIKE 'admin_%@dunazoe.com' OR email LIKE 'vendor_%@dunazoe.com';
    `).catch(()=>{});
  },
};

module.exports = { factory, seed };
