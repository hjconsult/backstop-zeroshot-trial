const { applyDiscount } = require("./discount");
const { percentOf } = require("./money");

// One line of an invoice: quantity times unit price, in cents.
function lineTotal({ quantity, unitCents }) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError("quantity must be a whole number, 0 or more");
  return quantity * unitCents;
}

// The invoice's total before tax, and the tax on it at `taxPercent`.
//
// `code` is an optional discount code (see applyDiscount). The discount comes off the total of the lines
// before tax, so `net` is the amount after the discount and the tax is worked out on that. Leave `code`
// out (undefined) for no discount. Anything else must be a known code, or applyDiscount's RangeError is thrown.
function invoiceTotals(lines, taxPercent = 25, code) {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const net = code === undefined ? subtotal : applyDiscount(subtotal, code);
  const tax = percentOf(net, taxPercent);
  return { net, tax, gross: net + tax };
}

module.exports = { lineTotal, invoiceTotals };
