# OrderDesk

Self-serve B2B ordering portal for wholesale buyers, backed by an existing Rust
ERP (Erpesque). Buyers browse a live catalog and order against their credit
limit; sales reps work a realtime approval board. Confirmed orders are pushed
into the ERP through a transactional outbox with idempotency.

> Status: scaffold. Built phase by phase — see `docs/TASKS.md`.

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js (App Router, RSC), React, Tailwind, shadcn/ui |
| API | NestJS, TypeScript |
| Data | PostgreSQL + Prisma |
| Cache / queues | Redis, BullMQ |
| Realtime | WebSockets with a Redis adapter |
| Infra | Docker Compose, GitHub Actions |
| Upstream | Erpesque Rust/Axum API over its OpenAPI contract |

## Layout

```
apps/web        Next.js buyer portal + rep console
apps/api        NestJS API + BullMQ worker
packages/ui     shadcn-based component kit
packages/contracts  zod schemas, branded types, money — shared by web and api
packages/db     Prisma schema, migrations, seed
infra/          docker-compose, Dockerfiles
docs/           SPEC.md, CURRICULUM.md, TASKS.md, decisions/
```

## Getting started

```bash
cp .env.example .env      # fill in ERP service credentials
pnpm install
pnpm db:up                # Postgres :5433, Redis :6380
pnpm dev
```

Ports are shifted off the defaults so this stack runs beside the Erpesque Rust
API's own Postgres on 5432.

## Docs

- **[docs/SPEC.md](docs/SPEC.md)** — domain model, ERP ownership boundary, integration contract, core flows
- **[docs/CURRICULUM.md](docs/CURRICULUM.md)** — the 10-week learning path behind the build
- **[docs/TASKS.md](docs/TASKS.md)** — phase-by-phase task list
- **docs/decisions/** — decision log (added as decisions get made)

## Design notes

**OrderDesk does not duplicate the ERP.** The ERP owns items, stock, ledgers and
invoices; OrderDesk owns only what has no ERP equivalent — buyer logins, price
lists, carts and the pre-order approval workflow. ERP data is cached with an
explicit `syncedAt` and never treated as authoritative. Full table in the spec.

**Order push is an outbox, not a call.** Approving a draft writes the draft and a
`PushAttempt` row with a deterministic idempotency key in one transaction; a
worker drains it. An ambiguous timeout can never produce two ERP orders.

**Credit limits are checked against live ERP exposure** (30s TTL) plus local open
drafts counted inside the submitting transaction, so concurrent submissions
cannot both slip under the limit.
