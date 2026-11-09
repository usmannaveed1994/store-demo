import type { OrderFulfillmentStatus, OrderStatus } from "@/lib/db/schema";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
};

/** A settled stage reads as `default`; work in progress stays quiet. */
export const FULFILLMENT_BADGE_VARIANT: Record<OrderFulfillmentStatus, BadgeVariant> = {
  pending: "outline",
  confirmed: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "outline",
};

export const PAYMENT_BADGE_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: "outline",
  paid: "default",
  failed: "destructive",
  cancelled: "outline",
  expired: "outline",
  refunded: "secondary",
};
