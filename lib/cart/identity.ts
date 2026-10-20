import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import {
  createCart,
  findCartByGuestToken,
  findCartByUserId,
  mergeGuestCart,
} from "@/lib/db/queries/carts";
import { getUserByClerkId } from "@/lib/db/queries/users";
import { getCurrentDatabaseUser } from "@/lib/users/sync-user";

/** HttpOnly so browser scripts cannot read or forge another visitor's cart id. */
export const CART_COOKIE_NAME = "store_demo_cart";

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type ResolvedCart = {
  cartId: string | null;
  guestToken: string | null;
};

function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  };
}

/**
 * The local `users.id` for the Clerk session.
 *
 * `auth()` reads the session token, so the common path costs no extra Clerk API
 * call. The mirror row can still be missing when the webhook has not landed yet,
 * which is what the `currentUser()` fallback covers.
 */
async function resolveUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const user = await getUserByClerkId(clerkUserId);

  if (user) {
    return user.id;
  }

  const synced = await getCurrentDatabaseUser();

  return synced?.id ?? null;
}

/**
 * Finds — and with `create`, mints — the cart for the current caller.
 *
 * Route Handlers only: it writes the guest cookie, and cookies cannot be set
 * while a page is rendering. A signed-in visitor with a guest cookie is merged
 * here, so the merge happens on the first cart request after signing in even if
 * the visitor never presses "Add to cart" again.
 */
export async function resolveCart({ create }: { create: boolean }): Promise<ResolvedCart> {
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value ?? null;
  const userId = await resolveUserId();

  if (userId) {
    let cart = await findCartByUserId(userId);

    if (!cart && create) {
      cart = await createCart({ userId });
    }

    if (guestToken) {
      cart = (await mergeGuestCart({ userId, guestToken })) ?? cart;
      cookieStore.delete(CART_COOKIE_NAME);
    }

    return { cartId: cart?.id ?? null, guestToken: null };
  }

  if (guestToken) {
    const existing = await findCartByGuestToken(guestToken);

    if (existing) {
      return { cartId: existing.id, guestToken };
    }
  }

  if (!create) {
    return { cartId: null, guestToken };
  }

  const token = crypto.randomUUID();
  const cart = await createCart({ guestToken: token });
  cookieStore.set(CART_COOKIE_NAME, token, cartCookieOptions());

  return { cartId: cart.id, guestToken: token };
}
