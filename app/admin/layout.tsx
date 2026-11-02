import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireAdmin } from "@/lib/admin/authorization";

import { AdminNav } from "./_components/admin-nav";

/**
 * Reading the session blocks the shell, which is the right trade for an
 * internal tool: a signed-out visitor must not see a cached admin frame.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "Admin — Diecast 64",
  description: "Store administration.",
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * The `requireAdmin()` call here decides who may render the frame, but it does
 * not protect the data: layouts and pages render concurrently, and server
 * actions are reachable by direct POST. Every page that reads admin data and
 * every action calls `requireAdmin()` itself.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const name =
    [admin.firstName, admin.lastName].filter((part): part is string => Boolean(part)).join(" ") ||
    admin.email;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-8 border-b border-border bg-background px-6 py-6 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
            Diecast 64
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Admin</span>
        </div>

        <AdminNav />

        <div className="mt-auto flex flex-col gap-4 border-t border-border pt-6">
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>

          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← View storefront
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
