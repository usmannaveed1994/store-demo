import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/authorization";
import { isUuid } from "@/lib/cart/validation";
import { getOrderById } from "@/lib/db/queries/orders";
import {
  FULFILLMENT_BADGE_VARIANT,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/presentation";
import { formatPrice } from "@/lib/products/presentation";

import { FulfillmentForm } from "../_components/fulfillment-form";
import { PaymentForm } from "../_components/payment-form";
import { TrackingForm } from "../_components/tracking-form";
import { saveTracking } from "../actions";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={strong ? "font-semibold tabular-nums text-foreground" : "tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * One order, with everything the admin can change about it.
 *
 * Cancelling is final, so the forms below freeze once the order is cancelled
 * rather than offering an edit the queries would silently refuse.
 */
export default async function AdminOrderDetailsPage({ params }: OrderDetailsPageProps) {
  await requireAdmin();

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const record = order.order;
  const currency = record.currency;
  const isCancelled = record.fulfillmentStatus === "cancelled";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="-ml-3 w-fit">
          <Link href="/admin/orders">← All orders</Link>
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Order {record.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              Placed {DATE_TIME_FORMAT.format(record.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PAYMENT_BADGE_VARIANT[record.status]}>
              {PAYMENT_STATUS_LABELS[record.status]}
            </Badge>
            <Badge variant={FULFILLMENT_BADGE_VARIANT[record.fulfillmentStatus]}>
              {FULFILLMENT_STATUS_LABELS[record.fulfillmentStatus]}
            </Badge>
          </div>
        </header>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="block text-sm font-medium text-foreground">
                        {item.productTitle}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        /{item.productSlug}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatPrice(item.unitPrice, currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatPrice(item.lineTotal, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
              <MoneyRow label="Subtotal" value={formatPrice(record.subtotal, currency)} />
              <MoneyRow
                label="Shipping"
                value={
                  Number(record.shippingTotal) === 0
                    ? "Free"
                    : formatPrice(record.shippingTotal, currency)
                }
              />
              <MoneyRow label="Total" value={formatPrice(record.total, currency)} strong />
            </dl>
          </Panel>

          <Panel title="Customer">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Name" value={record.customerName} />
              <Detail
                label="Email"
                value={
                  <a href={`mailto:${record.customerEmail}`} className="hover:underline">
                    {record.customerEmail}
                  </a>
                }
              />
              <Detail label="Phone" value={record.customerPhone ?? "—"} />
              <Detail label="Account" value={record.userId ? "Registered customer" : "Guest"} />
            </dl>

            <div className="border-t border-border pt-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Shipping address
              </p>
              <address className="mt-2 not-italic leading-relaxed text-sm text-foreground">
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
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Payment" description="For money that arrived or was refunded elsewhere.">
            <dl className="flex flex-col gap-3">
              <Detail
                label="Paid"
                value={record.paidAt ? DATE_TIME_FORMAT.format(record.paidAt) : "Not paid"}
              />
              <Detail
                label="Stripe session"
                value={
                  <span className="block wrap-anywhere text-xs text-muted-foreground">
                    {record.stripeCheckoutSessionId ?? "—"}
                  </span>
                }
              />
            </dl>

            <div className="border-t border-border pt-4">
              <PaymentForm order={record} />
            </div>
          </Panel>

          <Panel title="Fulfilment" description="Cancelling is final.">
            <dl className="flex flex-col gap-3">
              <Detail
                label="Shipped"
                value={record.shippedAt ? DATE_TIME_FORMAT.format(record.shippedAt) : "—"}
              />
              <Detail
                label="Delivered"
                value={record.deliveredAt ? DATE_TIME_FORMAT.format(record.deliveredAt) : "—"}
              />
            </dl>

            <div className="border-t border-border pt-4">
              {isCancelled ? (
                <p className="text-sm text-muted-foreground">
                  This order was cancelled. Units went back on sale only if the restock box was
                  ticked at the time.
                </p>
              ) : (
                <FulfillmentForm order={record} />
              )}
            </div>
          </Panel>

          <Panel title="Courier" description="Both fields are required together.">
            <TrackingForm
              action={saveTracking}
              orderId={record.id}
              courier={record.courier}
              trackingNumber={record.trackingNumber}
              disabled={isCancelled}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
