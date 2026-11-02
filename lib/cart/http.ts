import { NextResponse } from "next/server";

import type { ApiErrorResponse } from "@/lib/products/dto";

import type { CartDto, CartResponse } from "./dto";

/** Every cart endpoint answers with the full cart or a single error sentence. */
export type CartApiResponse = NextResponse<CartResponse | ApiErrorResponse>;

export function cartJson(cart: CartDto): CartApiResponse {
  return NextResponse.json<CartResponse>({ cart });
}

export function errorJson(message: string, status: number): CartApiResponse {
  return NextResponse.json<ApiErrorResponse>({ error: message }, { status });
}

