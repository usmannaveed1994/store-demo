"use client";

import { useMutation } from "@tanstack/react-query";

import { checkoutApi } from "./api";
import type { CheckoutRequest, CheckoutResponse } from "./dto";

/**
 * Starts the checkout.
 *
 * Redirecting in `onSuccess` keeps the pending state alive until the browser
 * leaves the page; re-enabling the button between the response and the
 * navigation would invite a second order.
 */
export function useStartCheckout() {
  return useMutation<CheckoutResponse, Error, CheckoutRequest>({
    mutationFn: checkoutApi.start,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}
