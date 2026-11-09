"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrackingFormState } from "@/lib/orders/validation";
import { cn } from "@/lib/utils";

const INITIAL_STATE: TrackingFormState = { fieldErrors: {} };

type TrackingFormProps = {
  action: (state: TrackingFormState, formData: FormData) => Promise<TrackingFormState>;
  orderId: string;
  courier: string | null;
  trackingNumber: string | null;
  /** A cancelled order keeps its last courier details but cannot be edited. */
  disabled?: boolean;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * Courier and tracking number.
 *
 * Client-side only for `useActionState`: a failed submit keeps what the admin
 * typed and puts the error under the offending input.
 */
export function TrackingForm({
  action,
  orderId,
  courier,
  trackingNumber,
  disabled = false,
}: TrackingFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={orderId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="courier">Courier</Label>
        <Input
          id="courier"
          name="courier"
          defaultValue={courier ?? ""}
          placeholder="DHL Express"
          disabled={disabled}
          aria-invalid={errors.courier ? true : undefined}
          aria-describedby={errors.courier ? "courier-error" : undefined}
        />
        <FieldError id="courier" message={errors.courier} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trackingNumber">Tracking number</Label>
        <Input
          id="trackingNumber"
          name="trackingNumber"
          defaultValue={trackingNumber ?? ""}
          disabled={disabled}
          aria-invalid={errors.trackingNumber ? true : undefined}
          aria-describedby={errors.trackingNumber ? "trackingNumber-error" : undefined}
        />
        <FieldError id="trackingNumber" message={errors.trackingNumber} />
      </div>

      {state.message ? (
        <p
          role={state.saved ? "status" : "alert"}
          className={cn("text-sm", state.saved ? "text-muted-foreground" : "text-destructive")}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={disabled || isPending}>
        {isPending ? "Saving…" : "Save courier details"}
      </Button>
    </form>
  );
}
