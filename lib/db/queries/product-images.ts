import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { productImages, type ProductImage } from "@/lib/db/schema";

/** One gallery photo as the admin form submits it; the position comes from the array order. */
export type ProductImageInput = {
  url: string;
  alt: string | null;
};

/** Gallery photos of a product, in display order. */
export async function listProductImages(productId: string): Promise<ProductImage[]> {
  return getDb()
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
}

/**
 * Rewrites a product's gallery in one transaction.
 *
 * Delete-then-insert is the whole update: positions are dense and derived from
 * the submitted order, so reconciling row by row would buy nothing but
 * off-by-one bugs. Interleaving the two statements matters — a partial rewrite
 * would collide with `product_images_product_position_key`.
 */
export async function replaceProductImages(
  productId: string,
  images: ProductImageInput[],
): Promise<ProductImage[]> {
  return getDb().transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.productId, productId));

    if (images.length === 0) {
      return [];
    }

    const rows = await tx
      .insert(productImages)
      .values(
        images.map((image, position) => ({
          productId,
          url: image.url,
          alt: image.alt,
          position,
        })),
      )
      .returning();

    return rows.sort((left, right) => left.position - right.position);
  });
}
