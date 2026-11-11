import { PAYMENT_DETAILS } from "@/lib/checkout/config";
import type { ManualPaymentMethod } from "@/lib/checkout/dto";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/checkout/validation";
import { cn } from "@/lib/utils";

type PaymentMethodSectionProps = {
  value: ManualPaymentMethod;
  onChange: (value: ManualPaymentMethod) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Advance payment / COD picker.
 *
 * Native radios rather than the shadcn primitive: `@radix-ui/react-radio-group`
 * is not installed, and the whole card is the label, so a tap anywhere selects
 * the method. The transfer details only appear once advance payment is chosen.
 */
export function PaymentMethodSection({
  value,
  onChange,
  error,
  disabled,
}: PaymentMethodSectionProps) {
  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-1 text-base font-medium text-foreground">Payment method</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_METHOD_OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                selected ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                aria-describedby={error ? "paymentMethod-error" : undefined}
                className="mt-0.5 size-4 shrink-0 accent-foreground"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id="paymentMethod-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {value === "advance" ? <AdvancePaymentDetails /> : null}
    </fieldset>
  );
}

/** Where to send the money, shown inline so the shopper can pay right away. */
function AdvancePaymentDetails() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-4 text-sm text-card-foreground">
      <p className="font-medium text-foreground">Please pay directly to our SadaPay account:</p>

      <dl className="mt-3 flex flex-col gap-2">
        <DetailRow label="Account title" value={PAYMENT_DETAILS.accountTitle} />
        <DetailRow label="Account number" value={PAYMENT_DETAILS.accountNumber} />
        <DetailRow label="IBAN" value={PAYMENT_DETAILS.iban} />
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        Send the receipt on WhatsApp and we will confirm the order.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
