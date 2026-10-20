"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartLineDto } from "@/lib/cart/dto";
import { isRemoteUrl } from "@/lib/images";
import { formatPrice } from "@/lib/products/presentation";

type CartLineProps = {
  line: CartLineDto;
  /** True while a mutation for this line is in flight, so its controls lock. */
  isBusy: boolean;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
};

/**
 * One cart row.
 *
 * A product that is no longer sellable keeps its row — with its price and a
 * Remove button — instead of vanishing silently between visits, which would make
 * the subtotal look wrong without an explanation.
 */
export function CartLine({ line, isBusy, onChangeQuantity, onRemove }: CartLineProps) {
  const atStockLimit = line.quantity >= line.stock;

  return (
    <li className="flex gap-4 border-b border-border py-5 last:border-b-0 sm:gap-6">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-24">
        {line.imageUrl ? (
          <Image
            alt=""
            src={line.imageUrl}
            fill
            sizes="96px"
            unoptimized={isRemoteUrl(line.imageUrl)}
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/10">
            <span aria-hidden className="text-lg font-semibold tracking-tight text-muted-foreground/60">
              {line.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <Link
              href={`/products/${line.slug}`}
              className="font-medium text-foreground hover:underline"
            >
              {line.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPrice(line.unitPrice, line.currency)} each
            </p>
          </div>

          <p className="text-sm font-semibold text-foreground">
            {line.lineTotal ? formatPrice(line.lineTotal, line.currency) : "Unavailable"}
          </p>
        </div>

        {line.isAvailable ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border border-border">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Decrease quantity of ${line.title}`}
                disabled={isBusy || line.quantity <= 1}
                onClick={() => onChangeQuantity(line.quantity - 1)}
              >
                −
              </Button>
              <span aria-live="polite" className="min-w-8 text-center text-sm tabular-nums">
                {line.quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Increase quantity of ${line.title}`}
                disabled={isBusy || atStockLimit}
                onClick={() => onChangeQuantity(line.quantity + 1)}
              >
                +
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={onRemove}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 aria-hidden className="size-4" />
              Remove
            </Button>

            {atStockLimit ? (
              <span className="text-xs text-muted-foreground">Only {line.stock} available</span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">
              No longer available — remove it to continue.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={onRemove}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 aria-hidden className="size-4" />
              Remove
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
