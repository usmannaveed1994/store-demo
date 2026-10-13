# store-demo

A store demo built on **Next.js 16** (App Router, Cache Components, React 19),
**Clerk** for authentication and **Drizzle ORM** over a **Prisma-hosted Postgres**
database.

Prisma is used only as the hosted Postgres provider. The schema, migrations and
queries are owned by Drizzle (`lib/db/schema/`, `drizzle/`).

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a database at [console.prisma.io](https://console.prisma.io) and copy
   its connection string.

3. Create a Clerk application and enable the **Google**, **GitHub** and
   **email + password** sign-in strategies.

4. Create your env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

5. Apply the schema:

   ```bash
   npm run db:migrate   # or `npm run db:push` while iterating on the schema
   ```

6. Start the app:

   ```bash
   npm run dev          # http://localhost:3000
   ```

### Clerk webhook (recommended)

The webhook is the primary user-sync path, so a local user row is created as
soon as someone signs up.

1. Expose your dev server, e.g. `ngrok http 3000`.
2. Clerk Dashboard -> **Configure -> Webhooks -> Add Endpoint**, set the URL to
   `https://<your-host>/api/webhooks/clerk` and subscribe to `user.created`,
   `user.updated` and `user.deleted`.
3. Put the endpoint's **Signing Secret** in `CLERK_WEBHOOK_SIGNING_SECRET`.

Webhook delivery is not guaranteed, so `getCurrentDatabaseUser()` in
`lib/users/sync-user.ts` reconciles the row lazily on authenticated requests as
a fallback. Call it from any page, layout, route handler or server action that
needs the local user:

```ts
import { getCurrentDatabaseUser } from "@/lib/users/sync-user";

const user = await getCurrentDatabaseUser();
if (!user) return null;
```

## Scripts

| Script                | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Start the dev server                               |
| `npm run build`       | Production build                                   |
| `npm run lint`        | ESLint                                             |
| `npm run typecheck`   | Generate route types, then run `tsc --noEmit`       |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema     |
| `npm run db:migrate`  | Apply pending migrations                           |
| `npm run db:push`     | Push the schema directly (no migration file)       |
| `npm run db:check`    | Check migration consistency                        |
| `npm run db:studio`   | Browse the database with Drizzle Studio            |

## Project layout

```
app/
  api/webhooks/clerk/route.ts  Clerk -> Postgres user sync (signature verified)
  sign-in/[[...sign-in]]/      Clerk <SignIn />  (Google, GitHub, email + password)
  sign-up/[[...sign-up]]/      Clerk <SignUp />
  layout.tsx                   Root layout, wraps the app in <ClerkProvider>
  page.tsx                     Landing page with sign in / sign up buttons
components/ui/                 shadcn/ui primitives (Tailwind v4, `cn()` helper)
lib/db/
  index.ts                     Lazily created Drizzle client (pg Pool)
  schema/users.ts              `users` table, enum and inferred types
  schema/products.ts           `products` table, enum and inferred types
  queries/users.ts             Typed queries + the Clerk upsert
  queries/products.ts          Typed catalogue queries (read/create/update/delete)
lib/users/
  clerk-user.ts                Normalises Backend API + webhook user shapes
  sync-user.ts                 Sync entry points
drizzle/                       Generated SQL migrations
proxy.ts                       Clerk middleware (Next 16 "Proxy")
```

## Data model

`users` mirrors Clerk and is identified by `clerk_user_id` (unique). `role` is
application-owned and is never overwritten by Clerk syncs.

| Column                        | Notes                                     |
| ----------------------------- | ----------------------------------------- |
| `id`                          | UUID primary key (`gen_random_uuid()`)     |
| `clerk_user_id`               | Unique, matches Clerk's `user_...` id      |
| `email` / `email_verified`    | Unique primary email + verification status |
| `first_name` / `last_name`    | Optional, from Clerk                       |
| `username`                    | Optional, from Clerk                       |
| `image_url`                   | Optional avatar                            |
| `role`                        | `customer` (default) or `admin`            |
| `last_sign_in_at`             | Optional, from Clerk                       |
| `created_at` / `updated_at`   | `updated_at` is maintained by Drizzle       |

### `products`

Storefront catalogue. Money is stored as `numeric(10, 2)` (exact decimals, so
Drizzle returns `price` / `compare_at_price` as strings) and reads hide
soft-deleted rows. Helpers live in `lib/db/queries/products.ts`
(`getProductBySlug`, `listActiveProducts`, `insertProduct`, ...).

| Column                        | Notes                                       |
| ----------------------------- | ------------------------------------------- |
| `id`                          | UUID primary key (`gen_random_uuid()`)       |
| `slug`                        | Unique, URL-safe key                         |
| `title` / `description`       | Display name + optional long copy            |
| `price`                       | Exact decimal selling price                  |
| `compare_at_price`            | Optional "was" price for sale badges         |
| `currency`                    | ISO-4217 code, defaults to `USD`             |
| `sku`                         | Optional, unique when set                    |
| `stock`                       | Units on hand, defaults to `0`               |
| `status`                      | `draft` (default), `active` or `archived`    |
| `is_featured`                 | Curation flag, defaults to `false`           |
| `image_url`                   | Optional primary image                       |
| `created_at` / `updated_at`   | `updated_at` is maintained by Drizzle        |
| `deleted_at`                  | Soft delete marker, `NULL` while live        |

## Auth notes

- Middleware lives in `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`).
- Auth is enforced **per resource** rather than per path: call
  `await auth.protect()` inside anything that touches private data. Clerk
  deprecated `createRouteMatcher` for exactly this reason.
- `cacheComponents` is enabled, so any server component that reads the session
  (Clerk's `<Show>`, `currentUser()`, `auth()`) must sit inside a `<Suspense>`
  boundary. See `app/page.tsx` for the pattern.

