"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartAuthSync, useCartQuery } from "@/lib/cart/hooks";
import { cn } from "@/lib/utils";

/** Badge stops growing at 99+ so the header keeps its width. */
const MAX_BADGE_COUNT = 99;

/** Matches the `--animate-cart-bump` duration in `app/globals.css`. */
const BUMP_DURATION_MS = 250;

/**
 * Header cart link with a live item count.
 *
 * Client-side because the count lives in the React Query cache: a mutation
 * writes the fresh cart there and the badge updates without a server round trip.
 */
export function CartIndicator({ className }: { className?: string }) {
  useCartAuthSync();

  const { data } = useCartQuery();
  const itemCount = data?.itemCount ?? 0;
  const isBumping = useCartBump(data?.itemCount);
  const label = itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart";

  return (
    <Button
      asChild
      variant="ghost"
      size="lg"
      className={cn(
        "h-9 min-w-9 gap-1 has-[>svg]:px-2 sm:h-10 sm:min-w-0 sm:gap-2 sm:has-[>svg]:px-4",
        className,
      )}
    >
      {/* The icon is decorative: `aria-label` already names the link and its count. */}
      <Link
        href="/cart"
        aria-label={label}
        className={cn("shrink-0", isBumping && "motion-safe:animate-cart-bump")}
      >
        <ShoppingCart aria-hidden className="size-4 shrink-0" />
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

/**
 * Flags an addition for one animation cycle by watching the cart count grow.
 *
 * The first count that arrives is the cached cart rather than a click, so it
 * only primes the baseline. Clearing the flag afterwards lets the next addition
 * replay the animation.
 */
function useCartBump(itemCount: number | undefined): boolean {
  const [isBumping, setIsBumping] = useState(false);
  const previousCount = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (itemCount === undefined) {
      return;
    }

    const previous = previousCount.current;
    previousCount.current = itemCount;

    if (previous === null || itemCount <= previous) {
      return;
    }

    setIsBumping(true);

    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }

    resetTimer.current = window.setTimeout(() => setIsBumping(false), BUMP_DURATION_MS);
  }, [itemCount]);

  return isBumping;
}
