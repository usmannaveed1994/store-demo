import { after, connection, NextResponse, type NextRequest } from "next/server";

import { resolveCart } from "@/lib/cart/identity";
import { ENABLE_STRIPE } from "@/lib/checkout/config";
import type {
  CheckoutErrorResponse,
  CheckoutFieldErrors,
  CheckoutResponse,
} from "@/lib/checkout/dto";
import { getCheckoutTotals } from "@/lib/checkout/pricing";
import { createCheckoutSession, resolveAppUrl } from "@/lib/checkout/session";
import { parseCheckoutRequest } from "@/lib/checkout/validation";
import { getCartDto } from "@/lib/db/queries/carts";
import { createPendingOrder, failPendingOrder, settleManualOrder } from "@/lib/db/queries/orders";
import { readJsonBody } from "@/lib/http";
import {
  flushPosthogLogs,
  logCheckoutRequestValidated,
  logCheckoutSessionCreated,
  logCheckoutSessionCreationFailed,
  logOrderPlaced,
} from "@/lib/posthog-logs";
import { toCents } from "@/lib/money";

type CheckoutApiResponse = NextResponse<CheckoutResponse | CheckoutErrorResponse>;

function errorJson(
  message: string,
  status: number,
  fieldErrors?: CheckoutFieldErrors,
): CheckoutApiResponse {
  return NextResponse.json<CheckoutErrorResponse>({ error: message, fieldErrors }, { status });
}

/**
 * Turns the cart into an order and hands the shopper to the payment step.
 *
 * Everything chargeable is re-derived here — products, prices, stock and
 * currency — because the request body only carries the address and, in the
 * manual flow, the chosen method.
 *
 * With `ENABLE_STRIPE` on, the response is Stripe's hosted URL and the
 * confirmation is decided later by the webhook (or the success page). With it
 * off, the order is settled immediately and the response points at the
 * confirmation page keyed by the order number.
 */
export async function POST(request: NextRequest): Promise<CheckoutApiResponse> {
  await connection();

  const body = await readJsonBody(request);

  if (!body) {
    return errorJson("Expected a JSON object body.", 400);
  }

  const checkout = parseCheckoutRequest(body);

  if (!checkout.ok) {
    return errorJson("Check your checkout details.", 400, checkout.fieldErrors);
  }

  const { cartId, userId } = await resolveCart({ create: false });

  if (!cartId) {
    return errorJson("Your cart is empty.", 409);
  }

  const cart = await getCartDto(cartId);
  const blocked = cart.lines.find((line) => !line.isAvailable);

  if (blocked) {
    return errorJson(
      `${blocked.title} is no longer available. Remove it from your cart to continue.`,
      409,
    );
  }

  if (cart.lines.length === 0 || !cart.subtotal) {
    return errorJson("Your cart is empty.", 409);
  }

  if (new Set(cart.lines.map((line) => line.currency)).size > 1) {
    return errorJson("This cart mixes currencies. Remove one group of items to continue.", 409);
  }

  if (toCents(getCheckoutTotals(cart.subtotal).total) <= 0) {
    return errorJson("There is nothing to charge for this cart.", 409);
  }

  logCheckoutRequestValidated();
  after(flushPosthogLogs);

  const order = await createPendingOrder({
    cart,
    shipping: checkout.value,
    userId,
    paymentMethod: ENABLE_STRIPE ? "card" : checkout.value.paymentMethod,
  });

  if (!ENABLE_STRIPE) {
    // No webhook will ever settle this order, so stock and the cart are cleared
    // now; the admin still confirms the payment by hand once the money arrives.
    await settleManualOrder(order.order.id);
    logOrderPlaced();

    return NextResponse.json<CheckoutResponse>({
      url: `/checkout/success?order=${encodeURIComponent(order.order.orderNumber)}`,
    });
  }

  try {
    const session = await createCheckoutSession({
      order,
      appUrl: resolveAppUrl(request.nextUrl.origin),
    });

    logCheckoutSessionCreated();

    return NextResponse.json<CheckoutResponse>({ url: session.url });
  } catch (error) {
    logCheckoutSessionCreationFailed();
    console.error(`[checkout] Could not open a Stripe session for order ${order.order.id}.`, error);

    await failPendingOrder(order.order.id);

    return errorJson("We could not start the payment. Please try again.", 502);
  }
}
