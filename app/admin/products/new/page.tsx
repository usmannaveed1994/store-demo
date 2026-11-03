import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { createProduct } from "../actions";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = {
  title: "New product",
  robots: { index: false, follow: false },
};

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" asChild className="-ml-3 w-fit">
          <Link href="/admin/products">← Products</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">New product</h1>
        <p className="text-sm text-muted-foreground">
          Save it as a draft until the copy and photos are ready to publish.
        </p>
      </header>

      <ProductForm action={createProduct} submitLabel="Create product" />
    </div>
  );
}
