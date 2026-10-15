# store-demo

A store demo built on **Next.js 16** (App Router, Cache Components, React 19),
**Clerk** for authentication, **Drizzle ORM** over a **Prisma-hosted Postgres**
database and **TanStack Query** for the client-side data fetching.

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

   `DATABASE_URL`, the Clerk keys and `CLERK_WEBHOOK_SIGNING_SECRET` are all
   required.

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
  api/products/route.ts        Public catalogue feed (GET /api/products)
  api/products/[slug]/route.ts One product (GET /api/products/[slug])
  api/webhooks/clerk/route.ts  Clerk -> Postgres user sync (signature verified)
  collections/                 Public catalogue page (grid fed by the API route)
  products/[slug]/page.tsx     Product detail page (streams one product row)
  sign-in/[[...sign-in]]/      Clerk <SignIn />  (Google, GitHub, email + password)
  sign-up/[[...sign-up]]/      Clerk <SignUp />
  layout.tsx                   Root layout: <ClerkProvider> + the shared <SiteHeader />
  providers.tsx                Client providers (the TanStack Query cache)
  page.tsx                     Landing page, hero + "Start collecting" CTA
components/ui/                 shadcn/ui primitives (Tailwind v4, `cn()` helper)
components/buy-button.tsx      Shared "Buy now" button (inert, sold-out aware)
components/site-header.tsx     Sticky site header (wordmark + Clerk account controls)
lib/db/
  index.ts                     Lazily created Drizzle client (pg Pool)
  schema/users.ts              `users` table, enum and inferred types
  schema/products.ts           `products` table, enum and inferred types
  queries/users.ts             Typed queries + the Clerk upsert
  queries/products.ts          Typed catalogue queries (read/create/update/delete)
lib/images.ts                  Image URL helpers (remote vs optimisable)
lib/products/
  dto.ts                       JSON wire types for the catalogue API
  presentation.ts              Money formatting + sale-pricing rules shared by both views
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

## Storefront

The catalogue is a public page backed by a public JSON feed.

`GET /api/products` returns published products only (soft-deleted rows and
`draft` / `archived` rows are filtered out in `listActiveProducts`) as
`{ "products": ProductDto[], "hasMore": boolean }`. `ProductDto` lives in
`lib/products/dto.ts` and differs from the database row in one way: Drizzle
returns `Date` objects, which JSON turns into ISO strings. `price` and
`compareAtPrice` stay strings, because they are `numeric` columns.

The feed is paged, because the grid scrolls:

- `limit` — rows per page. Defaults to `PRODUCTS_PAGE_SIZE` (12) and is clamped
  to `1..50`, so `?limit=9999` cannot serialise the table. Anything non-numeric
  falls back to the default.
- `offset` — rows to skip. Whole numbers `>= 0`; anything else is read as `0`.

`hasMore` is worked out by selecting one row beyond `limit` and checking whether
it arrived. That avoids a `COUNT(*)` and never promises a further page when the
catalogue is an exact multiple of `limit`. The next offset is deliberately not
sent back: the client already knows it, because it is how many products it has
rendered.

Ordering is `created_at DESC, id DESC`. The `id` tiebreaker is not decoration:
rows inserted in one transaction share a `created_at`, and a sort without a
unique key leaves tied rows in no guaranteed order, so offset paging can repeat
or skip products between pages. Offset paging stays sensitive to *concurrent*
writes — a product created mid-scroll shifts every later page — so move to
keyset cursors if the catalogue starts changing under readers.

One product at a time is served by `GET /api/products/[slug]` as
`{ "product": ProductDto }`, under the same publish rule: an unknown slug, a
`draft`, an `archived` row and a soft-deleted row all answer `404` with
`{ "error": "Product not found." }`. The four are deliberately indistinguishable,
so the endpoint cannot be used to confirm which unpublished slugs exist. The
detail page does not call it — see below for why it reads the same query
directly instead.

`/collections` is the landing page's "Start collecting" target. Its shell is
static and `ProductGrid` (a client component in `app/collections/_components/`)
reads the feed with React Query's `useInfiniteQuery`, so loading, error and empty
states are all rendered in the browser. Later pages are appended to the tiles
already on screen, triggered by `IntersectionObserver` on the sentinel below the
grid (600px ahead of the fold) or by pressing "Load more"; both call the same
`fetchNextPage`, and the observer is switched off while a page is in flight or
after a failed one, so no page is requested twice. A failed append keeps the
loaded products visible (`isFetchNextPageError`) and offers a retry rather than
replacing the grid with an error page; a failed *first* page has nothing worth
keeping (`isLoadingError`) and takes the area over instead.

