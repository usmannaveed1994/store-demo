"use client";

import { useEffect, useState } from "react";

import type { ProductDto, ProductsResponse } from "@/lib/products/dto";

import { ProductCard } from "./product-card";

/** Grid columns shared by the real tiles and the loading skeleton. */
const GRID_CLASSES = "mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

type ProductsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; products: ProductDto[] };

/**
 * Narrows the parsed JSON body to the API contract. `"products" in value` lets
 * TypeScript reach the unknown property without a cast.
 */
function isProductsResponse(value: unknown): value is ProductsResponse {
  if (typeof value !== "object" || value === null || !("products" in value)) {
    return false;
  }

  return Array.isArray(value.products);
}

/**
 * Catalogue grid for `/collections`.
 *
 * The first paint is a skeleton and the browser then pulls the catalogue from
 * `GET /api/products`, so this component never touches the database directly.
 */
export function ProductGrid() {
  const [state, setState] = useState<ProductsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts(): Promise<void> {
      try {
        const response = await fetch("/api/products", { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`The catalogue request failed (${response.status}).`);
        }

        const payload: unknown = await response.json();

        if (!isProductsResponse(payload)) {
          throw new Error("The catalogue response was not in the expected shape.");
        }

        setState({ status: "ready", products: payload.products });
      } catch (error) {
        // An abort is a teardown, not a failure the visitor should see.
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    }

    void loadProducts();

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <ProductGridSkeleton />;
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="mt-10 rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-foreground"
      >
        {state.message}
      </p>
    );
  }

  if (state.products.length === 0) {
    return (
      <p className="mt-10 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
        Nothing on the shelf yet. Products with an <code>active</code> status will appear here.
      </p>
    );
  }

  return (
    <ul className={GRID_CLASSES}>
      {state.products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder tiles that mirror the grid so the layout does not jump. */
function ProductGridSkeleton() {
  return (
    <ul aria-hidden className={GRID_CLASSES}>
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-4/3 animate-pulse bg-muted" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
