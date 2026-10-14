import { connection, NextResponse, type NextRequest } from "next/server";

import { listActiveProducts } from "@/lib/db/queries/products";
import { PRODUCTS_PAGE_SIZE, toProductDto, type ProductsResponse } from "@/lib/products/dto";

/**
 * Largest page a caller may ask for. The grid never needs more than
 * `PRODUCTS_PAGE_SIZE`, so this only exists to stop `?limit=100000` from
 * pulling the whole table into one response.
 */
const MAX_PAGE_SIZE = 50;

/**
 * Turns `?limit` / `?offset` into safe row bounds.
 *
 * Everything here is caller-supplied, so missing, negative, fractional and
 * non-numeric values all fall back to the page defaults instead of reaching the
 * query. `Number.parseInt` is strict enough to reject `abc` and `12.5`, but
 * still reads `12abc` as 12, which is harmless for a read-only listing.
 */
function parsePageBounds(searchParams: URLSearchParams): { limit: number; offset: number } {
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "", 10);

  return {
    limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) : PRODUCTS_PAGE_SIZE,
    offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
  };
}

/**
 * Public storefront catalogue feed, consumed by `/collections`.
 *
 * Serves one page at a time — `?limit` (default 12, maximum 50) and `?offset` —
 * so the grid can append as the visitor scrolls. `hasMore` is worked out by
 * asking the database for one row beyond the page and checking whether it
 * arrived, which avoids a `COUNT(*)` over the catalogue and never reports a
 * phantom next page when the catalogue is an exact multiple of the page size.
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
export async function GET(request: NextRequest): Promise<NextResponse<ProductsResponse>> {
  await connection();

  const { limit, offset } = parsePageBounds(request.nextUrl.searchParams);

  // One extra row is the cheapest possible answer to "is there another page?".
  const rows = await listActiveProducts({ limit: limit + 1, offset });
  const hasMore = rows.length > limit;
  const products = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json<ProductsResponse>({ products: products.map(toProductDto), hasMore });
}

