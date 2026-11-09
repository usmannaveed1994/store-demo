import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Order } from "@/lib/db/schema";
import { FULFILLMENT_STATUS_OPTIONS } from "@/lib/orders/validation";

import { setFulfillmentStatus } from "../actions";

/**
 * Fulfilment stage, posted with a plain form.
 *
 * The restock box is only offered once the money has arrived, because that is
 * the only case where units were ever taken out of stock.
 *
 * The stage is the form's `key` on purpose: React resets a form when its action
 * runs but never re-syncs a select's `defaultValue` after mount, so without a
 * remount the control would fall back to the stage the page opened with.
 */
export function FulfillmentForm({ order }: { order: Order }) {
  const canRestock = order.status === "paid";

  return (
    <form
      key={order.fulfillmentStatus}
      action={setFulfillmentStatus}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={order.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="fulfillmentStatus">Fulfilment stage</Label>
        <NativeSelect
          id="fulfillmentStatus"
          name="fulfillmentStatus"
          defaultValue={order.fulfillmentStatus}
        >
          {FULFILLMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {canRestock ? (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="restock"
            defaultChecked
            className="mt-0.5 size-4 rounded border-input accent-foreground"
          />
          <span>
            Return these units to stock when cancelling
            <span className="block text-xs text-muted-foreground">
              Ignored for every other stage. Untick if the goods came back damaged.
            </span>
          </span>
        </label>
      ) : null}

      <Button type="submit" variant="secondary">
        Save fulfilment
      </Button>
    </form>
  );
}
