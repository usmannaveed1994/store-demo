import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/authorization";
import { isUuid } from "@/lib/cart/validation";
import { listProductImages } from "@/lib/db/queries/product-images";
import { getProductById } from "@/lib/db/queries/products";

import { updateProduct } from "../../actions";
import { ProductForm } from "../../_components/product-form";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requireAdmin();

  const { id } = await params;

  // A malformed id would reach Postgres as an invalid uuid literal and throw 500.
  if (!isUuid(id)) {
    notFound();
  }

  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const images = await listProductImages(product.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" asChild className="-ml-3 w-fit">
            <Link href="/admin/products">← Products</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{product.title}</h1>
          <p className="text-sm text-muted-foreground">
            /products/{product.slug}
            {product.status === "active" ? (
              <>
                {" · "}
                <Link href={`/products/${product.slug}`} className="underline-offset-4 hover:underline">
                  View in store
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <ProductForm
        action={updateProduct}
        productId={product.id}
        submitLabel="Save changes"
        initialValues={{
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          currency: product.currency,
          stock: product.stock,
          status: product.status,
          isFeatured: product.isFeatured,
        }}
        initialImages={images.map((image) => image.url)}
      />
    </div>
  );
}
