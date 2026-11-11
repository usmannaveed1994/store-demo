import type { Metadata } from "next";
import { Suspense } from "react";

import { buildPageMetadata } from "@/lib/metadata";

import {
  ConfirmationSkeleton,
  OrderConfirmation,
} from "./_components/order-confirmation";

export const metadata: Metadata = {
  ...buildPageMetadata({ title: "Order confirmation", path: "/checkout/success" }),
  robots: { index: false, follow: false },
};

/**
 * Order confirmation page.
 *
 * With `ENABLE_STRIPE` off this is where `POST /api/checkout` redirects, keyed by
 * `?order=`. With it on it is the hosted session's return URL, and `?session_id=`
 * is re-read from Stripe before anything is fulfilled.
 *
 * `searchParams` is request data, so it is awaited inside the Suspense boundary
 * below and the shell still prerenders.
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
