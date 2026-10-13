import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users, type NewUser, type User } from "@/lib/db/schema";

/** Profile fields Clerk owns and we mirror. `role` is intentionally excluded. */
export type UserProfileUpdate = Partial<
  Pick<NewUser, "email" | "emailVerified" | "firstName" | "lastName" | "username" | "imageUrl" | "lastSignInAt">
>;

/** Minimum information required to create or refresh a mirrored Clerk user. */
export type ClerkUserSyncInput = Required<Pick<NewUser, "clerkUserId" | "email">> &
  Pick<NewUser, "emailVerified" | "firstName" | "lastName" | "username" | "imageUrl" | "lastSignInAt">;

export async function getUserByClerkId(clerkUserId: string): Promise<User | undefined> {
  const [user] = await getDb().select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);

  return user;
}

export async function insertUser(values: NewUser): Promise<User> {
  const [user] = await getDb().insert(users).values(values).returning();

  if (!user) {
    throw new Error("Failed to insert the user row.");
  }

  return user;
}

export async function updateUserByClerkId(clerkUserId: string, values: UserProfileUpdate): Promise<User | undefined> {
  const [user] = await getDb().update(users).set(values).where(eq(users.clerkUserId, clerkUserId)).returning();

  return user;
}

export async function deleteUserByClerkId(clerkUserId: string): Promise<User | undefined> {
  const [user] = await getDb().delete(users).where(eq(users.clerkUserId, clerkUserId)).returning();

  return user;
}

function toProfileUpdate(input: ClerkUserSyncInput): UserProfileUpdate {
  return {
    email: input.email,
    emailVerified: input.emailVerified,
    firstName: input.firstName,
    lastName: input.lastName,
    username: input.username,
    imageUrl: input.imageUrl,
    lastSignInAt: input.lastSignInAt,
  };
}

/**
 * Create the local row the first time Clerk reports a user, and refresh the
 * mirrored profile fields on every later call.
 *
 * The flow is deliberately a read-then-write rather than a single upsert: a
 * conflict target can only cover one unique index, and we need to tolerate both
 * "same Clerk id, refreshed profile" and "new Clerk id, email already known".
 */
export async function upsertUserFromClerk(input: ClerkUserSyncInput): Promise<User> {
  const existingByClerkId = await getUserByClerkId(input.clerkUserId);

  if (existingByClerkId) {
    const updated = await updateUserByClerkId(input.clerkUserId, toProfileUpdate(input));

    return updated ?? existingByClerkId;
  }

  // The Clerk user id is unknown but the email is taken: the account was
  // recreated (or migrated between Clerk instances), so adopt the existing row
  // instead of violating the unique email constraint.
  const existingByEmail = await getUserByEmail(input.email);

  if (existingByEmail) {
    const [adopted] = await getDb()
      .update(users)
      .set({ ...toProfileUpdate(input), clerkUserId: input.clerkUserId })
      .where(eq(users.id, existingByEmail.id))
      .returning();

    if (adopted) {
      return adopted;
    }
  }

  return insertUser({
    clerkUserId: input.clerkUserId,
    email: input.email,
    emailVerified: input.emailVerified ?? false,
    firstName: input.firstName,
    lastName: input.lastName,
    username: input.username,
    imageUrl: input.imageUrl,
    lastSignInAt: input.lastSignInAt,
  });
}
