const test = require("node:test");
const assert = require("node:assert");
const { lineTotal, invoiceTotals } = require("../src/invoice");

test("lineTotal multiplies quantity by unit price", () => {
  assert.strictEqual(lineTotal({ quantity: 3, unitCents: 1250 }), 3750);
});

test("lineTotal refuses a negative or fractional quantity", () => {
  assert.throws(() => lineTotal({ quantity: -1, unitCents: 100 }), RangeError);
  assert.throws(() => lineTotal({ quantity: 1.5, unitCents: 100 }), RangeError);
});

test("invoiceTotals adds the lines and 25% tax by default", () => {
  assert.deepStrictEqual(invoiceTotals([{ quantity: 2, unitCents: 1000 }, { quantity: 1, unitCents: 499 }]), { net: 2499, tax: 625, gross: 3124 });
});

// Two invoices the discount tests below reuse.
const smallInvoice = [{ quantity: 2, unitCents: 1000 }, { quantity: 1, unitCents: 499 }]; // 2499 before any discount
const bigInvoice = [{ quantity: 10, unitCents: 1250 }]; // 12500 before any discount

test("invoiceTotals without a code gives the same totals as before", () => {
  assert.deepStrictEqual(invoiceTotals(smallInvoice, 25, undefined), { net: 2499, tax: 625, gross: 3124 });
  assert.deepStrictEqual(invoiceTotals(smallInvoice, 25, undefined), invoiceTotals(smallInvoice));
  assert.deepStrictEqual(invoiceTotals(smallInvoice, 10), { net: 2499, tax: 250, gross: 2749 });
});

test("invoiceTotals takes TEN off the net before tax", () => {
  // 12500 less 10% is 11250. Tax is 25% of that: 2812.5, which rounds up to 2813.
  assert.deepStrictEqual(invoiceTotals(bigInvoice, 25, "TEN"), { net: 11250, tax: 2813, gross: 14063 });
  // 2499 less 10% (249.9, taken as 250) is 2249. Tax is 25% of that: 562.25, which rounds to 562.
  assert.deepStrictEqual(invoiceTotals(smallInvoice, 25, "TEN"), { net: 2249, tax: 562, gross: 2811 });
});

test("invoiceTotals takes FIFTY off the net before tax", () => {
  // 12500 less 5000 is 7500, and the tax is 25% of that. Taking 5000 off the gross instead would leave 10625, not 9375.
  assert.deepStrictEqual(invoiceTotals(bigInvoice, 25, "FIFTY"), { net: 7500, tax: 1875, gross: 9375 });
});

test("invoiceTotals rounds the tax on the discounted net", () => {
  // 5002 less 5000 is 2, and 25% of 2 is 0.5, which rounds up to 1. (25% of 5002 would have been 1251.)
  assert.deepStrictEqual(invoiceTotals([{ quantity: 1, unitCents: 5002 }], 25, "FIFTY"), { net: 2, tax: 1, gross: 3 });
});

test("invoiceTotals never lets a discount take the net below zero", () => {
  assert.deepStrictEqual(invoiceTotals(smallInvoice, 25, "FIFTY"), { net: 0, tax: 0, gross: 0 }); // 2499 less 5000
  assert.deepStrictEqual(invoiceTotals([{ quantity: 1, unitCents: 5000 }], 25, "FIFTY"), { net: 0, tax: 0, gross: 0 });
  assert.deepStrictEqual(invoiceTotals([], 25, "FIFTY"), { net: 0, tax: 0, gross: 0 });
  assert.deepStrictEqual(invoiceTotals([], 25, "TEN"), { net: 0, tax: 0, gross: 0 });
});

test("invoiceTotals takes the discount off the invoice as a whole, not off each line", () => {
  // 4000 + 4000 less 5000 is 3000. FIFTY taken off each line would have left 0.
  const twoLines = [{ quantity: 1, unitCents: 4000 }, { quantity: 1, unitCents: 4000 }];
  assert.deepStrictEqual(invoiceTotals(twoLines, 25, "FIFTY"), { net: 3000, tax: 750, gross: 3750 });
});

test("invoiceTotals applies a code at any tax percent, and at the default one when taxPercent is undefined", () => {
  const tenThousand = [{ quantity: 4, unitCents: 2500 }]; // 10000, which TEN brings down to 9000
  assert.deepStrictEqual(invoiceTotals(tenThousand, 15, "TEN"), { net: 9000, tax: 1350, gross: 10350 });
  assert.deepStrictEqual(invoiceTotals(tenThousand, 0, "TEN"), { net: 9000, tax: 0, gross: 9000 });
  assert.deepStrictEqual(invoiceTotals(tenThousand, undefined, "TEN"), { net: 9000, tax: 2250, gross: 11250 });
});

test("invoiceTotals refuses an unknown code with a RangeError", () => {
  // Only leaving the code out (undefined) means no discount. null and an empty string are not "no code".
  const unknown = ["BOGUS", "ten", " TEN", "FIFTY ", "", null, 10, {}];
  for (const code of unknown) {
    assert.throws(() => invoiceTotals(smallInvoice, 25, code), RangeError, `${String(code)} should be an unknown code`);
  }
  assert.throws(() => invoiceTotals(smallInvoice, 25, "BOGUS"), { name: "RangeError", message: /BOGUS/ });
  // The code is checked even when there is nothing to discount.
  assert.throws(() => invoiceTotals([], 25, "BOGUS"), RangeError);
});

test("invoiceTotals still refuses a bad line when there is a code", () => {
  assert.throws(() => invoiceTotals([{ quantity: -1, unitCents: 100 }], 25, "TEN"), { name: "RangeError", message: /quantity/ });
});

// Whole-number reference for the sweep below. It uses neither percentOf nor applyDiscount, so the check is not
// the code under test run twice. For amounts of 0 or more, rounding half away from zero is rounding half up,
// and n / d rounded half up is Math.floor((2 * n + d) / (2 * d)).
const roundedDiv = (n, d) => Math.floor((2 * n + d) / (2 * d));

test("for every whole-cent amount a code comes off the net first, and the tax is rounded on what is left", () => {
  for (const taxPercent of [0, 12, 15, 25]) {
    for (let cents = 0; cents <= 10000; cents++) {
      const lines = [{ quantity: 1, unitCents: cents }];
      const netAfter = { TEN: cents - roundedDiv(cents * 10, 100), FIFTY: Math.max(0, cents - 5000) };
      for (const code of ["TEN", "FIFTY"]) {
        const net = netAfter[code];
        const tax = roundedDiv(net * taxPercent, 100);
        assert.deepStrictEqual(invoiceTotals(lines, taxPercent, code), { net, tax, gross: net + tax }, `${code} on ${cents} at ${taxPercent}%`);
      }
    }
  }
});
