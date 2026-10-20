"use client";

import { useEffect, useRef, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useAddToCart } from "@/lib/cart/hooks";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  productId: string;
  /** Units on hand; zero or less disables the button, the same rule `BuyButton` uses. */
  stock: number;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

/** How long the success label stays up before the button resets. */
const FEEDBACK_DURATION_MS = 2000;

export function AddToCartButton({
  productId,
  stock,
  size = "lg",
  variant = "secondary",
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
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={soldOut || addToCart.isPending}
        onClick={handleClick}
        className={cn("w-full", className)}
      >
        {label}
      </Button>

      {/* Always mounted so the result of a click is announced, not only shown. */}
      <p
        aria-live="polite"
        className={cn("text-xs", addToCart.error ? "text-destructive" : "sr-only")}
      >
        {message}
      </p>
    </div>
  );
}
