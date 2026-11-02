import { fromCents, toCents } from "@/lib/money";

import { SHIPPING_FLAT_RATE_CENTS } from "./config";

/** Order totals, already shaped like the `numeric(10, 2)` columns they become. */
export type CheckoutTotals = {
  subtotal: string;
  shipping: string;
  total: string;
};

/**
 * Turns the cart's subtotal into what the order and Stripe will charge.
 *
 * The cart is the single source of the subtotal, so this function is the only
 * place shipping is added — the order row and the hosted session cannot drift.
 */
export function getCheckoutTotals(subtotal: string): CheckoutTotals {
  const subtotalCents = toCents(subtotal);

  return {
    subtotal: fromCents(subtotalCents),
    shipping: fromCents(SHIPPING_FLAT_RATE_CENTS),
    total: fromCents(subtotalCents + SHIPPING_FLAT_RATE_CENTS),
  };
}
