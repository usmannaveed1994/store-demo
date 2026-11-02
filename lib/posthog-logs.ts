import "server-only";

import { SeverityNumber } from "@opentelemetry/api-logs";

import { posthogLogLogger, posthogLogProvider } from "@/instrumentation";

export function logCheckoutRequestValidated(): void {
  posthogLogLogger?.emit({
    body: "checkout_request_validated",
    severityNumber: SeverityNumber.INFO,
    attributes: { route: "/api/checkout", stage: "payment_session" },
  });
}

export function logCheckoutSessionCreated(): void {
  posthogLogLogger?.emit({
    body: "checkout_session_created",
    severityNumber: SeverityNumber.INFO,
    attributes: { route: "/api/checkout", outcome: "redirect_ready" },
  });
}

export function logCheckoutSessionCreationFailed(): void {
  posthogLogLogger?.emit({
    body: "checkout_session_creation_failed",
    severityNumber: SeverityNumber.ERROR,
    attributes: { route: "/api/checkout", outcome: "payment_unavailable" },
  });
}

export async function flushPosthogLogs(): Promise<void> {
  await posthogLogProvider?.forceFlush();
}
