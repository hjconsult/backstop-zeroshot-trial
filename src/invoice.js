const { percentOf } = require("./money");

// One line of an invoice: quantity times unit price, in cents.
function lineTotal({ quantity, unitCents }) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError("quantity must be a whole number, 0 or more");
  return quantity * unitCents;
}

// The invoice's total before tax, and the tax on it at `taxPercent`.
function invoiceTotals(lines, taxPercent = 25) {
  const net = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const tax = percentOf(net, taxPercent);
  return { net, tax, gross: net + tax };
}

module.exports = { lineTotal, invoiceTotals };
