/**
 * Money arithmetic shared by the cart, the checkout and Stripe.
 *
 * Prices come out of `numeric(10, 2)` columns as decimal strings. Summing those
 * as floats drifts (0.1 + 0.2), and Stripe expects whole cents, so every total
 * is computed in integer cents and formatted back at the edge.
 */

/** Parses a decimal string into whole cents; malformed input counts as zero. */
export function toCents(amount: string): number {
  const value = Number(amount);

  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Formats whole cents as the `numeric(10, 2)` shape the database stores. */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
