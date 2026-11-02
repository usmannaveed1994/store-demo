import { sql } from "drizzle-orm";
import {
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
    /** Human-readable reference shown on the confirmation page, e.g. `DC-7F3A9C2E14`. */
    orderNumber: text("order_number").notNull(),
    /** `null` for a guest checkout; the order still keeps the shipping snapshot. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Kept for conversion bookkeeping only; the cart row itself is never deleted. */
    cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("pending"),
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
