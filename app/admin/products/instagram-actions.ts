"use server";

import { requireAdmin } from "@/lib/admin/authorization";
import { isUuid } from "@/lib/cart/validation";
import { listProductImages } from "@/lib/db/queries/product-images";
import { getProductById } from "@/lib/db/queries/products";
import { isCaptionTooLong } from "@/lib/instagram/caption";
import {
  createCarouselContainer,
  createImageContainer,
  getMediaPermalink,
  InstagramApiError,
  publishContainer,
  waitForContainer,
} from "@/lib/instagram/client";
import { MAX_CAPTION_LENGTH, MAX_CAROUSEL_ITEMS } from "@/lib/instagram/constants";
import {
  deleteInstagramImages,
  fetchSourceImage,
  toInstagramJpeg,
  uploadInstagramImage,
} from "@/lib/instagram/images";
import type { InstagramPostState } from "@/lib/instagram/types";
import { resolveSiteUrl } from "@/lib/metadata";

function toErrorState(error: unknown): InstagramPostState {
  if (error instanceof InstagramApiError) {
    return { status: "error", message: error.message };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Could not post to Instagram.",
  };
}

/**
 * Publishes a product — its photos and the caption the admin approved — to the
 * connected Instagram business account.
 *
 * The caption arrives from the dialog rather than being assembled here, so the
 * published post matches the preview exactly, including any edits. Failures come
 * back as state rather than exceptions so the dialog can surface Instagram's own
 * message. The temporary JPEGs are always cleaned up: they exist only because
 * Instagram ingests media by URL and the store keeps WebP.
 */
export async function postProductToInstagram(
  _previousState: InstagramPostState,
  formData: FormData,
): Promise<InstagramPostState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const rawCaption = formData.get("caption");
  const caption = typeof rawCaption === "string" ? rawCaption.trim() : "";

  if (!isUuid(id)) {
    return { status: "error", message: "Unknown product." };
  }

  if (!caption) {
    return { status: "error", message: "Add a caption before posting." };
  }

  if (isCaptionTooLong(caption)) {
    return {
      status: "error",
      message: `Instagram limits captions to ${MAX_CAPTION_LENGTH} characters.`,
    };
  }

  const product = await getProductById(id);

  if (!product) {
    return { status: "error", message: "This product no longer exists." };
  }

  const gallery = await listProductImages(id);
  const images = [
    ...new Set([
      ...gallery.map((image) => image.url),
      ...(product.imageUrl ? [product.imageUrl] : []),
    ]),
  ].slice(0, MAX_CAROUSEL_ITEMS);

  if (images.length === 0) {
    return { status: "error", message: "Add at least one product image before posting." };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      status: "error",
      message: "Image hosting is not configured: set BLOB_READ_WRITE_TOKEN.",
    };
  }

  const siteUrl = resolveSiteUrl();

  const uploads: string[] = [];

  try {
    const mediaUrls: string[] = [];

    for (const [index, url] of images.entries()) {
      const source = await fetchSourceImage(new URL(url, siteUrl));
      const upload = await uploadInstagramImage(id, index, await toInstagramJpeg(source));
      uploads.push(upload.url);
      mediaUrls.push(upload.url);
    }

    let containerId: string;

    if (mediaUrls.length === 1) {
      containerId = await createImageContainer(mediaUrls[0], { caption });
    } else {
      // Children have to be ingested before the parent will accept them.
      const children = await Promise.all(
        mediaUrls.map((url) => createImageContainer(url, { isCarouselItem: true })),
      );
      await Promise.all(children.map((child) => waitForContainer(child)));
      containerId = await createCarouselContainer(children, caption);
    }

    await waitForContainer(containerId);
    const mediaId = await publishContainer(containerId);
    const permalink = await getMediaPermalink(mediaId).catch(() => null);

    return { status: "success", permalink };
  } catch (error) {
    console.error("Instagram publish failed", error);
    return toErrorState(error);
  } finally {
    await deleteInstagramImages(uploads);
  }
}
