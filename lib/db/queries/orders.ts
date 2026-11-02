import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";

import type { CartDto } from "@/lib/cart/dto";
import type { ShippingDetails } from "@/lib/checkout/dto";
import { getCheckoutTotals } from "@/lib/checkout/pricing";
import { getDb } from "@/lib/db";
import { cartItems, carts, orderItems, orders, products } from "@/lib/db/schema";
import type { Order, OrderItem, OrderStatus } from "@/lib/db/schema";
import { fromCents, toCents } from "@/lib/money";

/** An order together with its immutable line snapshots. */
export type OrderWithItems = {
  order: Order;
  items: OrderItem[];
};

const ORDER_NUMBER_ATTEMPTS = 3;

function generateOrderNumber(): string {
  return `DC-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

/** Postgres unique-violation code, i.e. an order number that was already taken. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export type CreatePendingOrderInput = {
  cart: CartDto;
  shipping: ShippingDetails;
  /** The signed-in user, or `null` for a guest checkout. */
  userId: string | null;
};

/**
 * Writes the order and its lines before Stripe is called.
 *
 * The row has to exist first: the hosted session carries `metadata.orderId`, and
 * the webhook can arrive before the browser is redirected back. Prices are
 * copied from the cart DTO that was read moments earlier, so the amount Stripe
 * charges is the amount stored here.
 */
export async function createPendingOrder({
  cart,
  shipping,
  userId,
}: CreatePendingOrderInput): Promise<OrderWithItems> {
  const lines = cart.lines.filter((line) => line.isAvailable);
  const currency = lines[0]?.currency;

  if (lines.length === 0 || !currency || !cart.subtotal) {
    throw new Error("A pending order needs at least one purchasable cart line.");
  }

  const totals = getCheckoutTotals(cart.subtotal);

  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    try {
      return await getDb().transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber: generateOrderNumber(),
            userId,
            cartId: cart.id,
            status: "pending",
            currency,
            subtotal: totals.subtotal,
            shippingTotal: totals.shipping,
            total: totals.total,
            customerEmail: shipping.email,
            customerName: shipping.fullName,
            customerPhone: shipping.phone,
            shippingLine1: shipping.line1,
            shippingLine2: shipping.line2,
            shippingCity: shipping.city,
            shippingState: shipping.state,
            shippingPostalCode: shipping.postalCode,
            shippingCountry: shipping.country,
          })
          .returning();

        if (!order) {
          throw new Error("Failed to insert the order row.");
        }

        const items = await tx
          .insert(orderItems)
          .values(
            lines.map((line) => ({
              orderId: order.id,
              productId: line.productId,
              productTitle: line.title,
              productSlug: line.slug,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: fromCents(toCents(line.unitPrice) * line.quantity),
              currency: line.currency,
            })),
          )
          .returning();

        return { order, items };
      });
    } catch (error) {
      const canRetry = isUniqueViolation(error) && attempt < ORDER_NUMBER_ATTEMPTS - 1;

      if (!canRetry) {
        throw error;
      }
    }
  }

  throw new Error("Failed to create the order row.");
}

export async function attachCheckoutSession({
  orderId,
  sessionId,
}: {
  orderId: string;
  sessionId: string;
}): Promise<void> {
  await getDb()
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(orders.id, orderId));
}

/** Cancels an order whose Stripe session could not even be created. */
export async function failPendingOrder(orderId: string): Promise<void> {
  await getDb()
    .update(orders)
    .set({ status: "failed" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}

export async function findOrderByCheckoutSessionId(
  sessionId: string,
): Promise<OrderWithItems | null> {
  const [order] = await getDb()
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId))
    .limit(1);

  if (!order) {
    return null;
  }

  const items = await getDb()
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.createdAt), asc(orderItems.id));

  return { order, items };
}

export type MarkOrderPaidResult = {
  order: OrderWithItems;
  /** `false` when a webhook replay or the success page found the order already paid. */
  transitioned: boolean;
};

/**
 * Moves an order to `paid`, once.
 *
 * The `status IN ('pending', 'failed')` guard makes the update itself the lock:
 * Stripe retries webhooks, and the success page fulfils the same order in
 * parallel, but only the call that actually flips the status decrements stock
 * and clears the cart. Stock uses `stock >= quantity` so two orders can never
 * drive it negative.
 */
export async function markOrderPaid({
  sessionId,
  paymentIntentId,
}: {
  sessionId: string;
  paymentIntentId: string | null;
}): Promise<MarkOrderPaidResult | null> {
  const transitioned = await getDb().transaction(async (tx) => {
    const [paid] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      })
      .where(
        and(
          eq(orders.stripeCheckoutSessionId, sessionId),
          inArray(orders.status, ["pending", "failed"]),
        ),
      )
      .returning({ id: orders.id, cartId: orders.cartId });

    if (!paid) {
      return false;
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, paid.id));

    for (const item of items) {
      if (!item.productId) {
        continue;
      }

      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), gte(products.stock, item.quantity)))
        .returning({ id: products.id });

      if (updated.length === 0) {
        // Paid for stock that is gone — record it and leave the count at zero.
        console.warn(
          `[orders] Order ${paid.id} oversold product ${item.productId} (quantity ${item.quantity}).`,
        );
      }
    }

    if (paid.cartId) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, paid.cartId));
      await tx.update(carts).set({ status: "converted" }).where(eq(carts.id, paid.cartId));
    }

    return true;
  });

  const order = await findOrderByCheckoutSessionId(sessionId);

  return order ? { order, transitioned } : null;
}

/**
 * Closes a pending order that will never be paid.
 *
 * Only `pending` rows move, so a webhook that arrives late cannot overwrite a
 * payment that has already been fulfilled.
 */
export async function markOrderClosed({
  sessionId,
  status,
}: {
  sessionId: string;
  status: Extract<OrderStatus, "failed" | "cancelled" | "expired">;
}): Promise<void> {
  await getDb()
    .update(orders)
    .set({ status })
    .where(and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.status, "pending")));
}
