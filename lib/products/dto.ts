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

/** Body of `GET /api/products`. */
export type ProductsResponse = {
  products: ProductDto[];
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
