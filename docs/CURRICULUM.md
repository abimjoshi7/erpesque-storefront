# OrderDesk — Learning Guide

A 10-week, build-first path from Flutter/Dart/Rust to job-ready TypeScript full
stack. Every concept is introduced *because the project needs it next*, and
mapped onto something you already know.

**How to use this:** read the phase, then work `TASKS.md` for that phase. Do not
read ahead — the ordering exists so nothing is magic when you meet it. Each phase
ends with "prove it" questions. If you cannot answer them out loud, the phase is
not done, regardless of whether the code runs.

Budget: ~5-6 focused hours/day. Phases 4-7 carry the hiring signal — do not rush
them to add features.

---

## Phase 0 — TypeScript for a Dart developer (3 days)

You already have static types, null safety, generics, async/await and pattern
matching. Only four things are genuinely different, and they are exactly what
trips Dart devs.

### 0.1 Structural typing (the big one)

Dart is **nominal**: a `Money` is a `Money` because it was declared as one.
TypeScript is **structural**: anything with the same shape *is* that type.

```ts
interface Money { amount: number; currency: string }
interface Weight { amount: number; currency: string }
const w: Weight = { amount: 5, currency: 'kg' };
const m: Money = w; // compiles. no error. this is the trap.
```

Fix with branded types:

```ts
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

type Cents = Brand<number, 'Cents'>;
type ErpItemId = Brand<string, 'ErpItemId'>;

const cents = (n: number): Cents => n as Cents;
```

Use brands for every id and money value in `packages/contracts`. Mixing
`erpItemId` and `cartLineId` becomes a compile error instead of a bug.

### 0.2 Types are erased at runtime

Dart keeps types at runtime — `is`, `runtimeType`, reflection. TypeScript types
**vanish** when compiled. There is no `if (x is Money)` for an interface.

Consequence: every boundary into your program (HTTP body, ERP response, env
vars, `JSON.parse`, `localStorage`) is `unknown` until *parsed*. That is what
**zod** is for.

```ts
import { z } from 'zod';

export const erpItem = z.object({
  itemId: z.string(),
  itemName: z.string(),
  sellingPrice: z.coerce.number(),
  isActive: z.boolean().default(true),
});

export type ErpItem = z.infer<typeof erpItem>; // type derived from the schema
```

Rule for this project: **one zod schema per boundary, type always inferred from
the schema, never hand-written next to it.** A hand-written type that drifts from
its validator is the #1 source of "worked in dev" bugs.

### 0.3 Discriminated unions = your sealed classes

Dart sealed class / Rust enum → TS union with a literal discriminant.

```ts
type PushResult =
  | { kind: 'ok'; erpOrderId: string }
  | { kind: 'retryable'; reason: string }
  | { kind: 'fatal'; code: number; body: string };

function handle(r: PushResult) {
  switch (r.kind) {
    case 'ok': return r.erpOrderId;
    case 'retryable': return scheduleRetry(r.reason);
    case 'fatal': return giveUp(r.code);
    default: return assertNever(r); // exhaustiveness, like Rust's match
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

`assertNever` is how you get Rust-grade exhaustiveness. Put it in
`packages/contracts` on day one and use it everywhere.

### 0.4 The runtime model

- `Promise` ≈ `Future`. `async/await` behaves the same.
- **No isolates.** One thread, one event loop. CPU-bound work blocks *every*
  request on the process. Anything heavy goes to a BullMQ worker (Phase 6).
- `Promise.all` ≈ `Future.wait`. `Promise.allSettled` when partial failure is OK.
- No `unawaited()` equivalent needed — a floating promise is an unhandled
  rejection waiting to happen. Await it or explicitly `.catch()` it.

### 0.5 Config that must be strict

`tsconfig.base.json` in this repo already sets the bar:
`strict`, `noUncheckedIndexedAccess` (array access yields `T | undefined` —
correct, and closer to Dart's null safety than the default),
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`.

`any` is banned. `unknown` at the edges, parse, then flow typed.

### Prove it
1. Why does `noUncheckedIndexedAccess` change `arr[0]`'s type, and what is the Dart equivalent situation?
2. You have a `User` type and JSON from an API. Why can't you `as User` it safely?
3. What does `satisfies` do that a type annotation doesn't?
4. Write a union + exhaustive switch for `OrderDraft.status`.

---

## Phase 1 — React (1 week)

### Mental model translation

