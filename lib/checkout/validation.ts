import type { CheckoutFieldErrors, ShippingDetails } from "./dto";

/**
 * Destinations the form offers.
 *
 * The same list feeds the `<select>` and the server validation, so a country can
 * never be offered to the shopper and then rejected by the API (or the other way
 * round). Extend this list, not the two call sites.
 */
export const SHIPPING_COUNTRIES = [
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

const COUNTRY_CODES = new Set<string>(SHIPPING_COUNTRIES.map((country) => country.code));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_LENGTH = {
  email: 254,
  fullName: 120,
  phone: 32,
  line1: 160,
  line2: 160,
  city: 80,
  state: 80,
  postalCode: 24,
} as const;

export type ShippingValidationResult =
  | { ok: true; value: ShippingDetails }
  | { ok: false; fieldErrors: CheckoutFieldErrors };

/** Trimmed string for a form field; anything that is not a string reads as empty. */
function readField(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
}

function checkLength(
  fieldErrors: CheckoutFieldErrors,
  field: keyof CheckoutFieldErrors,
  value: string,
  max: number,
): void {
  if (value.length > max) {
    fieldErrors[field] = `Use ${max} characters or fewer.`;
  }
}

/**
 * Validates and normalises a checkout body.
 *
 * Hand-rolled to match `lib/cart/validation.ts`: the project has no schema
 * library, and the rules are small enough that one file keeps them readable.
 */
export function parseShippingDetails(body: Record<string, unknown>): ShippingValidationResult {
  const fieldErrors: CheckoutFieldErrors = {};

  const email = readField(body, "email").toLowerCase();
  const fullName = readField(body, "fullName");
  const phone = readField(body, "phone");
  const line1 = readField(body, "line1");
  const line2 = readField(body, "line2");
  const city = readField(body, "city");
  const state = readField(body, "state");
  const postalCode = readField(body, "postalCode");
  const country = readField(body, "country").toUpperCase();

  if (email.length === 0) {
    fieldErrors.email = "Enter your email address.";
  } else if (email.length > MAX_LENGTH.email || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (fullName.length < 2) {
    fieldErrors.fullName = "Enter the recipient's full name.";
  } else {
    checkLength(fieldErrors, "fullName", fullName, MAX_LENGTH.fullName);
  }

  if (phone.length > 0) {
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 6 || phone.length > MAX_LENGTH.phone) {
      fieldErrors.phone = "Enter a valid phone number.";
    }
  }

  if (line1.length < 3) {
    fieldErrors.line1 = "Enter the street address.";
  } else {
    checkLength(fieldErrors, "line1", line1, MAX_LENGTH.line1);
  }

  checkLength(fieldErrors, "line2", line2, MAX_LENGTH.line2);

  if (city.length < 2) {
    fieldErrors.city = "Enter the city.";
  } else {
    checkLength(fieldErrors, "city", city, MAX_LENGTH.city);
  }

  checkLength(fieldErrors, "state", state, MAX_LENGTH.state);

  if (postalCode.length < 3) {
    fieldErrors.postalCode = "Enter the postal code.";
  } else {
    checkLength(fieldErrors, "postalCode", postalCode, MAX_LENGTH.postalCode);
  }

  if (!COUNTRY_CODES.has(country)) {
    fieldErrors.country = "Choose a delivery country.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      email,
      fullName,
      phone: phone.length > 0 ? phone : null,
      line1,
      line2: line2.length > 0 ? line2 : null,
      city,
      state: state.length > 0 ? state : null,
      postalCode,
      country,
    },
  };
}
