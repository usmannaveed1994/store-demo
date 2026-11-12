import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/authorization";
import { getAccount, InstagramApiError } from "@/lib/instagram/client";

/**
 * Credential check for the admin "Post on Instagram" button.
 *
 * Answers with the business account the token belongs to, so a failing post can
 * be traced to the credentials rather than to the publish flow.
 */
export async function GET(): Promise<NextResponse> {
  await requireAdmin();

  try {
    const account = await getAccount();

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("Instagram account check failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not connect to Instagram.",
      },
      { status: error instanceof InstagramApiError ? error.status : 500 },
    );
  }
}
