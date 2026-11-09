"use server";

import { refresh } from "next/cache";

import { requireAdmin } from "@/lib/admin/authorization";
import { isUuid } from "@/lib/cart/validation";
import {
  updateOrderFulfillment,
  updateOrderPaymentStatus,
  updateOrderTracking,
} from "@/lib/db/queries/orders";
import type { OrderFulfillmentStatus, OrderStatus } from "@/lib/db/schema";
import {
  FULFILLMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  parseTrackingForm,
  type TrackingFormState,
} from "@/lib/orders/validation";

/**
 * Fulfilment stage, and — when cancelling — whether the units go back on sale.
 *
 * `restock` is a plain checkbox rather than an automatic rule: a damaged return
 * must not become sellable stock, and only the admin knows which it is.
 */
export async function setFulfillmentStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("fulfillmentStatus") ?? "");

  if (!isUuid(id) || !FULFILLMENT_STATUS_VALUES.has(status)) {
    return;
  }

  await updateOrderFulfillment(id, {
    fulfillmentStatus: status as OrderFulfillmentStatus,
    restock: formData.get("restock") === "on",
  });

  refresh();
}

/** Only the states an admin can vouch for; Stripe's own outcomes stay read-only. */
export async function setPaymentStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!isUuid(id) || !PAYMENT_STATUS_VALUES.has(status)) {
    return;
  }

  await updateOrderPaymentStatus(id, status as OrderStatus);
  refresh();
}

export async function saveTracking(
  _previousState: TrackingFormState,
  formData: FormData,
): Promise<TrackingFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!isUuid(id)) {
    return { fieldErrors: {}, message: "That order no longer exists." };
  }

  const parsed = parseTrackingForm({
    courier: formData.get("courier"),
    trackingNumber: formData.get("trackingNumber"),
  });

  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const order = await updateOrderTracking(id, parsed.value);

  if (!order) {
    return { fieldErrors: {}, message: "A cancelled order can no longer be edited." };
  }

  refresh();

  return { fieldErrors: {}, message: "Courier details saved.", saved: true };
}
