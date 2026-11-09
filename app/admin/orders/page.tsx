import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/authorization";
import { readPage, readParam } from "@/lib/admin/search-params";
import { listOrders } from "@/lib/db/queries/orders";
import type { OrderFulfillmentStatus, OrderStatus } from "@/lib/db/schema";
import {
  FULFILLMENT_BADGE_VARIANT,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/presentation";
import {
  FULFILLMENT_STATUS_OPTIONS,
  FULFILLMENT_STATUS_VALUES,
  PAYMENT_FILTER_OPTIONS,
  PAYMENT_FILTER_VALUES,
} from "@/lib/orders/validation";
import { formatPrice } from "@/lib/products/presentation";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFulfillment(value: string): OrderFulfillmentStatus | undefined {
  return FULFILLMENT_STATUS_VALUES.has(value) ? (value as OrderFulfillmentStatus) : undefined;
}

function readPayment(value: string): OrderStatus | undefined {
  return PAYMENT_FILTER_VALUES.has(value) ? (value as OrderStatus) : undefined;
}

/** Current filters, carried across pagination. */
function listHref(
  page: number,
  search: string,
  payment?: OrderStatus,
  fulfillment?: OrderFulfillmentStatus,
) {
  return {
    pathname: "/admin/orders",
    query: {
      ...(search ? { q: search } : {}),
      ...(payment ? { payment } : {}),
      ...(fulfillment ? { fulfillment } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  };
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const search = readParam(params.q).trim();
  const payment = readPayment(readParam(params.payment));
  const fulfillment = readFulfillment(readParam(params.fulfillment));
  const page = readPage(readParam(params.page));

  // One extra row answers "is there a next page?" without a second count query.
  const rows = await listOrders({
    search: search || undefined,
    payment,
    fulfillment,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });

  const hasNextPage = rows.length > PAGE_SIZE;
  const orders = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const hasFilters = Boolean(search || payment || fulfillment);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length === 0
            ? "Nothing to show."
            : `Showing ${orders.length} order${orders.length === 1 ? "" : "s"}${
                page > 1 ? ` from page ${page}` : ""
              }.`}
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4"
      >
        <label htmlFor="q" className="sr-only">
          Search orders
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Search number, email or name"
          className="h-9 w-full sm:w-72"
        />

        <label htmlFor="payment" className="sr-only">
          Filter by payment status
        </label>
        <NativeSelect
          id="payment"
          name="payment"
          defaultValue={payment ?? ""}
          className="h-9 w-full sm:w-44"
        >
          <option value="">All payments</option>
          {PAYMENT_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <label htmlFor="fulfillment" className="sr-only">
          Filter by fulfilment stage
        </label>
        <NativeSelect
          id="fulfillment"
          name="fulfillment"
          defaultValue={fulfillment ?? ""}
          className="h-9 w-full sm:w-44"
        >
          <option value="">All stages</option>
          {FULFILLMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <Button type="submit" variant="secondary">
          Filter
        </Button>

        {hasFilters ? (
          <Button variant="ghost" asChild>
            <Link href="/admin/orders">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Fulfilment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No orders match these filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="block text-sm font-medium text-foreground hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="block max-w-56 truncate text-xs text-muted-foreground">
                        {order.customerName} · {order.customerEmail}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {DATE_TIME_FORMAT.format(order.createdAt)}
                  </TableCell>

                  <TableCell>
                    <Badge variant={PAYMENT_BADGE_VARIANT[order.status]}>
                      {PAYMENT_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant={FULFILLMENT_BADGE_VARIANT[order.fulfillmentStatus]}>
                      {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right text-sm tabular-nums text-foreground">
                    {formatPrice(order.total, order.currency)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/orders/${order.id}`}>View</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page === 1}>
          {page > 1 ? (
            <Link href={listHref(page - 1, search, payment, fulfillment)}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>

        <span className="text-sm text-muted-foreground">Page {page}</span>

        <Button variant="outline" size="sm" asChild={hasNextPage} disabled={!hasNextPage}>
          {hasNextPage ? (
            <Link href={listHref(page + 1, search, payment, fulfillment)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </nav>
    </div>
  );
}
