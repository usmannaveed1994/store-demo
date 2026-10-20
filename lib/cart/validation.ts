/** Largest quantity a single cart line may hold. */
export const MAX_ITEM_QUANTITY = 99;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Reads a quantity from a parsed JSON body.
 *
 * Only JSON numbers are accepted, so `"2"` and `2.5` are rejected rather than
 * silently coerced the way `Number.parseInt` would.
 */
export function parseQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
