const { inspect } = require("node:util");
const { percentOf } = require("./money");

// The discount codes. Each one gives the cents it takes off a net amount. This is a Map so that
// only the codes listed here exist (a plain object would also answer to "constructor", "toString", ...).
const DISCOUNTS = new Map([
  ["TEN", (netCents) => percentOf(netCents, 10)],
  ["FIFTY", () => 5000],
]);

// `netCents` with the discount `code` applied, never below zero. Codes are matched exactly.
// The 10% is rounded to the cent like any other rate (see percentOf). An unknown code throws a RangeError.
function applyDiscount(netCents, code) {
  const centsOff = DISCOUNTS.get(code);
  if (!centsOff) throw new RangeError(`unknown discount code: ${inspect(code)}`);
  if (!Number.isInteger(netCents)) throw new TypeError("netCents must be an integer");
  return Math.max(0, netCents - centsOff(netCents));
}

module.exports = { applyDiscount };
