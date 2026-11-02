import "server-only";

import type Stripe from "stripe";

import {
  attachCheckoutSession,
  findOrderByCheckoutSessionId,
  markOrderClosed,
  markOrderPaid,
  type OrderWithItems,
} from "@/lib/db/queries/orders";
import { toCents } from "@/lib/money";
import { getStripe } from "@/lib/payments/stripe";

import { SHIPPING_FLAT_RATE_CENTS } from "./config";

export type CheckoutSessionResult = {
  sessionId: string;
  url: string;
};

/**
 * Absolute origin for Stripe's return links.
 *
 * `APP_URL` wins when set (tunnels, previews), otherwise the request's own
 * origin is used, which is correct for localhost and single-domain deploys.
 */
export function resolveAppUrl(origin: string): string {
  const configured = process.env.APP_URL?.trim();

  return (configured && configured.length > 0 ? configured : origin).replace(/\/+$/, "");
}

/**
 * Opens a hosted Stripe Checkout session for an existing order.
 *
 * Line items are rebuilt from the order snapshots, never from client input, and
 * the idempotency key ties the call to the order so a double-submit reuses the
 * same session instead of creating a second chargeable one.
 */
export async function createCheckoutSession({
  order,
  appUrl,
}: {
  order: OrderWithItems;
  appUrl: string;
}): Promise<CheckoutSessionResult> {
  const currency = order.order.currency.toLowerCase();

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: order.order.customerEmail,
      client_reference_id: order.order.id,
      metadata: { orderId: order.order.id, orderNumber: order.order.orderNumber },
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: toCents(item.unitPrice),
          product_data: { name: item.productTitle },
        },
      })),
      // Only send a shipping rate when shipping is actually charged; a zero
      // amount here would make Stripe's total disagree with the order row.
      shipping_options:
        SHIPPING_FLAT_RATE_CENTS > 0
          ? [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  display_name: "Standard shipping",
                  fixed_amount: { amount: SHIPPING_FLAT_RATE_CENTS, currency },
                },
              },
            ]
          : undefined,
      // Stripe appends the real session id, so the page never has to trust a
      // hand-crafted `?session_id=`.
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
      billing_address_collection: "auto",
    },
    { idempotencyKey: `checkout-session:${order.order.id}` },
  );

  if (!session.url) {
    throw new Error("Stripe returned a checkout session without a redirect URL.");
  }

  await attachCheckoutSession({ orderId: order.order.id, sessionId: session.id });

  return { sessionId: session.id, url: session.url };
}

function paymentIntentIdFrom(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}

/** Fulfils a session object the webhook already verified. */
export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<OrderWithItems | null> {
  if (session.payment_status !== "paid") {
    return null;
  }

  // Repairs the narrow window where Stripe created the session but this app
  // crashed before storing its id: the order is recoverable from the metadata.
  if (session.metadata?.orderId) {
    await attachCheckoutSession({ orderId: session.metadata.orderId, sessionId: session.id });
  }

  const result = await markOrderPaid({
    sessionId: session.id,
    paymentIntentId: paymentIntentIdFrom(session),
  });

  return result?.order ?? null;
}

async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  try {
    return await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    // A forged or stale id must not 500 the success page.
    console.warn(`[checkout] Could not retrieve Stripe session ${sessionId}.`, error);

    return null;
  }
}

/**
 * Success-page fulfilment.
 *
 * The webhook is authoritative, but it can lag the redirect by a second, so the
 * page asks Stripe directly instead of trusting the query string. Re-running
 * this is safe: `markOrderPaid` only transitions pending orders.
 */
export async function verifyAndFulfilSession(sessionId: string): Promise<OrderWithItems | null> {
  const session = await retrieveSession(sessionId);

  if (!session) {
    // Stripe unreachable: an order the webhook already fulfilled is still shown
    // as paid, instead of being reported as awaiting confirmation.
    const order = await findOrderByCheckoutSessionId(sessionId);

    return order?.order.status === "paid" ? order : null;
  }

  return fulfilCheckoutSession(session);
}

export type CancelSessionResult = "paid" | "cancelled" | "expired" | "unknown";

/**
 * Records an abandoned checkout.
 *
 * If the shopper actually paid and was bounced to the cancel URL anyway, the
 * caller redirects to the confirmation instead of closing a paid order.
 */
export async function cancelPendingSession(sessionId: string): Promise<CancelSessionResult> {
  const session = await retrieveSession(sessionId);

  if (!session) {
    return "unknown";
  }

  if (session.status === "complete" && session.payment_status === "paid") {
    return "paid";
  }

  const status = session.status === "expired" ? "expired" : "cancelled";
  await markOrderClosed({ sessionId, status });

  return status;
}
