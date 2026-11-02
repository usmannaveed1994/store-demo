import type { ProductStatus } from "@/lib/db/schema";

import { MAX_GALLERY_IMAGES } from "./constants";

/** Statuses the admin form offers, in the order it lists them. */
export const PRODUCT_STATUS_OPTIONS: readonly { value: ProductStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const PRODUCT_STATUSES = new Set<string>(PRODUCT_STATUS_OPTIONS.map((option) => option.value));

const MAX_LENGTH = {
  title: 160,
  slug: 80,
  sku: 64,
  description: 5000,
} as const;

const MAX_STOCK = 1_000_000;
const MAX_PRICE = 99_999_999.99;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRICE_PATTERN = /^\d{1,8}(?:\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const STOCK_PATTERN = /^\d{1,7}$/;
/** Blob URLs, plus root-relative paths so `/logo.svg`-style assets stay usable. */
const IMAGE_URL_PATTERN = /^(?:https:\/\/[^\s]+|\/[^\s]*)$/i;

/** A product as the admin form submits it, already normalised. */
export type ProductFormValues = {
  title: string;
  slug: string;
  sku: string | null;
  description: string | null;
  /** `numeric` columns travel as decimal strings, so the form keeps them that way. */
  price: string;
  compareAtPrice: string | null;
  currency: string;
  stock: number;
  status: ProductStatus;
  isFeatured: boolean;
  imageUrls: string[];
};

export type ProductFieldErrors = Partial<Record<keyof ProductFormValues, string>>;

export type ProductFormState = {
  fieldErrors: ProductFieldErrors;
  /** Banner text for outcomes that are not tied to a single input. */
  message?: string;
  /** `true` when the banner reports a successful save rather than a failure. */
  saved?: boolean;
};

export type ProductValidationResult =
  | { ok: true; value: ProductFormValues }
  | { ok: false; fieldErrors: ProductFieldErrors };

/** Trimmed string for a form field; anything that is not a string reads as empty. */
function readField(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
}

/**
 * URL-safe slug built from arbitrary text.
 *
 * Also the fallback for an admin who leaves the slug blank, which is why it
 * strips accents instead of rejecting them.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH.slug)
    .replace(/-+$/g, "");
}

/** Two-decimal price string, or `null` when the input is not a usable amount. */
function normalizePrice(value: string): string | null {
  if (!PRICE_PATTERN.test(value)) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PRICE) {
    return null;
  }

  return amount.toFixed(2);
}

/** Gallery URLs, deduplicated and in the order the form rendered them. */
function readImageUrls(body: Record<string, unknown>): string[] {
  const raw = body.imageUrls;

  if (!Array.isArray(raw)) {
    return [];
  }

  const urls = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(urls)];
}

/**
 * Validates and normalises a product form body.
 *
 * Hand-rolled to match `lib/checkout/validation.ts`: the project has no schema
 * library, and the rules are small enough that one file keeps them readable.
 */
export function parseProductForm(body: Record<string, unknown>): ProductValidationResult {
  const fieldErrors: ProductFieldErrors = {};

  const title = readField(body, "title");
  const slugInput = readField(body, "slug");
  const sku = readField(body, "sku");
  const description = readField(body, "description");
  const priceInput = readField(body, "price");
  const compareAtInput = readField(body, "compareAtPrice");
  const currency = (readField(body, "currency") || "USD").toUpperCase();
  const stockInput = readField(body, "stock");
  const status = readField(body, "status");
  const isFeatured = readField(body, "isFeatured") === "on";

  if (title.length < 2) {
    fieldErrors.title = "Enter a product title.";
  } else if (title.length > MAX_LENGTH.title) {
    fieldErrors.title = `Use ${MAX_LENGTH.title} characters or fewer.`;
  }

  // An empty slug is derived from the title, so the admin never has to invent one.
  const slug = slugify(slugInput || title);

  if (slug.length === 0) {
    fieldErrors.slug = "Enter a URL slug.";
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers and single hyphens.";
  }

  if (sku.length > MAX_LENGTH.sku) {
    fieldErrors.sku = `Use ${MAX_LENGTH.sku} characters or fewer.`;
  }

  if (description.length > MAX_LENGTH.description) {
    fieldErrors.description = `Use ${MAX_LENGTH.description} characters or fewer.`;
  }

  const price = normalizePrice(priceInput);

  if (price === null) {
    fieldErrors.price = "Enter a price between 0.01 and 99,999,999.99.";
  }

  let compareAtPrice: string | null = null;

  if (compareAtInput.length > 0) {
    compareAtPrice = normalizePrice(compareAtInput);

    if (compareAtPrice === null) {
      fieldErrors.compareAtPrice = "Enter a valid compare-at price.";
    } else if (price !== null && Number(compareAtPrice) <= Number(price)) {
      fieldErrors.compareAtPrice = "The compare-at price must be higher than the price.";
    }
  }

  if (!CURRENCY_PATTERN.test(currency)) {
    fieldErrors.currency = "Use a three-letter currency code, e.g. USD.";
  }

  const stock = STOCK_PATTERN.test(stockInput) ? Number(stockInput) : Number.NaN;

  if (!Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK) {
    fieldErrors.stock = `Enter a whole number between 0 and ${MAX_STOCK.toLocaleString("en-US")}.`;
  }

  if (!PRODUCT_STATUSES.has(status)) {
    fieldErrors.status = "Choose a status.";
  }

  const imageUrls = readImageUrls(body);

  if (imageUrls.length > MAX_GALLERY_IMAGES) {
    fieldErrors.imageUrls = `Use ${MAX_GALLERY_IMAGES} images or fewer.`;
  } else if (imageUrls.some((url) => !IMAGE_URL_PATTERN.test(url))) {
    fieldErrors.imageUrls = "Every image must be an uploaded file or a full https URL.";
  }

  if (Object.keys(fieldErrors).length > 0 || price === null) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      title,
      slug,
      sku: sku.length > 0 ? sku : null,
      description: description.length > 0 ? description : null,
      price,
      compareAtPrice,
      currency,
      stock,
      status: status as ProductStatus,
      isFeatured,
      imageUrls,
    },
  };
}
