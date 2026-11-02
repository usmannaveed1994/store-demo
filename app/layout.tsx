import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

import { Providers } from "./providers";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Diecast 64 | 1:64 Diecast Cars, Dioramas & Collectibles",
  description:
    "Explore the world of 1:64 scale collectibles. Discover premium diecast model cars, detailed dioramas, miniature accessories and everything you need to build your own 1:64 world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          
          {/* Wraps the header too: its cart badge reads the same client cache. */}
          <Providers>
            <Suspense>
              <SiteHeader />
            </Suspense>        
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

