import "server-only";

import Stripe from "stripe";

type StripeGlobals = typeof globalThis & {
  __storeDemoStripe?: Stripe;
};

const globalForStripe = globalThis as StripeGlobals;

/**
 * Lazily built Stripe client.
 *
 * Built on first use rather than at import time so `next build` can evaluate
 * modules without `STRIPE_SECRET_KEY`, and cached on `globalThis` so dev-mode
 * hot reloads keep a single client instead of leaking one per edit.
 */
export function getStripe(): Stripe {
  if (globalForStripe.__storeDemoStripe) {
    return globalForStripe.__storeDemoStripe;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local — see .env.example.",
    );
  }

  const client = new Stripe(secretKey);
  globalForStripe.__storeDemoStripe = client;

  return client;
}
