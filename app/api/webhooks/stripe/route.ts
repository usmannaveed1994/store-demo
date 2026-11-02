import type Stripe from "stripe";
import { connection } from "next/server";

import { fulfilCheckoutSessionWithResult } from "@/lib/checkout/session";
import { markOrderClosed } from "@/lib/db/queries/orders";
import { getUserById } from "@/lib/db/queries/users";
import { getStripe } from "@/lib/payments/stripe";
import { captureServerEvent } from "@/lib/posthog-server";

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * Stripe webhook.
 *
 * The signature is verified against the raw body, so the payload is read as text
 * before any parsing. Fulfilment is idempotent — Stripe retries for up to three
 * days — and a non-2xx here is what makes Stripe retry, so handler errors are
 * logged and returned as 500 rather than swallowed.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return json({ error: "Stripe webhook is not configured." }, 400);
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.warn("[stripe] Webhook signature verification failed.", error);

    return json({ error: "Invalid signature." }, 400);
  }

  try {
    switch (event.type) {
      // `completed` still needs the payment check: delayed methods complete the
      // session before the money arrives, and the async event follows later.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const result = await fulfilCheckoutSessionWithResult(event.data.object);

        // Fulfilment is idempotent, so only the request that transitions the
        // order to paid emits a conversion event.
        if (result?.transitioned) {
          const userId = result.order.order.userId;
          const user = userId ? await getUserById(userId) : undefined;

          await captureServerEvent(
            "checkout_completed",
            {
              order_total: Number(result.order.order.total),
              currency: result.order.order.currency,
              item_count: result.order.items.length,
              item_quantity: result.order.items.reduce((total, item) => total + item.quantity, 0),
            },
            user?.clerkUserId,
          );
        }
        break;
      }

      case "checkout.session.async_payment_failed":
        await markOrderClosed({ sessionId: event.data.object.id, status: "failed" });
        break;

      case "checkout.session.expired":
        await markOrderClosed({ sessionId: event.data.object.id, status: "expired" });
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(`[stripe] Failed to handle ${event.type} (${event.id}).`, error);

    return json({ error: "Webhook handling failed." }, 500);
  }

  return json({ received: true }, 200);
}