| Flutter | React |
|---|---|
| `StatelessWidget.build()` | function component returning JSX |
| constructor args | props |
| `StatefulWidget` + `setState` | `useState` |
| `initState` / `dispose` / `didUpdateWidget` | `useEffect` (all three, one API) |
| `BuildContext` inherited widgets | `useContext` |
| `Key` | `key` — same semantics, same reasons |
| Element tree diffing | reconciliation |
| `ValueNotifier` / Riverpod | `useState` / Zustand / TanStack Query |

### The rules that actually matter

**Hooks run top-level, in the same order, every render.** No conditionals, no
loops, no early returns before them. React tracks hook state positionally.

**Render must be pure.** A component is `state -> UI`, called many times,
possibly discarded. Side effects go in event handlers or effects, never inline.

**`useEffect` is for synchronizing with something outside React** — a
subscription, a WebSocket, a DOM API, a timer. It is *not*:
- for computing derived state → just compute it during render
- for reacting to a prop change → derive it, or key the component
- for fetching on mount → that's TanStack Query's job (or a server component)

The most common bad React code you will read (and must not write):

```tsx
// WRONG — extra render, stale window, unnecessary state
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(lines.reduce(sum, 0)); }, [lines]);

// RIGHT — it's just a computation
const total = useMemo(() => lines.reduce(sum, 0), [lines]);
```

`useMemo` / `useCallback` are performance tools, not correctness tools. Add them
when a profile says to, or when a value is a dependency of something expensive.

### State, three kinds — keep them separate
1. **Server state** (catalog, drafts) → TanStack Query. Caching, revalidation,
   optimistic updates. Conceptually the same job as your Flutter cache-first
   repository layer.
2. **Global client state** (cart drawer open, theme) → Zustand.
3. **Local state** → `useState`.

Mixing 1 and 2 is the classic mistake — do not put server data in Zustand.

### Build this phase
The cart UI, entirely client-side with fake data: item grid, add to cart,
quantity stepper, line remove, discount, tax, totals. Same math as your POS cart,
so you compare the two implementations directly and see what React costs and
saves versus Flutter.

### Prove it
1. Why does React need `key` on lists, and what breaks with index-as-key?
2. When does `useEffect`'s cleanup run — and how many times in StrictMode dev?
3. You have `props.itemId` and want to reset local state when it changes. Two ways — which is better and why?
4. What re-renders when a Context value changes, and how do you limit it?

---

## Phase 2 — Next.js App Router (1 week)

Hardest conceptual phase. Go slow.

### Server Components vs Client Components

Every component is a **Server Component** by default: it runs on the server,
during render, and its code never ships to the browser. It can `await` a
database call directly. It cannot use `useState`, `useEffect`, or event handlers.

`"use client"` at the top of a file marks the boundary. Everything imported from
that file downward is in the client bundle.

The mental model that makes it click: the server renders a *tree with holes*, and
client components fill the holes. Props crossing the boundary must be
serializable — no functions, no class instances, no `Date` methods you rely on.

Composition trick you will use constantly — pass server-rendered children into a
client shell so the shell stays interactive without pulling the content into the
bundle:

```tsx
// server component
<ClientCartDrawer>
  <CatalogList />   {/* still rendered on the server */}
</ClientCartDrawer>
```

### Data and mutations
- **Fetch in server components.** No `useEffect` fetching, no loading spinner
  for the initial payload.
- **Server Actions** for mutations — a function with `"use server"` callable from
  a form or a client handler. It is an RPC endpoint the framework generates.
  Validate its input with zod: it is a public endpoint, treat it like one.
- **Route Handlers** (`app/api/*/route.ts`) for webhooks and anything a
  non-Next client calls.

### Caching — the interview killer
Four independent layers. Know each by name, know how to bust each:

| Layer | Scope | Bust with |
|---|---|---|
| Request memoization | one render pass | nothing — it's per-request |
| Data Cache | across requests & deploys | `revalidateTag` / `revalidatePath` / `cache: 'no-store'` |
| Full Route Cache | static HTML at build | `dynamic = 'force-dynamic'`, dynamic APIs |
| Router Cache | client-side, per session | `router.refresh()` |

Most "my data is stale in Next" bug reports are someone not knowing which of the
four bit them. Being able to name them cold is a real differentiator.

### Also this phase
Streaming with `<Suspense>`, `loading.tsx`, `error.tsx`, nested layouts,
intercepting routes for modals, `middleware.ts` for auth redirects, `metadata`
export for SEO (the actual reason the public catalog is SSR).

