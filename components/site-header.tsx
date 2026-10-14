import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  /**
   * Draw the header over a full-bleed hero image: no background of its own and
   * white controls. Left off, the header sits on the page background.
   */
  overlay?: boolean;
};

/**
 * Site-wide header: the wordmark plus Clerk-aware account controls.
 *
 * `Show` reads the session on the server, so it must sit inside a `<Suspense>`
 * boundary to keep the rest of the page prerendered (`cacheComponents` requires
 * this). The signed-out controls are the fallback, which means anonymous
 * visitors get them in the static shell.
 */
export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "relative z-20 flex items-center justify-between gap-4 px-6 py-5 sm:px-10",
        !overlay && "border-b border-border",
      )}
    >
      <Link href="/" className="flex items-center gap-3">
        {/* The wordmark already names the brand, so the mark is decorative. */}
        <Image src="/logo.svg" alt="" width={40} height={40} className="size-10" />
        <span
          className={cn(
            "text-lg font-semibold tracking-tight",
            overlay ? "text-white" : "text-foreground",
          )}
        >
          Diecast 64
        </span>
      </Link>

      <Suspense fallback={<AuthControls overlay={overlay} />}>
        <Show when="signed-in" fallback={<AuthControls overlay={overlay} />}>
          <UserButton />
        </Show>
      </Suspense>
    </header>
  );
}

type AuthControlsProps = {
  overlay: boolean;
};

/**
 * Signed-out controls. They double as the `<Suspense>` fallback, so they have to
 * read correctly on both the transparent hero header and a normal page header.
 */
function AuthControls({ overlay }: AuthControlsProps) {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Button
        asChild
        variant="ghost"
        size="lg"
        className={overlay ? "text-white hover:bg-white/10 hover:text-white" : undefined}
      >
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="lg" className={overlay ? "bg-white text-black hover:bg-white/90" : undefined}>
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </nav>
  );
}
