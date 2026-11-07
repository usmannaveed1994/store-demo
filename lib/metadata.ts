import "server-only";

import type { Metadata } from "next";

export const SITE_NAME = "Diecast 64";
export const SITE_TITLE = "Diecast 64 | 1:64 Diecast Cars, Dioramas & Collectibles";
export const SITE_DESCRIPTION =
  "Explore the world of 1:64 scale collectibles. Discover premium diecast model cars, detailed dioramas, miniature accessories and everything you need to build your own 1:64 world.";
export const SITE_LOCALE = "en_US";

/** Brand suffix the root layout appends to every page title. */
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

/**
 * One social preview card.
 *
 * Dimensions are optional: uploaded product photos keep their own aspect ratio,
 * so only images with a known size (the site card) declare them.
 */
export type SocialImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  type?: string;
};

/** Card every route falls back to when it has no image of its own. */
export const SITE_SOCIAL_IMAGE: SocialImage = {
  url: "/images/opengraph.jpeg",
  width: 1424,
  height: 752,
  type: "image/jpeg",
  alt: SITE_TITLE,
};

/**
 * Fields a route may override. Everything else — brand, locale, title suffix and
 * fallback card — is decided here, so a new page only has to describe itself.
 */
export type PageMetadataInput = {
  /** Page title without the brand; the nearest layout template appends it. */
  title?: string;
  description?: string;
  /** App-relative path, used for `og:url` and the canonical link. */
  path?: string;
  /** Route-specific preview card. Defaults to the site card. */
  image?: SocialImage;
};

/**
 * Absolute origin that relative metadata URLs are resolved against.
 *
 * `APP_URL` wins when set; Vercel deployments fall back to the injected host.
 * `app/sitemap.ts` resolves the same origin for the absolute `<loc>` URLs it
 * must emit, so canonicals and sitemap entries can never point at different
 * hosts.
 */
export function resolveSiteUrl(): URL {
  const configured = process.env.APP_URL?.trim();

  if (configured) {
    return new URL(configured);
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  return new URL(vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
}

/**
 * Document defaults shared by the whole app: the title template, the site
 * description and the site-wide social card.
 *
 * The root layout exports this as its `metadata`. No `alternates.canonical`
 * here on purpose — that field is inherited by every descendant, so a base
 * canonical would claim every page lives at `/`.
 */
export const BASE_METADATA: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: { default: SITE_TITLE, template: TITLE_TEMPLATE },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_SOCIAL_IMAGE],
  },
};

/**
 * Metadata for one page, built from the site defaults.
 *
 * `openGraph` and `twitter` are restated in full because a nested metadata
 * object replaces its parent's wholesale — leaving them out would keep the
 * site title in the preview card of a page that names itself.
 *
 * A missing `title` is omitted rather than set to `undefined`, so the layout's
 * default title survives on pages that only refine their description.
 */
export function buildPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  image = SITE_SOCIAL_IMAGE,
}: PageMetadataInput = {}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: title ?? SITE_TITLE,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? SITE_TITLE,
      description,
      images: [image],
    },
  };
}
