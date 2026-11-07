import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { listActiveProductSitemapEntries } from "@/lib/db/queries/products";
import { resolveSiteUrl } from "@/lib/metadata";

/** The protocol requires absolute `<loc>` values, so paths are resolved against the site origin. */
function absoluteUrl(origin: URL, path: string): string {
  return new URL(path, origin).toString();
}

/**
 * `sitemap.xml`, generated from the database on every request.
 *
 * Nothing here is hand-maintained: publishing, editing, unpublishing or
 * soft-deleting a product changes the output on the next crawl, because the
 * product entries come straight from `listActiveProductSitemapEntries` — the
 * same `active` + not-deleted rule the storefront applies.
 *
 * `connection()` keeps this a runtime route handler. Without it `next build`
 * would try to render the sitemap on the build machine, where `DATABASE_URL` is
 * not available, and the file would then be frozen at whatever the catalogue
 * looked like during that build — the same reasoning as `app/api/products`.
 * The handler is left to the platform cache rather than pinned with
 * `revalidate`, which `cacheComponents` removes anyway.
 *
 * The static routes carry no `lastModified` on purpose: they have no real
 * revision date, and `new Date()` would claim a change on every single crawl
 * and teach crawlers to ignore the field. Product pages do know theirs —
 * `updated_at` — so they report it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const origin = resolveSiteUrl();
  const products = await listActiveProductSitemapEntries();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(origin, "/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl(origin, "/collections"),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(origin, `/products/${product.slug}`),
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes];
}
