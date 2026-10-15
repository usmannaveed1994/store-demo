import type { Product } from "@/lib/db/schema";

/**
 * JSON-safe shape of a product.
 *
 * Drizzle hands back `Date` instances and `JSON.stringify` turns those into ISO
 * strings, so `Product` cannot be reused verbatim on the wire. Every other field
 * is already JSON-safe: `price` and `compareAtPrice` are `numeric` columns, so
 * they travel as strings exactly as Postgres returns them.
 */
export type ProductDto = Omit<Product, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Rows per page of the storefront feed.
 *
 * Shared deliberately: the grid asks for a page of this size and the route
 * handler falls back to it, so the two can never drift apart. It lives here
 * rather than in the handler because the handler is server-only.
 */
export const PRODUCTS_PAGE_SIZE = 12;

/**
 * Body of `GET /api/products`.
 *
 * `hasMore` is what tells the grid whether appending is finished. The next
 * offset is not sent, because the client already knows it: it is the number of
 * products it has rendered so far.
 */
export type ProductsResponse = {
  products: ProductDto[];
  hasMore: boolean;
};

export type ProductDetailResponse = {
  product: ProductDto;
};

export type ApiErrorResponse = {
  error: string;
};

/** Converts a database row into the payload the storefront API returns. */
export function toProductDto(product: Product): ProductDto {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    deletedAt: product.deletedAt?.toISOString() ?? null,
  };
}
