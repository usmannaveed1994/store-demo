import { isCartResponse, type CartDto } from "./dto";

/** Shared by the query and every mutation that writes the result back. */
export const CART_QUERY_KEY = ["cart"] as const;

const JSON_HEADERS = { "content-type": "application/json" } as const;

function errorMessageFrom(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return null;
  }

  return typeof payload.error === "string" ? payload.error : null;
}

/**
 * Calls a cart endpoint and returns the refreshed cart.
 *
 * Mutations answer with the whole cart, so the caller can write it straight into
 * the query cache instead of following up with a second request.
 */
async function requestCart(input: string, init?: RequestInit): Promise<CartDto> {
  const response = await fetch(input, init);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessageFrom(payload) ?? `The cart request failed (${response.status}).`);
  }

  if (!isCartResponse(payload)) {
    throw new Error("The cart response was not in the expected shape.");
  }

  return payload.cart;
}

export const cartApi = {
  get: () => requestCart("/api/cart", { cache: "no-store" }),

  addItem: (productId: string, quantity = 1) =>
    requestCart("/api/cart/items", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ productId, quantity }),
    }),

  setQuantity: (productId: string, quantity: number) =>
    requestCart(`/api/cart/items/${productId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ quantity }),
    }),

  removeItem: (productId: string) =>
    requestCart(`/api/cart/items/${productId}`, { method: "DELETE" }),

  clear: () => requestCart("/api/cart", { method: "DELETE" }),
};
