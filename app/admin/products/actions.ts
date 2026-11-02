"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin/authorization";
import { isUuid } from "@/lib/cart/validation";
import { replaceProductImages } from "@/lib/db/queries/product-images";
import {
  getProductById,
  insertProduct,
  updateProduct as updateProductRecord,
} from "@/lib/db/queries/products";
import type { ProductStatus } from "@/lib/db/schema";
import {
  PRODUCT_STATUS_OPTIONS,
  parseProductForm,
  type ProductFormState,
} from "@/lib/products/validation";

const PRODUCT_STATUS_VALUES = new Set<string>(PRODUCT_STATUS_OPTIONS.map((option) => option.value));

type PostgresError = {
  code: string;
  constraint?: string;
};

/**
 * The pg error as Postgres threw it.
 *
 * Drizzle wraps driver failures in `DrizzleQueryError`, so the interesting
 * fields live on `cause`. Only the first two links of the chain are inspected:
 * anything deeper is not a constraint violation we can attribute to a field.
 */
function readPostgresError(error: unknown): PostgresError | null {
  let current: unknown = error;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return null;
    }

    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };

    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }

    current = candidate.cause;
  }

  return null;
}

/** Turns a unique-constraint violation into the field that caused it. */
function describeConflict(error: unknown): ProductFormState | null {
  const postgresError = readPostgresError(error);

  if (postgresError?.code !== "23505") {
    return null;
  }

  if (postgresError.constraint === "products_slug_key") {
    return { fieldErrors: { slug: "Another product already uses this slug." } };
  }

  if (postgresError.constraint === "products_sku_key") {
    return { fieldErrors: { sku: "Another product already uses this SKU." } };
  }

  return { fieldErrors: {}, message: "A product with these details already exists." };
}

/** `FormData` as the plain object the validator reads, with the gallery collapsed into one array. */
function readFormValues(formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key !== "imageUrl") {
      values[key] = value;
    }
  }

  values.imageUrls = formData.getAll("imageUrl").map((value) => String(value));

  return values;
}

function toImageInputs(urls: string[]): { url: string; alt: string | null }[] {
  return urls.map((url) => ({ url, alt: null }));
}

export async function createProduct(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = parseProductForm(readFormValues(formData));

  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const { value } = parsed;
  let productId: string;

  try {
    const product = await insertProduct({
      slug: value.slug,
      title: value.title,
      description: value.description,
      price: value.price,
      compareAtPrice: value.compareAtPrice,
      currency: value.currency,
      sku: value.sku,
      stock: value.stock,
      status: value.status,
      isFeatured: value.isFeatured,
      imageUrl: value.imageUrls[0] ?? null,
    });

    await replaceProductImages(product.id, toImageInputs(value.imageUrls));
    productId = product.id;
  } catch (error) {
    console.error("Failed to create product", error);
    return describeConflict(error) ?? { fieldErrors: {}, message: "Could not create the product." };
  }

  // Outside the `try`: `redirect()` signals by throwing, and catching it here
  // would turn a successful write into an error message.
  redirect(`/admin/products/${productId}/edit`);
}

export async function updateProduct(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!isUuid(id)) {
    notFound();
  }

  const parsed = parseProductForm(readFormValues(formData));

  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const existing = await getProductById(id);

  if (!existing) {
    notFound();
  }

  const { value } = parsed;

  try {
    await updateProductRecord(id, {
      title: value.title,
      slug: value.slug,
      description: value.description,
      price: value.price,
      compareAtPrice: value.compareAtPrice,
      currency: value.currency,
      sku: value.sku,
      stock: value.stock,
      status: value.status,
      isFeatured: value.isFeatured,
      imageUrl: value.imageUrls[0] ?? null,
    });

    await replaceProductImages(id, toImageInputs(value.imageUrls));
  } catch (error) {
    console.error("Failed to update product", error);
    return describeConflict(error) ?? { fieldErrors: {}, message: "Could not save the product." };
  }

  // Same route, so the router refreshes instead of navigating away from the form.
  refresh();

  return { fieldErrors: {}, message: "Changes saved.", saved: true };
}

/**
 * Enables or disables a product without touching the rest of its row.
 *
 * Kept as a separate action so the list can toggle status with a plain form and
 * no client JavaScript, and so a status change cannot overwrite stale field
 * values the way a full product update could.
 */
export async function setProductStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!isUuid(id) || !PRODUCT_STATUS_VALUES.has(status)) {
    return;
  }

  await updateProductRecord(id, { status: status as ProductStatus });
  refresh();
}
