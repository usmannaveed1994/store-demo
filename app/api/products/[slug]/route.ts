import { connection, NextResponse, type NextRequest } from "next/server";

import { getProductBySlug } from "@/lib/db/queries/products";
import { toProductDto, type ApiErrorResponse, type ProductDetailResponse } from "@/lib/products/dto";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/products/[slug]">,
): Promise<NextResponse<ProductDetailResponse | ApiErrorResponse>> {
  await connection();

  const { slug } = await context.params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return NextResponse.json<ApiErrorResponse>({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json<ProductDetailResponse>({ product: toProductDto(product) });
}
