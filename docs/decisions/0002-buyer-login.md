# 0002 — Buyer login: phone, one-time codes, and accounts beside the customer master

Status: accepted
Date: 2026-08-19

## What this decides

Ordering is guest-only today. A shopper places an order and is handed an opaque
`statusToken` — sixty-four hex characters, of which the database keeps only the
SHA-256 — and that token tracks exactly one order. There are no accounts, no
sign-in, and no history.

Decision `0001` named buyer login as the gap that matters most, because order
history, reorder and a server-side cart are all blocked behind it, and because
per-customer pricing and credit limits need to know who is buying before an
order is priced rather than after it is approved. This document decides how
buyers sign in.

The short version: buyer authentication sits beside the staff authentication
system rather than reusing it, identity stays the canonical phone number, the
credential is a one-time code rather than a password, and signing in creates no
row in the customer master.

## Why buyer auth does not reuse the staff auth system

The ERP already authenticates staff — `/auth/authenticate`, `/auth/refresh`,
`/auth/logout`, two-factor endpoints, invites and password recovery. Reusing
that machinery for buyers is the obvious move and it is the wrong one, for four
reasons that are each independently sufficient.

`users.user_name` is globally unique (`migrations/002_parties_auth.sql:35`), and
no later migration relaxes it. Buyers keyed by phone number would collide across
tenants: two shops could not both have a buyer reachable on the same number,
which is not an edge case in a market where a wholesaler buys from several
suppliers.

`users.tenant_id` is a single scalar rather than a membership table. A person who
buys from two shops therefore needs two identities, which the uniqueness
constraint above forbids. The two constraints are jointly unsatisfiable for the
population we are trying to serve.

A staff access token is an authorization decision, not merely an identity claim.
It carries `perms` in its claims, the authentication middleware inserts those as
an `AuthContext`, and the RBAC middleware trusts what it finds there. A buyer
token minted by the same issuer is one route-permission mapping away from being
a staff session. What makes this sharp rather than theoretical is that
`RBAC_ENFORCE` defaults to false (`config.rs:158`) and ships false in
`.env.example:17`. In that shadow mode the middleware logs the denial and allows
the request. A buyer token in a shadow-mode deployment would reach every
protected route in the API.

Finally, the staff session table stores refresh tokens in plaintext
(`migrations/049_user_sessions.sql:15`), with a unique index over the raw value.
This repository already holds itself to a higher standard for the far less
valuable order status token, which is stored as a SHA-256 digest and never in the
clear. Buyer sessions follow the `status_token_hash` precedent, not the
`user_sessions` one: the ERP stores a digest, and a database copy yields no
usable sessions.

None of this is a criticism of the staff design, which serves a Flutter client
holding bearer tokens and has different constraints. It is a statement that the
two audiences want different things, and that sharing the machinery would import
the wrong properties into the more exposed surface.

## The identity split

There is one shopper concept today, `storefront_customers`, keyed by tenant and
canonical phone. Wholesale needs the person separated from the entity that owes
money, because those are not the same thing once an account has more than one
buyer.

Three concepts replace the one. `storefront_customers` remains the person and
becomes the login identity — one phone number, one row. A new
`storefront_accounts` is the buying entity, the thing that has a credit limit and
a price list and that orders are billed to. A new `storefront_account_members`
joins the two and carries a role.

Hanging credentials off `storefront_customers` is not an improvisation.
Migration 119 anticipated it in its own comment
(`migrations/119_storefront_orders.sql:20-23`): repeat guests converge on one row
and accumulate history, which is what makes accounts addable later without a
migration. That prediction is what this design cashes in.

## Signing in creates no party

This is the load-bearing decision, and everything else bends around it.

Authentication creates no row in `parties`, ever. A `storefront_account` starts
with `party_id` null and prices and behaves exactly as a guest does. The only
paths into the customer master remain the ones that exist today: an order being
approved, or a fulfillment moving to confirmed, both of which run through
`link_web_order_party`. A person who signs in, browses, and never orders leaves
no trace in the customer master at all.

