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
    <header className={cn("sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-10 sm:py-5", 
      isHomePage
          ? "absolute inset-x-0 border-transparent bg-transparent"
          : "sticky border-border bg-background/80 backdrop-blur-md")}>
      <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* The wordmark already names the brand, so the mark is decorative. */}
        <Image src="/logo.svg" alt="" width={40} height={40} className="size-9 shrink-0 sm:size-10" />
        <span className="truncate text-base font-semibold tracking-tight sm:text-lg">
          Diecast 64
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <CartIndicator className={isHomePage ? "text-white" : undefined} />

        <Suspense fallback={<AuthControls isHomePage={isHomePage} />}>
          <Show when="signed-in" fallback={<AuthControls isHomePage={isHomePage} />}>
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
const AuthControls:  React.FC<{isHomePage?: boolean}> = ({isHomePage}) => {
  return (
    <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
      <Button asChild variant="ghost" size="lg" className={cn("h-9 px-2 sm:h-10 sm:px-6", isHomePage ? "text-white" : undefined )}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="lg" className="h-9 px-3 sm:h-10 sm:px-6">
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </nav>
  );
}
