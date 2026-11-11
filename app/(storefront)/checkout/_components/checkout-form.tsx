"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { useCartQuery } from "@/lib/cart/hooks";
import { CheckoutRequestError } from "@/lib/checkout/api";
import { DEFAULT_SHIPPING_COUNTRY, ENABLE_STRIPE, SHIPPING_COUNTRIES } from "@/lib/checkout/config";
import type {
  CheckoutFieldErrors,
  CheckoutRequest,
  ManualPaymentMethod,
  ShippingDetails,
} from "@/lib/checkout/dto";
import { useStartCheckout } from "@/lib/checkout/hooks";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/checkout/validation";

import { SelectField, TextField } from "./checkout-fields";
import { PaymentMethodSection } from "./payment-method";

type FormValues = {
  email: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const EMPTY_FORM: FormValues = {
  email: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: DEFAULT_SHIPPING_COUNTRY,
};

const COUNTRY_OPTIONS = SHIPPING_COUNTRIES.map((country) => ({
  value: country.code,
  label: country.label,
}));

/** Button copy follows the active flow, so the promise matches what happens. */
function submitLabelFor(isBusy: boolean): string {
  if (ENABLE_STRIPE) {
    return isBusy ? "Redirecting to Stripe…" : "Continue to payment";
  }

  return isBusy ? "Placing order…" : "Place order";
}

const PAYMENT_HINT = ENABLE_STRIPE
  ? "Card details are entered on Stripe's secure page. Nothing is charged until you confirm there."
  : "Your order number appears on the next screen, with the payment details and a WhatsApp link.";

/** Empty optional inputs become `null`, which is what the API expects. */
function toShippingDetails(values: FormValues): ShippingDetails {
  return {
    email: values.email.trim(),
    fullName: values.fullName.trim(),
    phone: values.phone.trim() || null,
    line1: values.line1.trim(),
    line2: values.line2.trim() || null,
    city: values.city.trim(),
    state: values.state.trim() || null,
    postalCode: values.postalCode.trim(),
    country: values.country,
  };
}

/**
 * Checkout form.
 *
 * The server owns every rule, so the form only maps `fieldErrors` back onto the
 * inputs. Prefilling from Clerk is a convenience only — a guest sees the same
 * form and its fields stay editable.
 */
export function CheckoutForm() {
  const cartQuery = useCartQuery();
  const startCheckout = useStartCheckout();
  const { isLoaded, user } = useUser();
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  // Only fields the shopper has touched. Everything else falls back to Clerk, so
  // the form stays reactive to the user loading without an effect writing state.
  const [edited, setEdited] = useState<Partial<FormValues>>({});
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("advance");

  const values: FormValues = {
    ...EMPTY_FORM,
    email: isLoaded ? (user?.primaryEmailAddress?.emailAddress ?? "") : "",
    fullName: isLoaded ? (user?.fullName ?? "") : "",
    ...edited,
  };

  function update(field: keyof FormValues) {
    return (value: string) => {
      // A new edit invalidates the previous submit's message.
      if (startCheckout.isError) {
        startCheckout.reset();
      }

      setEdited((current) => ({ ...current, [field]: value }));
      // Drop a stale message as soon as the shopper edits that field.
      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];

        return next;
      });
    };
  }

  function selectPaymentMethod(next: ManualPaymentMethod) {
    if (startCheckout.isError) {
      startCheckout.reset();
    }

    setPaymentMethod(next);
    setFieldErrors((current) => {
      if (!current.paymentMethod) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.paymentMethod;

      return nextErrors;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    // The radios can only be left unset by a client that skipped the UI; the
    // check keeps an order nobody can collect payment for out of the database.
    if (!PAYMENT_METHOD_OPTIONS.some((option) => option.value === paymentMethod)) {
      setFieldErrors({ paymentMethod: "Choose a payment method." });
      return;
    }

    const request: CheckoutRequest = { ...toShippingDetails(values), paymentMethod };

    startCheckout.mutate(request, {
      onSuccess: () => {
        const cart = cartQuery.data;

        if (cart) {
          posthog.capture("checkout_started", {
            item_count: cart.itemCount,
            subtotal: cart.subtotal,
            currency: cart.currency,
            payment_method: ENABLE_STRIPE ? "card" : paymentMethod,
          });
        }
      },
      onError: (error) => {
        if (error instanceof CheckoutRequestError) {
          setFieldErrors(error.fieldErrors);
        }
      },
    });
  }

  if (cartQuery.isPending) {
    return <FormSkeleton />;
  }

  if (cartQuery.isError) {
    return (
      <Notice
        title="We could not load your cart."
        description={cartQuery.error.message}
        href="/cart"
        action="Back to cart"
      />
    );
  }

  const cart = cartQuery.data;
  const blocked = cart.lines.find((line) => !line.isAvailable);

  if (cart.lines.length === 0 || !cart.subtotal) {
    return (
      <Notice
        title="Your cart is empty."
        description="Add something to it before checking out."
        href="/collections"
        action="Browse the catalogue"
      />
    );
  }

  if (blocked) {
    return (
      <Notice
        title={`${blocked.title} is no longer available.`}
        description="Remove it from your cart to continue."
        href="/cart"
        action="Review cart"
      />
    );
  }

  const isBusy = startCheckout.isPending;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const generalError = startCheckout.error && !hasFieldErrors ? startCheckout.error.message : null;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4" disabled={isBusy}>
        <legend className="mb-1 text-base font-medium text-foreground">Contact</legend>

        <TextField
          id="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={update("email")}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          id="fullName"
          label="Full name"
          value={values.fullName}
          onChange={update("fullName")}
          error={fieldErrors.fullName}
          autoComplete="name"
        />
        <TextField
          id="phone"
          label="Phone (optional)"
          type="tel"
          value={values.phone}
          onChange={update("phone")}
          error={fieldErrors.phone}
          autoComplete="tel"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4" disabled={isBusy}>
        <legend className="mb-1 text-base font-medium text-foreground">Shipping address</legend>

        <TextField
          id="line1"
          label="Street address"
          value={values.line1}
          onChange={update("line1")}
          error={fieldErrors.line1}
          autoComplete="address-line1"
        />
        <TextField
          id="line2"
          label="Apartment, suite, etc. (optional)"
          value={values.line2}
          onChange={update("line2")}
          error={fieldErrors.line2}
          autoComplete="address-line2"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="city"
            label="City"
            value={values.city}
            onChange={update("city")}
            error={fieldErrors.city}
            autoComplete="address-level2"
          />
          <TextField
            id="state"
            label="State / province (optional)"
            value={values.state}
            onChange={update("state")}
            error={fieldErrors.state}
            autoComplete="address-level1"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="postalCode"
            label="Postal code"
            value={values.postalCode}
            onChange={update("postalCode")}
            error={fieldErrors.postalCode}
            autoComplete="postal-code"
          />
          <SelectField
            id="country"
            label="Country"
            value={values.country}
            options={COUNTRY_OPTIONS}
            onChange={update("country")}
            error={fieldErrors.country}
            placeholder="Select a country"
            autoComplete="country-name"
          />
        </div>
      </fieldset>

      {ENABLE_STRIPE ? null : (
        <PaymentMethodSection
          value={paymentMethod}
          onChange={selectPaymentMethod}
          error={fieldErrors.paymentMethod}
          disabled={isBusy}
        />
      )}

      {generalError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
        >
          {generalError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={isBusy} className="h-12 text-base font-semibold">
          {submitLabelFor(isBusy)}
        </Button>
        <p className="text-xs text-muted-foreground">{PAYMENT_HINT}</p>
      </div>
    </form>
  );
}

function Notice({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

/** Roughly one block per field, so the layout does not jump when the cart loads. */
function FormSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-14 rounded-md bg-muted" />
        ))}
      </div>
      <div className="mt-8 h-4 w-32 rounded bg-muted" />
      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-14 rounded-md bg-muted" />
        ))}
      </div>
      <div className="mt-8 h-12 rounded-md bg-muted" />
    </div>
  );
}

