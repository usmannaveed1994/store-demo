import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Show } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";
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
      <SiteHeader overlay />

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
            <Link href="/collections">Start collecting</Link>
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

