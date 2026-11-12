import { MAX_CAPTION_LENGTH } from "./constants";

const ELLIPSIS = "…";
const SEPARATOR = "\n\n";

export type CaptionInput = {
  title: string;
  description?: string | null;
  /** Absolute storefront URL. Instagram does not link it, so it travels as text. */
  url: string;
};

/**
 * Characters Instagram will count, so an emoji costs one instead of a surrogate pair.
 *
 * Shared by the dialog's counter and the action's check so the two cannot drift.
 */
export function countCaptionCharacters(value: string): number {
  return [...value].length;
}

export function isCaptionTooLong(value: string): boolean {
  return countCaptionCharacters(value) > MAX_CAPTION_LENGTH;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, Math.max(max - ELLIPSIS.length, 0)).trimEnd()}${ELLIPSIS}`;
}

/**
 * Caption for one product post: title, description, then the product link.
 *
 * The link is reserved space before the text is measured, so a long description
 * loses characters instead of silently dropping the URL past the limit.
 */
export function buildProductCaption({ title, description, url }: CaptionInput): string {
  const trimmedDescription = description?.trim() ?? "";
  const head = trimmedDescription ? `${title.trim()}${SEPARATOR}${trimmedDescription}` : title.trim();

  return `${truncate(head, MAX_CAPTION_LENGTH - url.length - SEPARATOR.length)}${SEPARATOR}${url}`;
}
