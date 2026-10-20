/**
 * JSON-safe shape of a cart line.
 *
 * Money stays a string because it comes from `numeric` columns. `lineTotal` is
 * `null` for a line that can no longer be bought, which is also how the UI tells
 * an available line from an unavailable one without re-deriving the rule.
 */
export type CartLineDto = {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  unitPrice: string;
  currency: string;
  quantity: number;
  stock: number;
  isAvailable: boolean;
  lineTotal: string | null;
};

/**
 * A cart as the browser sees it.
 *
 * `itemCount` and `subtotal` only cover lines that can still be bought, so the
 * header badge and the cart page agree with what a checkout could charge.
 */
export type CartDto = {
  id: string | null;
  lines: CartLineDto[];
  itemCount: number;
  subtotal: string | null;
  currency: string | null;
};

/** What a visitor with no cart row gets back — no database write needed. */
export const EMPTY_CART: CartDto = {
  id: null,
  lines: [],
  itemCount: 0,
  subtotal: null,
  currency: null,
};

export type CartResponse = {
  cart: CartDto;
};

/** Narrows a parsed JSON body to the cart contract, mirroring `isProductsResponse`. */
export function isCartResponse(value: unknown): value is CartResponse {
  if (typeof value !== "object" || value === null || !("cart" in value)) {
    return false;
  }

  const cart = value.cart;

  if (typeof cart !== "object" || cart === null) {
    return false;
  }

  if (!("lines" in cart) || !("itemCount" in cart)) {
    return false;
  }

  return Array.isArray(cart.lines) && typeof cart.itemCount === "number";
}
