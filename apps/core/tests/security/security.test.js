// DUNAZOE OS — SECURITY TESTS
const axios  = require("axios");
const { factory, seed } = require("../fixtures/factory");
const { Pool }  = require("pg");

const BASE   = process.env.TEST_GATEWAY_URL || "http://localhost:3000";
const DB_URL = process.env.DATABASE_URL     || "postgresql://test:test@localhost:5432/dunazoe_test";
const pool   = new Pool({ connectionString:DB_URL });
const api    = axios.create({ baseURL:BASE, validateStatus:()=>true, timeout:15000 });

let customer_token, customer_id, other_id;

beforeAll(async()=>{
  const c=await api.post("/auth/register",factory.user()); customer_token=c.data.token; customer_id=c.data.user_id;
  const o=await api.post("/auth/register",factory.user()); other_id=o.data.user_id;
},30000);
afterAll(async()=>{ await seed.cleanAll(pool); await pool.end(); });

const SQL_PAYLOADS=["' OR '1'='1","'; DROP TABLE users; --","1' UNION SELECT * FROM users --"];

describe("SQL Injection Prevention",()=>{
  test.each(SQL_PAYLOADS)("SQL in email blocked: %s",async(p)=>{ const r=await api.post("/auth/login",{email:p,password:"test"}); expect(r.status).not.toBe(500); expect([400,401]).toContain(r.status); });
  test.each(SQL_PAYLOADS)("SQL in search blocked: %s",async(p)=>{ const r=await api.get(`/search/products?q=${encodeURIComponent(p)}`); expect(r.status).not.toBe(500); });
});

describe("JWT Security",()=>{
  test("Expired token rejected",async()=>{ const jwt=require("jsonwebtoken"); const tok=jwt.sign({id:1,role:"customer"},process.env.JWT_SECRET||"test_jwt_secret_minimum_32_characters_ok",{expiresIn:"0s"}); await new Promise(r=>setTimeout(r,100)); const r=await api.get(`/users/${customer_id}`,{headers:{Authorization:`Bearer ${tok}`}}); expect(r.status).toBe(401); });
  test("Tampered token rejected",async()=>{ const parts=customer_token.split("."); const tampered=parts[0]+"."+Buffer.from(JSON.stringify({id:999,role:"admin"})).toString("base64url")+"."+parts[2]; const r=await api.get(`/users/${customer_id}`,{headers:{Authorization:`Bearer ${tampered}`}}); expect(r.status).toBe(401); });
  test("No token → 401",async()=>{ const r=await api.get(`/users/${customer_id}`); expect(r.status).toBe(401); });
});

describe("IDOR Protection",()=>{
  test("Cannot view other user wallet",async()=>{ const r=await api.get(`/wallets/${other_id}`,{headers:{Authorization:`Bearer ${customer_token}`}}); expect([403,404]).toContain(r.status); });
  test("Cannot cancel other user order",async()=>{ const r=await api.post("/orders/99999/cancel",{reason:"IDOR"},{headers:{Authorization:`Bearer ${customer_token}`}}); expect([403,404]).toContain(r.status); });
});

describe("Payment Security",()=>{
  test("Cash payment always rejected",async()=>{
    for(const v of ["cash","CASH","Cash"]){
      const r=await api.post("/orders",factory.order({payment_type:v,product_id:1}),{headers:{Authorization:`Bearer ${customer_token}`}});
      expect(r.status).toBe(400);
    }
  });
  test("Negative deposit rejected",async()=>{ const r=await api.post("/wallets/deposit",{user_id:customer_id,amount:-1000,currency:"NGN"},{headers:{Authorization:`Bearer ${customer_token}`,"Idempotency-Key":factory.idempotencyKey()}}); expect(r.status).toBe(400); });
  test("Wallet cannot go negative",async()=>{ const r=await api.post("/wallets/withdraw",{amount:999999999,currency:"NGN"},{headers:{Authorization:`Bearer ${customer_token}`}}); expect(r.status).toBe(400); });
});

describe("Loan HARD RULE",()=>{
  test("Loan > contributed → REJECTED by ledger",async()=>{
    const { transactions } = require("../../shared/ledger/ledgerEngine");
    await expect(transactions.loanDisbursement({loan_id:9999,user_id:1,amount:100000,total_contributed:50000,correlation_id:"test"})).rejects.toThrow("LOAN REJECTED");
  });
});

describe("RBAC",()=>{
  test("Customer cannot toggle flags",async()=>{ const r=await api.post("/flags/thrift_enabled/toggle",{enabled:false},{headers:{Authorization:`Bearer ${customer_token}`}}); expect([401,403]).toContain(r.status); });
  test("Customer cannot run reconciliation",async()=>{ const r=await api.post("/reconciliation/run",{},{headers:{Authorization:`Bearer ${customer_token}`}}); expect([401,403]).toContain(r.status); });
});

describe("Security Headers",()=>{
  test("X-Content-Type-Options nosniff",async()=>{ const r=await api.get("/health"); expect(r.headers["x-content-type-options"]).toBe("nosniff"); });
});
