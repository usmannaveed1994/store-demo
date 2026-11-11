/**
 * ISO-4217 code a product starts with.
 *
 * Shared by the `products.currency` column default, the admin form's initial
 * value and the server-side fallback, so a new listing is never priced in a
 * currency the store does not trade in.
 */
export const DEFAULT_CURRENCY = "PKR";

/**
 * Images a single product gallery may hold.
 *
 * Shared by three places that must agree: the `product_images` position CHECK,
 * the server-side validation and the uploader UI.
 */
export const MAX_GALLERY_IMAGES = 5;

/** Largest file the upload route issues a token for, in bytes. */
export const MAX_IMAGE_SIZE_IN_BYTES = 5 * 1024 * 1024;

/**
 * Longest edge of a cropped upload, in pixels.
 *
 * The cropper re-encodes whatever the admin framed at this size, so a phone
 * photo never lands in Blob storage at 4000px and the canvas stays bounded.
 */
export const MAX_CROPPED_IMAGE_DIMENSION = 1600;

/**
 * Largest source file the cropper will open.
 *
 * Deliberately looser than `MAX_IMAGE_SIZE_IN_BYTES`: only the crop result is
 * uploaded, so the upload limit applies to the encoded output instead.
 */
export const MAX_CROP_SOURCE_SIZE_IN_BYTES = 25 * 1024 * 1024;

/** Formats the upload route accepts. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** `accept` attribute for the file picker, so the browser filters what the server enforces. */
export const IMAGE_ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_TYPES.join(",");
