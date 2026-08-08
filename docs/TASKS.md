# OrderDesk — Task List

Work top to bottom. One branch per group, conventional commits, PR into `main`.
A phase is done when every box is ticked **and** you can answer that phase's
"Prove it" questions in `CURRICULUM.md` out loud.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — TypeScript foundations (3 days)
Branch: `phase-0/contracts`

- [ ] `pnpm install` at root; confirm `pnpm typecheck` runs (no packages yet, should no-op cleanly)
- [ ] Create `packages/contracts` (`package.json`, `tsconfig.json` extending `tsconfig.base.json`, `src/index.ts`)
- [ ] Add deps: `zod`, `typescript`, `vitest`
- [ ] `src/brand.ts` — `Brand<T,B>` helper + `AccountId`, `BuyerUserId`, `ErpItemId`, `DraftId`
- [ ] `src/money.ts` — `Money` as Decimal-string + parse/format/add/multiply, ported from the ERP's `Money`. Currency is a required param (no hardcoded code)
- [ ] `src/assert-never.ts` — exhaustiveness helper
- [ ] `src/erp/item.ts` — zod schema for `/item/item-list` response, including the dual-case key normalization
- [ ] `src/order-draft.ts` — `OrderDraftStatus` union + legal transition map, exhaustive switch
- [ ] Vitest: money arithmetic (incl. rounding), status transitions (legal + illegal), zod rejects malformed ERP payloads
- [ ] Write `docs/decisions/0001-typescript-conventions.md` — brands, zod-first, no `any`

**Done when:** a malformed ERP item payload fails at parse time with a readable error, and an illegal status transition is a compile error or a thrown domain error, not a silent write.

---

## Phase 1 — React fundamentals (1 week)
Branch: `phase-1/cart-ui`

- [ ] `pnpm create vite@latest apps/playground -- --template react-ts` (throwaway; deleted after Phase 2)
- [ ] Item grid from a local fixture; loading and empty states
- [ ] Add to cart, quantity stepper, remove line
- [ ] Cart totals: subtotal, line discount, tax, grand total — using `packages/contracts` money helpers
- [ ] Derive every total during render; **zero** `useEffect` in the totals path
- [ ] Controlled quantity input with validation (min qty, break qty)
- [ ] Extract `useCart` custom hook; unit test it with `@testing-library/react`
- [ ] Zustand store for cart-drawer open state — client UI state only, no server data
- [ ] Deliberate exercise: write the wrong `useEffect`-derived-total version, observe the double render in React DevTools Profiler, then delete it
- [ ] Compare against your Flutter POS cart; note in the decision log what React made easier/harder

**Done when:** no `useEffect` exists except for genuine outside-world sync, and you can explain every re-render in the Profiler.

---

## Phase 2 — Next.js App Router (1 week)
Branch: `phase-2/public-catalog`

- [ ] `pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --import-alias "@/*"`
- [ ] Wire `apps/web` into the workspace; extend `tsconfig.base.json`; `packages/contracts` as a workspace dep
- [ ] Root layout, `loading.tsx`, `error.tsx`, `not-found.tsx`
- [ ] `/catalog` — server component list, fixture-backed, search + cursor pagination via searchParams
- [ ] `/catalog/[slug]` — detail page, `generateMetadata` with OG tags
- [ ] `<Suspense>`-streamed "related items" section
- [ ] Cart migrated in as a client component island; server-rendered content passed as `children`
- [ ] Server Action `addToCart` with zod validation of its input (treat it as a public endpoint)
- [ ] `useOptimistic` on add-to-cart
- [ ] Route Handler `/api/health`
- [ ] `middleware.ts` skeleton redirecting `/account/*` when unauthenticated
- [ ] Caching lab: force a stale item four ways, fix each, write `docs/decisions/0002-nextjs-caching.md` naming all four cache layers
- [ ] Delete `apps/playground`

**Done when:** view-source on `/catalog` shows fully rendered HTML, and the client JS bundle contains no catalog data-fetching code.

---

## Phase 3 — Design system (3 days)
Branch: `phase-3/ui-kit`

- [ ] Create `packages/ui`; Tailwind v4 `@theme` tokens (brand, semantic, spacing, radii)
- [ ] `cn()` = `clsx` + `tailwind-merge`
- [ ] `npx shadcn@latest init` + add: button, input, select, dialog, sheet, table, badge, dropdown-menu, toast, form
- [ ] `Money` display component — currency-aware, right-aligned, tabular numerals
- [ ] `DataTable` on TanStack Table: sorting, column visibility, cursor pagination
- [ ] `EmptyState`, `ErrorState`, `PageHeader`
- [ ] Dark mode via `class` strategy + no-flash theme script
- [ ] Form field wrapper: react-hook-form + `zodResolver` bound to `packages/contracts` schemas
- [ ] Accessibility pass: keyboard-only walk of the catalog + cart; visible focus rings; axe clean
- [ ] Apply the kit across Phase 2 pages

