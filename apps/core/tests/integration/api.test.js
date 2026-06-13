// DUNAZOE OS — API INTEGRATION TESTS
// Run: npx jest tests/integration/api.test.js --verbose --runInBand
const axios  = require("axios");
const { Pool }   = require("pg");
const { factory, seed } = require("../fixtures/factory");

const BASE   = process.env.TEST_GATEWAY_URL || "http://localhost:3000";
const DB_URL = process.env.DATABASE_URL     || "postgresql://test:test@localhost:5432/dunazoe_test";
const pool   = new Pool({ connectionString:DB_URL });
const api    = axios.create({ baseURL:BASE, validateStatus:()=>true, timeout:10000 });

let customer_token, vendor_token, admin_token, customer_id, product_id, order_id;

function auth(t){ return { headers:{ Authorization:`Bearer ${t}` }}; }
function idem(){ return { "Idempotency-Key":factory.idempotencyKey() }; }

beforeAll(async()=>{
  await seed.cleanAll(pool);
  const c=await api.post("/auth/register",factory.user({role:"customer"}));
  customer_token=c.data.token; customer_id=c.data.user_id;
  const v=await api.post("/auth/register",factory.vendor());
  vendor_token=v.data.token;
  const adm=await seed.createUser(pool,{role:"admin"});
  const al=await api.post("/auth/login",{email:adm.email,password:adm._password});
  admin_token=al.data.token;
},30000);

afterAll(async()=>{ await seed.cleanAll(pool); await pool.end(); });

describe("Authentication", ()=>{
  test("Register — success",async()=>{ const r=await api.post("/auth/register",factory.user()); expect(r.status).toBe(201); expect(r.data.token).toBeDefined(); });
  test("Register — duplicate returns 409",async()=>{ const u=factory.user(); await api.post("/auth/register",u); const r=await api.post("/auth/register",u); expect(r.status).toBe(409); });
  test("Login — success",async()=>{ const u=factory.user(); await api.post("/auth/register",u); const r=await api.post("/auth/login",{email:u.email,password:u.password}); expect(r.status).toBe(200); expect(r.data.token).toBeDefined(); });
  test("Login — wrong password 401",async()=>{ const u=factory.user(); await api.post("/auth/register",u); const r=await api.post("/auth/login",{email:u.email,password:"wrong"}); expect(r.status).toBe(401); });
  test("Protected route needs token",async()=>{ const r=await api.get(`/users/${customer_id}`); expect(r.status).toBe(401); });
  test("Cash payment blocked",async()=>{ const r=await api.post("/orders",factory.order({payment_type:"cash",product_id:1}),auth(customer_token)); expect(r.status).toBe(400); });
});

describe("Products", ()=>{
  test("GET /products — returns list",async()=>{ const r=await api.get("/products"); expect(r.status).toBe(200); expect(Array.isArray(r.data.products)).toBe(true); });
  test("GET /products?category=fashion — filtered",async()=>{ const r=await api.get("/products?category=fashion"); expect(r.status).toBe(200); });
  test("POST /products — requires auth",async()=>{ const r=await api.post("/products",factory.product()); expect(r.status).toBe(401); });
});

describe("Wallet", ()=>{
  test("GET /wallets/:id — returns balances",async()=>{ const r=await api.get(`/wallets/${customer_id}`,auth(customer_token)); expect([200,404]).toContain(r.status); });
  test("POST /wallets/deposit — negative rejected",async()=>{ const r=await api.post("/wallets/deposit",{user_id:customer_id,amount:-1000,currency:"NGN"},{...auth(customer_token),headers:{...auth(customer_token).headers,...idem()}}); expect(r.status).toBe(400); });
});

describe("Thrift", ()=>{
  test("POST /thrift/accounts — open account",async()=>{ const r=await api.post("/thrift/accounts",factory.thriftAccount(),auth(customer_token)); expect([200,201,409]).toContain(r.status); });
  test("POST /thrift/contribute — min ₦1000",async()=>{ const r=await api.post("/thrift/contribute",factory.contribution({amount:500}),auth(customer_token)); expect(r.status).toBe(400); });
});

describe("Fraud", ()=>{
  test("POST /fraud/check — safe order allowed",async()=>{ const r=await api.post("/fraud/check",factory.fraudCheck(),auth(customer_token)); expect(r.status).toBe(200); });
  test("POST /fraud/check — high amount blocked",async()=>{ const r=await api.post("/fraud/check",factory.highRiskFraud(),auth(customer_token)); if(r.status===200) expect(r.data.allowed).toBe(false); });
});

describe("Feature Flags", ()=>{
  test("GET /flags/thrift_enabled",async()=>{ const r=await api.get("/flags/thrift_enabled"); expect(r.status).toBe(200); expect(typeof r.data.enabled).toBe("boolean"); });
  test("GET /flags/unknown — defaults true",async()=>{ const r=await api.get("/flags/unknown_xyz_flag"); expect(r.status).toBe(200); expect(r.data.enabled).toBe(true); });
});

describe("Search", ()=>{
  test("GET /search/products?q=ankara",async()=>{ const r=await api.get("/search/products?q=ankara"); expect(r.status).toBe(200); expect(Array.isArray(r.data.products)).toBe(true); });
  test("GET /search/autocomplete?q=an",async()=>{ const r=await api.get("/search/autocomplete?q=an&type=products"); expect(r.status).toBe(200); });
});

describe("Health", ()=>{
  test("GET /health — gateway healthy",async()=>{ const r=await api.get("/health"); expect(r.status).toBe(200); expect(r.data.services).toBeGreaterThanOrEqual(22); });
});
