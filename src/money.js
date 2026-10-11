// Money is kept in whole cents. formatCents is what every printed amount goes through.
function formatCents(cents) {
  if (!Number.isInteger(cents)) throw new TypeError("cents must be an integer");
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// A rate applied to an amount, rounded half away from zero to the cent.
function percentOf(cents, percent) {
  const raw = (cents * percent) / 100;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

module.exports = { formatCents, percentOf };
