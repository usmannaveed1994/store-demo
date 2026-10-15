import Image from "next/image";
import Link from "next/link";

import { BuyButton } from "@/components/buy-button";
import { isRemoteUrl } from "@/lib/images";
import type { ProductDto } from "@/lib/products/dto";
import { getPricing } from "@/lib/products/presentation";

type ProductCardProps = {
  product: ProductDto;
};

/**
 * One catalogue tile. Presentational only — the grid owns the data.
 *
 * The tile opens `/products/[slug]` through a stretched link: an absolutely
 * positioned `<Link>` covering the card, rather than an `<a>` wrapped around
 * everything. The quick-buy button has to live inside the card too, and a
 * `<button>` nested inside an `<a>` is invalid markup. `isolate` gives the card
 * a stacking context of its own so the link's `z-10` and the button's `z-20`
 * stack predictably instead of depending on DOM order.
 */
export function ProductCard({ product }: ProductCardProps) {
  const pricing = getPricing(product);
  const isSoldOut = product.stock <= 0;

  return (
    <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-colors hover:border-foreground/25 focus-within:border-foreground/25 focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        {product.imageUrl ? (
          <Image
            // The heading right below already names the product, so the photo
            // is decorative and gets an empty alt to avoid repeating it.
            alt=""
            src={product.imageUrl}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized={isRemoteUrl(product.imageUrl)}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/10">
            <span aria-hidden className="text-3xl font-semibold tracking-tight text-muted-foreground/60">
              {product.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {pricing.compareAt ? (
          <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background">
            Sale
          </span>
        ) : null}

        {isSoldOut ? (
          <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
            Sold out
          </span>
        ) : null}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <BuyButton size="sm" stock={product.stock} className="shadow-md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-base font-medium leading-snug text-foreground">{product.title}</h2>

        {product.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-base font-semibold text-foreground">{pricing.price}</span>
          {pricing.compareAt ? (
            <span className="text-sm text-muted-foreground line-through">{pricing.compareAt}</span>
          ) : null}
        </div>
      </div>

      {/*
        Covers the whole tile, so clicking anywhere on the card opens the
        product. The label names the destination for screen readers, because
        the anchor itself has no text.
      */}
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View details for ${product.title}`}
        className="absolute inset-0 z-10"
      />
    </article>
  );
}
