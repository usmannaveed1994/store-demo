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
  api/cart/route.ts            Read or empty the caller's cart (GET, DELETE)
  api/cart/items/route.ts      Add a product to the cart (POST)
  api/cart/items/[productId]/route.ts  Change a line's quantity, or remove it
  api/webhooks/clerk/route.ts  Clerk -> Postgres user sync (signature verified)
  cart/                        Cart page (reads the shared React Query cache)
  collections/                 Public catalogue page (grid fed by the API route)
  products/[slug]/page.tsx     Product detail page (streams one product row)
  sign-in/[[...sign-in]]/      Clerk <SignIn />  (Google, GitHub, email + password)
  sign-up/[[...sign-up]]/      Clerk <SignUp />
  layout.tsx                   Root layout: <ClerkProvider> + <Providers> + header
  providers.tsx                Client providers (the TanStack Query cache)
  page.tsx                     Landing page, hero + "Start collecting" CTA
components/ui/                 shadcn/ui primitives (Tailwind v4, `cn()` helper)
components/buy-button.tsx      Shared "Buy now" button (inert, sold-out aware)
components/add-to-cart-button.tsx  Shared "Add to cart" button (React Query mutation)
components/cart-indicator.tsx  Header cart link with the live item count
components/site-header.tsx     Sticky site header (wordmark + cart + account controls)
lib/db/
  index.ts                     Lazily created Drizzle client (pg Pool)
  schema/users.ts              `users` table, enum and inferred types
  schema/products.ts           `products` table, enum and inferred types
  schema/carts.ts              `carts` + `cart_items`, `cart_status` enum
  queries/users.ts             Typed queries + the Clerk upsert
  queries/products.ts          Typed catalogue queries (read/create/update/delete)
  queries/carts.ts             Cart reads and mutations, incl. the guest merge
lib/cart/
  dto.ts                       JSON wire types for the cart API
  validation.ts                Quantity / UUID parsing for request bodies
  identity.ts                  Server-only: resolves the caller's cart (cookie or user)
  http.ts                      Shared JSON responses for the cart route handlers
  api.ts                       Browser fetchers + the `["cart"]` query key
  hooks.ts                     React Query hooks (query, mutations, auth resync)
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

### `carts`

One cart per browser (guest) or per account. The `carts_owner_check` constraint
keeps the two identities mutually exclusive: a row has a `user_id`, or a
`guest_token`, never both and never neither.

| Column                        | Notes                                        |
| ----------------------------- | -------------------------------------------- |
| `id`                          | UUID primary key (`gen_random_uuid()`)        |
| `user_id`                     | FK to `users`, `NULL` for a guest cart        |
| `guest_token`                 | Unique, `NULL` for a signed-in cart           |
| `status`                      | `active` (default), `converted`, `abandoned`  |
| `created_at` / `updated_at`   | `updated_at` is maintained by Drizzle         |

### `cart_items`

One row per product per cart, enforced by the unique index on
`(cart_id, product_id)` — that index is what lets an add be a single
`INSERT ... ON CONFLICT DO UPDATE` instead of a read-then-write race.

There is deliberately **no price column**. Totals are joined from `products` on
every read, so a price change or a product leaving the catalogue shows up
immediately and a client cannot pin a price it likes.

| Column                        | Notes                                              |
| ----------------------------- | -------------------------------------------------- |
| `id`                          | UUID primary key (`gen_random_uuid()`)              |
| `cart_id`                     | FK to `carts`, cascades on delete                   |
| `product_id`                  | FK to `products`, `restrict` (history is not lost)  |
| `quantity`                    | Units, defaults to `1`, clamped to stock on write   |
| `created_at` / `updated_at`   | Establishes the line order; `updated_at` by Drizzle |

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

The tile keeps its interactive elements separate: a stretched `<Link>` covering
the card opens the product, and the two buttons in
`components/buy-button.tsx` and `components/add-to-cart-button.tsx` sit above it
(`z-20` over `z-10`) so they keep their own clicks. Both are the same components
the detail page renders under the price, so the "Buy now" / "Sold out" copy, the
sold-out rule and the mutation live in one place. From `sm:` up the pair only
appears over the photo on hover or keyboard focus; below `sm:` it is always
visible, because a touch screen has no hover to reveal it with. Checkout is not
wired up yet, so "Buy now" does nothing.

Money and sale rules live in `lib/products/presentation.ts` (`formatPrice`,
`getPricing`), shared by the server-rendered detail view and the client-rendered
grid so both format prices and decide what counts as a real reduction the same
way.

## Cart

A cart lives in Postgres, not in `localStorage`: it survives a browser profile
reset, it can be merged on sign-in, and the price a shopper is shown is always the
price the server would charge.

Who owns it is decided in `lib/cart/identity.ts`:

