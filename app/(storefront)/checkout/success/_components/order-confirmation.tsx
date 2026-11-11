import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ENABLE_STRIPE, PAYMENT_DETAILS, whatsappLink, whatsappOrderLink } from "@/lib/checkout/config";
import { verifyAndFulfilSession } from "@/lib/checkout/session";
import { findOrderByNumber, type OrderWithItems } from "@/lib/db/queries/orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders/presentation";
import { formatPrice } from "@/lib/products/presentation";

import { CartCacheReset } from "../../_components/cart-cache-reset";

type SuccessSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Confirmation page.
 *
 * With `ENABLE_STRIPE` off the order is read straight from `?order=`, the number
 * the shopper was given to quote on WhatsApp — there is no payment to verify.
 * With it on, `?session_id=` is only a lookup key: the session is re-read from
 * Stripe and only a `paid` one fulfils the order, which makes this page a
 * second, idempotent path to the transition the webhook performs.
 */
export async function OrderConfirmation({
  searchParams,
}: {
  searchParams: SuccessSearchParams;
}) {
  const params = await searchParams;

  if (!ENABLE_STRIPE) {
    const orderNumber = typeof params.order === "string" ? params.order : null;
    const order = orderNumber ? await findOrderByNumber(orderNumber) : null;

    return order ? <PlacedOrder order={order} /> : <OrderNotFound />;
  }

  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const order = sessionId ? await verifyAndFulfilSession(sessionId) : null;

  return order ? <PaidOrder order={order} /> : <Unconfirmed />;
}

/**
 * Confirmation of a manually placed order.
 *
 * Not a payment receipt: the money may still be on its way, so the copy explains
 * how to pay and how to reach the order desk instead of thanking the shopper for
 * a payment that has not happened yet.
 */
function PlacedOrder({ order }: { order: OrderWithItems }) {
  const record = order.order;
  const placedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    record.createdAt,
  );

  return (
    <div>
      <CartCacheReset />

      <div className="flex size-12 items-center justify-center rounded-full bg-foreground text-background">
        <Check aria-hidden className="size-6" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Order placed
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Thank you! Your order number is{" "}
        <span className="font-semibold text-foreground">{record.orderNumber}</span>. Quote it in any
        message about this order.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-sm font-medium text-foreground">Talk to our order department</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Message us on WhatsApp with your order number and we will confirm the payment and the
          delivery.
        </p>
        <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
          <a href={whatsappOrderLink(record.orderNumber)} target="_blank" rel="noreferrer">
            Chat on WhatsApp
          </a>
        </Button>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-sm font-medium text-foreground">What happens next</h2>

        <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">💵 If you chose cash on delivery</p>
            <p>No action is needed right now. Keep the payment ready for our delivery partner.</p>
          </div>

          <div>
            <p className="font-medium text-foreground">💳 If you chose bank transfer</p>
            <p>
              Transfer the total to our official SadaPay account to complete the purchase: account
              title {PAYMENT_DETAILS.accountTitle}, account number {PAYMENT_DETAILS.accountNumber},
              IBAN {PAYMENT_DETAILS.iban}.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">📲 After paying</p>
            <p>
              Send a screenshot of the receipt on WhatsApp to {PAYMENT_DETAILS.whatsappNumber},
              together with your order number.
            </p>
          </div>

          <p className="font-medium text-foreground">🚀 Thank you for shopping with us!</p>
        </div>
      </section>

      <OrderDetails order={order} placedAt={placedAt} />
    </div>
  );
}

function OrderDetails({ order, placedAt }: { order: OrderWithItems; placedAt: string }) {
  const record = order.order;
  const currency = record.currency;

  return (
    <>
      <section className="mt-6 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
          <h2 className="text-sm font-medium text-foreground">Order {record.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">{placedAt}</p>
        </div>

        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <span className="text-foreground">
                {item.productTitle}
                <span className="text-muted-foreground">
                  {" "}
                  × {item.quantity} · {formatPrice(item.unitPrice, currency)} each
                </span>
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
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(record.total, currency)}</dd>
          </div>
        </dl>

        <dl className="mt-6 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <DetailRow label="Payment method" value={PAYMENT_METHOD_LABELS[record.paymentMethod]} />
          <DetailRow label="Name" value={record.customerName} />
          <DetailRow label="Phone" value={record.customerPhone ?? "—"} />
          <DetailRow label="Email" value={record.customerEmail} />
        </dl>

        <div className="mt-4 border-t border-border pt-4 text-sm">
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
      </section>

      <Button asChild size="lg" className="mt-8">
        <Link href="/collections">Keep shopping</Link>
      </Button>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
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

/**
 * Shown for an unknown or truncated `?order=` value.
 *
 * Says what to do rather than what went wrong: a shared link can lose its last
 * characters, and the order desk can still find the order from the number.
 */
function OrderNotFound() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        We could not find that order
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Check that the link is complete, or message our order department with the order number and
        we will look it up for you.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/collections">Back to the catalogue</Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href={whatsappLink("Hi, I would like to check on my order.")}
            target="_blank"
            rel="noreferrer"
          >
            Chat on WhatsApp
          </a>
        </Button>
      </div>
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

