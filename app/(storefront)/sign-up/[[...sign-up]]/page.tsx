import { Suspense } from "react";
import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign up | Store Demo",
};

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      {/*
        `SignUp` is a client component that reads the current URL, so it is
        wrapped in a `<Suspense>` boundary to keep the page prerenderable.
      */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignUp />
      </Suspense>
    </main>
  );
}

function AuthFormSkeleton() {
  return <div className="h-96 w-full max-w-sm rounded-lg border bg-card" aria-hidden />;
}
