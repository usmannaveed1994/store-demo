import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/authorization";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_IN_BYTES } from "@/lib/products/constants";

/**
 * Issues Vercel Blob client tokens for admin uploads.
 *
 * The browser PUTs the file straight to Blob storage, so image bytes never pass
 * through this handler. The authorization check runs before the body is parsed,
 * which also keeps `requireAdmin()`'s 404 out of the catch block below.
 *
 * There is deliberately no `onUploadCompleted` callback: Blob calls it over the
 * public internet, which `localhost` cannot receive. The form keeps the URL in
 * state and submits it with the rest of the product instead.
 */
export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image uploads are not configured: set BLOB_READ_WRITE_TOKEN." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
        maximumSizeInBytes: MAX_IMAGE_SIZE_IN_BYTES,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Image upload token request failed", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
