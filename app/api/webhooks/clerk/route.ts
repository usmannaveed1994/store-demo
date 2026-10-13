import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import { deleteUserByClerkId } from "@/lib/db/queries/users";
import { mapClerkWebhookUser } from "@/lib/users/clerk-user";
import { syncUserFromClerk } from "@/lib/users/sync-user";

/**
 * Clerk -> Postgres sync endpoint.
 *
 * Point a Clerk webhook at `POST /api/webhooks/clerk`, subscribe to
 * `user.created`, `user.updated` and `user.deleted`, and put its signing secret
 * in `CLERK_WEBHOOK_SIGNING_SECRET`. The endpoint is signature-verified, so it
 * does not need to be covered by an auth check.
 *
 * No `runtime` segment config here: `cacheComponents` rejects it, and Node.js
 * is already the default runtime for route handlers in Next.js 16.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("[clerk/webhook] Signature verification failed:", error);

    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const user = await syncUserFromClerk(mapClerkWebhookUser(event.data));

        return NextResponse.json({ userId: user?.id ?? null });
      }

      case "user.deleted": {
        const { id } = event.data;

        if (id) {
          await deleteUserByClerkId(id);
        }

        return NextResponse.json({ deletedClerkUserId: id ?? null });
      }

      default:
        return NextResponse.json({ ignored: event.type });
    }
  } catch (error) {
    console.error(`[clerk/webhook] Failed to handle "${event.type}":`, error);

    // A non-2xx response makes Clerk retry the delivery, which is what we want
    // for transient database failures.
    return NextResponse.json({ error: "Failed to process webhook event." }, { status: 500 });
  }
}
