import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

import { BASE_METADATA } from "@/lib/metadata";

import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = BASE_METADATA;

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
