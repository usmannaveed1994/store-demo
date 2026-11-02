/**
 * Flat shipping charged on every order, in whole cents. `0` means free shipping.
 *
 * Isolated here so a real rate — or Stripe Tax / shipping rates — only has to
 * change this value and `lib/checkout/session.ts`, not every total calculation.
 */
export const SHIPPING_FLAT_RATE_CENTS = 0;
