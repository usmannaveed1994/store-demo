"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { CartIndicator } from "@/components/cart-indicator";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  
  return (
    <header className={cn("sticky top-0 z-20 flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5 sm:px-10", 
      isHomePage
          ? "absolute inset-x-0 border-transparent bg-transparent"
          : "sticky border-border bg-background/80 backdrop-blur-md")}>
      <Link href="/" className="flex items-center gap-3">
        {/* The wordmark already names the brand, so the mark is decorative. */}
        <Image src="/logo.svg" alt="" width={40} height={40} className="size-10" />
        <span className="text-lg font-semibold tracking-tight">Diecast 64</span>
      </Link>

      <div className="flex items-center gap-2">
        <CartIndicator />

        <Suspense fallback={<AuthControls />}>
          <Show when="signed-in" fallback={<AuthControls />}>
            <UserButton />
          </Show>
        </Suspense>
      </div>
    </header>
  );
}


/**
 * Signed-out controls. They double as the `<Suspense>` fallback, which is how
 * anonymous visitors get them in the static shell.
 */
function AuthControls() {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Button asChild variant="ghost" size="lg">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="lg">
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </nav>
  );
}
