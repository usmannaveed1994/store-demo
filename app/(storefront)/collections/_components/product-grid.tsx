"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { PRODUCTS_PAGE_SIZE, type ProductsResponse } from "@/lib/products/dto";

import { ProductCard } from "./product-card";

/** Grid columns shared by the real tiles and the loading skeleton. */
const GRID_CLASSES = "mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/**
 * How far below the viewport the next page starts loading, so tiles are usually
 * already there by the time the visitor scrolls down to them.
 */
const SCROLL_AHEAD_MARGIN = "600px 0px";

/** Placeholder tiles shown while the very first page is in flight. */
const INITIAL_SKELETON_TILES = 8;

/**
 * Cache key for the feed. The page size belongs in it because it decides how the
 * catalogue is cut into pages: if it ever changed, pages fetched under the old
 * size must not be reused as pages of the new one.
 */
const PRODUCTS_QUERY_KEY = ["products", { limit: PRODUCTS_PAGE_SIZE }] as const;

/**
 * Narrows the parsed JSON body to the API contract. `"products" in value` lets
 * TypeScript reach the unknown properties without a cast.
 */
function isProductsResponse(value: unknown): value is ProductsResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("products" in value) || !("hasMore" in value)) {
    return false;
  }

  return Array.isArray(value.products) && typeof value.hasMore === "boolean";
}

/** React Query types errors as `Error`; anything else still owes the visitor a sentence. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Reads one page of the feed.
 *
 * `offset` is the page parameter — how many products the visitor already has —
 * so page two of twelve is asked for as `?offset=12`. React Query hands down an
 * `AbortSignal` that fires when the query is cancelled or the grid unmounts,
 * which replaces the `AbortController` this used to keep in a ref.
 */
async function fetchProductsPage(offset: number, signal: AbortSignal): Promise<ProductsResponse> {
  const response = await fetch(`/api/products?limit=${PRODUCTS_PAGE_SIZE}&offset=${offset}`, { signal });

  if (!response.ok) {
    throw new Error(`The catalogue request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();

  if (!isProductsResponse(payload)) {
    throw new Error("The catalogue response was not in the expected shape.");
  }

  return payload;
}

/**
 * Catalogue grid for `/collections`.
 *
 * The first paint is a skeleton and the browser then pulls the catalogue from
 * `GET /api/products`, one page at a time, so this component never touches the
 * database directly. Each further page is appended below the tiles already on
 * screen — nothing that has been rendered is ever replaced.
 *
 * Paging state lives in React Query rather than in this component: it owns the
 * cache, the in-flight request and the retry policy, so there is no offset ref,
 * no request latch, no `AbortController` in a ref and no mount effect to start
 * the first page — the query starts itself.
 */
export function ProductGrid() {
  /** Watched by the observer, and sits next to the "Load more" control. */
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    isLoadingError,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: ({ pageParam, signal }) => fetchProductsPage(pageParam, signal),
    initialPageParam: 0,
    // The route has already answered "is there another page?" with `hasMore`, so
    // the offset to ask for next is simply how far this page reached.
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.hasMore ? lastOffset + lastPage.products.length : undefined,
    // The default is three attempts, which would sit on a failed grid for ~7s of
    // backoff before admitting the API is down. One retry rides out a blip.
    retry: 1,
  });

  const products = data?.pages.flatMap((page) => page.products) ?? [];

  /**
   * Whether the observer is allowed to ask for another page.
   *
   * Switching it off while a page is in flight is also what stops a *failed*
   * page from being re-requested the instant it fails: the sentinel is still on
   * screen, so re-observing it would fetch, fail, re-observe, fetch again. A
   * failure instead stops the scroll and waits to be asked (the button below).
   */
  const canLoadMore = hasNextPage && !isFetchingNextPage && !isFetchNextPageError;

  /**
   * Infinite scroll.
   *
   * `observe()` always reports a target's current state straight away, so a
   * sentinel that is still inside the margin once a page has landed asks for the
   * next one instead of stalling — that is what fills a window taller than one
   * page. Rebuilding the observer is deliberate: `canLoadMore` flipping back to
   * true is exactly the moment it should look again.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !canLoadMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: SCROLL_AHEAD_MARGIN },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [canLoadMore, fetchNextPage]);

  if (isPending) {
    return <ProductGridSkeleton />;
  }

  // Nothing has loaded, so there is nothing worth keeping: the error takes over.
  if (isLoadingError) {
    return (
      <div className="mt-10 rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-foreground">
        <p role="alert">{messageOf(error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="mt-10 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
        Nothing on the shelf yet. Products with an <code>active</code> status will appear here.
      </p>
    );
  }

  return (
    <>
      <ul className={GRID_CLASSES}>
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}

        {/* Appended pages trail skeletons; the tiles above them stay put. */}
        {isFetchingNextPage ? <SkeletonTiles count={PRODUCTS_PAGE_SIZE} /> : null}
      </ul>

      {/* The visible grid should not shout every append at a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {isFetchingNextPage ? "Loading more products." : `Showing ${products.length} products.`}
      </p>

      {/* Observed by the scroller, and a button so the footer is keyboard-reachable. */}
      <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-3">
        {/*
          A failed append leaves the tiles above in place, so this branch has to
          be checked before `hasNextPage`: the last page load failed, which means
          `hasNextPage` is still true from the pages that did arrive.
        */}
        {isFetchNextPageError ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {messageOf(error)}
            </p>
            <Button type="button" variant="outline" size="lg" onClick={() => void fetchNextPage()}>
              Try again
            </Button>
          </>
        ) : hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            That is all {products.length} products in the catalogue.
          </p>
        )}
      </div>
    </>
  );
}

/** Placeholder tiles that mirror the grid so the layout does not jump. */
function SkeletonTiles({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-4/3 animate-pulse bg-muted" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </>
  );
}

function ProductGridSkeleton() {
  return (
    <ul aria-hidden className={GRID_CLASSES}>
      <SkeletonTiles count={INITIAL_SKELETON_TILES} />
    </ul>
  );
}