The temptation to break this is real, because per-customer pricing and credit
limits both need a `party_id` before an order is priced, not after it is
approved. The resolution is to move the human decision rather than remove it.
Staff promote an account: a `/storefront-admin/` action that sets
`storefront_accounts.party_id`, either matching an existing party or creating
one. That is the same judgement staff already exercise when approving an order,
made once per buyer instead of once per order, by the holder of the same
permission. `link_web_order_party` gains a single early branch — if the order
carries a `storefront_account_id` whose account already has a `party_id`, use it
rather than matching by phone — and the rest of that function is untouched, so
guest orders behave identically.

The property the ERP is protecting is that abandoned and fraudulent orders stay
out of the customer master. Under this design nothing unauthenticated can create
a party, and nothing authenticated can either. An account becomes a party when a
staff member says so, or when one of its orders is approved, which is today's
rule unchanged.

## Phone and a one-time code, not a password

Identity in this system is already the canonical phone number. The unique index
says so, the party-matching SQL says so, and the contact normalisation says so:
"+977 9841112233" and "98-4111-2233" are the same shopper and eventually the same
customer. A password would be a second secret layered over an identity that
already exists, and its recovery path would be a one-time code sent to that same
phone. The password would therefore be a cache of the code flow with a breach
surface attached to it.

The convergence property is what makes this more than an aesthetic preference. A
guest who has been ordering for a year signs in and lands on their existing
`storefront_customers` row, so their entire history appears with no backfill and
no reconciliation. A password scheme cannot do that, because there is no password
on the historical row and no way to prove the claim except — again — a code sent
to the phone.

The tradeoff is real and worth stating plainly. Every login costs a message, so
there is a per-login cost that a password does not have. More importantly,
message delivery latency and failure become a login availability problem: when
the gateway is slow or down, buyers cannot sign in at all, whereas a forgotten
password is a slow failure rather than a total one. Sliding sessions with a long
idle window keep logins rare enough that this is tolerable, and a resend throttle
limits the cost of the pathological case. We accept it because it removes an
entire password reset flow, a strength policy, and a credential-stuffing surface
from a public endpoint.

The existing two-factor endpoints are the right shape and the wrong guarantees,
so they are not reused. They are gated on a single global configuration flag, so
enabling codes for buyers would enable them for staff. They key the challenge by
an opaque user id that a buyer does not have. They store the code in plaintext.
And `consume_otp` (`routes/auth.rs:1443`) matches the newest live row and returns,
with no attempt counter and no cap — a six-digit space with unlimited guesses is
not a credential. The buyer flow gets its own challenge table with the digest
stored rather than the code, one live challenge per tenant and phone, a short
expiry, and a hard cap on attempts.

## How a session is carried

The browser still never talks to the ERP. That property is the reason there is no
CORS configuration in this repository and no API key in any client bundle, and
buyer login does not weaken it.

The session token is opaque — minted server-side from the same primitive the
status token already uses — and the ERP stores only its SHA-256. There is no
access and refresh split: that exists in the staff design because a mobile client
holds bearer tokens, whereas here the token lives in an httpOnly cookie and a
server-to-server hop, and a second token type would only be a second thing to
leak. Expiry is a sliding idle window with an absolute cap that is never extended.

Between the browser and this app the token rides in an httpOnly, Secure,
SameSite=Lax cookie scoped to the tenant's path, mirroring the per-tenant key
prefix that `src/lib/cart.ts` already uses so two shops open in one browser
cannot see each other's session. Between this app and the ERP it rides in an
`X-Storefront-Session` header, deliberately not `Authorization: Bearer`. The
storefront path already short-circuits before the JWT middleware reads
`Authorization`, so a bearer token would be ignored today — but a distinct header
means a leaked buyer token can never be replayed as a staff bearer token if that
ordering ever changes. The existing API key header is unchanged and still
applies; the session header is additive.

The storefront stores nothing. The cookie value is the ERP session token, so this
app remains a stateless relay, which is what keeps decision `0001`'s rule — no new
database — intact.

