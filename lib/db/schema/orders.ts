import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { carts } from "./carts";
import { products } from "./products";
import { users } from "./users";

/**
 * Lifecycle of an order.
 *
 * `pending` until Stripe confirms the payment; a declined card never reaches
 * this table as `failed`, because Stripe keeps the hosted session open. The
 * error states we do record are an abandoned session (`cancelled`), one that
 * timed out (`expired`) and a delayed payment method that failed later.
 *
 * An admin may also set `pending`, `paid` or `refunded` by hand, for money that
 * arrives or leaves outside the hosted session.
 */
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refunded",
]);

/**
 * Fulfilment lifecycle, driven by the admin dashboard.
 *
 * Deliberately separate from `order_status`: money can be refunded after an
 * order shipped, and an unpaid order can be cancelled before it is packed.
 * `cancelled` is terminal — the stock decision taken at that moment is not
 * replayed if the order is moved back afterwards.
 */
export const orderFulfillmentStatusEnum = pgEnum("order_fulfillment_status", [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

/**
 * How the shopper pays for an order.
 *
 * `card` is written by the Stripe flow only. The manual flow (`ENABLE_STRIPE ===
 * false` in `lib/checkout/config.ts`) stores `advance` — a transfer to the store
 * account — or `cod`. The default matches orders created before the manual flow
 * existed, which were all card payments.
 */
export const orderPaymentMethodEnum = pgEnum("order_payment_method", [
  "card",
  "advance",
  "cod",
]);

/**
 * One checkout attempt.
 *
 * Money and contact details are copied from the cart and the form at creation
 * time, so a later price change, a renamed product or a deleted address cannot
 * rewrite what the shopper was charged. `status` only moves forward through the
 * guarded updates in `lib/db/queries/orders.ts`.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-readable reference shown on the confirmation page, e.g. `DC64-7K2M9Q`. */
    orderNumber: text("order_number").notNull(),
    /** `null` for a guest checkout; the order still keeps the shipping snapshot. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Kept for conversion bookkeeping only; the cart row itself is never deleted. */
    cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    /** How the shopper chose to pay; see `orderPaymentMethodEnum`. */
    paymentMethod: orderPaymentMethodEnum("payment_method").notNull().default("card"),
    fulfillmentStatus: orderFulfillmentStatusEnum("fulfillment_status")
      .notNull()
      .default("pending"),
    /** Courier name and its tracking number: either both set, or both `null`. */
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    /** ISO-4217 code, taken from the cart's products. */
    currency: text("currency").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    shippingTotal: numeric("shipping_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    shippingLine1: text("shipping_line1").notNull(),
    shippingLine2: text("shipping_line2"),
    shippingCity: text("shipping_city").notNull(),
    shippingState: text("shipping_state"),
    shippingPostalCode: text("shipping_postal_code").notNull(),
    /** ISO-3166-1 alpha-2, upper-case. */
    shippingCountry: text("shipping_country").notNull(),
    /** Set right after the hosted session is created; the webhook looks orders up by it. */
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Stamped once, the first time the order reaches the matching stage. */
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("orders_order_number_key").on(table.orderNumber),
    uniqueIndex("orders_stripe_checkout_session_id_key").on(table.stripeCheckoutSessionId),
    index("orders_user_id_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_fulfillment_status_idx").on(table.fulfillmentStatus),
    check("orders_total_check", sql`${table.total} >= 0`),
  ],
);

/**
 * One line of an order.
 *
 * Title, slug and price are snapshots, not joins: the catalogue may rename a
 * product or delete it, while an invoice has to keep saying what was bought for
 * how much. `productId` is therefore nullable and only used to reconcile stock.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productTitle: text("product_title").notNull(),
    productSlug: text("product_slug").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    /**
     * `true` while this line's units are subtracted from the product's stock.
     * Set on payment and cleared when a cancellation returns them, so the
     * reversal runs at most once and an oversold line (paid for stock that was
     * never deducted) is never credited back.
     */
    stockDeducted: boolean("stock_deducted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderFulfillmentStatus = (typeof orderFulfillmentStatusEnum.enumValues)[number];
export type OrderPaymentMethod = (typeof orderPaymentMethodEnum.enumValues)[number];
