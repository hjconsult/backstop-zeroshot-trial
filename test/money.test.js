const test = require("node:test");
const assert = require("node:assert");
const { formatCents, percentOf } = require("../src/money");

test("formatCents prints whole cents with two decimals", () => {
  assert.strictEqual(formatCents(123456), "1234.56");
  assert.strictEqual(formatCents(5), "0.05");
  assert.strictEqual(formatCents(-250), "-2.50");
});

test("formatCents refuses fractions of a cent", () => {
  assert.throws(() => formatCents(10.5), TypeError);
});

test("percentOf rounds half away from zero to the cent", () => {
  assert.strictEqual(percentOf(10, 25), 3);
  assert.strictEqual(percentOf(-10, 25), -3);
  assert.strictEqual(percentOf(199, 25), 50);
});
