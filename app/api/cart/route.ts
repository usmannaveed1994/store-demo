import { connection } from "next/server";

import { EMPTY_CART } from "@/lib/cart/dto";
import { cartJson, type CartApiResponse } from "@/lib/cart/http";
import { resolveCart } from "@/lib/cart/identity";
import { clearCart, getCartDto } from "@/lib/db/queries/carts";

/**
 * Current cart.
 *
 * `create: false` keeps a plain page load from writing rows: a visitor who never
 * added anything simply gets the empty cart back.
 */
export async function GET(): Promise<CartApiResponse> {
  await connection();

  const { cartId } = await resolveCart({ create: false });

  return cartJson(cartId ? await getCartDto(cartId) : EMPTY_CART);
}

/** Empties the cart but keeps the cart row, so a later add reuses the same cookie. */
export async function DELETE(): Promise<CartApiResponse> {
  await connection();

  const { cartId } = await resolveCart({ create: false });

  return cartJson(cartId ? await clearCart(cartId) : EMPTY_CART);
}
