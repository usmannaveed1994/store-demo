/**
 * What the checkout form submits.
 *
 * Only the shopper's own details travel in this body: prices, currency, stock
 * and totals are always re-derived from the cart on the server.
 */
export type ShippingDetails = {
  email: string;
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  /** ISO-3166-1 alpha-2, upper-case. */
  country: string;
};

/** Per-field messages keyed by form field name, so the form can place them. */
export type CheckoutFieldErrors = Partial<Record<keyof ShippingDetails, string>>;

/** Successful `POST /api/checkout`: where the browser should go next. */
export type CheckoutResponse = {
  url: string;
};

export type CheckoutErrorResponse = {
  error: string;
  fieldErrors?: CheckoutFieldErrors;
};

export function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

export function isCheckoutErrorResponse(value: unknown): value is CheckoutErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}
