import {
  boolean,
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

export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * URL-safe key, e.g. `blue-cotton-tee`. Used as the product detail route
     * (`/products/[slug]`), so it is unique across the whole catalogue.
     */
    slug: text("slug").notNull().unique("products_slug_key"),
    title: text("title").notNull(),
    description: text("description"),
    /** Selling price, exact to two decimals rather than a floating point value. */
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    /** Optional "was" price that powers sale badges when greater than `price`. */
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
    /** ISO-4217 currency code, e.g. `USD`. */
    currency: text("currency").notNull().default("USD"),
    /** Merchant stock-keeping unit. Unique when set; multiple `NULL`s allowed. */
    sku: text("sku"),
    /** Units on hand. Reserved for a future inventory ledger. */
    stock: integer("stock").notNull().default(0),
    status: productStatusEnum("status").notNull().default("draft"),
    /** Curation flag for featured collections and the homepage. */
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Primary image; move to a `product_images` table when galleries are needed. */
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Soft delete: rows stay for historical orders but drop out of every read. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("products_sku_key").on(table.sku),
    index("products_status_idx").on(table.status),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductStatus = (typeof productStatusEnum.enumValues)[number];
