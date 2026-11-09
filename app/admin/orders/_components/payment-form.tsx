import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Order } from "@/lib/db/schema";
import { PAYMENT_STATUS_OPTIONS } from "@/lib/orders/validation";

import { setPaymentStatus } from "../actions";

/**
 * Payment state, editable by hand.
 *
 * Only the states an admin can vouch for are offered; `failed`, `expired` and
 * `cancelled` stay as Stripe wrote them, so the dashboard cannot claim an
 * outcome the processor never reported.
 *
 * Keyed by the state for the same reason as the fulfilment form: React resets
 * the form on submit and keeps the select showing its mount-time value.
 */
export function PaymentForm({ order }: { order: Order }) {
  const isStripeState = !PAYMENT_STATUS_OPTIONS.some((option) => option.value === order.status);

  return (
    <form key={order.status} action={setPaymentStatus} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={order.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Payment status</Label>
        <NativeSelect id="status" name="status" defaultValue={isStripeState ? "" : order.status}>
          {isStripeState ? (
            <option value="" disabled>
              Set by Stripe
            </option>
          ) : null}
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Use this for money that arrived or was refunded outside Stripe.
        </p>
      </div>

      <Button type="submit" variant="secondary">
        Save payment
      </Button>
    </form>
  );
}
