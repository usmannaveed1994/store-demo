"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CART_QUERY_KEY } from "@/lib/cart/api";

/**
 * Drops the cached cart once a payment has gone through.
 *
 * The cart is emptied on the server during fulfilment, not here: the browser may
 * never see the webhook. Refetching is enough to blank the header badge and the
 * cart page without a full reload.
 */
export function CartCacheReset() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
  }, [queryClient]);

  return null;
}
