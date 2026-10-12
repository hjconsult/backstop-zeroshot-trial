const test = require("node:test");
const assert = require("node:assert");
const { roundToKrone, cashGross, formatCashGross } = require("../src/cash");
const { invoiceTotals } = require("../src/invoice");
const { formatCents } = require("../src/money");

test("roundToKrone rounds to the nearest 100 cents", () => {
  assert.strictEqual(roundToKrone(14000), 14000);
  assert.strictEqual(roundToKrone(14001), 14000);
  assert.strictEqual(roundToKrone(14049), 14000);
  assert.strictEqual(roundToKrone(14051), 14100);
  assert.strictEqual(roundToKrone(14099), 14100);
  assert.strictEqual(roundToKrone(14100), 14100);
  assert.strictEqual(roundToKrone(0), 0);
  assert.strictEqual(roundToKrone(1), 0);
  assert.strictEqual(roundToKrone(49), 0);
  assert.strictEqual(roundToKrone(99), 100);
});

test("roundToKrone rounds a half krone up", () => {
  assert.strictEqual(roundToKrone(50), 100);
  assert.strictEqual(roundToKrone(150), 200);
  assert.strictEqual(roundToKrone(14050), 14100);
  assert.strictEqual(roundToKrone(14150), 14200);
});

test("below zero a half krone rounds up too, which is towards zero (not away from it, as percentOf would)", () => {
  assert.strictEqual(roundToKrone(-99), -100);
  assert.strictEqual(roundToKrone(-149), -100);
  assert.strictEqual(roundToKrone(-150), -100); // a half goes up, so -1.50 kroner is -1 and not -2
  assert.strictEqual(roundToKrone(-151), -200);
  assert.strictEqual(roundToKrone(-14049), -14000);
  assert.strictEqual(roundToKrone(-14050), -14000);
  assert.strictEqual(roundToKrone(-14051), -14100);
  assert.strictEqual(roundToKrone(-14100), -14100);
});

test("roundToKrone gives 0, never negative zero, for an amount that rounds to nothing", () => {
  // assert.strictEqual tells 0 and -0 apart
  for (const cents of [-49, -50, -1, -0, 0, 1, 49]) {
    assert.strictEqual(roundToKrone(cents), 0, `${cents} should round to 0`);
  }
});

test("for every whole-cent amount roundToKrone gives the one whole krone within half a krone, a half going up", () => {
  for (let cents = -20000; cents <= 20000; cents++) {
    const result = roundToKrone(cents);
    assert.ok(Number.isInteger(result) && result % 100 === 0, `${cents} gave ${result}, which is not a whole krone`);
    assert.ok(!Object.is(result, -0), `${cents} gave negative zero`);
    // A window of 100 whole cents holds exactly one whole krone, so this pins the answer down without repeating the
    // formula. Up to 50 cents above is allowed (that is a half going up), but not 50 cents below.
    assert.ok(result > cents - 50 && result <= cents + 50, `${cents} gave ${result}`);
  }
});

test("roundToKrone refuses an amount that is not whole cents", () => {
  for (const cents of [10.5, 14049.99, NaN, Infinity, "1000", null, undefined, {}]) {
    assert.throws(() => roundToKrone(cents), TypeError, `${String(cents)} should be refused`);
  }
});

// Two invoices the tests below reuse (the same ones as in invoice.test.js).
const smallInvoice = [{ quantity: 2, unitCents: 1000 }, { quantity: 1, unitCents: 499 }]; // 2499 before tax
const bigInvoice = [{ quantity: 10, unitCents: 1250 }]; // 12500 before tax

test("cashGross is the gross total taken to the nearest krone", () => {
  // 2499 and 625 tax is 3124, which is 24 cents past 31 kroner.
  assert.strictEqual(cashGross(smallInvoice), 3100);
  // 12500 and 3125 tax is 15625, which is 25 cents past 156 kroner.
  assert.strictEqual(cashGross(bigInvoice), 15600);
  // 12500 less 10% is 11250, and its tax is 2812.5, which is taken as 2813. That makes 14063, 63 cents past 140 kroner.
  assert.strictEqual(cashGross(bigInvoice, 25, "TEN"), 14100);
  // 12500 less 5000 is 7500, and its tax is 1875. That makes 9375, 75 cents past 93 kroner.
  assert.strictEqual(cashGross(bigInvoice, 25, "FIFTY"), 9400);
});

test("cashGross rounds a gross that is exactly half a krone up", () => {
  const oneLine = [{ quantity: 1, unitCents: 1240 }];
  assert.deepStrictEqual(invoiceTotals(oneLine), { net: 1240, tax: 310, gross: 1550 }); // the half krone
  assert.strictEqual(cashGross(oneLine), 1600);
  // Without tax the gross is the line itself, so the amounts around a half can be written out.
  const line = (unitCents) => [{ quantity: 1, unitCents }];
  assert.strictEqual(cashGross(line(4949), 0), 4900);
  assert.strictEqual(cashGross(line(4950), 0), 5000);
  assert.strictEqual(cashGross(line(4951), 0), 5000);
});

test("cashGross rounds the gross once, not the net and the tax separately", () => {
  // 1240 net and 310 tax make a gross of 1550, which goes up to 1600. Rounding 1240 (to 1200) and 310 (to 300)
  // first would leave 1500.
  assert.strictEqual(cashGross([{ quantity: 1, unitCents: 1240 }]), 1600);
});

