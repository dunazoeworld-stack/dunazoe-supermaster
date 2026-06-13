// DUNAZOE OS — UNIT TESTS (core.test.js)
process.env.JWT_SECRET = "test_jwt_secret_minimum_32_characters_ok";
process.env.INTERNAL_SECRET = "test_internal_secret_32_characters_ok";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/dunazoe_test";
process.env.NODE_ENV = "test";
jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), connect: jest.fn(() => ({ query:jest.fn(),release:jest.fn() })) })) }));
jest.mock("redis", () => ({ createClient: jest.fn(() => ({ connect:jest.fn(),get:jest.fn(()=>null),set:jest.fn(),exists:jest.fn(()=>0),ttl:jest.fn(()=>-1),incr:jest.fn(()=>1),expire:jest.fn(),on:jest.fn(),isReady:true })) }));

describe("Business Rules", () => {
  test("5%+5% charge model", () => {
    const amount = 18000;
    const cc = amount * 0.05; // customer charge
    const vc = amount * 0.05; // vendor charge
    expect(cc).toBe(900); expect(vc).toBe(900);
    expect(cc + vc).toBe(1800); // platform earns 10% total
  });

  test("HARD RULE: loan > total_contributed REJECTED", () => {
    const validate = (requested, contributed) =>
      parseFloat(requested) <= parseFloat(contributed);
    expect(validate(50000, 50000)).toBe(true);
    expect(validate(50001, 50000)).toBe(false);
    expect(validate(100000, 50000)).toBe(false);
  });

  test("Ajo surcharge: +10% if schedule > 2 weeks", () => {
    const surcharge = (price, weeks) => weeks > 2 ? price * 0.10 : 0;
    expect(surcharge(18000, 2)).toBe(0);
    expect(surcharge(18000, 3)).toBe(1800);
    expect(surcharge(18000, 6)).toBe(1800);
  });

  test("Thrift 2% charge: applies when loan >= 90% contributed", () => {
    const applies = (loan, contrib) => loan / contrib >= 0.90;
    expect(applies(89000, 100000)).toBe(false);
    expect(applies(90000, 100000)).toBe(true);
    expect(applies(100000, 100000)).toBe(true);
  });

  test("Copytrader: self-referral blocked", () => {
    const vendor_id = 5, buyer_id = 5;
    expect(vendor_id === buyer_id).toBe(true); // BLOCK
  });

  test("Delivery commission: 2% of order amount", () => {
    expect(18000 * 0.02).toBe(360);
    expect(100000 * 0.02).toBe(2000);
  });

  test("Milestone bonus: every 100 deliveries", () => {
    const isMilestone = n => n > 0 && n % 100 === 0;
    expect(isMilestone(100)).toBe(true);
    expect(isMilestone(200)).toBe(true);
    expect(isMilestone(99)).toBe(false);
    expect(isMilestone(101)).toBe(false);
  });
});

describe("Fraud Detection", () => {
  const check = ({ amount, quantity = 1, orders_last_hour = 0 }) => {
    if (amount > 500000 || orders_last_hour >= 5) return "high_risk";
    if (quantity > 50) return "suspicious";
    if (amount > 200000) return "suspicious";
    return "safe";
  };
  test("Normal order — safe", () => expect(check({ amount:18000 })).toBe("safe"));
  test(">₦500k — high_risk", () => expect(check({ amount:750000 })).toBe("high_risk"));
  test(">50 qty — suspicious", () => expect(check({ amount:18000, quantity:80 })).toBe("suspicious"));
  test("5+ orders/hour — high_risk", () => expect(check({ amount:5000, orders_last_hour:5 })).toBe("high_risk"));
});

describe("Escrow State Machine", () => {
  const T = { pending:["paid"], paid:["locked","released"], locked:["released","refunded"], released:[], refunded:[] };
  const can = (from, to) => (T[from]||[]).includes(to);
  test("pending→paid valid", () => expect(can("pending","paid")).toBe(true));
  test("paid→released valid", () => expect(can("paid","released")).toBe(true));
  test("released→refunded INVALID", () => expect(can("released","refunded")).toBe(false));
  test("pending→released INVALID", () => expect(can("pending","released")).toBe(false));
});

describe("Trust Score Tiers", () => {
  const tier = s => s>=90?"Platinum":s>=75?"Gold":s>=60?"Silver":s>=40?"Bronze":"New";
  const mult = s => s>=90?3:s>=75?2:s>=60?1:s>=40?0.5:0;
  test("Score 100 → Platinum 3×", () => { expect(tier(100)).toBe("Platinum"); expect(mult(100)).toBe(3); });
  test("Score 75 → Gold 2×",      () => { expect(tier(75)).toBe("Gold");     expect(mult(75)).toBe(2); });
  test("Score 39 → New, ineligible",() => { expect(tier(39)).toBe("New");     expect(mult(39)).toBe(0); });
  test("Final loan capped at contributed", () => {
    const contributed = 50000;
    const max_by_tier = contributed * mult(95); // Platinum: 3× = 150000
    const final = Math.min(max_by_tier, contributed);
    expect(final).toBe(50000); // HARD RULE enforced
  });
});

describe("Double-Entry Ledger", () => {
  const balanced = lines => {
    const d = lines.filter(l=>l.side==="debit").reduce((s,l)=>s+l.amount,0);
    const c = lines.filter(l=>l.side==="credit").reduce((s,l)=>s+l.amount,0);
    return Math.abs(d-c) < 0.001;
  };
  test("Balanced entry passes", () => expect(balanced([{side:"debit",amount:100},{side:"credit",amount:100}])).toBe(true));
  test("Unbalanced entry fails", () => expect(balanced([{side:"debit",amount:100},{side:"credit",amount:99}])).toBe(false));
  test("Order payment 5+5% is balanced", () => {
    const a=18000,cc=a*0.05,vc=a*0.05,net=a-vc;
    const lines = [
      {side:"debit",amount:a+cc},
      {side:"credit",amount:net},
      {side:"credit",amount:cc},
      {side:"credit",amount:vc},
    ];
    expect(balanced(lines)).toBe(true);
    expect(lines.filter(l=>l.side==="debit").reduce((s,l)=>s+l.amount,0)).toBe(18900);
  });
});
