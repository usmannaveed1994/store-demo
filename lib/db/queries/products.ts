import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { products, type NewProduct, type Product, type ProductStatus } from "@/lib/db/schema";

/** Columns a caller may change once a product already exists. */
export type ProductUpdate = Partial<Omit<NewProduct, "id" | "createdAt">>;

/** Pagination and filtering for product listings. Every field is optional. */
export type ProductFilters = {
  status?: ProductStatus;
  featured?: boolean;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIMIT = 20;

/**
 * Shared `WHERE` conditions for the read helpers: never surface soft-deleted
 * rows, then apply the optional `status` / `featured` filters.
 */
function buildReadConditions(filters: Pick<ProductFilters, "status" | "featured">) {
  const conditions = [isNull(products.deletedAt)];

  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }

  if (typeof filters.featured === "boolean") {
    conditions.push(eq(products.isFeatured, filters.featured));
  }

  return conditions;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [product] = await getDb()
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);

  return product;
}

/**
 * The published product with this slug, or `undefined`.
 *
 * The publish rule is the one `listActiveProducts` applies to every listing:
 * only an `active`, non-deleted row is a product the storefront may show. A
 * `draft` or `archived` row is therefore indistinguishable from a slug that was
 * never used, which is what both callers need — the detail page and
 * `GET /api/products/[slug]` may not confirm that an unpublished slug exists.
 * Keep them in step by changing `status` here rather than at the call sites.
 */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const [product] = await getDb()
    .select()
    .from(products)
    .where(and(...buildReadConditions({ status: "active" }), eq(products.slug, slug)))
    .limit(1);

  return product;
}

/**
 * Newest first, then a stable tiebreaker.
 *
 * `created_at` is not unique: rows inserted in one transaction all share the
 * timestamp Postgres took from `now()`. A sort with no unique key leaves tied
 * rows in no guaranteed order, and offset paging relies on that order being
 * repeatable — otherwise page two can repeat or skip rows from page one. `id`
 * breaks the tie deterministically, so `created_at` keeps deciding the order
 * and `id` only settles the rows `created_at` cannot separate.
 */
export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const { limit = DEFAULT_LIMIT, offset = 0 } = filters;

  return getDb()
    .select()
    .from(products)
    .where(and(...buildReadConditions(filters)))
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit)
    .offset(offset);
}

/** Public storefront listings: everything that is published and not deleted. */
export async function listActiveProducts(options: Omit<ProductFilters, "status"> = {}): Promise<Product[]> {
  return listProducts({ ...options, status: "active" });
}

/** Homepage / collection curation: published products flagged as featured. */
export async function listFeaturedProducts(
  options: Omit<ProductFilters, "status" | "featured"> = {},
): Promise<Product[]> {
  return listProducts({ ...options, status: "active", featured: true });
}

export async function insertProduct(values: NewProduct): Promise<Product> {
  const [product] = await getDb().insert(products).values(values).returning();

  if (!product) {
    throw new Error("Failed to insert the product row.");
  }

  return product;
}

export async function updateProduct(id: string, values: ProductUpdate): Promise<Product | undefined> {
  const [product] = await getDb().update(products).set(values).where(eq(products.id, id)).returning();

  return product;
}

/** Soft delete: hides the row from every read helper while keeping it for history. */
export async function softDeleteProduct(id: string): Promise<Product | undefined> {
  const [product] = await getDb()
    .update(products)
    .set({ deletedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return product;
}

/** Hard delete: permanently removes the row. Prefer `softDeleteProduct`. */
export async function deleteProduct(id: string): Promise<Product | undefined> {
  const [product] = await getDb().delete(products).where(eq(products.id, id)).returning();

  return product;
}
