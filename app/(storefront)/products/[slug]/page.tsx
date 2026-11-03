import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getProductBySlug } from "@/lib/db/queries/products";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";

import { ProductDetail, ProductDetailSkeleton } from "./_components/product-detail";

type ProductDetailPageProps = PageProps<"/products/[slug]">;

/** Social previews clip long copy themselves, usually mid-word. */
function toSocialDescription(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * Only the product-specific fields are passed: the brand, locale, preview card
 * fallback and `og:url` come from `buildPageMetadata`.
 */
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // Unknown, draft, archived and soft-deleted slugs all land here. The 404 UI
  // needs a title, but no canonical URL, so the rest stays with the layout.
  if (!product) {
    return { title: "Product not found" };
  }

  const description = toSocialDescription(
    product.description?.trim() || `${product.title} from the ${SITE_NAME} catalogue.`,
  );

  // `imageUrl` holds the first gallery photo, so this is the photo the page opens on.
  const image = product.imageUrl ? { url: product.imageUrl, alt: product.title } : undefined;

  return buildPageMetadata({
    title: product.title,
    description,
    path: `/products/${product.slug}`,
    image,
  });
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
