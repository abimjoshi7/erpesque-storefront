# erpesque-storefront

Customer-facing shop for the erpesque ERP. Each ERP tenant gets a public catalog
at `/{tenant_code}`, served from the items that tenant has published — there is
no separate product database.

Next.js App Router, TypeScript, Tailwind. Reads the ERP's public `/storefront/*`
endpoints; the ERP stays the only source of truth.

## How it talks to the ERP

Every ERP call happens on the server — in a server component or a route handler.
The browser never reaches the API, which is why there is no CORS configuration
here and no API key in any client bundle. `src/lib/erp.ts` opens with
`import "server-only"`, so importing it from a client component fails the build
instead of silently shipping the key to browsers.

In production the request path is:

    browser → this app (Cloudflare) → Worker (api.ghumtibags.com) → Rust origin

The Worker's edge gate expects `X-Client-API-Key`. Locally there is no Worker, so
the app talks to the Rust origin directly and sends `X-API-Key` instead. Set
whichever one matches what you are pointing at — see `.env.example`.

## Running it

The ERP server must be running, and the tenant must have the storefront module
enabled, or every page 404s by design.

```bash
cp .env.example .env.local     # then fill in ERP_ORIGIN_API_KEY
npm install
npm run dev                    # http://localhost:3001/nsbs
```

A tenant that does not exist, one that is suspended, and one that has not enabled
the module all return the same 404. That is deliberate: a distinguishable
response would let anyone enumerate tenant codes.

## API types

`src/types/erp-api.d.ts` is generated from the ERP's OpenAPI spec — never edit it
by hand:

```bash
npm run types:generate         # regenerate from ../erp/server/openapi.yaml
npm run types:check            # regenerate and fail if the result differs
```

