/**
 * Result of a publish attempt.
 *
 * Client-safe on purpose: the dialog renders it and the server action returns
 * it, so it cannot live behind `server-only`.
 */
export type InstagramPostState =
  | { status: "idle" }
  | { status: "success"; permalink: string | null }
  | { status: "error"; message: string };

/** The business account the token belongs to. */
export type InstagramAccount = {
  id: string;
  username?: string;
};
