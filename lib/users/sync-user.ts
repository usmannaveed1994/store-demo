import "server-only";

import { currentUser } from "@clerk/nextjs/server";

import { getUserByClerkId, upsertUserFromClerk } from "@/lib/db/queries/users";
import type { User } from "@/lib/db/schema";
import { mapClerkBackendUser, type ClerkUserRecord } from "@/lib/users/clerk-user";

/**
 * Writes a normalised Clerk user into Postgres.
 *
 * Returns `null` when the Clerk user has no email address, because the local
 * `users.email` column is required. Webhook deliveries without an email are
 * acknowledged (not retried) and logged instead of failing the request.
 */
export async function syncUserFromClerk(record: ClerkUserRecord): Promise<User | null> {
  if (!record.email) {
    console.warn(`[users/sync] Skipping Clerk user ${record.clerkUserId}: no primary email address.`);

    return null;
  }

  return upsertUserFromClerk({
    clerkUserId: record.clerkUserId,
    email: record.email,
    emailVerified: record.emailVerified,
    firstName: record.firstName,
    lastName: record.lastName,
    username: record.username,
    imageUrl: record.imageUrl,
    lastSignInAt: record.lastSignedInAt,
  });
}

/**
 * Returns the local user for the active Clerk session, creating the row on
 * first contact and returning `null` when nobody is signed in.
 */
export async function getCurrentDatabaseUser(): Promise<User | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const existing = await getUserByClerkId(clerkUser.id);

  if (existing) {
    return existing;
  }

  return syncUserFromClerk(mapClerkBackendUser(clerkUser));
}
