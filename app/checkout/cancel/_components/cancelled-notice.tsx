import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cancelPendingSession } from "@/lib/checkout/session";

type CancelSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Shown when the shopper backs out of Stripe Checkout.
 *
 * Stripe still holds the session (and may complete it later), so the order is
 * closed as `cancelled` but the cart is left untouched. If the shopper actually
 * paid and landed here anyway, this forwards to the confirmation instead.
 */
export async function CancelledNotice({ searchParams }: { searchParams: CancelSearchParams }) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;

  if (sessionId) {
    const outcome = await cancelPendingSession(sessionId);

    if (outcome === "paid") {
      redirect(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Checkout cancelled
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Your card was not charged and everything is still in your cart. You can pick up where you
        left off whenever you are ready.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/cart">Back to cart</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/collections">Keep shopping</Link>
        </Button>
      </div>
    </div>
  );
}

export function CancelledSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-9 w-64 rounded bg-muted" />
      <div className="mt-4 h-4 w-full max-w-md rounded bg-muted" />
      <div className="mt-8 flex gap-3">
        <div className="h-11 w-32 rounded-md bg-muted" />
        <div className="h-11 w-32 rounded-md bg-muted" />
      </div>
    </div>
  );
}
