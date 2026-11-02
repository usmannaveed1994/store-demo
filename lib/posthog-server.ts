import "server-only";

import { PostHog } from "posthog-node";

type EventProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Sends a server-side product event from a short-lived route handler.
 *
 * A missing analytics configuration leaves production requests unaffected. The
 * browser initialization reports absent public configuration during development.
 */
export async function captureServerEvent(
  event: string,
  properties: EventProperties,
  distinctId?: string,
): Promise<void> {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) {
    return;
  }

  const posthog = new PostHog(projectToken, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });

  posthog.capture({ event, distinctId, properties });
  await posthog.shutdown();
}
