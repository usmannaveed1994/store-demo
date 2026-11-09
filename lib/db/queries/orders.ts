import { and, asc, desc, eq, gte, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import type { CartDto } from "@/lib/cart/dto";
import type { ShippingDetails } from "@/lib/checkout/dto";
import { getCheckoutTotals } from "@/lib/checkout/pricing";
import { getDb } from "@/lib/db";
import { cartItems, carts, orderItems, orders, products } from "@/lib/db/schema";
import type { Order, OrderFulfillmentStatus, OrderItem, OrderStatus } from "@/lib/db/schema";
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

/** The line snapshots of one order, oldest first. */
async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  return getDb()
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
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

  return { order, items: await listOrderItems(order.id) };
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const [order] = await getDb().select().from(orders).where(eq(orders.id, id)).limit(1);

  if (!order) {
    return null;
  }

  return { order, items: await listOrderItems(order.id) };
}

/** Pagination and filtering for the admin order list. Every field is optional. */
export type OrderFilters = {
  /** Fulfilment stage, as set by the admin. */
  fulfillment?: OrderFulfillmentStatus;
  /** Payment state; only `pending`, `paid` and `refunded` are set by hand. */
  payment?: OrderStatus;
  /** Case-insensitive substring matched against the order number, email and name. */
  search?: string;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIMIT = 20;

/** `%`, `_` and `\` are LIKE metacharacters, so a search for `50%` must not become a wildcard. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildOrderConditions(filters: Pick<OrderFilters, "fulfillment" | "payment" | "search">) {
  const conditions: SQL[] = [];

  if (filters.fulfillment) {
    conditions.push(eq(orders.fulfillmentStatus, filters.fulfillment));
  }

  if (filters.payment) {
    conditions.push(eq(orders.status, filters.payment));
  }

  const search = filters.search?.trim();

  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const match = or(
      ilike(orders.orderNumber, pattern),
      ilike(orders.customerEmail, pattern),
      ilike(orders.customerName, pattern),
    );

    if (match) {
      conditions.push(match);
    }
  }

  return conditions;
}

/**
 * Newest first, then a stable tiebreaker.
 *
 * Orders created in one transaction share `created_at`, and offset paging needs
 * a repeatable order — otherwise page two can repeat or skip rows from page one.
 */
export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  const { limit = DEFAULT_LIMIT, offset = 0 } = filters;

  return getDb()
    .select()
    .from(orders)
    .where(and(...buildOrderConditions(filters)))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit)
    .offset(offset);
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

    // Confirmation is the admin's first step, but a manual cancel recorded
    // before the payment landed must survive it, so only `pending` advances.
    await tx
      .update(orders)
      .set({ fulfillmentStatus: "confirmed" })
      .where(and(eq(orders.id, paid.id), eq(orders.fulfillmentStatus, "pending")));

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
        // `stock_deducted` stays false, so a later cancellation cannot credit
        // back units this order never took.
        console.warn(
          `[orders] Order ${paid.id} oversold product ${item.productId} (quantity ${item.quantity}).`,
        );
        continue;
      }

      await tx.update(orderItems).set({ stockDeducted: true }).where(eq(orderItems.id, item.id));
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

export type FulfillmentUpdate = {
  fulfillmentStatus: OrderFulfillmentStatus;
  /** Put the deducted units back on sale; only acted on when cancelling. */
  restock?: boolean;
};

/**
 * Moves an order through the stages an admin controls.
 *
 * `cancelled` is terminal: the stock decision taken at that moment cannot be
 * replayed by moving the order back, so a cancelled order is left untouched.
 * Restocking reads `order_items.stock_deducted`, which makes the reversal safe
 * to submit twice and keeps an oversold line (paid for stock that was never
 * taken) out of the count. Everything happens in one transaction, so a status
 * change can never be stored without the restock it promised.
 */
export async function updateOrderFulfillment(
  orderId: string,
  { fulfillmentStatus, restock = false }: FulfillmentUpdate,
): Promise<Order | undefined> {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        fulfillmentStatus: orders.fulfillmentStatus,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (
      !current ||
      (current.fulfillmentStatus === "cancelled" && fulfillmentStatus !== "cancelled")
    ) {
      return undefined;
    }

    const now = new Date();
    const [updated] = await tx
      .update(orders)
      .set({
        fulfillmentStatus,
        // Stamped once, so re-saving the same stage keeps the original date.
        ...(fulfillmentStatus === "shipped" && !current.shippedAt ? { shippedAt: now } : {}),
        ...(fulfillmentStatus === "delivered" && !current.deliveredAt ? { deliveredAt: now } : {}),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updated) {
      return undefined;
    }

    if (fulfillmentStatus === "cancelled" && restock) {
      const deducted = await tx
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.stockDeducted, true)));

      for (const line of deducted) {
        if (line.productId) {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${line.quantity}` })
            .where(eq(products.id, line.productId));
        }

        // Cleared even when the product is gone, so the reversal cannot replay.
        await tx.update(orderItems).set({ stockDeducted: false }).where(eq(orderItems.id, line.id));
      }
    }

    return updated;
  });
}

/** Courier details, editable until the order is cancelled. */
export async function updateOrderTracking(
  orderId: string,
  { courier, trackingNumber }: { courier: string | null; trackingNumber: string | null },
): Promise<Order | undefined> {
  const [order] = await getDb()
    .update(orders)
    .set({ courier, trackingNumber })
    .where(and(eq(orders.id, orderId), ne(orders.fulfillmentStatus, "cancelled")))
    .returning();

  return order;
}

/**
 * Sets the payment state by hand — a bank transfer that arrived, a refund
 * issued elsewhere. Stripe keeps writing the same column from its webhooks.
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order | undefined> {
  const [order] = await getDb()
    .update(orders)
    .set({
      status,
      // Never rewrite the original timestamp; a manual "paid" only fills a gap.
      ...(status === "paid" ? { paidAt: sql`coalesce(${orders.paidAt}, now())` } : {}),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return order;
}
