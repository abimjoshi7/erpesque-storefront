# 0003 — Signed-in checkout: only verified customers fill a cart and order

Status: accepted
Date: 2026-09-11

## What this decides

Decision `0002` made buyer login additive. Its "What does not change" section
promised that guest checkout stays exactly as it was: no session header, contact
typed in, a status token issued. This document reverses that promise for any
shop that asks for it. By default every shop now does.

The shop owner's requirement is that only a valid customer can shop, and that
every order is an authentic transaction. Read literally, that means an order
must be tied to an identity that has been proved, not to a phone number
somebody typed into a form. Guest checkout could never offer that. The first
proof a guest order got was a member of staff ringing the number before
delivery, and by then the rider's time was already committed.

The short version:

- Each shop has a `requireSignIn` flag. It defaults to on, and existing shops
  are included. The ERP stores it (`tenant_preferences.storefront_require_sign_in`,
  migration 136) and publishes it on every `StorefrontTenant`. Merchants can turn
  it off from the shop settings page.
- Where it is on, a shopper must sign in with a one-time code before they can
  fill a cart or check out.
- It is enforced in three places, and only the last is the boundary. The
  storefront asks for sign-in at "add to cart". The cart page checks the session
  with the ERP. The ERP refuses `POST /order` with 401 when there is no live
  session.
- Checkout is prefilled from the account. A verified phone cannot be edited.
- Turnstile is mandatory in production, on both sides.

## Why the gate sits at the cart and not only at checkout

Checkout is the only place the rule has to hold, and the ERP enforces it there
whatever the storefront does. Gating only at checkout would still let a
signed-out shopper fill a cart, price it, and then meet a sign-in wall at the
last step. That is the worst moment to learn the rule. So the product page
offers "Sign in to buy" in place of "Add to cart" and brings the shopper back to
the product afterwards.

The catalog stays public. Search engines, the sitemap, shared links and Open
Graph cards all depend on it, and browsing costs the merchant nothing. We
considered gating the whole shop and rejected it. It would put a request-time
cookie read in the shop layout, which decision `0002` explains we avoid. And it
would turn a retail shop into a members-only one for no gain in authenticity:
a shopper who only looks has not transacted.

## Why the storefront and the ERP both enforce it

The storefront is the only public client of `POST /order`: the browser never
reaches the ERP, and the API key lives on this server. A storefront-only check
would therefore stop everyone except a caller holding that key. That is exactly
the caller a leaked key creates. The ERP check costs one flag read inside a
transaction that is already open, and it makes the storefront's checks what
they should be: courtesy, not the boundary.

The two layers cannot drift apart. The storefront never decides the rule
itself. It reads `requireSignIn` from the same tenant object the ERP enforces
against. The order route answers 401 early only when there is no cookie at all,
to spare the ERP a round trip. When there is a cookie, the ERP's own 401 decides
whether the session is still live.

## What "verified" means today: an email address, not a phone

Decision `0002` made the canonical phone the identity, with a code sent by SMS.
No SMS provider has been chosen. `request-code` answers 503 when asked for a
channel the server cannot deliver on. With signed-in checkout on by default,
that would mean no shop could take any order at all.

So for now codes go by email, through the ERP's existing Resend client
(`RESEND_API_KEY` and a verified `EMAIL_FROM_ADDRESS`). The tenant object
publishes the channels deliverable right now as `signInWith`. The storefront's
sign-in form offers email first and keeps the phone step intact for when SMS
arrives. When `signInWith` is empty, the sign-in page says the shop cannot sign
anyone in, and therefore cannot take orders, rather than showing a form whose
first step is sure to fail.

The guarantee this buys today is therefore **a verified email address**, not a
verified phone. Three consequences follow, and all three are deliberate.

**An email-verified shopper still types a phone number.** The rider needs a
number to call, and an email sign-in has not proved one. Checkout shows the
verified email read-only as the identity the order is placed under, and asks
for the phone as an ordinary required field. The ERP records that number as
typed, as contact for delivery. It never uses it to find or merge a shopper.

**A phone-verified shopper cannot change their number at checkout.** Once SMS
exists, the session's phone is the one the code arrived on. The ERP records it
whatever `contact.phone` says, so checkout shows it read-only rather than
offering a choice it would not honour. It is still sent, so the guest and
signed-in bodies stay the same shape.

