import type { Metadata } from "next";
import { Suspense } from "react";

import { buildPageMetadata } from "@/lib/metadata";

import { CancelledNotice, CancelledSkeleton } from "./_components/cancelled-notice";

export const metadata: Metadata = {
  ...buildPageMetadata({ title: "Checkout cancelled", path: "/checkout/cancel" }),
  robots: { index: false, follow: false },
};

/** Return URL for an abandoned Stripe Checkout session. */
export default function CheckoutCancelPage({ searchParams }: PageProps<"/checkout/cancel">) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <Suspense fallback={<CancelledSkeleton />}>
          <CancelledNotice searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
