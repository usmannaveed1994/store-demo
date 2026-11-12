/**
 * Instagram publishing limits.
 *
 * Instagram's Content Publishing API lives on the Facebook Graph API, so the
 * version is pinned here once instead of at each call site.
 */
export const GRAPH_API_HOST = "https://graph.facebook.com";
export const GRAPH_API_VERSION = "v25.0";

/** Hard caption limit Instagram enforces, in characters. */
export const MAX_CAPTION_LENGTH = 2200;

/** Images one carousel may hold; a single image is published as its own container. */
export const MAX_CAROUSEL_ITEMS = 10;

/** Largest image Instagram downloads from `image_url`, in bytes. */
export const MAX_PUBLISH_IMAGE_BYTES = 8 * 1024 * 1024;

/** Longest edge the uploaded JPEG is normalised to; also Instagram's recommended width. */
export const PUBLISH_IMAGE_EDGE = 1080;

/** Instagram rejects photos narrower than this, so tiny sources are scaled up to it. */
export const MIN_PUBLISH_IMAGE_WIDTH = 320;

/** Accepted aspect ratio window, expressed as width / height (4:5 up to 1.91:1). */
export const MIN_ASPECT_RATIO = 0.8;
export const MAX_ASPECT_RATIO = 1.91;

/** Bytes fetched from the product image before it is re-encoded. */
export const MAX_SOURCE_IMAGE_BYTES = 32 * 1024 * 1024;

/** How long to wait for Instagram to finish processing one media container. */
export const CONTAINER_POLL_INTERVAL_MS = 3000;
export const CONTAINER_POLL_TIMEOUT_MS = 45_000;
