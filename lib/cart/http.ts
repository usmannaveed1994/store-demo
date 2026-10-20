import { NextResponse, type NextRequest } from "next/server";

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

/** Parsed JSON body, or `null` when the request did not carry an object. */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();

    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
