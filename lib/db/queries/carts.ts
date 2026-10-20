import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { CartDto, CartLineDto } from "@/lib/cart/dto";
import { getDb } from "@/lib/db";
import { cartItems, carts, products, type Cart, type ProductStatus } from "@/lib/db/schema";

/** Only carts in this state are read or written by the storefront. */
const ACTIVE_CART = "active" as const;

/** Result of a cart mutation: the refreshed cart, or why the change was refused. */
export type CartMutationResult =
  | { ok: true; cart: CartDto }
  | { ok: false; status: number; message: string };

/** Columns a cart line is drawn from: the cart row joined to the live product. */
const cartLineColumns = {
  productId: products.id,
  slug: products.slug,
  title: products.title,
  imageUrl: products.imageUrl,
  unitPrice: products.price,
  currency: products.currency,
  stock: products.stock,
  status: products.status,
  deletedAt: products.deletedAt,
  quantity: cartItems.quantity,
};

type CartLineRow = {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  unitPrice: string;
  currency: string;
  stock: number;
  status: ProductStatus;
  deletedAt: Date | null;
  quantity: number;
};


/** Money is exact to two decimals, so arithmetic happens in whole cents. */
function toCents(amount: string): number {
  const value = Number(amount);

  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Maps a joined row to the wire shape.
 *
 * A line stays in the cart when its product is no longer sellable, but it is
 * flagged instead of silently disappearing, and its quantity is capped at the
 * stock still on hand.
 */
function toCartLine(row: CartLineRow): CartLineDto {
  const isAvailable = row.status === "active" && row.deletedAt === null && row.stock > 0;
  const quantity = isAvailable ? Math.min(row.quantity, row.stock) : row.quantity;

  return {
    productId: row.productId,
    slug: row.slug,
    title: row.title,
    imageUrl: row.imageUrl,
    unitPrice: row.unitPrice,
    currency: row.currency,
    quantity,
    stock: row.stock,
    isAvailable,
    lineTotal: isAvailable ? fromCents(toCents(row.unitPrice) * quantity) : null,
  };
}

export async function getCartDto(cartId: string): Promise<CartDto> {
  const rows = await getDb()
    .select(cartLineColumns)
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    // `id` breaks ties between rows inserted in the same statement.
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));

  const lines = rows.map(toCartLine);
  const purchasable = lines.filter((line) => line.isAvailable);
  const subtotalCents = purchasable.reduce(
    (total, line) => total + toCents(line.unitPrice) * line.quantity,
    0,
  );

  return {
    id: cartId,
    lines,
    itemCount: purchasable.reduce((total, line) => total + line.quantity, 0),
    // Single-currency catalogue: the first available line decides the currency.
    currency: purchasable[0]?.currency ?? lines[0]?.currency ?? null,
    subtotal: purchasable.length > 0 ? fromCents(subtotalCents) : null,
  };
}

export async function findCartByUserId(userId: string): Promise<Cart | undefined> {
  const [cart] = await getDb()
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, ACTIVE_CART)))
    .limit(1);

  return cart;
}

export async function findCartByGuestToken(guestToken: string): Promise<Cart | undefined> {
  const [cart] = await getDb()
    .select()
    .from(carts)
    .where(and(eq(carts.guestToken, guestToken), eq(carts.status, ACTIVE_CART)))
    .limit(1);

  return cart;
}

/** A cart always has exactly one owner, which `carts_owner_check` enforces. */
export type CartOwner = { userId: string } | { guestToken: string };

export async function createCart(owner: CartOwner): Promise<Cart> {
  const [cart] = await getDb()
    .insert(carts)
    .values("userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken })
    .returning();

  if (!cart) {
    throw new Error("Failed to insert the cart row.");
  }

  return cart;
}

/** The published product behind a cart change, or `undefined` when it cannot be sold. */
async function getPurchasableProduct(
  productId: string,
): Promise<{ title: string; stock: number } | undefined> {
  const [product] = await getDb()
    .select({ title: products.title, stock: products.stock, status: products.status })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);

  return product?.status === "active" ? product : undefined;
}

