"use client";

import { useMutation } from "@tanstack/react-query";

import { checkoutApi } from "./api";
import type { CheckoutResponse, ShippingDetails } from "./dto";

/**
 * Starts the hosted checkout.
 *
 * Redirecting in `onSuccess` keeps the pending state alive until the browser
 * leaves for Stripe; re-enabling the button between the response and the
 * navigation would invite a second order.
 */
export function useStartCheckout() {
  return useMutation<CheckoutResponse, Error, ShippingDetails>({
    mutationFn: checkoutApi.start,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}
