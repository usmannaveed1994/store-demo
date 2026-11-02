import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function reportMissingConfiguration(variableName: string): void {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
    );
  }
}

if (!projectToken) {
  reportMissingConfiguration("NEXT_PUBLIC_POSTHOG_KEY");
}

if (!host) {
  reportMissingConfiguration("NEXT_PUBLIC_POSTHOG_HOST");
}

/**
 * Dedicated provider for the explicit PostHog operational logs added in this
 * integration. Existing application loggers intentionally remain untouched.
 */
export const posthogLogProvider =
  projectToken && host
    ? new LoggerProvider({
        resource: resourceFromAttributes({ "service.name": "store-demo" }),
        processors: [
          new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: new URL("/i/v1/logs", host).toString(),
              headers: {
                Authorization: `Bearer ${projectToken}`,
                "Content-Type": "application/json",
              },
            }),
          }),
        ],
      })
    : null;

export const posthogLogLogger = posthogLogProvider?.getLogger("posthog-store-demo") ?? null;

export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs" && posthogLogProvider) {
    logs.setGlobalLoggerProvider(posthogLogProvider);
  }
}
