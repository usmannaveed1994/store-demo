import Image from "next/image";

import type { ProductDto } from "@/lib/products/dto";

type ProductCardProps = {
  product: ProductDto;
};

type ProductPricing = {
  /** Selling price, already formatted for display. */
  price: string;
  /** Formatted "was" price, only set when the product is genuinely reduced. */
  compareAt: string | null;
};

/**
 * Formats a `numeric` price (a string straight from Postgres) as currency,
 * falling back to the raw value when `Intl` does not recognise the code.
 */
function formatPrice(amount: string, currency: string): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return amount;
  }

  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * `compareAtPrice` is only meaningful when it is set *and* higher than `price`,
 * so both checks live here rather than in the markup.
 */
function getPricing(product: ProductDto): ProductPricing {
  const price = product.price;
  const rawCompareAt = product.compareAtPrice;

  if (rawCompareAt === null) {
    return { price: formatPrice(price, product.currency), compareAt: null };
  }

  const compareAt = Number(rawCompareAt);

  if (!Number.isFinite(compareAt) || compareAt <= Number(price)) {
    return { price: formatPrice(price, product.currency), compareAt: null };
  }

  return { price: formatPrice(price, product.currency), compareAt: formatPrice(rawCompareAt, product.currency) };
}

/**
 * Product images come from arbitrary merchant URLs (a `text` column), so only
 * local paths go through the Next.js image optimiser — remote hosts would need
 * an explicit `images.remotePatterns` allow-list first.
 */
function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** One catalogue tile. Presentational only — the grid owns the data. */
export function ProductCard({ product }: ProductCardProps) {
  const pricing = getPricing(product);
  const isSoldOut = product.stock <= 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-colors hover:border-foreground/25">
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
    </article>
  );
}
