import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { ProductGrid } from "./_components/product-grid";

export const metadata: Metadata = {
  title: "Collections — Diecast 64",
  description:
    "Browse every 1:64 scale release in the Diecast 64 catalogue: licensed castings, opening parts and display-ready finishing.",
};

/**
 * Public catalogue page. The shell is static and the grid streams in from
 * `GET /api/products` once the browser has hydrated.
 */
export default function CollectionsPage() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
          The catalogue
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Collections
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
          Every 1:64 release currently in the garage.
        </p>

        <ProductGrid />
      </section>
    </main>
  );
}
