"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { cartApi, CART_QUERY_KEY } from "./api";
import type { CartDto } from "./dto";

export function useCartQuery() {
  return useQuery<CartDto>({
    queryKey: CART_QUERY_KEY,
    queryFn: cartApi.get,
    staleTime: 0,
  });
}

/** Every cart mutation answers with the whole cart, so it is cached directly. */
function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<CartDto>) {
  const queryClient = useQueryClient();

  return useMutation<CartDto, Error, TVariables>({
    mutationFn,
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useAddToCart() {
  return useCartMutation((productId: string) => cartApi.addItem(productId));
}

export function useSetCartItemQuantity() {
  return useCartMutation((variables: { productId: string; quantity: number }) =>
    cartApi.setQuantity(variables.productId, variables.quantity),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((productId: string) => cartApi.removeItem(productId));
}

export function useClearCart() {
  return useCartMutation(() => cartApi.clear());
}

/**
 * Re-reads the cart when the Clerk session changes.
 *
 * Signing in merges the guest cart on the server, and Clerk hands control back
 * with a client-side redirect, so the `QueryClient` — and the cached guest cart
 * — is still in memory when the app remounts.
 */
export function useCartAuthSync(): void {
  const { isLoaded, user } = useUser();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const currentUserId = useRef<string | null>(null);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // The first resolution matches the query's own fetch, so it is not a change.
    if (!hasResolved.current) {
      hasResolved.current = true;
      currentUserId.current = userId;
      return;
    }

    if (currentUserId.current !== userId) {
      currentUserId.current = userId;
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    }
  }, [isLoaded, userId, queryClient]);
}
