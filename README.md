# agency-boost-frontend

Next.js app for AgencyBoost, a multi-tenant SaaS for insurance agency offices (KPM).

**The documentation that governs this repository lives in `agency-boost-docs`**, checked out one
level up as `../docs/`, with the working rules in `../.claude/`. Start at
[`../CLAUDE.md`](../CLAUDE.md) and [`frontend/CLAUDE.md`](CLAUDE.md).

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui re-themed · Vitest · Playwright

## Setup

See `../docs/03-engineering/local-development.md`. In short:

```bash
pnpm install
cp .env.example .env.local
pnpm dev                  # http://localhost:3000
```

## The rules that bite here

- **Never commit from Claude** — it proposes a message; a human commits.
- **Tokens only.** `bg-[#F2994A]` fails review — see `../docs/02-specs/design-system/tokens.md`.
- **`../prototype/` is the visual target and is frozen.** Copy is verbatim, including Indonesian
  labels. Divergences are registered in `../docs/02-specs/design-system/prototype-parity.md`.
- **Role gating here is convenience, not control.** The API must refuse it too.
- Every state: loading, empty, error, permission-denied.

## Status

Scaffolding only. Implementation begins at Phase 1 —
see `../docs/05-delivery/phases/phase-01-engineering-foundation.md`.