**Email and phone identities are separate customers.** Signing in by email
adopts no guest history. A guest order carries no email to match. Matching it
by a phone number the email session never proved would hand anyone who typed a
victim's number that victim's order history. That is the enumeration and
takeover property `0002` was built to prevent. When an SMS provider lands, a
shopper who has used both channels will have two accounts until a linking step
exists. That step has to prove both identities in the same session. It is not
built yet, and it needs its own decision.

## Turnstile is mandatory in production

Where Turnstile is configured, both the sign-in code request and the order are
behind it. Until now, "configured" was optional on both sides, and that made a
missing key a silent gap. On the storefront, the widget renders nothing without
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. On the ERP, `verify_human` skips the check
without `TURNSTILE_SECRET_KEY`.

Now both sides fail closed on their own misconfiguration.

- The storefront's `src/instrumentation.ts` throws at server start in
  production when the site key was not built in. It skips `next build`, so CI
  can prove the app compiles without the key. A build is not a deployment;
  starting a server is.
- The ERP gains `TURNSTILE_REQUIRED`. When it is set and the secret key is
  missing, the ERP answers orders and code requests with 503 instead of
  skipping the check. Production should set it.
- An unreachable Cloudflare still fails open, with the edge Worker's rate
  buckets as the backstop. That trade, recorded in `0002`, is unchanged. An
  outage we do not control is a different failure from a key we forgot to set.

On the checkout form, when a site key is configured, "Place order" stays
disabled until a token exists. A submit without one is certain to be refused.

## Returning to where the shopper was

The sign-in page takes `?next=`, so a shopper sent from the cart or a product
comes back to it. Any redirect parameter is an open redirect in waiting. One
that forwards a freshly signed-in buyer to a look-alike page is exactly the
phishing a code-based login invites, because the shopper has just been taught
to trust the page. `src/lib/next-path.ts` therefore accepts only a path on this
shop (`/{tenant}` or beneath it). It resolves the value with the URL parser
before checking the prefix, so dot segments cannot climb out. It refuses
protocol-relative paths, backslashes, control characters, encoded slashes and
the sign-in page itself. Anything it refuses goes to the account page.

A shopper who is already signed in is redirected straight on. The session is
checked with the ERP rather than inferred from the cookie. Otherwise a lapsed
cookie would bounce between the cart, which sends it to sign-in, and sign-in,
which sends it back.

## A fault this work found in 0002's cookie

Decision `0002` scoped the session cookie to `Path=/{tenant}`. Every route
handler lives under `/api/{tenant}/…`, which is not beneath that path, so the
browser never sent the session to `/me`, `/auth/logout` or `/order`. As a
result, the header always read "Sign in", sign-out never revoked anything at
the ERP, and no order could have carried a session. The account pages sit under
`/{tenant}` and worked, which hid the fault.

The cookie is now `Path=/`. The per-tenant cookie name keeps shops apart, and
the ERP's tenant binding was always the real boundary, as `0002` itself said.
Any cookie a browser still holds at the old path is simply ignored until it
expires. The feature had not reached real buyers, because no shop could send a
code.

The cookie's `Max-Age` also moves from 14 to 30 days, to match the idle window
the ERP shipped.

## What does not change

- Shops that turn `requireSignIn` off get checkout exactly as `0002` left it.
  A session is optional: presenting one bills the account, and a stale one
  places a guest order.
- Every existing `/{tenant}/order/{token}` link still works. Signed-in orders
  still receive a status token, and it is still the only way to cancel. The
  account pages cannot cancel yet.
- The cart still holds slugs and quantities and nothing else, and every figure
  still comes from the server.

## Costs, stated plainly

- **Sign-in is now a hard dependency for taking any order.** Where
  `requireSignIn` is on, an email outage, a Resend key that has lapsed, or a
  server with no sender configured means the shop takes no orders at all.
  `/storefront-admin/readiness` names that state for the merchant. Nothing turns
  the flag off automatically. Quietly reopening guest checkout is exactly the
  decision the flag leaves with the merchant.
- **Every first order now costs a message** and an inbox round trip before it
  can be placed. The 30-day sliding session keeps repeat sign-ins rare.
- **The default-on migration changes live shops.** That is intended, since it
  is what the owner asked for. But a merchant who relied on guest checkout
  will see it close on deploy.

## Open questions

- An SMS provider and, with it, linking a shopper's phone and email into one
  account. The linking step must prove both identities in one session.
- Cancelling from the account pages. Self-cancel still hangs off the status
  token.
- Whether an email-verified shopper's typed phone should be confirmed by a
  code at checkout once SMS exists, which would make "authentic" mean the
  number too.
