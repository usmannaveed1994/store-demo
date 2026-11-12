import "server-only";

import {
  CONTAINER_POLL_INTERVAL_MS,
  CONTAINER_POLL_TIMEOUT_MS,
  GRAPH_API_HOST,
  GRAPH_API_VERSION,
} from "./constants";
import type { InstagramAccount } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;

/** Instagram's `status_code` for a media container. */
export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

/** A Graph API failure carrying the message Instagram gave us, so it can be shown as-is. */
export class InstagramApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InstagramApiError";
    this.status = status;
  }
}

type GraphErrorPayload = {
  error?: {
    message?: string;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

type InstagramConfig = {
  accessToken: string;
  accountId: string;
};

function readConfig(): InstagramConfig {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID?.trim();

  if (!accessToken || !accountId) {
    throw new InstagramApiError(
      "Instagram is not configured: set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID.",
      503,
    );
  }

  return { accessToken, accountId };
}

/** Shared request wrapper: bearer token, no caching, bounded wait, readable errors. */
async function graphRequest<T>(url: URL, init: RequestInit, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as (T & GraphErrorPayload) | null;

  if (!response.ok || !payload) {
    const error = payload?.error;

    throw new InstagramApiError(
      error?.error_user_msg ??
        error?.message ??
        `Instagram request failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  return payload;
}

function nodeUrl(id: string): URL {
  return new URL(`${GRAPH_API_HOST}/${GRAPH_API_VERSION}/${id}`);
}

function accountUrl(accountId: string, path: string): URL {
  return new URL(`${GRAPH_API_HOST}/${GRAPH_API_VERSION}/${accountId}${path}`);
}

/** The configured business account; also the credential check behind `GET /api/instagram`. */
export async function getAccount(): Promise<InstagramAccount> {
  const { accessToken, accountId } = readConfig();
  const url = accountUrl(accountId, "");
  url.searchParams.set("fields", "id,username");

  return graphRequest<InstagramAccount>(url, { method: "GET" }, accessToken);
}

/**
 * One image as a media container.
 *
 * `isCarouselItem` skips the caption on purpose: a carousel caption belongs to
 * the parent container and children ignore theirs.
 */
export async function createImageContainer(
  imageUrl: string,
  options: { caption?: string; isCarouselItem?: boolean } = {},
): Promise<string> {
  const { accessToken, accountId } = readConfig();
  const body = new URLSearchParams({ image_url: imageUrl });

  if (options.isCarouselItem) {
    body.set("is_carousel_item", "true");
  }

  if (options.caption) {
    body.set("caption", options.caption);
  }

  const container = await graphRequest<{ id: string }>(
    accountUrl(accountId, "/media"),
    { method: "POST", body },
    accessToken,
  );

  return container.id;
}

/** The carousel parent that carries the caption and publishes its children together. */
export async function createCarouselContainer(
  children: string[],
  caption: string,
): Promise<string> {
  const { accessToken, accountId } = readConfig();

  const body = new URLSearchParams({
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });

  const container = await graphRequest<{ id: string }>(
    accountUrl(accountId, "/media"),
    { method: "POST", body },
    accessToken,
  );

  return container.id;
}

/**
 * Waits until Instagram has ingested a container.
 *
 * Publishing one that is still `IN_PROGRESS` fails, and the wait is bounded so a
 * stuck upload surfaces as an error instead of a hung action.
 */
export async function waitForContainer(containerId: string): Promise<void> {
  const { accessToken } = readConfig();
  const url = nodeUrl(containerId);
  url.searchParams.set("fields", "status_code");

  const deadline = Date.now() + CONTAINER_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { status_code } = await graphRequest<{ status_code: ContainerStatus }>(
      url,
      { method: "GET" },
      accessToken,
    );

    if (status_code === "FINISHED") {
      return;
    }

    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new InstagramApiError(
        status_code === "EXPIRED"
          ? "Instagram gave up preparing the media (the container expired). Try again."
          : "Instagram could not process the image. Check that the photo is a valid JPEG.",
        502,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
  }

  throw new InstagramApiError("Instagram is still preparing the media. Try again shortly.", 504);
}

/** Publishes a finished container and returns the live media id. */
export async function publishContainer(containerId: string): Promise<string> {
  const { accessToken, accountId } = readConfig();

  const published = await graphRequest<{ id: string }>(
    accountUrl(accountId, "/media_publish"),
    { method: "POST", body: new URLSearchParams({ creation_id: containerId }) },
    accessToken,
  );

  return published.id;
}

/** Public URL of a published post, or `null` when Instagram has not indexed it yet. */
export async function getMediaPermalink(mediaId: string): Promise<string | null> {
  const { accessToken } = readConfig();
  const url = nodeUrl(mediaId);
  url.searchParams.set("fields", "permalink");

  const media = await graphRequest<{ permalink?: string }>(url, { method: "GET" }, accessToken);

  return media.permalink ?? null;
}
