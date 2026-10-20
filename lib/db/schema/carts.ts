import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "./products";
import { users } from "./users";

/** Lifecycle of a cart; only `active` carts are read or written by the storefront. */
export const cartStatusEnum = pgEnum("cart_status", ["active", "converted", "abandoned"]);

/**
 * A cart belongs to either a signed-in user or an anonymous browser.
 *
 * Guests are identified by a random token kept in an httpOnly cookie, so the
 * same cart survives a sign-in: its rows are merged onto the user's cart and the
 * guest cart is then deleted.
 */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestToken: text("guest_token"),
    status: cartStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("carts_guest_token_key").on(table.guestToken),
    index("carts_user_id_idx").on(table.userId),
    // Exactly one owner: a cart is never both a guest cart and a user cart.
    check("carts_owner_check", sql`(${table.userId} is null) <> (${table.guestToken} is null)`),
  ],
);

/**
 * One product in a cart.
 *
 * No price is stored on purpose: totals are joined from `products` on every
 * read, so a price change or a product leaving the catalogue is reflected
 * immediately and cannot be influenced from the browser.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Lets an add be a single upsert instead of a read-then-write race.
    uniqueIndex("cart_items_cart_product_key").on(table.cartId, table.productId),
    index("cart_items_cart_id_idx").on(table.cartId),
  ],
);

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type CartStatus = (typeof cartStatusEnum.enumValues)[number];
