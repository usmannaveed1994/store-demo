import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Diecast 64";
const SITE_TITLE = "Diecast 64 | 1:64 Diecast Cars, Dioramas & Collectibles";
const SITE_DESCRIPTION =
  "Explore the world of 1:64 scale collectibles. Discover premium diecast model cars, detailed dioramas, miniature accessories and everything you need to build your own 1:64 world.";

const OPENGRAPH_IMAGE = {
  url: "/images/opengraph.jpeg",
  width: 1424,
  height: 752,
  type: "image/jpeg",
  alt: "Diecast 64 — 1:64 diecast cars, dioramas and collectibles",
};

/**
 * Absolute origin that relative metadata URLs are resolved against.
 *
 * `APP_URL` wins when set; Vercel deployments fall back to the injected host.
 */
function resolveSiteUrl(): URL {
  const configured = process.env.APP_URL?.trim();

  if (configured) {
    return new URL(configured);
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  return new URL(vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [OPENGRAPH_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OPENGRAPH_IMAGE],
  },
};

/**
 * Root layout: the document, the Clerk provider and the client cache.
 *
 * The storefront chrome lives in `app/(storefront)/layout.tsx` instead, so the
 * admin area can render its own sidebar without inheriting the shop header.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          {/* Wraps every route: the cart badge reads the same client cache. */}
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}


