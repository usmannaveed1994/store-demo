/**
 * Checkout switches and store details, in one place.
 *
 * Every value here is a plain constant, so the same imports work in client
 * components, route handlers and server components.
 */

/**
 * Flat shipping charged on every order, in whole cents. `0` means free shipping.
 *
 * Isolated here so a real rate — or Stripe Tax / shipping rates — only has to
 * change this value and `lib/checkout/session.ts`, not every total calculation.
 */
export const SHIPPING_FLAT_RATE_CENTS = 0;

/**
 * Master switch for the Stripe flow.
 *
 * `false` routes checkout through the manual flow: no Stripe session is opened,
 * the shopper picks advance payment (SadaPay) or cash on delivery, and the
 * confirmation is keyed by the order number. Flip it to `true` to restore the
 * hosted card checkout — `lib/payments/stripe.ts`, `lib/checkout/session.ts` and
 * the webhook route are untouched by either mode.
 */
export const ENABLE_STRIPE = false;

/**
 * Where an advance payment should be sent, and how to reach the order desk.
 *
 * Rendered on the checkout, the confirmation page and the WhatsApp hand-off.
 * Replace the bracketed placeholders with the real details before going live.
 */
export const PAYMENT_DETAILS = {
  accountTitle: "MUHAMMAD USMAN",
  accountNumber: "03314741989",
  iban: "PK13SADA0000003314741989",
  whatsappNumber: "+923314741989",
} as const;

/**
 * Destinations the form offers.
 *
 * The same array feeds the `<select>` and the server validation, so a country
 * can never be offered to the shopper and then rejected by the API (or the other
 * way round). Delete entries to ship to fewer places, add a line to widen it.
 */
export const SHIPPING_COUNTRIES = [
  { code: "PK", label: "Pakistan" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "PT", label: "Portugal" },
  { code: "SE", label: "Sweden" },
  { code: "DK", label: "Denmark" },
  { code: "NO", label: "Norway" },
  { code: "CH", label: "Switzerland" },
  { code: "JP", label: "Japan" },
  { code: "SG", label: "Singapore" },
  { code: "AE", label: "United Arab Emirates" },
] as const;

/** Country the form starts on. Must be one of `SHIPPING_COUNTRIES`. */
export const DEFAULT_SHIPPING_COUNTRY = "PK";

/**
 * `wa.me` link that opens a chat with the order desk.
 *
 * The number is reduced to digits because `wa.me` rejects spaces, dashes and a
 * leading `+`, and the message is encoded so an order number cannot break it.
 */
export function whatsappLink(message: string): string {
  const number = PAYMENT_DETAILS.whatsappNumber.replace(/\D/g, "");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Chat about one order, with the reference already filled in. */
export function whatsappOrderLink(orderNumber: string): string {
  return whatsappLink(`Hi, I'd like to talk about my order ${orderNumber}.`);
}
