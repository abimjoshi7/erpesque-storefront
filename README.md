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

## Status

Catalog listing, search, category filter, pagination, product pages, cart, and
checkout. Orders land in the ERP as draft sales orders awaiting staff approval;
payment is on delivery.

Not built yet: product images, stock badges, pricelist-resolved pricing,
delivery charges, and the order-status page the checkout's status token is for.
