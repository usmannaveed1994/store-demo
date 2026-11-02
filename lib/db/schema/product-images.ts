import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { MAX_GALLERY_IMAGES } from "../../products/constants";

import { products } from "./products";

/**
 * Additional photos for a product detail page.
 *
 * `products.image_url` stays the single thumbnail the catalogue tiles use; the
 * rows here are the gallery behind it. `position` is the display order and is
 * unique per product, so a gallery is an ordered list rather than a bag of URLs
 * whose order depends on insertion time.
 */
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Accessible description; falls back to the product title when empty. */
    alt: text("alt"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Also serves the `where product_id = ?` lookup, so no second index is needed.
    uniqueIndex("product_images_product_position_key").on(table.productId, table.position),
    check(
      "product_images_position_check",
      // `sql.raw` keeps the bound literal out of the statement: Postgres does not
      // accept parameters inside a CHECK constraint.
      sql`${table.position} >= 0 and ${table.position} < ${sql.raw(String(MAX_GALLERY_IMAGES))}`,
    ),
  ],
);

export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
