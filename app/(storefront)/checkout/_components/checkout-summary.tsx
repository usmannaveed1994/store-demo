"use client";

import { useCartQuery } from "@/lib/cart/hooks";
import { SHIPPING_FLAT_RATE_CENTS } from "@/lib/checkout/config";
import { getCheckoutTotals } from "@/lib/checkout/pricing";
import { formatPrice } from "@/lib/products/presentation";

/**
 * What the shopper is about to pay.
 *
 * Reads the same `["cart"]` query the form does, so the two cannot show
 * different baskets, and totals come from the shared pricing helper rather than
 * being re-added here.
 */
export function CheckoutSummary() {
  const { data, isPending, isError } = useCartQuery();

  if (isPending) {
    return (
      <aside aria-hidden className="animate-pulse rounded-xl border border-border bg-card p-6">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="mt-5 flex flex-col gap-3">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
        <div className="mt-6 h-9 w-full rounded bg-muted" />
      </aside>
    );
  }

  if (isError || !data.subtotal || !data.currency) {
    return (
      <aside className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Order summary
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {isError
            ? "We could not load your cart. Refresh to try again."
            : "Totals appear once your cart loads."}
        </p>
      </aside>
    );
  }

  const currency = data.currency;
  const totals = getCheckoutTotals(data.subtotal);

  return (
    <aside className="rounded-xl border border-border bg-card p-6 text-card-foreground lg:sticky lg:top-24">
      <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        Order summary
      </h2>

      <ul className="mt-4 divide-y divide-border">
        {data.lines.map((line) => (
          <li key={line.productId} className="flex items-start justify-between gap-4 py-3 text-sm">
            <span className="text-foreground">
              {line.title}
              <span className="text-muted-foreground"> × {line.quantity}</span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {line.lineTotal ? formatPrice(line.lineTotal, currency) : "—"}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums text-foreground">{formatPrice(totals.subtotal, currency)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="tabular-nums text-foreground">
            {SHIPPING_FLAT_RATE_CENTS === 0 ? "Free" : formatPrice(totals.shipping, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(totals.total, currency)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Taxes are included where applicable. Payment is taken on Stripe&apos;s secure page.
      </p>
    </aside>
  );
}