- **Signed in.** The cart is the `active` row with the caller's `user_id`.
  `auth()` supplies the Clerk id, which `users.clerk_user_id` maps to the local
  row; if the webhook has not created that row yet, the `currentUser()` fallback
  in `getCurrentDatabaseUser` does.
- **Guest.** The first `POST /api/cart/items` mints a random token, stores it as
  `guest_token` and sets it in an httpOnly, `SameSite=Lax` cookie
  (`store_demo_cart`, 30 days). A `GET` never writes, so a visitor who has added
  nothing gets the empty cart back with `id: null`.

`resolveCart` is server-only and reads the cookie, which is why it runs in Route
Handlers and never during a page render — cookies cannot be written mid-render.

Merging happens on the first cart request after signing in: guest lines are
summed into the user's cart (`least(existing + guest, stock)`) and the guest cart
row is deleted in the same transaction, so a retry cannot apply the same
quantities twice. Lines whose product is no longer sellable are skipped, and the
cookie is dropped.

### API

Every endpoint answers with the whole cart, so the client never needs a follow-up
`GET`:

```json
{
  "cart": {
    "id": "8f14e45f-ceea-467a-9575-1c0f4b1a2e77",
    "lines": [
      {
        "productId": "f10691d7-63d1-4325-8c88-93a81a44633e",
        "slug": "hot-wheels-lamborghini-countach-yellow",
        "title": "Hot Wheels Lamborghini Countach - Yellow",
        "imageUrl": "https://images.example.com/countach.jpg",
        "unitPrice": "4.99",
        "currency": "USD",
        "quantity": 2,
        "stock": 60,
        "isAvailable": true,
        "lineTotal": "9.98"
      }
    ],
    "itemCount": 2,
    "subtotal": "9.98",
    "currency": "USD"
  }
}
```

| Request                              | Effect                                            |
| ------------------------------------ | ------------------------------------------------- |
| `GET /api/cart`                      | Read the cart (never creates one)                 |
| `POST /api/cart/items`               | `{ productId, quantity? }` — add, or bump a line  |
| `PATCH /api/cart/items/[productId]`  | `{ quantity }` — absolute; `0` removes the line   |
| `DELETE /api/cart/items/[productId]` | Remove one line                                   |
| `DELETE /api/cart`                   | Empty the cart, keeping the row and the cookie    |

Errors are `{ "error": "…" }` with a matching status: `400` for an unparseable
body, a malformed `productId` or a quantity outside `0..99`; `404` when the
product is not published (`draft`, `archived`, soft-deleted) and when a `PATCH` or
`DELETE` arrives for a visitor with no cart; `409` when the product is sold out.

Rules the server owns, so a crafted request cannot break them:

- **Price and currency** are joined from `products` on every request. Nothing
  about money is accepted from the client.
- **Quantity is clamped to stock** rather than rejected, on both add and set, so
  the shopper ends up with every available unit instead of an error they cannot
  act on. The add is one `INSERT ... ON CONFLICT DO UPDATE`, so two concurrent
  clicks cannot lose an increment.
- **A line that stops being sellable stays in the cart** with
  `isAvailable: false` and `lineTotal: null`. It is never silently dropped, so the
  shopper can see why the total moved, and it is excluded from `itemCount` and
  `subtotal`.
- `subtotal` is `null` when nothing is buyable, which is why the page renders `—`
  rather than `$0.00`.

### Client

`lib/cart/hooks.ts` wraps `lib/cart/api.ts`:

- `useCartQuery` — key `["cart"]`, `staleTime: 0`, so a remount re-reads instead
  of trusting a cache another tab or a sign-in may have moved on from.
- `useAddToCart`, `useSetCartItemQuantity`, `useRemoveCartItem`, `useClearCart` —
  each writes the returned cart straight into `setQueryData(["cart"])`. No
  invalidation and no second request, so the header badge updates on the same
  tick as the page.
- `useCartAuthSync` — invalidates `["cart"]` when Clerk's session changes. It has
  to exist because signing in hands control back with a client-side redirect, so
  the `QueryClient` and the cached guest cart are still in memory.

The header badge and `/cart` share that single cache entry, which is why the cart
page needs no per-visitor server render and stays static.

The page (`app/cart/`) renders a loading skeleton, an error state with a retry, an
empty state, and then one row per line: a stepper capped at `stock`, a remove
button and a line total, followed by the subtotal and an inert "Checkout" button.
The stepper's `−` stops at one unit so a mis-click cannot delete a line — removal
is its own button.

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
  It sits inside `<Providers>`, so the cart badge reads the same React Query
  cache as the pages below it.
  Pages only own their own `<main>`; the hero takes `flex-1` rather than
  `min-h-svh`, so it fills the height left below the header instead of
  overflowing by it.

