import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";

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

export const metadata: Metadata = {
  title: "Diecast 64 — 1:64 Model Cars",
  description:
    "Collector-grade 1:64 scale diecast model cars with licensed castings, opening parts and display-ready detail.",
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
            <SiteHeader />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