export type AddCartItemInput = { cartId: string; productId: string; quantity: number };

/**
 * Adds units to a line, creating it when it is new.
 *
 * The upsert is a single statement so two concurrent adds cannot lose an
 * increment, and `least(...)` keeps the stored quantity inside stock on hand.
 */
export async function addCartItem({
  cartId,
  productId,
  quantity,
}: AddCartItemInput): Promise<CartMutationResult> {
  const product = await getPurchasableProduct(productId);

  if (!product) {
    return { ok: false, status: 404, message: "That product is not available." };
  }

  if (product.stock <= 0) {
    return { ok: false, status: 409, message: `${product.title} is sold out.` };
  }

  const requested = Math.min(quantity, product.stock);

  await getDb()
    .insert(cartItems)
    .values({ cartId, productId, quantity: requested })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: sql`least(${cartItems.quantity} + ${requested}, ${product.stock})` },
    });

  return { ok: true, cart: await getCartDto(cartId) };
}

export type SetCartItemQuantityInput = { cartId: string; productId: string; quantity: number };

/** Sets an absolute quantity. `0` removes the line. */
export async function setCartItemQuantity({
  cartId,
  productId,
  quantity,
}: SetCartItemQuantityInput): Promise<CartMutationResult> {
  if (quantity <= 0) {
    return removeCartItem({ cartId, productId });
  }

  const product = await getPurchasableProduct(productId);

  if (!product) {
    return { ok: false, status: 404, message: "That product is not available." };
  }

  if (product.stock <= 0) {
    return { ok: false, status: 409, message: `${product.title} is sold out.` };
  }

  await getDb()
    .update(cartItems)
    .set({ quantity: Math.min(quantity, product.stock) })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  return { ok: true, cart: await getCartDto(cartId) };
}

export async function removeCartItem({
  cartId,
  productId,
}: {
  cartId: string;
  productId: string;
}): Promise<CartMutationResult> {
  await getDb()
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  return { ok: true, cart: await getCartDto(cartId) };
}

/** Empties a cart while keeping the cart row, so its cookie stays valid. */
export async function clearCart(cartId: string): Promise<CartDto> {
  await getDb().delete(cartItems).where(eq(cartItems.cartId, cartId));

  return getCartDto(cartId);
}

/**
 * Folds an anonymous cart into the signed-in user's cart.
 *
 * Quantities are summed and capped at stock, lines that can no longer be sold
 * are skipped, and the guest cart is deleted in the same transaction so a retry
 * cannot merge the same rows twice. Returns `null` when there is nothing to
 * merge, which is what tells the caller to drop the cookie.
 */
export async function mergeGuestCart({
  userId,
  guestToken,
}: {
  userId: string;
  guestToken: string;
}): Promise<Cart | null> {
  const guestCart = await findCartByGuestToken(guestToken);

  if (!guestCart) {
    return null;
  }

  const userCart = (await findCartByUserId(userId)) ?? (await createCart({ userId }));

  await getDb().transaction(async (tx) => {
    const guestLines = await tx
      .select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        stock: products.stock,
        status: products.status,
        deletedAt: products.deletedAt,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, guestCart.id));

    for (const line of guestLines) {
      if (line.status !== "active" || line.deletedAt !== null || line.stock <= 0) {
        continue;
      }

      const quantity = Math.min(line.quantity, line.stock);

      await tx
        .insert(cartItems)
        .values({ cartId: userCart.id, productId: line.productId, quantity })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productId],
          set: { quantity: sql`least(${cartItems.quantity} + ${quantity}, ${line.stock})` },
        });
    }

    // Cascades to the guest cart's items.
    await tx.delete(carts).where(eq(carts.id, guestCart.id));
  });

  return userCart;
}