## The one schema decision that cannot wait

`sales_orders` gains `storefront_account_id` from the first migration, even
though nothing reads it until Phase 2 and multi-user accounts do not arrive until
Phase 4.

The existing `storefront_customer_id` records who typed the order in. The new
column records who owes for it. While every account has exactly one member those
two answers coincide, which is precisely why it is tempting to defer the column —
and precisely why deferring it is expensive. Adding it later means re-parenting
historical orders by inference, and moving `storefront_customers.party_id` values
that staff have been setting by hand through approvals onto a new owner. That is
a migration through the customer master, which is the one place this system is
deliberately careful. Forty lines of DDL now avoids it.

The same reasoning applies to `storefront_accounts` and
`storefront_account_members`: the tables ship in Phase 0 and the multi-user
feature ships in Phase 4. The role column is unconstrained text rather than a
CHECK, for the reason migration 119 gives for `source` — so that later callers can
name themselves without a migration.

## What does not change

Guest checkout is untouched. A request with no session header runs today's code
path exactly: contact required, `storefront_account_id` null, `party_id` null,
and a status token issued and returned.

Every existing status token URL keeps working, forever. The lookup by token is
refactored so that the token path and the account path render identical JSON, but
it is not narrowed, and the unique index over the token digest is untouched.
Signed-in orders still receive a status token, so `/{tenant}/order/{token}`
remains the universal tracking path and a link sent to someone before they had an
account still opens.

History appears with no backfill. Because `storefront_customers` is keyed by
canonical phone and the login flow is keyed by the same canonical phone, signing
in resolves to the buyer's existing row, and `sales_orders.storefront_customer_id`
already points at it. The history query is therefore scoped to the session's
account *or* to the customer ids of that account's members, and that second
clause is what surfaces everything placed before accounts existed. The
alternative — a backfill that rewrites historical orders to satisfy a query — is
rejected. Every change here is additive: new tables, nullable new columns, no
existing row rewritten.

## Two things that will go wrong if they are not written down

The first concerns caching, and it is the single most dangerous line in the
change. Session-carrying fetches must use `cache: "no-store"` and must never use
`next: { revalidate }`. Next's data cache keys on URL and is not header-sensitive
by default, so a cached order-history response would be replayed to a different
buyer. The existing `get()` helper in `src/lib/erp.ts` defaults to a sixty-second
revalidate, which is correct for a catalog and catastrophic for a session, so
session calls cannot go through it unmodified. The same applies on the ERP side:
private responses get the private cache-control header, never the catalog one,
because a shared edge cache holding one buyer's order history is the worst
outcome available here.

The second concerns rendering. `cookies()` must not be called in
`src/app/[tenant]/layout.tsx`. It is a request-time API, and using it in a layout
opts every page beneath `/{tenant}` into dynamic rendering.

An earlier draft of this document justified the rule by saying that would discard
the one-hour revalidate on facets and the edge caching the catalog depends on.
That was wrong on both counts, and the correction matters more than the error: a
rule propped up by a reason that does not survive checking is a rule someone will
discard along with the reason. Next's data cache is independent of dynamic
rendering, so `fetchFacets`'s `revalidate: 3600` would survive untouched. And
every route under `/{tenant}` is already dynamic today — the build marks all of
them the moment they read `searchParams` or a path param — so there is no static
rendering left there to lose.

The rule stands on a different footing. Reading a cookie in the layout makes every
page beneath it unconditionally request-time, which forecloses partial
prerendering or a static shell later, and it couples every page to a read that
only the header needs. The account slot is therefore either a small client
component that fetches its own state after hydration, or an island isolated behind
`<Suspense>`. The layout itself stays free of request-time APIs.

## Cross-site request forgery, which is new

This repository sets no cookies today. That is why no route handler checks the
request origin, and why `POST /api/{tenant}/order` needs no CSRF token: there is
no ambient credential for a cross-site form to borrow. A session cookie creates
exactly that exposure, and every mutation in this app is a route handler.

