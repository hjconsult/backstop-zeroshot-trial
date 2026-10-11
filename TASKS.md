# Tasks

Do them in order, each as its own change.

**T1 — Discount codes.** Add `applyDiscount(netCents, code)` in
`src/discount.js`. `TEN` takes 10% off, `FIFTY` takes 5000 cents off, and the
result never goes below zero. An unknown code throws a `RangeError`. Add tests.

**T2 — Discounted invoices.** `invoiceTotals(lines, taxPercent, code)` takes an
optional discount code and applies it to the net amount before tax, using
`applyDiscount` from T1. Add tests.

**T3 — Cash rounding.** Cash invoices are paid in whole kroner. Add a way to
get an invoice's gross total rounded to the nearest krone (100 cents, halves
up) and printed. Do not change `test/money.test.js`.
