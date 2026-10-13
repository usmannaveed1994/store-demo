import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative flex min-h-svh flex-1 flex-col overflow-hidden">
      {/*
        The photo is taken out of flow with `fill`, so it covers the whole
        viewport while the copy below centres itself on top of it. `preload`
        is Next 16's replacement for the deprecated `priority` prop and marks
        this as the LCP image.
      */}
      <Image
        src="/hero.jpg"
        alt="A row of 1:64 scale diecast model cars lined up on a display shelf"
        fill
        preload
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Dulling layers that keep the white copy legible over any photo. */}
      <div className="absolute inset-0 bg-black/55" aria-hidden />
      <div
        className="absolute inset-0 bg-linear-to-b from-black/70 via-black/30 to-black/85"
        aria-hidden
      />

      {/* Transparent header: no background of its own, so the hero shows through. */}
      <header className="relative z-20 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          {/* The wordmark already names the brand, so the mark is decorative. */}
          <Image src="/logo.svg" alt="" width={40} height={40} className="size-10" />
          <span className="text-lg font-semibold tracking-tight text-white">Diecast 64</span>
        </Link>

        {/*
          `Show` reads the session on the server, so it must sit inside a
          `<Suspense>` boundary to keep the rest of the page prerendered.
          The signed-out controls are the fallback, which means anonymous
          visitors see the buttons in the static shell.
        */}
        <Suspense fallback={<AuthControls />}>
          <Show when="signed-in" fallback={<AuthControls />}>
            <UserButton />
          </Show>
        </Suspense>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 pt-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/70">
          1:64 scale collectibles
        </p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Diecast Model Cars, Down to the Last Detail
        </h1>
        <p className="max-w-xl text-pretty text-base text-white/80 sm:text-lg">
          Collector-grade 1:64 replicas with licensed castings, opening parts and display-ready
          finishing — built for the shelf, ready for the road.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-white text-black hover:bg-white/90">
            <Link href="/sign-up">Start collecting</Link>
          </Button>

          {/*
            `Show` reads the session on the server, so it needs its own
            `<Suspense>` boundary to keep the section prerendered. The
            signed-out button doubles as the fallback, so anonymous visitors
            get it in the static shell while signed-in visitors get a row with
            the single call to action left.
          */}
          <Suspense fallback={<SignInCta />}>
            <Show when="signed-out" fallback={null}>
              <SignInCta />
            </Show>
          </Suspense>
        </div>
      </section>
    </main>
  );
}

/**
 * The hero's secondary call to action. It only makes sense for visitors who
 * are not already signed in, so the session-aware wrapper above hides it.
 */
function SignInCta() {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
    >
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}

function AuthControls() {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Button
        asChild
        variant="ghost"
        size="lg"
        className="text-white hover:bg-white/10 hover:text-white"
      >
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="lg" className="bg-white text-black hover:bg-white/90">
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </nav>
  );
}

