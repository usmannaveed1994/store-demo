import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Runs Clerk on every matched request so `auth()`, `currentUser()` and the
 * client-side session hooks have an up-to-date auth context.
 *
 * Auth is enforced per resource, not per path: call `await auth.protect()`
 * inside any page, layout, route handler or server action that touches private
 * data (Clerk deprecated `createRouteMatcher` in favour of this approach,
 * because path matching can diverge from how Next.js routes requests).
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Always run for Clerk's Frontend API proxy.
    "/__clerk/(.*)",
  ],
};
