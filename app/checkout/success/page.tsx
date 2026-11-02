import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ConfirmationSkeleton,
  OrderConfirmation,
} from "./_components/order-confirmation";

export const metadata: Metadata = {
  title: "Order confirmation — Diecast 64",
  robots: { index: false, follow: false },
};

/**
 * Return URL for Stripe Checkout.
 *
 * `searchParams` is request data, so it is awaited inside the Suspense boundary
 * below and the shell still prerenders. The confirmation streams in once Stripe
 * has been asked about the session.
 */
export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <Suspense fallback={<ConfirmationSkeleton />}>
          <OrderConfirmation searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