`SameSite=Lax` blocks cookie attachment on cross-site POST and is the first
layer, but it is not sufficient on its own — it does nothing against a same-site
subdomain. So every mutating handler gains an explicit origin check, comparing
`Origin` against `Host` or `X-Forwarded-Host`. Next performs this comparison for
Server Actions automatically but not for route handlers, so it has to be written
here. Moving the mutations to Server Actions would get it for free at the cost of
reshaping the client calls; a shared helper is less churn and keeps the existing
shape.

## Security review

Enumeration is the property most easily broken by careless additions. The tenant
resolver returns an identical 404 for an unknown code, a suspended tenant, a
disabled module and a missing base currency, which is what stops anyone
enumerating tenant codes. Every new handler calls it first, and none may have a
branch that fails differently. The code-request endpoint introduces a second
enumeration surface, and it must not reveal whether a phone is known: same body,
same status, comparable latency. This falls out of the design rather than needing
care, because the request path creates nothing and reads nothing about the
customer — the customer row is created at verification, never at request, which
also means an unauthenticated caller cannot fill `storefront_customers` with
garbage. That mirrors the party-at-approval property one level down. The staff
`authenticate` handler, which returns a different status for an unknown user than
for a wrong password, is the pattern to avoid rather than copy.

There is no rate limiting in the ERP origin at all — the OpenAPI document says as
much, attributing 429s to the edge Worker. New Worker buckets are therefore
required for both code endpoints, keyed on the forwarded shopper IP and
additionally per shop. An origin-side throttle is required *as well*, recorded on
the challenge row and keyed by the canonical phone, because the Worker cannot see
the phone number and the phone number is what incurs the message cost: IP-only
limiting means one attacker rotating addresses bills the merchant per message.
Turnstile guards the request endpoint, reusing the existing verification helper
unchanged, including its deliberate fail-open when Cloudflare is unreachable, with
the Worker bucket as the backstop — the same trade already made at checkout.

Brute force is the reason the attempt cap is not optional. A six-digit code is a
space of one million, which is a credential only while guesses are bounded.

Session fixation is prevented structurally: no client input names a session, the
token is minted server-side at verification and is never accepted as a creation
parameter, and any prior session for that customer is deleted before the new row
is inserted, so a pre-planted cookie is overwritten rather than adopted. The
cookie is written only in the verification route handler, in the same response
that carries the result.

Token leakage is guarded on both sides. The cookie is httpOnly, the token never
appears in a URL, and no new log line may carry it — the ERP logs liberally, and a
digest prefix is sufficient for correlation. The ERP stores only the digest.

The first cut stores no passwords. A nullable password column ships unused, so
that a desk user who does not hold the account phone can be given one later
without a migration under load. When it is used it goes through argon2id — and
specifically not through the existing verification helper, which falls back to a
plaintext comparison for legacy staff rows and would be a live plaintext path on
a table that has no legacy.

All new tables carry row-level security with the same tenant isolation policy as
migration 119, and every handler runs inside a tenant-scoped transaction. No new
admin-pool surface is needed, because the tenant has already been resolved from
the URL by the time any session query runs.

## Phasing

Phase 0 is schema and plumbing with no user-visible change: the four new tables,
the nullable password column, `sales_orders.storefront_account_id`, down
migrations for all of it, and a message-sending module shaped like the existing
email one — constructed from configuration, absent when unconfigured, so the flow
is buildable and testable before a provider is chosen.

Phase 1 is the smallest shippable slice: sign in and see your orders. Six ERP
endpoints, the storefront's session, cookie, origin-check and no-store plumbing,
a sign-in page and account pages. Checkout is not touched and remains guest-only.
This ships alone and is immediately useful, because every repeat guest gets their
history with no backfill, and it teaches this codebase the cookie discipline on
the least dangerous surface available.

Phase 2 makes checkout session-aware: contact prefilled from the account and
overridable per order, `storefront_account_id` stamped, guest path byte-identical.

Phase 3 adds staff promotion, at which point an account can become a real customer
without an order being approved.

