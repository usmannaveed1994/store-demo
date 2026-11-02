/**
 * Images a single product gallery may hold.
 *
 * Shared by three places that must agree: the `product_images` position CHECK,
 * the server-side validation and the uploader UI.
 */
export const MAX_GALLERY_IMAGES = 5;

/** Largest file the upload route issues a token for, in bytes. */
export const MAX_IMAGE_SIZE_IN_BYTES = 5 * 1024 * 1024;

/** Formats the upload route accepts. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** `accept` attribute for the file picker, so the browser filters what the server enforces. */
export const IMAGE_ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_TYPES.join(",");
