const test = require("node:test");
const assert = require("node:assert");
const { applyDiscount } = require("../src/discount");

test("TEN takes 10% off", () => {
  assert.strictEqual(applyDiscount(10000, "TEN"), 9000);
  assert.strictEqual(applyDiscount(2499, "TEN"), 2249);
});

test("TEN rounds the discount half away from zero to the cent, like percentOf", () => {
  assert.strictEqual(applyDiscount(1004, "TEN"), 904); // 100.4 off, taken as 100
  assert.strictEqual(applyDiscount(1005, "TEN"), 904); // 100.5 off, taken as 101
  assert.strictEqual(applyDiscount(1006, "TEN"), 905); // 100.6 off, taken as 101
});

test("FIFTY takes 5000 cents off", () => {
  assert.strictEqual(applyDiscount(12000, "FIFTY"), 7000);
  assert.strictEqual(applyDiscount(5001, "FIFTY"), 1);
});

test("the result never goes below zero", () => {
  assert.strictEqual(applyDiscount(5000, "FIFTY"), 0);
  assert.strictEqual(applyDiscount(4999, "FIFTY"), 0);
  assert.strictEqual(applyDiscount(100, "FIFTY"), 0);
  assert.strictEqual(applyDiscount(0, "FIFTY"), 0);
  assert.strictEqual(applyDiscount(0, "TEN"), 0);
  assert.strictEqual(applyDiscount(1, "TEN"), 1);
});

test("for every whole-cent amount the result is a whole number from 0 up to the amount", () => {
  for (let net = 0; net <= 20000; net++) {
    for (const code of ["TEN", "FIFTY"]) {
      const result = applyDiscount(net, code);
      assert.ok(Number.isInteger(result) && result >= 0 && result <= net, `${code} on ${net} gave ${result}`);
    }
  }
});

test("TEN is always within half a cent of exactly 10% off", () => {
  for (let net = 0; net <= 20000; net++) {
    const result = applyDiscount(net, "TEN");
    // |result - 0.9 * net| <= 0.5, written in whole numbers so there is no floating point in the check
    assert.ok(Math.abs(result * 10 - net * 9) <= 5, `TEN on ${net} gave ${result}`);
  }
});

test("an unknown code throws a RangeError", () => {
  const unknown = ["BOGUS", "", "ten", "Ten", " TEN", "FIFTY ", "constructor", "toString", "__proto__", undefined, null, 10, {}];
  for (const code of unknown) {
    assert.throws(() => applyDiscount(10000, code), RangeError, `${String(code)} should be an unknown code`);
  }
});

test("the RangeError names the unknown code", () => {
  assert.throws(() => applyDiscount(10000, "BOGUS"), { name: "RangeError", message: /BOGUS/ });
});

test("an amount that is not whole cents is refused", () => {
  assert.throws(() => applyDiscount(10.5, "TEN"), TypeError);
  assert.throws(() => applyDiscount(NaN, "FIFTY"), TypeError);
  assert.throws(() => applyDiscount("1000", "TEN"), TypeError);
  assert.throws(() => applyDiscount(undefined, "TEN"), TypeError);
});
