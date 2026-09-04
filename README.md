# agency-boost-frontend

Next.js app for AgencyBoost, a multi-tenant SaaS for insurance agency offices (KPM).

**This repository is a submodule of the `agency-boost` superproject** (ADR-0009). It is a complete,
independent repository — branch, commit and push here normally.

The documentation that governs it lives in the superproject, one level up as `../docs/`, with the
working rules in `../.claude/`. Start at
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

## Working as a submodule

Day-to-day development is unchanged. The one addition: after pushing here, the superproject needs a
**pointer bump** so it records which commit of this repository belongs with the current docs.

```bash
# here
git commit -m "feat(...): …" && git push

# in the superproject
cd .. && git add frontend && git commit -m "chore(frontend): bump pointer to <sha>"
```

Merge the PR here first, then the superproject bump — a pointer to a commit that only exists on a
deleted feature branch breaks every fresh clone.

## Status

Scaffolding only. Implementation begins at Phase 1 —
see `../docs/05-delivery/phases/phase-01-engineering-foundation.md`.
