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

/**
 * How an order is paid for.
 *
 * `card` is only ever written by the Stripe path. The manual flow offers
 * `advance` (transfer to the account in `lib/checkout/config.ts`) and `cod`.
 */
export type PaymentMethod = "card" | "advance" | "cod";

/** The methods the checkout form offers while `ENABLE_STRIPE` is `false`. */
export type ManualPaymentMethod = Exclude<PaymentMethod, "card">;

/**
 * What `POST /api/checkout` expects: the delivery details plus the chosen
 * method. Everything chargeable — prices, stock, currency — is re-derived on the
 * server from the cart.
 */
export type CheckoutRequest = ShippingDetails & {
  paymentMethod: ManualPaymentMethod;
};

/** Per-field messages keyed by form field name, so the form can place them. */
export type CheckoutFieldErrors = Partial<Record<keyof CheckoutRequest, string>>;

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
