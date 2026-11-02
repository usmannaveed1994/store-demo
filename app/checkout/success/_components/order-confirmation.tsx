import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { verifyAndFulfilSession } from "@/lib/checkout/session";
import type { OrderWithItems } from "@/lib/db/queries/orders";
import { formatPrice } from "@/lib/products/presentation";

import { CartCacheReset } from "../../_components/cart-cache-reset";

type SuccessSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Confirmation shown after Stripe redirects back.
 *
 * The session id is only a lookup key: the session is re-read from Stripe, and
 * only a `paid` one fulfils the order. That makes this page a second, idempotent
 * path to the same transition the webhook performs, which covers the second or
 * two where the redirect beats the webhook.
 */
export async function OrderConfirmation({
  searchParams,
}: {
  searchParams: SuccessSearchParams;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const order = sessionId ? await verifyAndFulfilSession(sessionId) : null;

  return order ? <PaidOrder order={order} /> : <Unconfirmed />;
}

function PaidOrder({ order }: { order: OrderWithItems }) {
  const record = order.order;
  const currency = record.currency;
  const firstName = record.customerName.split(" ")[0] || record.customerName;
  const placedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    record.paidAt ?? record.createdAt,
  );

  return (
    <div>
      <CartCacheReset />

      <div className="flex size-12 items-center justify-center rounded-full bg-foreground text-background">
        <Check aria-hidden className="size-6" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Thanks, {firstName}!
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your payment went through. A receipt is on its way to{" "}
        <span className="text-foreground">{record.customerEmail}</span>.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
          <p className="text-sm font-medium text-foreground">
            Order {record.orderNumber}
          </p>
          <p className="text-sm text-muted-foreground">{placedAt}</p>
        </div>

        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <span className="text-foreground">
                {item.productTitle}
                <span className="text-muted-foreground"> × {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal, currency)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-2 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(record.subtotal, currency)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="tabular-nums">
              {Number(record.shippingTotal) === 0
                ? "Free"
                : formatPrice(record.shippingTotal, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total paid</dt>
            <dd className="tabular-nums">{formatPrice(record.total, currency)}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-border pt-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Delivering to
          </p>
          <address className="mt-2 not-italic leading-relaxed text-foreground">
            {record.customerName}
            <br />
            {record.shippingLine1}
            {record.shippingLine2 ? (
              <>
                <br />
                {record.shippingLine2}
              </>
            ) : null}
            <br />
            {record.shippingCity}
            {record.shippingState ? `, ${record.shippingState}` : ""} {record.shippingPostalCode}
            <br />
            {record.shippingCountry}
          </address>
        </div>
      </div>

      <Button asChild size="lg" className="mt-8">
        <Link href="/collections">Keep shopping</Link>
      </Button>
    </div>
  );
}

/**
 * Shown when Stripe has not confirmed the money yet.
 *
 * Deliberately says nothing about failure: a delayed payment method can still
 * settle, and the webhook will fulfil the order when it does.
 */
function Unconfirmed() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        We&apos;re confirming your payment
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Stripe has not confirmed this payment yet. Refresh this page in a moment — if you were
        charged, a receipt will arrive at the email address you entered.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/collections">Back to the catalogue</Link>
      </Button>
    </div>
  );
}

export function ConfirmationSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="size-12 rounded-full bg-muted" />
      <div className="mt-6 h-9 w-64 rounded bg-muted" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-muted" />
      <div className="mt-8 h-80 rounded-xl bg-muted" />
      <div className="mt-8 h-11 w-40 rounded-md bg-muted" />
    </div>
  );
}

