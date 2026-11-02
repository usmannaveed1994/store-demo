"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import posthog from "posthog-js";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useAddToCart } from "@/lib/cart/hooks";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  productId: string;
  /** Units on hand; zero or less disables the button, the same rule `BuyButton` uses. */
  stock: number;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  /** Swaps the label for a round cart icon, for spots too tight for text. */
  iconOnly?: boolean;
  className?: string;
};

/** How long the success label stays up before the button resets. */
const FEEDBACK_DURATION_MS = 2000;

export function AddToCartButton({
  productId,
  stock,
  size = "lg",
  variant = "secondary",
  iconOnly = false,
  className,
}: AddToCartButtonProps) {
  const addToCart = useAddToCart();
  const [justAdded, setJustAdded] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const soldOut = stock <= 0;

  function handleClick() {
    addToCart.mutate(productId, {
      onSuccess: () => {
        posthog.capture("cart_item_added", { product_id: productId });
        setJustAdded(true);

        if (resetTimer.current !== null) {
          window.clearTimeout(resetTimer.current);
        }

        resetTimer.current = window.setTimeout(() => setJustAdded(false), FEEDBACK_DURATION_MS);
      },
    });
  }

  const label = addToCart.isPending ? "Adding…" : justAdded ? "Added" : "Add to cart";
  const message = addToCart.error ? addToCart.error.message : justAdded ? "Added to cart." : "";

  return (
    <div className={cn("flex flex-col gap-1", iconOnly && "items-end")}>
      <Button
        type="button"
        size={iconOnly ? "icon" : size}
        variant={variant}
        disabled={soldOut || addToCart.isPending}
        onClick={handleClick}
        // The icon carries no text, so the state has to be named here.
        aria-label={iconOnly ? (soldOut ? "Sold out" : "Add to cart") : undefined}
        className={cn(!iconOnly && "w-full", iconOnly && "rounded-full", className)}
      >
        {iconOnly ? (
          justAdded ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <ShoppingCart aria-hidden className="size-4" />
          )
        ) : (
          label
        )}
      </Button>

      {/* Always mounted so the result of a click is announced, not only shown. */}
      <p
        aria-live="polite"
        className={cn(
          "text-xs",
          addToCart.error ? "text-destructive" : "sr-only",
          iconOnly && "max-w-32 text-right",
        )}
      >
        {message}
      </p>
    </div>
  );
}
