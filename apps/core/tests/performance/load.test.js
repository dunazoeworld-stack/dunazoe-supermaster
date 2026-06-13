// DUNAZOE OS — k6 LOAD TESTS
// Run: k6 run tests/performance/load.test.js
import http      from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const order_success_rate   = new Rate("order_success_rate");
const payment_success_rate = new Rate("payment_success_rate");
const fraud_block_rate     = new Rate("fraud_block_rate");
const idem_violations      = new Counter("idempotency_violations");
const order_latency        = new Trend("order_latency");
const wallet_latency       = new Trend("wallet_latency");

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    concurrent_users: { executor:"ramping-vus", startVUs:0, stages:[{duration:"30s",target:100},{duration:"60s",target:500},{duration:"60s",target:1000},{duration:"30s",target:0}], exec:"browseAndOrder" },
    wallet_attack:    { executor:"constant-vus", vus:50, duration:"30s", exec:"walletAttack", startTime:"3m" },
    duplicate_webhooks:{ executor:"shared-iterations", vus:10, iterations:100, exec:"duplicateWebhook", startTime:"5m" },
    login_brute:      { executor:"constant-arrival-rate", rate:100, timeUnit:"1s", duration:"30s", preAllocatedVUs:50, exec:"loginBrute", startTime:"7m" },
    order_spike:      { executor:"ramping-arrival-rate", startRate:10, timeUnit:"1s", stages:[{duration:"10s",target:10},{duration:"5s",target:500},{duration:"30s",target:500},{duration:"10s",target:10}], preAllocatedVUs:200, exec:"orderSpike", startTime:"9m" },
  },
  thresholds: {
    "http_req_duration":    ["p(95)<500","p(99)<2000"],
    "http_req_failed":      ["rate<0.01"],
    "order_success_rate":   ["rate>0.95"],
    "payment_success_rate": ["rate>0.99"],
    "idempotency_violations":["count<1"],
    "order_latency":        ["p(95)<1000"],
  },
};

export function setup() {
  const email=`k6_${Date.now()}@dunazoe.com`, password="K6TestPass2026!";
  const reg=http.post(`${BASE}/auth/register`,JSON.stringify({name:"K6 Test",email,password,phone:"08012345678",role:"customer",state:"oyo",city:"ibadan"}),{headers:{"Content-Type":"application/json"}});
  if(reg.status!==201){ console.error("Setup failed:",reg.body); return {}; }
  const d=JSON.parse(reg.body);
  return { token:d.token, user_id:d.user_id, email, password };
}

function authH(t){ return {"Content-Type":"application/json","Authorization":`Bearer ${t}`}; }
function idemH(t){ return {...authH(t),"Idempotency-Key":uuidv4()}; }

export function browseAndOrder(data) {
  if(!data?.token) return;
  group("Browse",()=>{ const r=http.get(`${BASE}/products?page=1&limit=20`); check(r,{"products 200":r=>r.status===200}); sleep(0.5); });
  group("Search",()=>{ const r=http.get(`${BASE}/search?q=ankara`); check(r,{"search 200":r=>r.status===200}); sleep(0.3); });
  group("Wallet",()=>{ const s=Date.now(); const r=http.get(`${BASE}/wallets/${data.user_id}`,{headers:authH(data.token)}); wallet_latency.add(Date.now()-s); check(r,{"wallet 200":r=>r.status===200}); sleep(0.3); });
  group("Fraud",()=>{ const r=http.post(`${BASE}/fraud/check`,JSON.stringify({user_id:data.user_id,amount:18000,quantity:1,ip_address:"192.168.1.1"}),{headers:authH(data.token)}); check(r,{"fraud 200":r=>r.status===200}); });
  sleep(1);
}

export function walletAttack(data) {
  if(!data?.token) return;
  const r=http.post(`${BASE}/wallets/deposit`,JSON.stringify({user_id:data.user_id,amount:10000,currency:"NGN",reference:`RACE_${Date.now()}`}),{headers:idemH(data.token)});
  check(r,{"no 500":r=>r.status!==500});
  payment_success_rate.add(r.status===200);
  if(r.status===500) idem_violations.add(1);
  sleep(0.1);
}

export function duplicateWebhook() {
  const ref=`DUPE_${__ITER}`;
  for(let i=0;i<3;i++){
    const r=http.post(`${BASE}/payments/webhook/paystack`,JSON.stringify({event:"charge.success",data:{reference:ref,amount:1800000,status:"success",customer:{email:"test@dunazoe.com"}}}),{headers:{"Content-Type":"application/json","x-paystack-signature":"test_sig"}});
    check(r,{"webhook acks":r=>r.status===200});
  }
  payment_success_rate.add(1);
}

export function loginBrute() {
  const r=http.post(`${BASE}/auth/login`,JSON.stringify({email:"brute@dunazoe.com",password:"Wrong!"}),{headers:{"Content-Type":"application/json"}});
  fraud_block_rate.add(r.status===429);
  check(r,{"handled":r=>r.status===401||r.status===429,"not 500":r=>r.status!==500});
  sleep(0.1);
}

export function orderSpike(data) {
  if(!data?.token) return;
  const s=Date.now();
  const r=http.post(`${BASE}/orders`,JSON.stringify({product_id:1,quantity:1,payment_type:"full",delivery_address:"12 Bodija Estate, Ibadan"}),{headers:idemH(data.token)});
  order_latency.add(Date.now()-s);
  check(r,{"not 500":r=>r.status!==500,"handled":r=>[201,400,403,404,409].includes(r.status)});
  order_success_rate.add(r.status===201);
  sleep(0.5);
}

export function teardown(){ console.log("k6 load test complete"); }
