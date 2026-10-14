import { connection, NextResponse } from "next/server";

import { listActiveProducts } from "@/lib/db/queries/products";
import { toProductDto, type ProductsResponse } from "@/lib/products/dto";

/**
 * The storefront grid has no pager yet, so the feed returns the whole published
 * catalogue. `listActiveProducts` would otherwise fall back to its 20-row
 * pagination default and quietly hide products from the grid. The cap keeps one
 * request from serialising a runaway table; swap it for a `limit` / `offset`
 * pair once the grid grows a pager.
 */
const CATALOGUE_LIMIT = 100;

/**
 * Public storefront catalogue feed, consumed by `/collections`.
 *
 * No Route Segment Config here: with `cacheComponents` enabled the `dynamic`,
 * `revalidate` and `fetchCache` exports are removed, and route handlers are
 * dynamic by default.
 *
 * `connection()` is the replacement for that opt-out. It keeps the handler out
 * of the build entirely, which matters because `DATABASE_URL` is a runtime
 * concern — without it `next build` would try to prerender this handler and
 * fail on any machine that cannot reach Postgres.
 *
 * Only published, non-deleted rows come back, because `listActiveProducts`
 * filters on `status` and `deleted_at`.
 */
export async function GET(): Promise<NextResponse<ProductsResponse>> {
  await connection();

  const products = await listActiveProducts({ limit: CATALOGUE_LIMIT });

  return NextResponse.json<ProductsResponse>({ products: products.map(toProductDto) });
}
