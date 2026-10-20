"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartAuthSync, useCartQuery } from "@/lib/cart/hooks";

/** Badge stops growing at 99+ so the header keeps its width. */
const MAX_BADGE_COUNT = 99;

/**
 * Header cart link with a live item count.
 *
 * Client-side because the count lives in the React Query cache: a mutation
 * writes the fresh cart there and the badge updates without a server round trip.
 */
export function CartIndicator() {
  useCartAuthSync();

  const { data } = useCartQuery();
  const itemCount = data?.itemCount ?? 0;
  const label = itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart";

  return (
    <Button asChild variant="ghost" size="lg">
      {/* The icon is decorative: `aria-label` already names the link and its count. */}
      <Link href="/cart" aria-label={label}>
        <ShoppingCart aria-hidden className="size-4" />
        {itemCount > 0 ? (
          <span
            aria-hidden
            className="rounded-full bg-red-400 px-1.5 text-xs font-semibold text-white"
          >
            {itemCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : itemCount}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