**Done when:** you can complete a full add-to-cart flow with the keyboard alone, and no page has a raw `<button>`.

---

## Phase 4 — Postgres + Prisma (1.5 weeks)
Branch: `phase-4/schema`

- [ ] `pnpm db:up`; confirm Postgres on 5433 and Redis on 6380
- [ ] Create `packages/db`; `prisma init`; `.env` from `.env.example`
- [ ] Model every entity in `SPEC.md` §2 — money as `Decimal(18,4)`, enums for statuses
- [ ] Indexes: every filtered FK, plus composites for catalog search and the draft board query
- [ ] Unique constraints: `BuyerUser.email`, `PushAttempt.idempotencyKey`, price-list line per (list, item)
- [ ] Deliberate `onDelete` on every relation — no defaults by accident
- [ ] `prisma migrate dev --name init`; read the generated SQL line by line
- [ ] Prisma client extension enforcing `accountId` scoping on buyer-facing models
- [ ] Seed script: pull the real catalog from `/item/item-list` into `CatalogItem`, plus 2 demo accounts, 3 users, 2 price lists
- [ ] Query-log lab: build a drafts list page, find the N+1, fix with `select`, record before/after query counts
- [ ] Price-resolution query (account list → tier list → base price, priority wins) + unit tests
- [ ] Credit-check transaction: interactive `$transaction` with row lock; write a concurrency test that fires two submits and asserts exactly one passes
- [ ] Practice an expand/contract rename migration; document the steps
- [ ] `docs/decisions/0003-data-model.md` — Decimal, cursor pagination, scoping extension

**Done when:** the concurrency test fails if you remove the lock, and passes with it. That test is the centrepiece of the project.

---

## Phase 5 — Node backend (1.5 weeks)
Branch: `phase-5a/express-primer`, then `phase-5b/nest-api`

### Week A — Express primer (throwaway)
- [ ] Minimal Express API in `sandbox/express-primer` (git-ignored): 3 routes, hand-rolled middleware chain
- [ ] Central error handler (4-arg), 404 handler, request logger with correlation id
- [ ] Graceful shutdown on `SIGTERM` — drain connections, close the pool
- [ ] Stream a large CSV response without buffering it
- [ ] Write `docs/decisions/0004-why-nest.md` listing what got painful — this is your interview answer

### Week B — NestJS API
- [ ] `nest new apps/api`; wire into workspace; port 4000
- [ ] `ZodValidationPipe` using `packages/contracts` schemas
- [ ] Global exception filter → `{ code, message, details }`; no stack traces to clients
- [ ] Logging interceptor with correlation id propagated from the web app
- [ ] `AuthModule`: register, login, argon2id hashing, access JWT (15m) + refresh cookie (30d)
- [ ] Refresh rotation **with reuse detection** — reused token revokes the whole family
- [ ] `JwtAuthGuard` + `RolesGuard` (`@RequireRole`) + account-scope guard
- [ ] `AccountsModule`, `PriceListModule` (resolution logic from Phase 4), `CartModule`
- [ ] `DraftsModule`: submit (guardrails: account status, min/break qty, stock, credit), approve, reject
- [ ] `ErpClientModule`: service login, token cached in Redis with refresh-ahead, `clientApiKey` header, zod-parsed responses, timeout + circuit breaker, one-place key normalization
- [ ] Approve writes draft + `PushAttempt` in **one transaction** (outbox — no enqueue inside the tx)
- [ ] Swagger at `/docs`; generate a typed client for `apps/web`
- [ ] Vitest unit tests: price resolution, credit math, totals, transition rules
- [ ] Supertest integration tests on auth + draft lifecycle
- [ ] Testcontainers: real Postgres + Redis in the integration suite
- [ ] `apps/web` talks to the real API; delete all fixtures

**Done when:** `pnpm test` boots real containers and the whole draft lifecycle passes against them.

---

## Phase 6 — Redis (1 week)
Branch: `phase-6/cache-and-jobs`

