import { connection, NextResponse, type NextRequest } from "next/server";

import { resolveCart } from "@/lib/cart/identity";
import type {
  CheckoutErrorResponse,
  CheckoutFieldErrors,
  CheckoutResponse,
} from "@/lib/checkout/dto";
import { getCheckoutTotals } from "@/lib/checkout/pricing";
import { createCheckoutSession, resolveAppUrl } from "@/lib/checkout/session";
import { parseShippingDetails } from "@/lib/checkout/validation";
import { getCartDto } from "@/lib/db/queries/carts";
import { createPendingOrder, failPendingOrder } from "@/lib/db/queries/orders";
import { readJsonBody } from "@/lib/http";
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
 * Turns the cart into an order and opens Stripe Checkout.
 *
 * Everything chargeable is re-derived here — products, prices, stock and
 * currency — because the request body only carries the shopper's address. The
 * response is a bare URL: the client redirects, and the confirmation is decided
 * later by the webhook (or the success page).
 */
export async function POST(request: NextRequest): Promise<CheckoutApiResponse> {
  await connection();

  const body = await readJsonBody(request);

  if (!body) {
    return errorJson("Expected a JSON object body.", 400);
  }

  const shipping = parseShippingDetails(body);

  if (!shipping.ok) {
    return errorJson("Check your delivery details.", 400, shipping.fieldErrors);
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

  const order = await createPendingOrder({ cart, shipping: shipping.value, userId });

  try {
    const session = await createCheckoutSession({
      order,
      appUrl: resolveAppUrl(request.nextUrl.origin),
    });

    return NextResponse.json<CheckoutResponse>({ url: session.url });
  } catch (error) {
    console.error(`[checkout] Could not open a Stripe session for order ${order.order.id}.`, error);

    await failPendingOrder(order.order.id);

    return errorJson("We could not start the payment. Please try again.", 502);
  }
}