### Build this phase
Public catalog: server-rendered list with search + pagination, item detail page,
streamed "related items", full SEO metadata + OG images, 404 handling. Data from
a local fixture — the real projection arrives in Phase 4.

### Prove it
1. Draw the request path for a page with one server component and one client component. What HTML goes over the wire, what JS?
2. When would you pick a Route Handler over a Server Action?
3. Your catalog shows a deleted item after redeploy. Walk through all four caches.
4. Why can't you pass a callback prop from a server component to a client component?

---

## Phase 3 — Tailwind + design system (3 days)

- Utility-first: styling lives with markup, no naming ceremony, no dead CSS.
  Closest Flutter analogue is composing small widgets rather than theming a
  giant `ThemeData`.
- Tailwind v4 tokens via `@theme` in CSS — colors, spacing, radii.
- `cn()` helper = `clsx` + `tailwind-merge`, so later classes actually win.
- **shadcn/ui** — you copy component source into your repo (not a dependency).
  Built on Radix primitives, so keyboard nav, focus traps and ARIA are correct
  by default. Accessibility is a thing interviewers check and most portfolios fail.
- Dark mode via `class` strategy, responsive via mobile-first breakpoints.

### Build this phase
`packages/ui`: Button, Input, Select, Dialog, Sheet, Table, DataTable (TanStack
Table), Badge, Money display, EmptyState, form field wrappers bound to
react-hook-form + zod resolver.

### Prove it
1. Why does `tailwind-merge` exist — what breaks without it?
2. How do you keep a design token in sync between Tailwind and a chart library?
3. What does Radix give you that a `<div onClick>` doesn't?

---

## Phase 4 — Postgres + Prisma (1.5 weeks)

### Schema and modeling
Implement `docs/SPEC.md` §2. Practice the things that separate a working schema
from a good one:
- `@@index` on every foreign key you filter or join on, plus composite indexes
  matching your actual `WHERE` + `ORDER BY`.
- `@@unique` for real invariants (`PushAttempt.idempotencyKey`,
  `BuyerUser.email`).
- `Decimal` for money. Never `Float`. You already know why from the ERP.
- Enums for status columns; they become TS unions for free.
- `onDelete` behaviour chosen deliberately, not defaulted.

### Queries
- `select` vs `include` — `include` pulls whole rows, `select` pulls what you
  need. Default to `select`.
- **N+1**: turn on Prisma query logging and watch a list page. If a page of 20
  drafts fires 21 queries, fix it with a relation `select` or a single
  `groupBy`.
- Pagination: cursor-based (`cursor` + `take`), not `skip` — `OFFSET 10000` gets
  slow and shifts rows under concurrent writes.
- Raw SQL via `$queryRaw` tagged template when Prisma can't express it. The
  tagged-template form is parameterized; `$queryRawUnsafe` is not — never build
  SQL by string concatenation.

### Transactions
- `$transaction([...])` for a fixed batch.
- `$transaction(async (tx) => ...)` interactive, for read-then-write logic —
  this is what the submit and approve flows need.
- Understand read-committed vs serializable, and why the credit check needs
  either a serializable transaction or a row lock (`SELECT ... FOR UPDATE`) to
  stop two concurrent submits both passing the limit.

### Migrations
- `migrate dev` locally (generates + applies), `migrate deploy` in CI/prod.
- **Never edit an applied migration.** Roll forward with a new one.
- Expand/contract for breaking changes: add column → backfill → switch reads →
  drop old. Same discipline as your 113 ERP migrations.

### Build this phase
Full schema + migrations, a Prisma client extension that enforces
`accountId` scoping on every buyer-facing query (defence in depth, mirrors your
ERP tenant isolation), and a seed script that pulls the real catalog from
`/item/item-list` into `CatalogItem`.

### Prove it
1. Why is `Decimal` required for money, concretely, with an example that breaks in float?
2. Show the query plan for your catalog search. Which index serves it?
3. Two buyers submit simultaneously against a credit limit that fits only one. Exactly what stops the overdraw?
4. A migration must rename a column with zero downtime. Give the steps.

---

## Phase 5 — Node backend: Express then NestJS (1.5 weeks)

### Week A — Express, by hand (3 days)
Build a throwaway mini-API so nothing in Nest is magic afterwards:
middleware chain and `next()`, error-handling middleware (4-arg signature),
routers, `req`/`res` lifecycle, streaming a response, graceful shutdown on
`SIGTERM`. Then write down what got painful — that list *is* the argument for
Nest, and it is the answer when an interviewer asks "why Nest?".

