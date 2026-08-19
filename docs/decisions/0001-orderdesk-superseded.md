# 0001 — OrderDesk is superseded; this app takes the wholesale surface

Status: accepted
Date: 2026-08-19

## What OrderDesk was

OrderDesk was a self-serve ordering portal for wholesale buyers: buyers would
browse a live catalog and order against a credit limit, and sales reps would
work a realtime approval board. It carried its own stack — NestJS for the API,
Prisma over a dedicated Postgres, Redis for caching, BullMQ for the worker, all
in a pnpm + Turborepo monorepo — and its own Postgres schema for buyer accounts,
price lists, carts, order drafts and an outbox.

It was merged into this repository as a git subtree in `f1f3e28`. It never had
any source files: twelve files, all configuration and documentation. Nothing has
been ported, because there was nothing to port.

## Why it is superseded

OrderDesk rested on two claims about the ERP, both stated in its `SPEC.md` §1.
Both were true when it was designed. Neither is true now.

The first was that the ERP "has no customer-facing surface at all". It now has
nine public `/storefront/*` endpoints and six `/storefront-admin/*` ones, and
this app consumes every public one — that is what the status table in the README
tracks. The surface OrderDesk was going to build exists, on the side of the wall
where the source of truth already lives.

The second was that the ERP has one price per item, which is why OrderDesk
proposed to own price lists itself. The ERP has pricelists, with multi-buy bundle
rules resolved as an unbounded knapsack so that a quantity two smaller bundles
cover more cheaply than one larger one is priced the cheaper way. A tenant binds
one through `tenant_preferences.storefront_pricelist_id`, single-unit rules feed
the catalog price and multi-buy rules are applied at `/quote` and `/order`. The
contract is documented on the generated types at `src/types/erp-api.d.ts:12468`
and `:12648`.

The approval workflow OrderDesk planned to own as a "pre-ERP lifecycle" also
already exists. `/storefront/{tenantCode}/order` writes an ordinary `sales_orders`
row with `source = 'web'`, `fulfillment_status = 'draft'` and
`approval_status = 1`, so a web order appears in the approval queue staff already
work from and nothing reaches the general ledger until a human accepts it
(`src/types/erp-api.d.ts:10358`). Party matching happens at approval rather than
at checkout: the shopper is recorded in `storefront_customers` keyed by the
canonical phone number, and approving the order matches them against existing
customers and creates a party if none matches (`:10366`). That ordering is
deliberate on the ERP's part — it keeps abandoned and fraudulent orders out of
the customer master — and it is the same problem OrderDesk's `BuyerAccount.erpPartyId`
was meant to solve.

What settles it is OrderDesk's own rule, from the same section of its spec: *if
the ERP can already answer it, OrderDesk asks — it does not store the truth.*
Applied honestly to the ERP as it stands today, that rule condemns most of the
schema in its §2.

## What dies with it

The transactional outbox goes first, and it was the most interesting thing in
the design: `PushAttempt` rows with deterministic idempotency keys, a BullMQ
worker draining them, exponential backoff and capped retries. All of that exists
to reconcile two databases that can disagree. There is only one database. The
order write *is* the ERP write, synchronous, and `/storefront/{tenantCode}/order`
is already the transaction boundary. An outbox here would be machinery guarding
against a failure mode the architecture no longer has.

The `CatalogItem` projection, its `syncedAt` column, the Redis read-through cache
and the nightly full sync go the same way. This app holds no catalog copy at all;
`src/lib/erp.ts` leans on Next's data cache, one minute for catalog reads and an
hour for facets and the sitemap, and every figure involving money is re-read live.

`Cart` and `CartLine` go, and `CartLine.unitPriceSnapshot` deserves naming
directly: it contradicts the property this repo is built on. A cart that
remembers what something cost is a cart that can be edited in devtools, and one
that quietly charges yesterday's price after an overnight repricing. `src/lib/cart.ts`
stores slugs and quantities and nothing else, and every amount a shopper sees
comes back from `POST /quote`. Snapshotting prices at add-time would have been a
regression dressed as a feature.

`PriceList` and `PriceListLine` go, because the ERP's pricelists are richer than
what was specified here. `OrderDraft`, `OrderDraftLine` and `AuditLog` go,
because `sales_orders` and `/audit-trail` already hold them.

## What is actually missing

Seven things stand between this app and owning the wholesale surface. None of
them is a reason to keep OrderDesk, because all seven are ERP-side *data*, and
this repository's rule is that the ERP stays the only source of truth. The work
is therefore new `/storefront/*` endpoints upstream plus the screens to use them
here. No new database.

**Buyer login.** Ordering is guest-only today, and an order is tracked by an
opaque `statusToken` handed out once at checkout. Wholesale needs accounts, more
than one user per account, and roles. This is the gap that matters most: order
history, reorder and a server-side cart are all blocked behind it.

**Per-customer pricing.** The ERP binds one pricelist per tenant storefront, not
one per party. The resolver already exists and already handles date ranges,
active flags and multi-buy rules, so this is a change to which pricelist gets
looked up, not new pricing machinery.

**Credit limit and the credit check.** `Party` carries `termId` and `termName`
but no credit limit field (`src/types/erp-api.d.ts:12864`). The other half is
already available: outstanding balance comes from
`/txn/invoice/customer_due_amount/party_id/{party_id}/currency_id/{currency_id}`.
The limit needs somewhere to live in the ERP, and the check belongs inside the
order write.

**Order history and reorder.** Only single-order-by-token exists. Cheap once
login lands, and unavailable before it.

**PO number and delivery window.** An order carries a free-text `note` and
nothing structured. Both are fields on the order, plus the checkout inputs here.

**A server-side cart.** Worth doing only after login, for buyers moving between
devices. Whatever it stores, it must keep holding slugs and quantities and no
prices.

**Minimum order quantity and order multiples.** Multi-buy bundles exist, but
nothing enforces a minimum. It belongs on the item and has to be enforced at
`/quote` and `/order`, not only in the form.

## What is salvaged

The credit-check argument in OrderDesk's `SPEC.md` §4.3 is the part worth
keeping. Outstanding balance is live ERP data read with a short TTL, while open
commitments have to be counted inside the same transaction as the submit, or two
concurrent submissions can both slip under the limit. That reasoning survives
intact; it just moves into the ERP's order transaction rather than a portal's.

The idempotency key survives too, retargeted. It is no longer protecting a push
between two systems, but it is still the right shape for stopping a double-submit
at checkout from becoming two orders.

The decision log survives as a habit — this document is the first entry.

`docs/CURRICULUM.md` does not survive in the tree. It was the most substantial
thing OrderDesk carried and it is worth reading again, but it belongs to a
project that no longer exists, and keeping it here would leave a curriculum for a
stack this repository does not use. It remains in git history:

```bash
git show f1f3e28:orderdesk/docs/CURRICULUM.md
```

The same is true of `SPEC.md` and `TASKS.md` at the same revision.

## Consequences

`orderdesk/` is removed. The tooling that existed only to keep it at arm's length
goes with it: the `tsconfig.json` exclude, the `eslint.config.mjs` ignore, the
`paths-ignore` on the CI workflow, and the README section explaining why a second
project was sitting in the tree. The CI workflow itself stays — it is this
repository's only CI and it was never about OrderDesk.

Wholesale work from here is ordinary work on this app and on the ERP behind it,
starting with buyer login.
