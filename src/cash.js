const { formatCents } = require("./money");
const { invoiceTotals } = require("./invoice");

// Cash invoices are paid in whole kroner. invoiceTotals keeps its exact cents; only the gross, the amount that
// is asked for in cash, is rounded here.

// `cents` rounded to the nearest whole krone (100 cents), halves up: 14049 -> 14000, 14050 -> 14100, 14051 -> 14100.
// "Up" is towards plus infinity, below zero too: -14050 -> -14000, but -14051 -> -14100. That is not the rule
// percentOf uses (halves away from zero, which would take -14050 to -14100), so percentOf is not used here.
function roundToKrone(cents) {
  if (!Number.isInteger(cents)) throw new TypeError("cents must be an integer");
  // Add half a krone, then cut down to the whole krone at or below that. It has to be Math.floor, not a truncation,
  // so that the cut goes downwards below zero as well.
  return Math.floor((cents + 50) / 100) * 100;
}

// The gross total of an invoice in cents, rounded to the nearest krone for payment in cash. The arguments are the
// ones invoiceTotals takes. The gross (net + tax) is rounded once, as a whole: rounding the net and the tax
// separately and adding them up can end up a krone away from that.
function cashGross(lines, taxPercent, code) {
  return roundToKrone(invoiceTotals(lines, taxPercent, code).gross);
}

// The cash gross as it is printed. Like every printed amount it goes through formatCents, so it has two decimals:
// 14100 cents is "141.00".
function formatCashGross(lines, taxPercent, code) {
  return formatCents(cashGross(lines, taxPercent, code));
}

module.exports = { roundToKrone, cashGross, formatCashGross };
