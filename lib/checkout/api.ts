import {
  isCheckoutErrorResponse,
  isCheckoutResponse,
  type CheckoutFieldErrors,
  type CheckoutRequest,
  type CheckoutResponse,
} from "./dto";

/** A failed checkout with the server's field-level messages, when it sent any. */
export class CheckoutRequestError extends Error {
  readonly fieldErrors: CheckoutFieldErrors;

  constructor(message: string, fieldErrors: CheckoutFieldErrors = {}) {
    super(message);
    this.name = "CheckoutRequestError";
    this.fieldErrors = fieldErrors;
  }
}

function requestErrorFrom(payload: unknown, status: number): CheckoutRequestError {
  if (!isCheckoutErrorResponse(payload)) {
    return new CheckoutRequestError(`Checkout failed (${status}).`);
  }

  return new CheckoutRequestError(payload.error, payload.fieldErrors ?? {});
}

export const checkoutApi = {
  /**
   * Creates the order and returns where to go next: Stripe's hosted page, or
   * the confirmation page when the manual flow is in charge.
   */
  start: async (request: CheckoutRequest): Promise<CheckoutResponse> => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw requestErrorFrom(payload, response.status);
    }

    if (!isCheckoutResponse(payload)) {
      throw new CheckoutRequestError("The checkout response was not in the expected shape.");
    }

    return payload;
  },
};
