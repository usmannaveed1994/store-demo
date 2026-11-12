import "server-only";

import { del, put } from "@vercel/blob";
import sharp from "sharp";

import {
  MAX_ASPECT_RATIO,
  MAX_PUBLISH_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  MIN_ASPECT_RATIO,
  MIN_PUBLISH_IMAGE_WIDTH,
  PUBLISH_IMAGE_EDGE,
} from "./constants";

const SOURCE_TIMEOUT_MS = 15_000;
const JPEG_QUALITY = 90;
const PADDING_COLOR = { r: 255, g: 255, b: 255 };

export type InstagramImage = {
  url: string;
  pathname: string;
};

/**
 * Downloads a product photo from its stored URL.
 *
 * The image never has to be publicly reachable: it is fetched here, re-encoded
 * and re-hosted, so relative paths and `localhost` origins work too.
 */
export async function fetchSourceImage(url: URL): Promise<Buffer> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Could not download the product image (HTTP ${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error("The product image is empty.");
  }

  if (bytes.byteLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("The product image is too large to post to Instagram.");
  }

  return bytes;
}

/**
 * Re-encodes a photo as the JPEG Instagram accepts.
 *
 * The admin uploader stores WebP, which Instagram refuses, and a photo outside
 * the 4:5–1.91:1 window is padded to the nearest legal ratio rather than
 * cropped, so the product is never cut out of its own post.
 */
export async function toInstagramJpeg(source: Buffer): Promise<Buffer> {
  const normalised = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = normalised.info;

  if (!width || !height) {
    throw new Error("The product image could not be read.");
  }

  const scale = Math.min(PUBLISH_IMAGE_EDGE / width, PUBLISH_IMAGE_EDGE / height, 1);
  const targetScale =
    Math.round(width * scale) < MIN_PUBLISH_IMAGE_WIDTH ? MIN_PUBLISH_IMAGE_WIDTH / width : scale;

  const targetWidth = Math.round(width * targetScale);
  const targetHeight = Math.round(height * targetScale);
  const ratio = targetWidth / targetHeight;

  // `ceil` keeps a padded canvas inside the window instead of a rounding step outside it.
  const canvasWidth = ratio < MIN_ASPECT_RATIO
    ? Math.ceil(targetHeight * MIN_ASPECT_RATIO)
    : targetWidth;
  const canvasHeight = ratio > MAX_ASPECT_RATIO
    ? Math.ceil(targetWidth / MAX_ASPECT_RATIO)
    : targetHeight;

  const jpeg = await sharp(normalised.data)
    .resize({
      width: canvasWidth,
      height: canvasHeight,
      fit: "contain",
      background: PADDING_COLOR,
    })
    .flatten({ background: PADDING_COLOR })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (jpeg.byteLength > MAX_PUBLISH_IMAGE_BYTES) {
    throw new Error("The product image is still too large for Instagram after conversion.");
  }

  return jpeg;
}

/**
 * Hosts one converted JPEG where Instagram can fetch it.
 *
 * `instagram/<product>/<n>.jpg` keeps the temporary copies identifiable, and the
 * random suffix stops two posts of the same product from colliding.
 */
export async function uploadInstagramImage(
  productId: string,
  index: number,
  jpeg: Buffer,
): Promise<InstagramImage> {
  const blob = await put(`instagram/${productId}/${index + 1}.jpg`, jpeg, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/** Removes the temporary copies; Instagram has already ingested them by now. */
export async function deleteInstagramImages(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }

  try {
    await del(urls);
  } catch (error) {
    // A stranded blob is not worth failing a published post over.
    console.error("Could not delete temporary Instagram images", error);
  }
}
