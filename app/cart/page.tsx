import type { Metadata } from "next";

import { CartView } from "./_components/cart-view";

export const metadata: Metadata = {
  title: "Cart — Diecast 64",
  description: "Review the 1:64 releases in your cart before checkout.",
  // The contents are per visitor, so there is nothing worth indexing.
  robots: { index: false, follow: true },
};

/**
 * Cart page.
 *
 * The page itself is not prerendered per visitor: `CartView` reads the cart in
 * the browser through React Query, which is the same cache the header badge
 * fills. That keeps this route static and the two views in sync for free.
 */
export default function CartPage() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Your bag
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Cart
        </h1>

        <CartView />
      </section>
    </main>
  );
}