### Week B — NestJS, the real API
- **Modules / providers / DI.** Constructor injection, provider tokens,
  module scoping. You know DI from Riverpod and Rust trait objects; the new part
  is the module graph.
- **Pipes** — `ZodValidationPipe` on every DTO, schemas imported from
  `packages/contracts` so web and api validate identically.
- **Guards** — `JwtAuthGuard`, then `RolesGuard` reading
  `@RequireRole('OWNER')` and account-scoping metadata. Same permission model
  shape as your ERP RBAC.
- **Interceptors** — request logging with a correlation id, response envelope,
  timing.
- **Exception filters** — one error shape for the whole API
  (`{ code, message, details }`), mapped from domain errors. No stack traces to
  clients.
- **Swagger/OpenAPI** generated from decorators; generate a typed client for
  `apps/web` from it.

### Auth, done properly
- argon2id password hashing (not bcrypt, not SHA).
- Short-lived access JWT (15m) + long-lived refresh token in an httpOnly,
  Secure, SameSite=Lax cookie.
- **Refresh rotation with reuse detection**: each refresh issues a new token and
  invalidates the old; if an already-used token appears, revoke the whole family
  — that's a stolen-token signal.
- Rate limit auth routes (Phase 6 adds the Redis-backed limiter).

### The ERP client
A `ErpClientModule` wrapping the Rust API: service login, token cached in Redis
with refresh-ahead, required `clientApiKey` header, zod-parsed responses, typed
errors, timeout + circuit breaker. Every response normalized once (the ERP's
dual-case `categoryId`/`CATEGORY_ID` never leaks past this module).

### Testing
- Vitest unit tests for pure domain logic (price resolution, credit math,
  totals) — this is where most of your tests belong.
- Supertest for controller-level integration.
- **Testcontainers** for a real Postgres + Redis in tests. Most candidates mock
  the database and their tests prove nothing; this is a visible quality signal.

### Build this phase
Buyer auth, account/user CRUD, price-list resolution, cart, draft lifecycle
(submit/approve/reject) with the credit guardrail, ERP client, OpenAPI docs.

### Prove it
1. Guard vs interceptor vs middleware vs pipe — what runs when?
2. Why httpOnly cookie for refresh but memory for access token?
3. Refresh token reuse detected — what exactly do you do, and why?
4. Your ERP call times out after the order may have been created. How does the system stay correct?

---

## Phase 6 — Redis (1 week)

### Caching
- Cache-aside: read cache → miss → source → write cache with TTL.
- Key design: `od:{env}:catalog:{tenant}:page:{n}:{filterHash}` — namespaced,
  versioned, greppable. Bump a version prefix to invalidate a whole class.
- **Stampede**: 500 requests miss the same hot key at once and all hit the ERP.
  Fix with a short-lived lock (`SET key NX PX`) + single-flight, or stale-while-
  revalidate. Implement it; it's a great README section.
- TTL policy is a correctness decision: catalog 15m is fine, credit exposure 30s
  is the maximum you can defend. Write down *why* per key.

### Other jobs Redis does here
- Session / refresh-token family store with revocation.
- Sliding-window rate limiter (Lua script for atomicity) per IP and per account.
- Pub/Sub — needed in Phase 7 to fan WebSocket events across API instances.

### BullMQ
- Queues: `erp-push` (the outbox drain), `catalog-sync` (nightly + on-demand),
  `email`.
- Retries with exponential backoff, `attempts`, dead-letter handling, job
  idempotency, concurrency limits, repeatable jobs.
- A worker is a **separate process** — remember Phase 0.4: no isolates, so heavy
  work must not share the API's event loop.

### Build this phase
Cached catalog endpoint (measure p95 before/after and record it), rate limiter,
`erp-push` worker draining `PushAttempt`, nightly catalog sync, Bull Board mounted
behind an admin guard.

### Prove it
1. Cache-aside vs write-through — which did you pick and what does it cost you?
2. Sketch the stampede fix. What happens to request #2 while #1 holds the lock?
3. Your rate limiter must be atomic across 3 API pods. How?
4. A job is picked up but the worker dies mid-call to the ERP. Is the order lost, duplicated, or fine?

---

## Phase 7 — WebSockets (1 week)

### Choose the transport, and be able to defend it
- **SSE**: one-way server→client, plain HTTP, auto-reconnect built in, survives
  proxies. You already shipped SSE notifications in Erpesque — say so.
