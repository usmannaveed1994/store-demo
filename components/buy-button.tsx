import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BuyButtonProps = {
  /**
   * Units on hand. `0` (or less) is the sold-out state, so every caller gets the
   * same rule instead of reimplementing it — which is also why the label is not
   * a prop: the two states are the button's behaviour, not its styling.
   */
  stock: number;
  size?: ButtonProps["size"];
  className?: string;
};

export function BuyButton({ stock, size = "lg", className }: BuyButtonProps) {
  const soldOut = stock <= 0;

  return (
    <Button type="button" size={size} disabled={soldOut} className={cn("w-full", className)}>
      {soldOut ? "Sold out" : "Buy now"}
    </Button>
  );
}
