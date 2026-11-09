/**
 * Reading the admin list pages' query string.
 *
 * `searchParams` values arrive as `string | string[] | undefined`, and a hand
 * edited URL can carry anything, so both helpers reduce input to a usable value
 * instead of trusting it.
 */

/** The first value of a repeated param, or an empty string. */
export function readParam(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? (value[0] ?? "") : "";
}

/** A one-based page number; anything that is not a positive integer reads as page one. */
export function readPage(value: string): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
