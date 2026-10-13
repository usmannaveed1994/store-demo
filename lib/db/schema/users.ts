import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Roles a shopper account can hold.
 *
 * Drizzle owns this schema and `npm run db:generate` produces the SQL in
 * `drizzle/`. If a `prisma/schema.prisma` is ever added to introspect these
 * tables, keep this enum's values in sync with it.
 */
export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);

/**
 * Local mirror of every Clerk user, keyed by the Clerk user id (`user_...`).
 *
 * Clerk remains the source of truth for credentials, sessions and email
 * verification; this table only stores what the storefront needs to query
 * against (ownership, roles, denormalised profile data).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk's `user_...` identifier. Never exposed to the browser. */
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username"),
    imageUrl: text("image_url"),
    role: userRoleEnum("role").notNull().default("customer"),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_key").on(table.clerkUserId),
    uniqueIndex("users_email_key").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
