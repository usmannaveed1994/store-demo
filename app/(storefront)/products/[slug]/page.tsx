import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getProductBySlug } from "@/lib/db/queries/products";

import { ProductDetail, ProductDetailSkeleton } from "./_components/product-detail";

type ProductDetailPageProps = PageProps<"/products/[slug]">;

/**
 * Metadata for one product.
 *
 * Reading `params` and the product here is request-time work, which Cache
 * Components only permits when the rest of the route defers too. It does: the
 * `params` promise is awaited inside the `<Suspense>` boundary below, so the
 * shell still prerenders and both the metadata and the product stream in with
 * the request.
 *
 * Both this and `ProductDetail` read the row with `getProductBySlug`, so the two
 * cannot disagree about whether a slug exists, and neither waits on an HTTP call
 * to this app's own API. The cost of that is two point reads of the same unique
 * index per view instead of one; wrapping the query in React's `cache` is the
 * answer if that ever shows up in a profile.
 */
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // A slug with no published row — unknown, draft, archived or deleted — still
  // needs a title, because `ProductDetail` renders the 404 UI for it.
  if (!product) {
    return { title: "Product not found — Diecast 64" };
  }

  return {
    title: `${product.title} — Diecast 64`,
    description: product.description ?? `${product.title} from the Diecast 64 catalogue.`,
  };
}

/**
 * Product detail route, reached from a catalogue tile.
 *
 * The page itself is not `async`: it hands the unresolved `params` promise to
 * `ProductDetail` and lets that component await it inside a `<Suspense>`
 * boundary. Because nothing above the boundary touches runtime data, the frame
 * and the skeleton prerender and prefetch, and the product streams in as the
 * row arrives (`◐` in `next build`, not a blocking `ƒ`).
 *
 * The trade-off of that shape is the status code for a slug that does not
 * exist. Starting the stream fixes the response at `200`, so `ProductDetail`'s
 * `notFound()` renders the 404 UI inside a `200` and lets Next inject `noindex`
 * — the documented behaviour for a mid-stream `notFound()`. A hard `404` would
 * mean letting this route block with `export const instant = false`, giving up
 * the instant navigation for URLs only crawlers and API clients see. Revisit if
 * that ever matters more than the navigation.
 *
 * `generateStaticParams` is deliberately absent: listing slugs would make
 * `next build` query Postgres from the build machine, and `DATABASE_URL` is a
 * runtime concern, the same reason `GET /api/products` calls `connection()`.
 */
export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span> Back to collections
        </Link>

        <div className="mt-8">
          <Suspense fallback={<ProductDetailSkeleton />}>
            <ProductDetail params={params} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