`types:check` is what keeps this repo honest about the API contract now that it
lives separately from the server. Point `ERP_OPENAPI` at another path or a URL to
generate from somewhere else.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run types:generate` | Regenerate API types from the OpenAPI spec |
| `npm run types:check` | Fail if the generated types are stale |

## The cart holds no prices

`src/lib/cart.ts` stores slugs and quantities in localStorage and nothing else.
Every figure a shopper sees comes from `POST /api/{tenant}/quote`, which the
server answers by pricing the cart against the live catalog.

That is a security property, not a performance one. A cart that remembered
prices could be edited in devtools, and would quietly charge yesterday's price
after an overnight repricing. Checkout re-prices again as it writes the order,
so what is ordered is always what the shop currently sells at the price it
currently charges — the total displayed is never an input to anything.

## Buyer sessions

Decisions `docs/decisions/0002-buyer-login.md` and
`docs/decisions/0003-signed-in-checkout.md` have the reasoning; the rules this
app has to keep are short.

A shopper signs in with a one-time code sent to an email address — or, once
the ERP has an SMS provider, a phone number. Which channels are offered is the
shop's `signInWith`, the ones the ERP can deliver on right now; today that is
email, through the ERP's Resend client. The ERP mints an opaque session token
and keeps only its SHA-256; the token itself lives in an httpOnly,
`SameSite=Lax` cookie named `sf_session_{tenant}` at `Path=/`, and travels to
the ERP in `X-Shopper-Session` — never `Authorization`, which the edge gate
reserves for staff JWTs. `src/lib/session.ts` is the only place the cookie's
attributes are decided, and `/api/{tenant}/auth/verify-code` is the only place
it is written.

There is no challenge handle between the two steps. The ERP keeps one live code
per phone number or address, so step two submits it again alongside the digits
— which is also what lets the send throttle count, since a resend updates that
one row instead of creating a rival.

### Signed-in checkout

Signed-in checkout is opt-in per shop. A shop whose merchant turns
`requireSignIn` on (it is off by default, existing shops included) accepts only
signed-in shoppers at the cart and at checkout. It is enforced three times, and only the last is the
boundary: the product page offers "Sign in to buy" in place of "Add to cart";
the cart page checks the session with the ERP and sends a shopper without one to
`/{tenant}/sign-in?next=/{tenant}/cart`; and the ERP refuses `POST /order` with
401 without a live session. The catalog itself stays public.

Checkout is prefilled from the account — the name, and the address and landmark
from the last order, all editable. A verified phone is shown read-only, because
the ERP records it whatever the form says. An email-verified shopper still types
a phone for the rider, which is recorded as contact and never used to match a
customer; email and phone sign-ins are separate customers until a linking step
exists.

`?next=` is vetted by `src/lib/next-path.ts`: only a path on this shop gets
through, and anything else lands on the account page.

With `requireSignIn` on, **sign-in is a hard dependency for taking any order**:
a shop whose ERP cannot send a code cannot sell, and the sign-in page says so.

Four rules go with it:

- **Session calls never cache.** Next's data cache keys on the URL and does not
  vary on headers, so a cached order history would be replayed to the next
  shopper who asked. Everything under the buyer-session block in `src/lib/erp.ts`
  uses `cache: "no-store"` and never `next: { revalidate }`.
- **No `cookies()` in `src/app/[tenant]/layout.tsx`.** It is a request-time API,
  and reading it there would make every page beneath `/{tenant}` render per
  request to decide one header link. `src/components/shopper-provider.tsx` asks
  `/api/{tenant}/me` once after hydration and shares the answer with the header
  and the add to cart button.
- **Every mutating route handler checks the origin.** A cookie is an ambient
  credential, so `POST` handlers call `isSameOrigin` from
  `src/lib/same-origin.ts` first. Next does this for Server Actions on its own
  and not for route handlers.
- **Production does not start without a Turnstile site key.**
  `src/instrumentation.ts` refuses at server start (not at build, so CI still
  builds without it). `NEXT_PUBLIC_` values are inlined at build time, so the
  key must be present when building the image that is deployed. The ERP side
  is `TURNSTILE_SECRET_KEY` with `TURNSTILE_REQUIRED=true`.

Every shop that has not turned `requireSignIn` on keeps guest checkout as it
was: no session header, no account, a status token issued as before. Every existing
`/{tenant}/order/{token}` link still works, and signed-in orders get a status
token too.

## Status

Every public `/storefront/*` endpoint the ERP exposes is consumed here:

| ERP endpoint | Where it surfaces |
| --- | --- |
| `GET /catalog` | `/{tenant}` — listing, search, facet filter, pagination |
| `GET /facets` | Category and brand navigation, and the shop-exists check |
| `GET /product/{slug}` | `/{tenant}/product/{slug}`, with schema.org `Product` |
| `GET /media/{fileId}` | Proxied through `/{tenant}/media/{fileId}` |
| `GET /sitemap` | `/{tenant}/sitemap.xml` |
| `POST /quote` | Every figure the cart shows |
| `POST /order` | Checkout, carrying `X-Shopper-Session` |
| `GET /order/{token}` | `/{tenant}/order/{token}` |
| `POST /order/{token}/cancel` | Self-cancel while the order is still a draft |
| `POST /auth/request-code` | `/{tenant}/sign-in`, step one — an email or a phone |
| `POST /auth/verify` | `/{tenant}/sign-in`, step two — the only place the cookie is written |
| `POST /auth/logout` | Sign out, which revokes at the ERP before clearing the cookie |
| `GET /auth/session` | The header, add to cart and checkout prefill, via `/api/{tenant}/me` and the cart page |
| `GET /account/orders` | `/{tenant}/account` — order history |
| `GET /account/orders/{orderNumber}` | `/{tenant}/account/orders/{orderNumber}` |

Orders land in the ERP as draft sales orders awaiting staff approval; payment is
on delivery.

Signed-in checkout (`requireSignIn`, `signInWith`, email codes, the verified
`email` and last-order `address` on the session) comes from the ERP's
`feat/storefront-signed-in-checkout` branch; the default `../erp` checkout must
be on it for `npm run types:check` to pass until it merges.

The shop's chrome — name, search box, cart count, footer — lives in
`src/app/[tenant]/layout.tsx`, which is also where the shop-exists check
happens, so every page beneath it 404s together. Each segment has its own
`loading.tsx`, `error.tsx` and `not-found.tsx`, so an ERP that is down looks
different from a shop that is closed.

### Known gaps

- **Images are served at their original size.** The media route streams the
  ERP's bytes through unchanged, and the ERP stores originals — a single
  photograph in the nsbs catalog is 400 KB. A listing of 24 of those is a heavy
  page on a phone. Resizing belongs at the edge (Cloudflare Images, or a
  `cf-resize` fetch in the Worker), not in this app.
- **The catalog has no sort.** The ERP orders by the merchant's `sort_weight`
  and offers no `?sort=`, so there is nothing to render a control for yet.
- **`sitemap.truncated` is ignored.** The ERP caps the slug list; a shop large
  enough to hit that cap needs a paginated sitemap index here.
- **Email and phone sign-ins are separate customers.** Codes go by email until
  an SMS provider is chosen; when one is, a shopper who used both has two
  accounts until a step that proves both in one session exists. Decision `0003`.
- **A signed-in buyer cannot cancel from their account.** Self-cancel hangs off
  the status token, and an order reached by its number does not carry one, so
  `/{tenant}/account/orders/{orderNumber}` is read-only. The token link still
  cancels.
