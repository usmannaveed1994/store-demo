import { connection, type NextRequest } from "next/server";

import { cartJson, errorJson, readJsonBody, type CartApiResponse } from "@/lib/cart/http";
import { resolveCart } from "@/lib/cart/identity";
import { isUuid, MAX_ITEM_QUANTITY, parseQuantity } from "@/lib/cart/validation";
import { removeCartItem, setCartItemQuantity } from "@/lib/db/queries/carts";

type CartItemRouteContext = RouteContext<"/api/cart/items/[productId]">;

/** Sets the quantity of one line. `0` removes it, which is what the − button sends at one unit. */
export async function PATCH(
  request: NextRequest,
  context: CartItemRouteContext,
): Promise<CartApiResponse> {
  await connection();

  const { productId } = await context.params;

  if (!isUuid(productId)) {
    return errorJson("A valid product id is required.", 400);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return errorJson("Expected a JSON object body.", 400);
  }

  const quantity = parseQuantity(body.quantity);

  if (quantity === null || quantity < 0 || quantity > MAX_ITEM_QUANTITY) {
    return errorJson(`Quantity must be a whole number between 0 and ${MAX_ITEM_QUANTITY}.`, 400);
  }

  const { cartId } = await resolveCart({ create: false });

  if (!cartId) {
    return errorJson("There is no cart to update.", 404);
  }

  const result = await setCartItemQuantity({ cartId, productId, quantity });

  return result.ok ? cartJson(result.cart) : errorJson(result.message, result.status);
}

export async function DELETE(
  _request: NextRequest,
  context: CartItemRouteContext,
): Promise<CartApiResponse> {
  await connection();

  const { productId } = await context.params;

  if (!isUuid(productId)) {
    return errorJson("A valid product id is required.", 400);
  }

  const { cartId } = await resolveCart({ create: false });

  if (!cartId) {
    return errorJson("There is no cart to update.", 404);
  }

  const result = await removeCartItem({ cartId, productId });

  return result.ok ? cartJson(result.cart) : errorJson(result.message, result.status);
}