- [ ] `CacheModule` on ioredis; namespaced key builder `od:{env}:{domain}:{...}`
- [ ] Cache-aside for the catalog (TTL 15m) and stock (60s)
- [ ] Stampede protection: `SET NX PX` lock + single-flight; test with 200 concurrent misses
- [ ] Invalidate on catalog sync via version-prefix bump
- [ ] Credit exposure cached at 30s; document why it can't be longer
- [ ] Sliding-window rate limiter as a Lua script; applied per IP on auth, per account on submit
- [ ] Refresh-token family store + revocation list in Redis
- [ ] BullMQ queues: `erp-push`, `catalog-sync`, `email`
- [ ] `erp-push` worker drains `PushAttempt`: exponential backoff, capped attempts, `FAILED` + alert at the cap
- [ ] Idempotency proven: run the push twice with the same key, assert one ERP order
- [ ] `catalog-sync` repeatable nightly job + manual trigger endpoint
- [ ] Worker runs as a **separate process** (`apps/api/src/worker.ts`)
- [ ] Bull Board behind an admin guard
- [ ] Benchmark catalog p95 cold vs warm (autocannon); record numbers in the README
- [ ] `docs/decisions/0005-caching-and-staleness.md` — TTL budget per key, with reasons

**Done when:** killing the worker mid-push and restarting it produces exactly one ERP order.

---

## Phase 7 — WebSockets (1 week)
Branch: `phase-7/realtime`

- [ ] Choose ws vs socket.io; write the decision + why not SSE here
- [ ] Nest WebSocket gateway; **JWT verified during the handshake**, reject before connect
- [ ] Rooms keyed by `accountId`; rep room separate from buyer rooms
- [ ] Cross-account leak test: buyer A must never receive an account-B event (assert it)
- [ ] Redis adapter for multi-instance fan-out; verify with two API processes
- [ ] Events: `draft.submitted`, `draft.approved`, `draft.rejected`, `draft.pushed`, `stock.changed`
- [ ] Rep order board page: live list, claim, approve/reject with optimistic UI + rollback on failure
- [ ] Buyer's draft page updates live on approval
- [ ] Live stock badge on catalog pages
- [ ] Presence: which rep is viewing a draft
- [ ] Heartbeat + reconnect with exponential backoff
- [ ] Resume: client sends last event id, server replays the gap from a bounded Redis stream
- [ ] Backpressure: coalesce stock updates, drop for slow consumers, never buffer unbounded
- [ ] `docs/decisions/0006-realtime.md`

**Done when:** you kill one API pod and connected clients reconnect, resume, and miss nothing.

---

## Phase 8 — Docker, CI, deploy (1 week)
Branch: `phase-8/ship-it`

- [ ] `infra/api.Dockerfile` — multi-stage, alpine, non-root, prod deps only, Prisma engines, `HEALTHCHECK`, `--init`
- [ ] `infra/web.Dockerfile` — Next standalone output
- [ ] `.dockerignore` for both
- [ ] Record image sizes before/after optimization
- [ ] Uncomment web/api/worker in `infra/docker-compose.yml`; healthchecks + `depends_on: service_healthy`
- [ ] Fresh-clone test: `cp .env.example .env && docker compose up` → working seeded app
- [ ] CI: add the Playwright e2e job
- [ ] Deploy job: `prisma migrate deploy` before the app rollout
- [ ] Deploy `apps/web` to Vercel; api + worker + Postgres + Redis to Fly.io or Railway
- [ ] pino structured logs, correlation id threaded web → api → worker
- [ ] Sentry on web + api
- [ ] `/health` (liveness) and `/ready` (deps reachable) — and know the difference
- [ ] Demo credentials seeded in production

**Done when:** a stranger with the repo URL and no help gets a running app in one command, or uses the live one.

---

## Phase 9 — Portfolio polish (ongoing)
Branch: `phase-9/polish`

- [ ] README: what it is, architecture diagram, ownership-boundary table, live URL, demo creds, 30s GIF
- [ ] Decision log index linking `docs/decisions/*`
- [ ] Performance section: catalog p95 cached vs uncached, image sizes, bundle size, Lighthouse
- [ ] Playwright e2e: login → browse → cart → submit → approve → ERP push verified
- [ ] Bundle analysis; kill anything accidentally client-side
- [ ] Lighthouse ≥ 95 on the public catalog
- [ ] Security pass: helmet, CORS allowlist, cookie flags, rate limits, no secrets in the repo, dependency audit
- [ ] Write the 2-minute spoken walkthrough of the outbox flow and rehearse it
- [ ] **AI slice:** "what did Acme order last quarter?" → tool-calling over a read-only reporting view, zod-validated tool args, streamed response, hard row cap, account-scoped `WHERE` the model cannot influence
- [ ] Pin the repo on GitHub; rewrite the CV bullets around the four talking points

---

## Running rules

- Branch per group above; conventional commits; PR with a description of the tradeoff you made.
- Never merge red CI.
- Any decision you'd have to re-derive later goes in `docs/decisions/` the same day.
- If a phase runs long, cut scope from Phase 9, never from 4-7.
