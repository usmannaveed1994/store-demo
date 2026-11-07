"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_STATUS_OPTIONS,
  type ProductFormState,
  type ProductFormValues,
} from "@/lib/products/validation";

import { ProductImageField } from "./product-image-field";

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  /** Present when editing: rendered as a hidden input so the action knows the row. */
  productId?: string;
  initialValues?: Partial<Omit<ProductFormValues, "imageUrls">>;
  initialImages?: string[];
  submitLabel: string;
};

const INITIAL_STATE: ProductFormState = { fieldErrors: {} };

const DEFAULT_VALUES: Omit<ProductFormValues, "imageUrls"> = {
  title: "",
  slug: "",
  sku: null,
  description: null,
  price: "",
  compareAtPrice: null,
  currency: "USD",
  stock: 0,
  status: "draft",
  isFeatured: false,
};

const FIELD_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * Create / edit form.
 *
 * Inputs are uncontrolled and keyed off `initialValues`, so a failed submit
 * keeps everything the admin typed while the action's field errors appear next
 * to the offending input.
 */
export function ProductForm({
  action,
  productId,
  initialValues,
  initialImages = [],
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const values = { ...DEFAULT_VALUES, ...initialValues };
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {productId ? <input type="hidden" name="id" value={productId} /> : null}

      <section className="grid gap-6 rounded-xl border border-border bg-background p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={values.title}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
            autoFocus
          />
          <FieldError id="title" message={errors.title} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={values.slug}
            placeholder="derived from the title"
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? "slug-error" : "slug-hint"}
          />
          <p id="slug-hint" className="text-xs text-muted-foreground">
            Leave blank to generate it from the title.
          </p>
          <FieldError id="slug" message={errors.slug} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            defaultValue={values.sku ?? ""}
            aria-invalid={errors.sku ? true : undefined}
            aria-describedby={errors.sku ? "sku-error" : undefined}
          />
          <FieldError id="sku" message={errors.sku} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={values.description ?? ""}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "description-error" : undefined}
          />
          <FieldError id="description" message={errors.description} />
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border border-border bg-background p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            defaultValue={values.price}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={errors.price ? "price-error" : undefined}
          />
          <FieldError id="price" message={errors.price} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="compareAtPrice">Compare-at price</Label>
          <Input
            id="compareAtPrice"
            name="compareAtPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            defaultValue={values.compareAtPrice ?? ""}
            aria-invalid={errors.compareAtPrice ? true : undefined}
            aria-describedby={
              errors.compareAtPrice ? "compareAtPrice-error" : "compareAtPrice-hint"
            }
          />
          <p id="compareAtPrice-hint" className="text-xs text-muted-foreground">
            Optional. Shown struck through next to the price.
          </p>
          <FieldError id="compareAtPrice" message={errors.compareAtPrice} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            defaultValue={values.currency}
            aria-invalid={errors.currency ? true : undefined}
            aria-describedby={errors.currency ? "currency-error" : undefined}
            className="uppercase"
          />
          <FieldError id="currency" message={errors.currency} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={values.stock}
            aria-invalid={errors.stock ? true : undefined}
            aria-describedby={errors.stock ? "stock-error" : undefined}
          />
          <FieldError id="stock" message={errors.stock} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? "status-error" : undefined}
            className={FIELD_CLASS}
          >
            {PRODUCT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError id="status" message={errors.status} />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            id="isFeatured"
            name="isFeatured"
            type="checkbox"
            defaultChecked={values.isFeatured}
            className="mt-0.5 size-4 rounded border-input accent-foreground"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="isFeatured">Featured</Label>
            <p className="text-xs text-muted-foreground">
              Featured products appear in the home page carousel.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">Images</h2>
          <p className="text-xs text-muted-foreground">
            Each image is cropped before it uploads. Drag the photos to reorder them — the first
            one is the catalogue thumbnail.
          </p>
        </div>
        <ProductImageField initialImages={initialImages} error={errors.imageUrls} />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/admin/products">Cancel</Link>
        </Button>
        {state.message ? (
          <p
            role="status"
            className={state.saved ? "text-sm text-foreground" : "text-sm text-destructive"}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
