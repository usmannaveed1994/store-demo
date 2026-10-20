"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartDto } from "@/lib/cart/dto";
import {
  useCartQuery,
  useClearCart,
  useRemoveCartItem,
  useSetCartItemQuantity,
} from "@/lib/cart/hooks";
import { formatPrice } from "@/lib/products/presentation";

import { CartLine } from "./cart-line";

const SKELETON_ROWS = 3;

/**
 * The cart page body.
 *
 * It reads the same `["cart"]` query the header badge does, so both are filled by
 * one request and every mutation updates them together.
 */
export function CartView() {
  const { data, error, isPending, isError, isRefetching, refetch } = useCartQuery();

  if (isPending) {
    return <CartSkeleton />;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-8 text-center"
      >
        <p className="text-sm text-foreground">{error.message}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={isRefetching}
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (data.lines.length === 0) {
    return <EmptyCart />;
  }

  return <CartContents cart={data} />;
}

function CartContents({ cart }: { cart: CartDto }) {
  const setQuantity = useSetCartItemQuantity();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  // One line is locked at a time, which is enough to stop double clicks without
  // disabling the whole list.
  const busyProductId = setQuantity.isPending
    ? setQuantity.variables?.productId
    : removeItem.isPending
      ? removeItem.variables
      : undefined;

  const mutationError = setQuantity.error ?? removeItem.error ?? clearCart.error;
  const subtotal = cart.subtotal && cart.currency ? formatPrice(cart.subtotal, cart.currency) : null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <p className="text-sm text-muted-foreground">
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={clearCart.isPending}
          onClick={() => clearCart.mutate()}
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 aria-hidden className="size-4" />
          {clearCart.isPending ? "Clearing…" : "Clear cart"}
        </Button>
      </div>

      {mutationError ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
        >
          {mutationError.message}
        </p>
      ) : null}

      <ul>
        {cart.lines.map((line) => (
          <CartLine
            key={line.productId}
            line={line}
            isBusy={busyProductId === line.productId}
            onChangeQuantity={(quantity) =>
              setQuantity.mutate({ productId: line.productId, quantity })
            }
            onRemove={() => removeItem.mutate(line.productId)}
          />
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-5 border-t border-border pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Subtotal
          </p>
          {/* Not `0.00` when nothing is buyable: the total is genuinely unknown. */}
          <p className="mt-1 text-2xl font-semibold text-foreground">{subtotal ?? "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Shipping and taxes are calculated at checkout.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" disabled className="h-12 px-10 text-base font-semibold">
            Checkout
          </Button>
          <p className="text-xs text-muted-foreground">Checkout is not wired up yet.</p>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">Your cart is empty.</p>
      <Button asChild size="lg" className="mt-5">
        <Link href="/collections">Browse the catalogue</Link>
      </Button>
    </div>
  );
}

/** Mirrors the row layout so the page does not jump when the cart resolves. */
function CartSkeleton() {
  return (
    <div aria-hidden className="mt-8 animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />

      <ul className="mt-6">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li
            key={index}
            className="flex gap-4 border-b border-border py-5 last:border-b-0 sm:gap-6"
          >
            <div className="size-20 shrink-0 rounded-lg bg-muted sm:size-24" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-28 rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
