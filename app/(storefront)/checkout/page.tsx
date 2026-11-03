import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";

import { CheckoutForm } from "./_components/checkout-form";
import { CheckoutSummary } from "./_components/checkout-summary";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Checkout",
    description: "Delivery details and secure payment.",
    path: "/checkout",
  }),
  robots: { index: false, follow: false },
};

/**
 * Checkout page.
 *
 * A prerendered shell: the form and the summary both read the cart through
 * React Query on the client, so the page needs no request-time data of its own
 * and navigation to it is instant. Stripe's hosted page is where card details
 * are collected — this route never sees them.
 */
export default function CheckoutPage() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Secure checkout
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Checkout
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <CheckoutForm />
          <CheckoutSummary />
        </div>
      </section>
    </main>
  );
}
