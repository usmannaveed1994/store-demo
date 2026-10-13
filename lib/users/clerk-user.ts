import type { User as ClerkBackendUser, UserJSON } from "@clerk/nextjs/server";

/**
 * The subset of a Clerk user that the storefront mirrors into Postgres.
 *
 * Clerk exposes the same user through two different shapes, the Backend API
 * object (`camelCase`, class instances) and the webhook payload (`snake_case`,
 * plain JSON). Both are normalised into this single record so the persistence
 * layer only has to understand one type.
 */
export type ClerkUserRecord = {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
  lastSignedInAt: Date | null;
};

type ClerkEmailAddress = {
  id: string;
  address: string;
  status: string | null;
};

/**
 * Clerk reports timestamps as epoch numbers. Current payloads use
 * milliseconds, so anything below the millisecond threshold (Sep 2001) is a
 * seconds value and is scaled up. This keeps the column correct even if a
 * payload arrives in seconds.
 */
function toDate(epoch: number | null | undefined): Date | null {
  if (typeof epoch !== "number") {
    return null;
  }

  return new Date(epoch < 1_000_000_000_000 ? epoch * 1000 : epoch);
}

function resolvePrimaryEmail(
  emails: ClerkEmailAddress[],
  primaryEmailAddressId: string | null,
): ClerkEmailAddress | null {
  if (primaryEmailAddressId) {
    const primary = emails.find((email) => email.id === primaryEmailAddressId);

    if (primary) {
      return primary;
    }
  }

  return emails[0] ?? null;
}

/** Maps the `camelCase` Backend API user returned by `currentUser()`. */
export function mapClerkBackendUser(user: ClerkBackendUser): ClerkUserRecord {
  const email = resolvePrimaryEmail(
    user.emailAddresses.map((entry) => ({
      id: entry.id,
      address: entry.emailAddress,
      status: entry.verification?.status ?? null,
    })),
    user.primaryEmailAddressId,
  );

  return {
    clerkUserId: user.id,
    email: email?.address ?? null,
    emailVerified: email?.status === "verified",
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    imageUrl: user.imageUrl || null,
    lastSignedInAt: toDate(user.lastSignInAt),
  };
}

/** Maps the `snake_case` user payload delivered by Clerk webhooks. */
export function mapClerkWebhookUser(user: UserJSON): ClerkUserRecord {
  const email = resolvePrimaryEmail(
    user.email_addresses.map((entry) => ({
      id: entry.id,
      address: entry.email_address,
      status: entry.verification?.status ?? null,
    })),
    user.primary_email_address_id,
  );

  return {
    clerkUserId: user.id,
    email: email?.address ?? null,
    emailVerified: email?.status === "verified",
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    imageUrl: user.image_url || null,
    lastSignedInAt: toDate(user.last_sign_in_at),
  };
}
