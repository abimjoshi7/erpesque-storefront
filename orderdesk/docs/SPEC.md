# OrderDesk — Specification

Self-serve ordering portal for wholesale buyers, backed by an existing Rust ERP
(Erpesque). Buyers browse a live catalog and order against their credit limit;
sales reps work a realtime approval board.

## 1. Why this exists (and why it is not an ERP rewrite)

Erpesque already owns items, stock, ledgers, invoices and POS, and is consumed by
a Flutter app. It has no customer-facing surface at all. OrderDesk adds that
surface without duplicating a single line of ERP business logic.

### Ownership boundary

| Concept | Owner | Notes |
|---|---|---|
| Items, categories, units, tax, currency | **ERP** | OrderDesk caches a read-only projection |
| Stock levels, valuation, ledgers | **ERP** | read-only |
| Invoices, payments, GL | **ERP** | read-only |
| Confirmed sales orders | **ERP** | OrderDesk creates them via `/order/save` |
| Buyer accounts & buyer users | **OrderDesk** | ERP has parties, not portal logins |
| Per-customer price lists / tiers | **OrderDesk** | ERP has one price per item |
| Carts | **OrderDesk** | no ERP equivalent |
| Order drafts + approval workflow | **OrderDesk** | pre-ERP lifecycle |
| Delivery windows, PO references | **OrderDesk** | |

Rule of thumb: **if the ERP can already answer it, OrderDesk asks — it does not
store the truth.** The only ERP data OrderDesk persists is a cache with an
explicit `syncedAt`, never treated as authoritative.

## 2. Domain model (OrderDesk's own Postgres)

```
BuyerAccount
  id, erpPartyId, name, slug, currencyCode
  creditLimit (Decimal), paymentTermsDays, status(ACTIVE|HOLD|CLOSED)

BuyerUser
  id, accountId -> BuyerAccount, email (unique), passwordHash (argon2id)
  role (OWNER | BUYER | VIEWER), lastLoginAt

PriceList
  id, accountId? , tier?, currencyCode, validFrom, validTo, priority

PriceListLine
  id, priceListId, erpItemId, unitPrice (Decimal), minQty, breakQty?

Cart          id, accountId, buyerUserId, updatedAt
CartLine      id, cartId, erpItemId, qty (Decimal), unitPriceSnapshot

OrderDraft
  id, accountId, buyerUserId, reference, poNumber?, deliveryWindow?
  status (DRAFT|SUBMITTED|APPROVED|REJECTED|PUSHING|PUSHED|FAILED)
  subtotal, taxTotal, grandTotal (Decimal)
  submittedAt, decidedAt, decidedByUserId?, rejectionReason?

OrderDraftLine
  id, draftId, erpItemId, nameSnapshot, qty, unitPrice, taxRateSnapshot, lineTotal

PushAttempt                      -- transactional outbox
  id, draftId, idempotencyKey (unique), attempt, status(PENDING|OK|ERROR)
  erpOrderId?, errorCode?, errorBody?, nextRetryAt

CatalogItem                      -- read-only projection of the ERP catalog
  erpItemId (pk), sku, name, categoryId, unitId, taxRateId
  basePrice, stockOnHand, isActive, syncedAt

AuditLog
  id, accountId?, actorUserId?, action, entity, entityId, before, after, at
```

Money is `Decimal(18,4)` throughout — never a float. Same rule as the ERP.

## 3. ERP integration contract

Auth: service credentials via `/auth/authenticate`, refresh via `/auth/refresh`,
plus the `clientApiKey` / `originApiKey` header the Cloudflare Worker gate
expects. Token cached in Redis with refresh-ahead; never one login per request.

| OrderDesk need | ERP endpoint | Direction | Cache |
|---|---|---|---|
| Catalog | `/item/item-list`, `/ItemCategory`, `/unit`, `/tax`, `/currency` | read | Redis 15m + nightly full sync |
| Stock | `/reports/inventory-valuation`, `/reports/low-stock`, `/reports/stock-ledger` | read | Redis 60s |
| Locations | `/inventory-location` | read | Redis 1h |
| Outstanding balance | `/netsuite/invoice/customer_due_amount/party_id/{party_id}/currency_id/{currency_id}` | read | Redis 30s |
| Create order | `/order/save` | write | never cached, idempotent |
| Order status | `/order/{id}` | read | Redis 30s |

Everything crossing this boundary is validated with a zod schema in
`packages/contracts`. The ERP returns dual-case keys in places
(`categoryId` / `CATEGORY_ID`) — normalize at the edge, once.

## 4. Core flows

### 4.1 Browse → cart → submit
1. Public catalog page is server-rendered from the `CatalogItem` projection.
2. Signed-in buyer sees resolved prices (price list beats base price; highest
   `priority` wins among overlapping active lists).
3. Cart lines snapshot the price at add-time; a price change surfaces as a
   visible diff at submit, never a silent re-price.
4. Submit runs the guardrails: account status, per-line min/break qty, stock
   availability, and **credit check** = `creditLimit - outstanding - openDrafts`.
5. Draft goes `SUBMITTED`, rep board gets a WebSocket event.

### 4.2 Approve → push to ERP (the interesting part)
1. Rep approves. In **one Postgres transaction**: draft → `APPROVED` and a
   `PushAttempt` row is inserted with a deterministic `idempotencyKey`
   (`draftId` + draft version). This is the transactional outbox — no job is
   enqueued from inside the transaction.
2. A BullMQ worker picks up pending attempts, calls `/order/save`, and records
   `erpOrderId` on success.
3. Failure → exponential backoff, capped retries, then `FAILED` + alert. The
   unique `idempotencyKey` means a retry after an ambiguous timeout can never
   create two ERP orders.
4. Success broadcasts to both the rep board and the buyer's tab.

### 4.3 Credit check correctness
Outstanding balance is live ERP data with a 30s Redis TTL. Open OrderDesk drafts
are counted from the local DB inside the same transaction as the submit, so two
concurrent submissions cannot both slip under the limit. Document this tradeoff
in the README — it is the best interview conversation in the project.

## 5. Non-goals

- No payment processing (ERP owns AR).
- No inventory mutation from OrderDesk.
- No multi-warehouse allocation logic — ERP decides fulfilment.
- No mobile app; the Flutter client stays the internal tool.

## 6. Definition of done (portfolio bar)

- `docker compose up` boots the whole stack.
- Live URL with seeded demo buyer + rep credentials in the README.
- Architecture diagram + decision log (why Nest, why Prisma, why outbox).
- Playwright e2e covering browse → cart → submit → approve → push.
- CI green: typecheck, lint, unit, integration (testcontainers), build.
- p95 numbers for the catalog endpoint, cached vs uncached.
