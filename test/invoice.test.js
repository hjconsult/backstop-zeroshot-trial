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
