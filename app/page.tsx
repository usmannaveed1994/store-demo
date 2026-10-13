import { Suspense } from "react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex w-full max-w-2xl justify-end">
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

      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Store Demo</h1>
        <p className="max-w-md text-muted-foreground">
          Sign in to create your account. A matching record is written to Postgres on first sign-up.
        </p>
      </section>
    </main>
  );
}

function AuthControls() {
  return (
    <div className="flex items-center gap-3">
      <Button asChild variant="ghost" size="lg">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="lg">
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}

