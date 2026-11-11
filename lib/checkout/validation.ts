import { SHIPPING_COUNTRIES } from "./config";
import type {
  CheckoutFieldErrors,
  CheckoutRequest,
  ManualPaymentMethod,
  ShippingDetails,
} from "./dto";

/** Server-side mirror of the list the `<select>` renders. */
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

/** Methods the manual flow offers, with the copy each radio card shows. */
export const PAYMENT_METHOD_OPTIONS: readonly {
  value: ManualPaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "advance",
    label: "Advance Payment",
    description: "Transfer the total to our SadaPay account before dispatch.",
  },
  {
    value: "cod",
    label: "Cash on Delivery (COD)",
    description: "Pay our delivery partner in cash when the parcel arrives.",
  },
];

const PAYMENT_METHODS = new Set<string>(PAYMENT_METHOD_OPTIONS.map((option) => option.value));

export type CheckoutValidationResult =
  | { ok: true; value: CheckoutRequest }
  | { ok: false; fieldErrors: CheckoutFieldErrors };

/**
 * Validates a manual checkout body: the address plus a method the form offers.
 *
 * The method is re-checked here because the radio state only exists in the
 * browser — a crafted request must not create an order whose payment nobody can
 * collect.
 */
export function parseCheckoutRequest(body: Record<string, unknown>): CheckoutValidationResult {
  const shipping = parseShippingDetails(body);
  const fieldErrors: CheckoutFieldErrors = shipping.ok ? {} : { ...shipping.fieldErrors };
  const paymentMethod = readField(body, "paymentMethod");

  if (!PAYMENT_METHODS.has(paymentMethod)) {
    fieldErrors.paymentMethod = "Choose a payment method.";
  }

  if (!shipping.ok || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: { ...shipping.value, paymentMethod: paymentMethod as ManualPaymentMethod },
  };
}
