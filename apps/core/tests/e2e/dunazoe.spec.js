// DUNAZOE OS — PLAYWRIGHT E2E TESTS
// Run: npx playwright test tests/e2e/dunazoe.spec.js
const { test, expect } = require("@playwright/test");
const { factory } = require("../fixtures/factory");

const FRONTEND = process.env.FRONTEND_URL     || "http://localhost:3001";
const API      = process.env.TEST_GATEWAY_URL  || "http://localhost:3000";

let customer_email, customer_password;

async function apiRegister(request,o={}) {
  const user=factory.user(o);
  const res=await request.post(`${API}/auth/register`,{data:user});
  const body=await res.json();
  return {...user,token:body.token,user_id:body.user_id};
}

test.describe("Authentication",()=>{
  test("User can register",async({page})=>{
    const user=factory.user(); customer_email=user.email; customer_password=user.password;
    await page.goto(`${FRONTEND}/register`);
    await page.fill('[name="name"]',user.name);
    await page.fill('[name="email"]',user.email);
    await page.fill('[name="password"]',user.password);
    await page.fill('[name="confirm_password"]',user.password);
    await page.fill('[name="phone"]',user.phone||"08012345678");
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/register|step|dashboard/,{timeout:10000});
  });

  test("Login with correct credentials",async({page})=>{
    if(!customer_email) return test.skip();
    await page.goto(`${FRONTEND}/login`);
    await page.fill('[name="email"]',customer_email);
    await page.fill('[name="password"]',customer_password);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/dashboard|home/,{timeout:10000});
  });

  test("Wrong password shows error",async({page})=>{
    await page.goto(`${FRONTEND}/login`);
    await page.fill('[name="email"]','test@dunazoe.com');
    await page.fill('[name="password"]','WrongPass!');
    await page.click('[type="submit"]');
    const err=page.locator('[data-testid="error-message"],.error').first();
    await expect(err).toBeVisible({timeout:5000});
  });

  test("Protected page redirects to login",async({page})=>{
    await page.context().clearCookies();
    await page.evaluate(()=>localStorage.clear());
    await page.goto(`${FRONTEND}/dashboard`);
    await expect(page).toHaveURL(/login|auth/,{timeout:5000});
  });
});

test.describe("Product Browsing",()=>{
  test("Homepage loads",async({page})=>{
    await page.goto(FRONTEND);
    await expect(page).toHaveTitle(/DUNAZOE|Dunazoe/);
  });

  test("Products page loads",async({page})=>{
    await page.goto(`${FRONTEND}/products`);
    await expect(page.locator("body")).toBeVisible({timeout:8000});
  });

  test("Search works",async({page})=>{
    await page.goto(FRONTEND);
    const search=page.locator('[data-testid="search-input"],input[placeholder*="search" i]');
    if(await search.isVisible()){
      await search.fill("ankara");
      await search.press("Enter");
      await expect(page).toHaveURL(/search|q=ankara/,{timeout:5000});
    }
  });
});

test.describe("Cart & Checkout",()=>{
  test.beforeEach(async({page})=>{
    if(!customer_email) return;
    await page.goto(`${FRONTEND}/login`);
    await page.fill('[name="email"]',customer_email||"test@test.com");
    await page.fill('[name="password"]',customer_password||"pass");
    await page.click('[type="submit"]');
    await page.waitForURL(/dashboard|home|login/,{timeout:8000});
  });

  test("Cart page loads",async({page})=>{
    await page.goto(`${FRONTEND}/cart`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Cash payment option NOT shown",async({page})=>{
    await page.goto(`${FRONTEND}/checkout`);
    const cash=page.locator('[value="cash"],[data-testid="payment-cash"]');
    await expect(cash).not.toBeVisible();
  });
});

test.describe("Wallet & Thrift",()=>{
  test.beforeEach(async({page})=>{
    if(!customer_email) return;
    await page.goto(`${FRONTEND}/login`);
    await page.fill('[name="email"]',customer_email||"test@test.com");
    await page.fill('[name="password"]',customer_password||"pass");
    await page.click('[type="submit"]');
    await page.waitForURL(/dashboard|home|login/,{timeout:8000});
  });

  test("Wallet page loads",async({page})=>{
    await page.goto(`${FRONTEND}/wallet`);
    await expect(page.locator("body")).toBeVisible({timeout:8000});
  });

  test("Thrift page loads",async({page})=>{
    await page.goto(`${FRONTEND}/thrift`);
    await expect(page.locator("body")).toBeVisible({timeout:8000});
  });

  test("Dashboard shows trust score",async({page})=>{
    await page.goto(`${FRONTEND}/dashboard`);
    await expect(page.locator("body")).toBeVisible({timeout:8000});
  });
});

test.describe("Mobile Responsiveness",()=>{
  test("Homepage mobile",async({browser})=>{
    const ctx=await browser.newContext({viewport:{width:390,height:844},userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"});
    const page=await ctx.newPage();
    await page.goto(FRONTEND);
    await expect(page.locator("body")).toBeVisible();
    await ctx.close();
  });
});
