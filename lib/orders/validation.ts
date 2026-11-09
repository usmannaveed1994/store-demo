import type { OrderFulfillmentStatus, OrderStatus } from "@/lib/db/schema";

import { FULFILLMENT_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "./presentation";

/** Fulfilment stages the admin may set, listed in the order the workflow runs. */
export const FULFILLMENT_STATUS_OPTIONS: readonly { value: OrderFulfillmentStatus; label: string }[] =
  [
    { value: "pending", label: FULFILLMENT_STATUS_LABELS.pending },
    { value: "confirmed", label: FULFILLMENT_STATUS_LABELS.confirmed },
    { value: "shipped", label: FULFILLMENT_STATUS_LABELS.shipped },
    { value: "delivered", label: FULFILLMENT_STATUS_LABELS.delivered },
    { value: "cancelled", label: FULFILLMENT_STATUS_LABELS.cancelled },
  ];

/**
 * Payment states an admin may set by hand.
 *
 * The remaining values (`failed`, `expired`, `cancelled`) are written by Stripe
 * and only ever read here, so offering them as a choice would let the dashboard
 * claim a payment outcome the processor never reported.
 */
export const PAYMENT_STATUS_OPTIONS: readonly { value: OrderStatus; label: string }[] = [
  { value: "pending", label: PAYMENT_STATUS_LABELS.pending },
  { value: "paid", label: PAYMENT_STATUS_LABELS.paid },
  { value: "refunded", label: PAYMENT_STATUS_LABELS.refunded },
];

export const FULFILLMENT_STATUS_VALUES = new Set<string>(
  FULFILLMENT_STATUS_OPTIONS.map((option) => option.value),
);

export const PAYMENT_STATUS_VALUES = new Set<string>(
  PAYMENT_STATUS_OPTIONS.map((option) => option.value),
);

/**
 * Every payment state, for the list filter.
 *
 * Filtering has to reach the states only Stripe writes — finding the `failed`
 * orders is exactly what the dashboard is for, even though they cannot be set
 * by hand.
 */
export const PAYMENT_FILTER_OPTIONS: readonly { value: OrderStatus; label: string }[] = (
  ["pending", "paid", "refunded", "failed", "expired", "cancelled"] as const
).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));

export const PAYMENT_FILTER_VALUES = new Set<string>(
  PAYMENT_FILTER_OPTIONS.map((option) => option.value),
);

const MAX_LENGTH = {
  courier: 80,
  trackingNumber: 80,
} as const;

/** Courier details as the detail page submits them, already normalised. */
export type TrackingFormValues = {
  courier: string | null;
  trackingNumber: string | null;
};

export type TrackingFieldErrors = Partial<Record<keyof TrackingFormValues, string>>;

export type TrackingFormState = {
  fieldErrors: TrackingFieldErrors;
  /** Banner text for outcomes that are not tied to a single input. */
  message?: string;
  /** `true` when the banner reports a successful save rather than a failure. */
  saved?: boolean;
};

export type TrackingValidationResult =
  | { ok: true; value: TrackingFormValues }
  | { ok: false; fieldErrors: TrackingFieldErrors };

/** Trimmed string for a form field; anything that is not a string reads as empty. */
function readField(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
}

/**
 * Courier and tracking number, which are either both present or both empty.
 *
 * A half-filled pair would render a tracking link that goes nowhere, so a lone
 * value is rejected instead of being stored. Blanking both is allowed: a courier
 * can change after the order was marked shipped.
 */
export function parseTrackingForm(body: Record<string, unknown>): TrackingValidationResult {
  const fieldErrors: TrackingFieldErrors = {};

  const courier = readField(body, "courier");
  const trackingNumber = readField(body, "trackingNumber");

  if (courier.length > MAX_LENGTH.courier) {
    fieldErrors.courier = `Use ${MAX_LENGTH.courier} characters or fewer.`;
  }

  if (trackingNumber.length > MAX_LENGTH.trackingNumber) {
    fieldErrors.trackingNumber = `Use ${MAX_LENGTH.trackingNumber} characters or fewer.`;
  }

  if ((courier.length === 0) !== (trackingNumber.length === 0)) {
    const message = "Enter both a courier and a tracking number, or leave both blank.";

    if (courier.length === 0) {
      fieldErrors.courier = message;
    } else {
      fieldErrors.trackingNumber = message;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      courier: courier.length > 0 ? courier : null,
      trackingNumber: trackingNumber.length > 0 ? trackingNumber : null,
    },
  };
}
