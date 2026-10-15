import type { Product } from "@/lib/db/schema";

/**
 * The columns a price is read from.
 *
 * Declared as a `Pick` rather than a `Product` so both the database row and its
 * JSON form (`ProductDto`, which only differs in its timestamps) satisfy it,
 * and the money rules below can be shared by server and client components.
 */
type PricedProduct = Pick<Product, "price" | "compareAtPrice" | "currency">;

/** Selling price and optional "was" price, already formatted for display. */
export type ProductPricing = {
  price: string;
  /** Formatted "was" price, only set when the product is genuinely reduced. */
  compareAt: string | null;
  /** Whole-percent saving implied by `compareAt`, or `null` when there is none. */
  discountPercent: number | null;
};

/**
 * Formats a `numeric` price (a string straight from Postgres) as currency,
 * falling back to the raw value when `Intl` does not recognise the code.
 */
export function formatPrice(amount: string, currency: string): string {
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
 * Works out what a product should show as its price.
 *
 * `compareAtPrice` is only meaningful when it is set *and* higher than `price`,
 * so both checks live here rather than in the markup. A malformed value never
 * reaches a component: `numeric` columns travel as strings, and a non-numeric
 * one would otherwise render as `NaN` inside a badge rather than as no sale.
 */
export function getPricing(product: PricedProduct): ProductPricing {
  const price = formatPrice(product.price, product.currency);
  const compareAtPrice = product.compareAtPrice;

  if (compareAtPrice === null) {
    return { price, compareAt: null, discountPercent: null };
  }

  const selling = Number(product.price);
  const was = Number(compareAtPrice);

  if (!Number.isFinite(selling) || !Number.isFinite(was) || was <= selling) {
    return { price, compareAt: null, discountPercent: null };
  }

  return {
    price,
    compareAt: formatPrice(compareAtPrice, product.currency),
    discountPercent: Math.round((1 - selling / was) * 100),
  };
}
