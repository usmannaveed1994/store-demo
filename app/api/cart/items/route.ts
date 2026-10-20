import { connection, type NextRequest } from "next/server";

import { cartJson, errorJson, readJsonBody, type CartApiResponse } from "@/lib/cart/http";
import { resolveCart } from "@/lib/cart/identity";
import { isUuid, MAX_ITEM_QUANTITY, parseQuantity } from "@/lib/cart/validation";
import { addCartItem } from "@/lib/db/queries/carts";

const DEFAULT_QUANTITY = 1;

/**
 * Adds a product to the cart, minting a guest cart and its cookie on first use.
 *
 * Quantity is clamped to stock rather than rejected, so a shopper asking for
 * more than is left still ends up with every available unit.
 */
export async function POST(request: NextRequest): Promise<CartApiResponse> {
  await connection();

  const body = await readJsonBody(request);

  if (!body) {
    return errorJson("Expected a JSON object body.", 400);
  }

  const productId = typeof body.productId === "string" ? body.productId : "";

  if (!isUuid(productId)) {
    return errorJson("A valid productId is required.", 400);
  }

  const quantity = body.quantity === undefined ? DEFAULT_QUANTITY : parseQuantity(body.quantity);

  if (quantity === null || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
    return errorJson(`Quantity must be a whole number between 1 and ${MAX_ITEM_QUANTITY}.`, 400);
  }

  const { cartId } = await resolveCart({ create: true });

  if (!cartId) {
    return errorJson("The cart could not be created.", 500);
  }

  const result = await addCartItem({ cartId, productId, quantity });

  return result.ok ? cartJson(result.cart) : errorJson(result.message, result.status);
}
