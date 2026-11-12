import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/authorization";
import { readPage, readParam } from "@/lib/admin/search-params";
import { listImageUrlsByProductIds } from "@/lib/db/queries/product-images";
import { listProducts } from "@/lib/db/queries/products";
import type { Product, ProductStatus } from "@/lib/db/schema";
import { isRemoteUrl } from "@/lib/images";
import { buildProductCaption } from "@/lib/instagram/caption";
import { MAX_CAROUSEL_ITEMS } from "@/lib/instagram/constants";
import { resolveSiteUrl } from "@/lib/metadata";
import { formatPrice } from "@/lib/products/presentation";
import { PRODUCT_STATUS_OPTIONS } from "@/lib/products/validation";

import { InstagramPostDialog } from "./_components/instagram-post-dialog";
import { setProductStatus } from "./actions";
import { postProductToInstagram } from "./instagram-actions";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

/** A publish waits on Instagram's own processing, so the action outlives a default request. */
export const maxDuration = 60;

const PAGE_SIZE = 20;
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const STATUS_VALUES = new Set<string>(PRODUCT_STATUS_OPTIONS.map((option) => option.value));

const STATUS_BADGE_VARIANT: Record<ProductStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `searchParams` values arrive as `string | string[]`; the UI only ever needs the first. */
function readStatus(value: string): ProductStatus | undefined {
  return STATUS_VALUES.has(value) ? (value as ProductStatus) : undefined;
}

/**
 * Photos the Instagram action publishes, in the order it publishes them: the
 * gallery first, then the primary image when it is not already part of it.
 */
function postImages(product: Product, gallery: string[] | undefined): string[] {
  const urls = [...(gallery ?? []), ...(product.imageUrl ? [product.imageUrl] : [])];

  return [...new Set(urls)].slice(0, MAX_CAROUSEL_ITEMS);
}

/** Current filters, carried across pagination. */
function listHref(page: number, search: string, status?: ProductStatus) {
  return {
    pathname: "/admin/products",
    query: {
      ...(search ? { q: search } : {}),
      ...(status ? { status } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  };
}

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const search = readParam(params.q).trim();
  const status = readStatus(readParam(params.status));
  const page = readPage(readParam(params.page));

  // One extra row answers "is there a next page?" without a second count query.
  const rows = await listProducts({
    search: search || undefined,
    status,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });

  const hasNextPage = rows.length > PAGE_SIZE;
  const products = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;

  // One query for the whole page: the Instagram dialog previews every row's photos.
  const imagesByProduct = await listImageUrlsByProductIds(products.map((product) => product.id));
  const siteUrl = resolveSiteUrl();
  const siteIsLocal = LOCAL_HOSTNAMES.has(siteUrl.hostname);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length === 0
              ? "Nothing to show."
              : `Showing ${products.length} product${products.length === 1 ? "" : "s"}${
                  page > 1 ? ` from page ${page}` : ""
                }.`}
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4"
      >
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Search title, SKU or slug"
          className="h-9 w-full sm:w-72"
        />

        <label htmlFor="status" className="sr-only">
          Filter by status
        </label>
        <NativeSelect id="status" name="status" defaultValue={status ?? ""} className="h-9 w-auto">
          <option value="">All statuses</option>
          {PRODUCT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <Button type="submit" variant="secondary">
          Filter
        </Button>

        {search || status ? (
          <Button variant="ghost" asChild>
            <Link href="/admin/products">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No products match these filters.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const images = postImages(product, imagesByProduct.get(product.id));
                const caption = buildProductCaption({
                  title: product.title,
                  description: product.description,
                  url: new URL(`/products/${product.slug}`, siteUrl).toString(),
                });

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 rounded-md object-cover"
                            unoptimized={isRemoteUrl(product.imageUrl)}
                          />
                        ) : (
                          <div aria-hidden className="size-10 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="block max-w-56 truncate text-sm font-medium text-foreground hover:underline"
                          >
                            {product.title}
                          </Link>
                          <span className="block max-w-56 truncate text-xs text-muted-foreground">
                            /{product.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[product.status]}>
                        {product.status === "active"
                          ? "Active"
                          : product.status === "draft"
                            ? "Draft"
                            : "Archived"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-foreground">
                      {formatPrice(product.price, product.currency)}
                    </TableCell>

                    <TableCell className="text-sm tabular-nums text-foreground">
                      {product.stock}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {DATE_FORMAT.format(product.updatedAt ?? product.createdAt)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <InstagramPostDialog
                          productId={product.id}
                          productTitle={product.title}
                          caption={caption}
                          images={images}
                          siteIsLocal={siteIsLocal}
                          action={postProductToInstagram}
                        />

                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/products/${product.id}/edit`}>Edit</Link>
                        </Button>

                        <form action={setProductStatus}>
                          <input type="hidden" name="id" value={product.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={product.status === "archived" ? "active" : "archived"}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {product.status === "archived" ? "Enable" : "Disable"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page === 1}>
          {page > 1 ? (
            <Link href={listHref(page - 1, search, status)}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>

        <span className="text-sm text-muted-foreground">Page {page}</span>

        <Button variant="outline" size="sm" asChild={hasNextPage} disabled={!hasNextPage}>
          {hasNextPage ? (
            <Link href={listHref(page + 1, search, status)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </nav>
    </div>
  );
}