- **WebSocket**: bidirectional, lower per-message overhead, needs its own auth
  and reconnect logic.
- Order board wants server→client push *and* client acks/typing/presence →
  WebSocket. Say why in the README.

### Doing it correctly
- **Authenticate on handshake**, reject before the socket is established.
  A connected-then-authorized socket is a security bug.
- **Rooms per `accountId`** — a buyer must never receive another account's
  events. This is the security question you *will* be asked; the room key is the
  answer.
- **Redis adapter** so an event emitted on pod A reaches a client on pod B.
- Heartbeat/ping, reconnect with backoff, and **resume**: client sends the last
  event id, server replays the gap from a bounded Redis stream. Without this you
  silently lose events on every reconnect.
- Backpressure: drop or coalesce when a client is slow; never buffer unbounded.

### Build this phase
Rep order board (drafts appear live, claim/approve/reject with optimistic UI),
live stock deltas on catalog pages, approval status pushed to the buyer's tab,
presence showing which rep is looking at a draft.

### Prove it
1. Exactly where do you check the JWT for a WS connection, and what if it expires mid-session?
2. Three API pods, one buyer connected to pod 2. How does an event from pod 1 reach them?
3. Client reconnects after 40s offline. How do they not miss events?
4. When is SSE the better answer?

---

## Phase 8 — Docker, CI, deploy, observability (1 week)

### Dockerfile that isn't amateur hour
Multi-stage: deps → build → runtime on `node:22-alpine`. Non-root `USER`,
`.dockerignore`, only production deps in the final layer, Prisma engines copied
correctly, `HEALTHCHECK`, `dumb-init` or `--init` for signal handling. Compare
image sizes before/after and put the number in the README.

### Compose
Uncomment the services in `infra/docker-compose.yml`: web, api, worker, postgres,
redis, with healthchecks and `depends_on: condition: service_healthy`. Target:
fresh clone → `docker compose up` → working app with seed data.

### CI
`.github/workflows/ci.yml` is already scaffolded: typecheck → lint → test (with
postgres+redis services) → build. Add `prisma migrate deploy` on the deploy job
and a Playwright e2e job.

### Deploy
Vercel for `apps/web`; Fly.io or Railway for api + worker + managed Postgres +
Redis. Real domain, seeded demo credentials in the README.

### Observability
Structured logging with pino + a correlation id threaded from web → api → worker.
Sentry for errors. `/health` (liveness) vs `/ready` (deps reachable) — know the
difference and why Kubernetes needs both.

### Prove it
1. Why multi-stage, and what's actually in your final image?
2. Container ignores Ctrl-C. Why, and what fixes it?
3. Where do migrations run in your pipeline, and what happens if one fails mid-deploy?
4. Trace a single request's correlation id through all three processes.

---

## Phase 9 — Portfolio polish and interview prep (ongoing)

### The README does the interviewing when you're not in the room
Architecture diagram, the ownership boundary table, a **decision log** (why Nest
over Express, why Prisma over Drizzle, why outbox over direct call, why 30s
credit TTL), performance numbers, demo credentials, a 30-second GIF of the
submit→approve→push flow.

### E2E
Playwright: login → browse → add to cart → submit → rep approves → ERP push
verified. One test, the whole money path.

### Talking points you now own
- Multi-tenant/account isolation at three layers (guard, Prisma extension, WS room)
- Cache invalidation with an explicit staleness budget per key
- Transactional outbox + idempotency across a service boundary
- Realtime fan-out across horizontally scaled instances
- Polyglot integration: TypeScript service against a Rust API over OpenAPI

### The AI slice (bridges your other track)
One LLM feature: "what did Acme order last quarter?" → tool-calling over a
read-only reporting view, zod-validated tool arguments, streamed response, hard
row limits and an account-scoped `WHERE` the model cannot influence. Small
surface, high signal, and it makes you the "full-stack engineer who ships AI
features" rather than either one alone.

---

## Standing rules for the whole project

1. **No `any`.** `unknown` at boundaries, parse with zod, then flow typed.
2. **One schema, inferred types.** Never hand-write a type beside its validator.
3. **Money is Decimal.** End to end, including JSON transport (string, not number).
4. **Every ERP response is parsed and normalized once**, at the client module.
5. **Branch per phase feature, conventional commits, PR with a description** —
   the git history is part of the portfolio.
6. **Write the "why" down as you go** in the decision log. Reconstructing it at
   week 10 is miserable and it shows.