The cache itself lives in `app/providers.tsx`, mounted in the root layout:
`Providers` is a client component that receives `children` and passes them
straight through, so every page below it stays a Server Component and only the
grid reaches the browser. `staleTime` is a minute there, which is why returning
to `/collections` renders the cached pages immediately instead of re-fetching
them.

Products with an `image_url` render through `next/image`. Relative paths are
optimised; remote URLs are passed through untouched (`unoptimized`) because the
image optimiser refuses hosts that are not declared in
`images.remotePatterns`. Add your CDN to that list if you want remote photos
optimised too.

### Product detail

Every catalogue tile links to `/products/[slug]` — the `slug` column is the URL
key, which is why it is unique and URL-safe. The route renders one product in
full: photo, state badges (sale, featured, sold out), price with any "was" price
and its saving, the whole description, the stock line, SKU, currency and the
`created_at` / `updated_at` timestamps.

Unlike the grid, this page does not go through the API: it reads the row with
`getProductBySlug`, the same query the catalogue endpoints are built on, because
one row needs no paging and `notFound()` is available for a slug that does not
resolve — a hop through the app's own HTTP API would buy nothing. The publish
rule (`active` and not soft-deleted) lives inside that query, so the page and
`GET /api/products/[slug]` cannot drift: an unknown slug, a `draft`, an
`archived` row and a deleted row are the same missing product to both. The price
is that `generateMetadata` and the view each perform the lookup — two point reads
of a unique index per view; wrap the query in React's `cache` if that ever
matters.

`page.tsx` never awaits `params` or the fetch itself. It hands the unresolved
`params` promise to `ProductDetail` and lets that component do both inside a
`<Suspense>` boundary, so nothing above the boundary touches runtime data: the
frame and the skeleton prerender and prefetch, and the product streams in as the
row arrives (`◐` in `next build`, not a blocking `ƒ`). The one thing that shape
costs is the status code for a slug that does not exist — starting the stream
fixes the response at `200`, so the `notFound()` inside the boundary renders the
404 UI in a `200` and lets Next inject `noindex`, which is the documented
behaviour for a mid-stream `notFound()`. A hard `404` would mean letting this
route block on the server (`export const instant = false`), trading the instant
navigation away for an error code only crawlers and API clients ever see.

`generateStaticParams` is deliberately absent — listing slugs would make
`next build` query Postgres from the build machine, and `DATABASE_URL` is a
runtime concern, exactly as in `GET /api/products`.

The tile keeps its two interactive elements separate: a stretched `<Link>`
covering the card opens the product, and `components/buy-button.tsx` sits above
it (`z-20` over `z-10`) so it keeps its own clicks. The button appears over the
photo on hover and whenever anything in the tile has keyboard focus, and it is
the same component the detail page renders full width under the price — one
definition of the "Buy now" / "Sold out" copy and the sold-out rule. Checkout is
not wired up yet, so pressing it does nothing.

Money and sale rules live in `lib/products/presentation.ts` (`formatPrice`,
`getPricing`), shared by the server-rendered detail view and the client-rendered
grid so both format prices and decide what counts as a real reduction the same
way.

## Auth notes

- Middleware lives in `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`).
- Auth is enforced **per resource** rather than per path: call
  `await auth.protect()` inside anything that touches private data. Clerk
  deprecated `createRouteMatcher` for exactly this reason.
- `cacheComponents` is enabled, so any server component that reads the session
  (Clerk's `<Show>`, `currentUser()`, `auth()`) must sit inside a `<Suspense>`
  boundary. See `app/page.tsx` for the pattern.
- The site header is rendered once, from `app/layout.tsx`, so every route gets
  the same chrome and no page renders it itself. It is `sticky` with a
  translucent, blurred background (`bg-background/80 backdrop-blur-md`), which
  keeps it legible while the landing page's dark hero scrolls underneath it.
  Pages only own their own `<main>`; the hero takes `flex-1` rather than
  `min-h-svh`, so it fills the height left below the header instead of
  overflowing by it.

