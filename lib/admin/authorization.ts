import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { getUserByClerkId } from "@/lib/db/queries/users";
import type { User } from "@/lib/db/schema";

/**
 * The single gate for the admin area.
 *
 * Two different failures, deliberately answered differently:
 *
 * - no session → Clerk's `protect()` sends the visitor to sign-in;
 * - a session without the `admin` role → `notFound()`, so a shopper who guesses
 *   `/admin` cannot tell the area apart from a URL that never existed.
 *
 * Call it in the admin layout *and* in every server action and route handler
 * underneath it. The layout check is a convenience for the UI; it does not
 * protect the action endpoints, which are reachable by direct POST.
 */
export async function requireAdmin(): Promise<User> {
  const { userId } = await auth.protect();
  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "admin") {
    notFound();
  }

  return user;
}
