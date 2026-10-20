import Image from "next/image";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { BuyButton } from "@/components/buy-button";
import { getProductBySlug } from "@/lib/db/queries/products";
import { isRemoteUrl } from "@/lib/images";
import { getPricing } from "@/lib/products/presentation";

/** Below this many units the stock line warns instead of just counting. */
const LOW_STOCK_THRESHOLD = 5;

type ProductDetailProps = {
  /**
   * The route's `params` promise, handed down unresolved.
   *
   * Awaiting it here rather than in the page is what keeps the route instant:
   * nothing above this `<Suspense>` boundary reads runtime data, so the frame
   * and the skeleton can be prerendered and prefetched, and the product streams
   * in as the row resolves.
   */
  params: Promise<{ slug: string }>;
};

/**
 * One product, full width of the storefront.
 *
 * The row comes from `getProductBySlug`, the same reader the catalogue endpoints
 * are built on, so "is this product public?" is answered in one place: that
 * query only returns an `active`, non-deleted row, which is why an unknown slug,
 * a `draft`, an `archived` row and a soft-deleted one all end up in the 404 UI
 * below.
 *
 * Because the boundary above has already streamed its fallback, that
 * `notFound()` can no longer set the status code: the 404 UI renders inside a
 * `200` and Next adds `noindex`. Letting the route block
 * (`export const instant = false`) would buy a real `404` at the cost of the
 * instant navigation this route is otherwise able to offer.
 */
export async function ProductDetail({ params }: ProductDetailProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const pricing = getPricing(product);
  const soldOut = product.stock <= 0;

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        {product.imageUrl ? (
          <Image
            // The heading beside the photo already names the product.
            alt=""
            src={product.imageUrl}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            unoptimized={isRemoteUrl(product.imageUrl)}
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/10">
            <span aria-hidden className="text-5xl font-semibold tracking-tight text-muted-foreground/60">
              {product.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {soldOut ? <Badge>Sold out</Badge> : null}
          {pricing.compareAt ? (
            <Badge>Sale{pricing.discountPercent ? ` · ${pricing.discountPercent}% off` : ""}</Badge>
          ) : null}
          {product.isFeatured ? <Badge>Featured</Badge> : null}
        </div>

        <div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {product.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-foreground">{pricing.price}</span>
            {pricing.compareAt ? (
              <span className="text-lg text-muted-foreground line-through">{pricing.compareAt}</span>
            ) : null}
          </div>
        </div>

        {product.description ? (
          <p className="max-w-prose text-pretty text-muted-foreground">{product.description}</p>
        ) : null}

        {/*
          The page's primary actions. Buy now keeps the checkout placeholder and
          Add to cart writes to the saved cart, so the shopper can keep browsing.
          `h-12` overrides the `lg` height so the pair is unmistakably the thing
          to press.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          <BuyButton stock={product.stock} className="h-12 text-base font-semibold shadow-md" />
          <AddToCartButton
            productId={product.id}
            stock={product.stock}
            className="h-12 text-base font-semibold shadow-md"
          />
        </div>

        <dl className="grid gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-2">
          <Spec label="Availability" value={describeStock(product.stock)} />
          {product.sku ? <Spec label="SKU" value={product.sku} /> : null}
          <Spec label="Currency" value={product.currency} />
          <Spec label="Added" value={formatDate(product.createdAt)} />
          <Spec label="Last updated" value={formatDate(product.updatedAt)} />
        </dl>
      </div>
    </div>
  );
}

/**
 * Placeholder shown while the row above streams in.
 *
 * It mirrors the two-column layout, so the page frame does not jump when the
 * product arrives.
 */
export function ProductDetailSkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-10 lg:grid-cols-2 lg:gap-14">
      <div className="aspect-square rounded-2xl border border-border bg-muted" />

      <div className="flex flex-col gap-6">
        <div className="h-6 w-24 rounded-full bg-muted" />
        <div className="h-9 w-3/4 rounded bg-muted" />
        <div className="h-7 w-32 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-12 w-full rounded-md bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

/** A small pill for the states a product can be in. */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

/** One row of the specification list. */
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Wording for the stock count: none, nearly none, or plenty. */
function describeStock(stock: number): string {
  if (stock <= 0) {
    return "Sold out";
  }

  return stock <= LOW_STOCK_THRESHOLD ? `Only ${stock} left` : `${stock} in stock`;
}

/**
 * Formats a catalogue timestamp on the server.
 *
 * Drizzle hands back `Date` instances for `created_at` / `updated_at`, so this
 * formats rather than parses. The locale is pinned rather than taken from the
 * host so a row always reads the same way, whatever locale the build or the
 * server happens to run with.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value);
}