Phase 4 adds the second member and enforces the roles the schema has carried since
Phase 0.

Phase 5 is what login unblocks, and it is decision `0001`'s list: per-customer
pricing from the account's party, the credit limit and its check inside the order
transaction, purchase order references and delivery windows, a server-side cart —
which must still hold slugs and quantities and no prices — and minimum order
quantities.

## Open questions

Whether the Cloudflare Worker forwards an unknown request header through to the
Rust origin is unresolved, and it blocks Phase 1. The Worker's source is in
neither checkout, so its behaviour is known only through its documented contract.
If it strips headers it does not recognise, the session cannot reach the ERP and
the transport needs rethinking before anything is built. The fallback is to carry
the session in the JSON body of writes — never in a query string, which lands in
logs.

No message delivery exists in the ERP. A grep of the entire server source finds a
single mention, a comment at `routes/auth.rs:481` describing out-of-band delivery
that was never built. Phase 0 does not need a provider, because an unconfigured
sender logs the code at debug level and the flow remains testable, but Phase 1
cannot reach real buyers without one, and free tiers for delivery into this market
are thin enough that the choice deserves its own decision rather than a default.

## Addendum — what shipped, 2026-08-21

Phases 0 and 1 are built on the ERP's `feat/storefront` branch (migrations 125
to 128, `routes/storefront_auth.rs`), and the storefront now talks to them. Six
details differ from what this document assumed, and the document is wrong rather
than the code.

**The header is `X-Shopper-Session`.** Not `X-Storefront-Session`. The reasoning
is unchanged — a named header, never `Authorization`, which the edge gate
reserves for staff JWTs — but the name sits beside the `X-Shopper-IP` that
already travels the same path, and one vocabulary is worth more than either name.

**The open question about the Worker is closed, and the answer is yes.** It
builds its upstream request as `new Headers(request.headers)` and deletes only
`host`, so an unrecognised header is forwarded verbatim
(`workers/erpesque-api/src/index.js`). Nothing had to move into a request body.
`request-code` was additionally moved into the strict order-class rate bucket,
because every accepted request spends the merchant's money on a message.

**There is no challenge id.** The ERP keeps one live challenge per tenant and
phone, updated in place, so the phone number is the handle: step two of the form
submits the number again with the digits. That is not an omission — a challenge
row that a resend replaced would reset the send counters, and a counter a resend
resets is not a counter.

**The paths are `/auth/request-code`, `/auth/verify`, `/auth/session`,
`/auth/logout`, `/account/orders` and `/account/orders/{orderNumber}`.** The
account reads sit under `/account/` rather than at the top level, which keeps
the endpoints that require a session visibly apart from the public catalog ones.

**History is claimed at sign-in, not joined at read time.** This document
proposed scoping the history query to the session's account *or* to the customer
ids of that account's members. What shipped instead is an `UPDATE` inside
verification: orders on that customer with `storefront_account_id IS NULL` are
adopted into the account. The property it protects is the one this document
cared about — a year of guest orders appears with no backfill — and the proof
still runs the right way round, because a guest order records a phone number
that was typed while a session records one a code was received on. The `OR`
clause would have kept the read honest without ever writing; the `UPDATE` makes
every later read simple at the cost of touching rows once. Only unclaimed rows
are touched, so nothing can move between accounts. Note that this is the one
place the "every change here is additive, no existing row rewritten" claim above
no longer holds.

**Phase 2 arrived early, in part.** `place_order` stamps `storefront_account_id`
when a session is presented, and an expired session is never a reason a checkout
fails. Contact prefill is still to come.

Two things this document said are still true and still blocking. No SMS provider
is chosen: `SmsClient` is `None` unless `SMS_PROVIDER` is set, a `log` provider
exists for local work, and `request-code` answers 503 rather than reporting a
send that never happened — which is the right failure, but it is still a shop
that cannot sign anyone in. And the sliding window shipped at 30 days idle under
a 90-day cap, against the 14 days this app's cookie assumes; the cookie expiring
first is the harmless direction, but they should be made to agree.