test("cashGross takes the tax percent and the code the way invoiceTotals does", () => {
  assert.strictEqual(cashGross(smallInvoice, 10), 2700); // 2499 and 250 tax is 2749
  assert.strictEqual(cashGross(smallInvoice, 0), 2500); // 2499, a cent short of 25 kroner
  assert.strictEqual(cashGross(smallInvoice, undefined), 3100); // the default 25% again
  assert.strictEqual(cashGross(smallInvoice, 25, "TEN"), 2800); // 2249 and 562 tax is 2811
  const tenThousand = [{ quantity: 4, unitCents: 2500 }]; // 10000, which TEN brings down to 9000
  assert.strictEqual(cashGross(tenThousand, undefined, "TEN"), 11300); // 9000 and 2250 tax is 11250, a half krone
  assert.strictEqual(cashGross(tenThousand, 15, "TEN"), 10400); // 9000 and 1350 tax is 10350, a half krone
  assert.strictEqual(cashGross(tenThousand, 0, "TEN"), 9000);
});

test("cashGross refuses what invoiceTotals refuses", () => {
  for (const code of ["BOGUS", "ten", "", null]) {
    assert.throws(() => cashGross(smallInvoice, 25, code), RangeError, `${String(code)} should be an unknown code`);
  }
  assert.throws(() => cashGross(smallInvoice, 25, "BOGUS"), { name: "RangeError", message: /BOGUS/ });
  assert.throws(() => cashGross([{ quantity: -1, unitCents: 100 }]), { name: "RangeError", message: /quantity/ });
});

test("cashGross is 0 when there is nothing to pay, or less than half a krone", () => {
  assert.strictEqual(cashGross([]), 0);
  assert.strictEqual(cashGross([], 25, "FIFTY"), 0);
  assert.strictEqual(cashGross(smallInvoice, 25, "FIFTY"), 0); // 2499 less 5000
  assert.strictEqual(cashGross([{ quantity: 0, unitCents: -500 }]), 0); // 0 times -500 is negative zero
  // 5002 less 5000 is 2 and the tax on it is 1, so the gross is 3 cents.
  assert.strictEqual(cashGross([{ quantity: 1, unitCents: 5002 }], 25, "FIFTY"), 0);
});

test("cashGross rounds a gross below zero (a credit line) up as well", () => {
  // -1240 net and -310 tax make -1550: half a krone, which goes up to -1500, not away from zero to -1600.
  assert.strictEqual(cashGross([{ quantity: 1, unitCents: -1240 }]), -1500);
  const line = (unitCents) => [{ quantity: 1, unitCents }];
  assert.strictEqual(cashGross(line(-1549), 0), -1500);
  assert.strictEqual(cashGross(line(-1550), 0), -1500);
  assert.strictEqual(cashGross(line(-1551), 0), -1600);
});

test("formatCashGross prints the cash gross with two decimals, through formatCents", () => {
  assert.strictEqual(formatCashGross(smallInvoice), "31.00");
  assert.strictEqual(formatCashGross(bigInvoice), "156.00");
  assert.strictEqual(formatCashGross(bigInvoice, 25, "TEN"), "141.00");
  assert.strictEqual(formatCashGross(bigInvoice, 25, "FIFTY"), "94.00");
  assert.strictEqual(formatCashGross([{ quantity: 1, unitCents: 1240 }]), "16.00"); // 15.50 goes up
  assert.strictEqual(formatCashGross([]), "0.00");
  assert.strictEqual(formatCashGross([{ quantity: 1, unitCents: -1240 }]), "-15.00");
  // The text is what formatCents makes of the rounded amount, and not of the exact gross.
  assert.strictEqual(formatCashGross(smallInvoice, 10, "TEN"), formatCents(cashGross(smallInvoice, 10, "TEN")));
  assert.notStrictEqual(formatCashGross(smallInvoice), formatCents(invoiceTotals(smallInvoice).gross)); // "31.00", not "31.24"
});

// Whole-number references for the sweep below. They use none of roundToKrone, percentOf and applyDiscount, so the
// check is not the code under test run twice. roundedDiv is n / d rounded half up. nearestKrone cuts off what is past
// the last whole krone and adds a krone back if that was 50 cents or more. Both are for amounts of 0 or more.
const roundedDiv = (n, d) => Math.floor((2 * n + d) / (2 * d));
const nearestKrone = (cents) => cents - (cents % 100) + (cents % 100 >= 50 ? 100 : 0);

test("for every whole-cent amount the cash gross is the gross, with any code and tax taken off or on first, to the nearest krone", () => {
  for (const taxPercent of [0, 12, 15, 25]) {
    for (let cents = 0; cents <= 10000; cents++) {
      const lines = [{ quantity: 1, unitCents: cents }];
      const netAfter = { none: cents, TEN: cents - roundedDiv(cents * 10, 100), FIFTY: Math.max(0, cents - 5000) };
      for (const code of [undefined, "TEN", "FIFTY"]) {
        const net = netAfter[code ?? "none"];
        const gross = net + roundedDiv(net * taxPercent, 100);
        const cash = nearestKrone(gross);
        const label = `${code ?? "no code"} on ${cents} at ${taxPercent}%`;
        assert.strictEqual(cashGross(lines, taxPercent, code), cash, label);
        assert.strictEqual(formatCashGross(lines, taxPercent, code), `${cash / 100}.00`, label);
      }
    }
  }
});
