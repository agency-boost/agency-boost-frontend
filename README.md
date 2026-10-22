# agency-boost-frontend

Next.js app for AgencyBoost, a multi-tenant SaaS for insurance agency offices (KPM).

**This repository is a submodule of the `agency-boost` superproject** (ADR-0009). It is a complete,
independent repository — branch, commit and push here normally.

The documentation that governs it lives in the superproject, one level up as `../docs/`, with the
working rules in `../.claude/`. Start at
[`../CLAUDE.md`](../CLAUDE.md) and [`frontend/CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · shadcn/ui re-themed · Vitest with
Testing Library and axe · hosted on Vercel.

Playwright end-to-end tests are planned (`../docs/03-engineering/testing-strategy.md`) but are not
in this repository yet, and Playwright is not a dependency.

## Setup

You need **Node 24** and **pnpm 10.33**. `package.json` pins both: `packageManager` names pnpm and
`engines.node` names Node. The same versions run here, in CI and on Vercel.

```bash
corepack enable            # once per machine: Corepack reads packageManager and supplies pnpm 10.33.0
pnpm install
cp .env.example .env.local # NEXT_PUBLIC_API_ORIGIN=http://localhost:3001, NEXT_PUBLIC_APP_ENV=development
pnpm dev                   # http://localhost:3000, against the API on :3001
```

The API is the backend submodule, and `../backend/README.md` explains how to run it. Next inlines
`NEXT_PUBLIC_*` values when it compiles, so after you edit `.env.local` you have to restart the dev
server. `../docs/03-engineering/local-development.md` covers the whole local setup.

| Script | What it does |
|---|---|
| `pnpm dev` | The dev server |
| `pnpm lint` · `pnpm typecheck` | ESLint over `src/` with no warnings allowed · `tsc --noEmit` |
| `pnpm test` · `pnpm test:coverage` | Vitest · the same with the coverage ratchet (80% global) |
| `pnpm build` | `next build` |
| `pnpm check:secrets` | Scans `.next/` for the seeded demo credentials; run it after a build |
| `pnpm vercel-build` | Vercel's build (below). It runs a real `next build`, and it refuses unless the environment is production's or staging's, so there is no reason to run it locally |

## The rules that bite here

- **Never commit from Claude** — it proposes a message; a human commits.
- **Tokens only.** `bg-[#F2994A]` fails review — see `../docs/02-specs/design-system/tokens.md`.
- **`../prototype/` is the visual target and is frozen.** Copy is verbatim, including Indonesian
  labels. Divergences are registered in `../docs/02-specs/design-system/prototype-parity.md`.
- **Role gating here is convenience, not control.** The API must refuse it too.
- Every state: loading, empty, error, permission-denied.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every pull request and on every push to `main` and `development`.
It uses Node 24, and pnpm comes from `packageManager`.

| Job | Runs |
|---|---|
| `quality` | Lint, typecheck, the tests, the coverage ratchet |
| `build` | A production build with `NEXT_PUBLIC_APP_ENV=demo`, the First Load JS budget (`scripts/check-bundle-size.mjs`), and `pnpm check:secrets` on that output |
| `audit` | `pnpm audit --audit-level high` |

`companion-pr.yml` also runs on pull requests. A PR that touches `src/` must name its superproject
PR, or say `docs:none` and give a reason.

**Vercel builds, and GitHub Actions tests.** The tests, the coverage ratchet and the bundle budget run
once, in Actions, on the pull request, before anything merges. Running them again inside the Vercel
build would cost build minutes, and a failure there would arrive only after the merge, as a failed
deployment. Vercel's build does the two things that depend on the deployment itself: it checks that
deployment's environment, and it scans that deployment's bundle for seeded credentials. Deployment
Checks (below) connect the two systems.

## Deployment (Vercel)

One Vercel project, on the Pro plan, linked to this repository. The runbook covers creating it, DNS
and every dashboard setting in order:
[`../docs/03-engineering/deployment-gcp.md`](../docs/03-engineering/deployment-gcp.md). The pipeline
as a whole is in [`../docs/03-engineering/ci-cd.md`](../docs/03-engineering/ci-cd.md). The
decisions are ADR-0152 (hosting), ADR-0154 (branches and release order) and ADR-0041 (the demo
accounts).

### Branches and domains

| Branch | Vercel environment | Domain |
|---|---|---|
| `main` | Production, the project's production branch | `agencyboost.id`. `www.agencyboost.id` redirects to the apex |
| `development` | Preview, with `staging.agencyboost.id` assigned to the branch | `staging.agencyboost.id` |
| any other branch | none | none |

**No other branch deploys, and there are no per-PR previews.** The API allows exactly one origin per
environment in `CORS_ORIGINS`: `https://agencyboost.id` for production and
`https://staging.agencyboost.id` for staging. A preview on `<hash>.vercel.app` would load and then
fail every API call. It would also be cross-site to the API, so the refresh cookie would never be
sent (see *Cookies* below), and it would put another copy of the staging demo panel on a URL nobody
manages. Pull requests are checked by CI, not by a deployment.

`vercel.json` enforces this with `git.deploymentEnabled`. JSON has no comments, so the reasoning is
written here:

```json
"deploymentEnabled": { "**": false, "main": true, "development": true }
```

- `"**": false` turns off every branch, and the two named branches turn themselves back on. Vercel
  deploys a branch that matches several rules if any one of them is `true`.
- The pattern must be `"**"`, not `"*"`. Vercel matches with minimatch, where `*` stops at a `/`, so
  `"*": false` would still deploy every `phase-NN/…` branch.

`scripts/lib/deploy-env.spec.mjs` pins this object, so a later "simplification" fails a test.

### Environment variables

Set in Vercel under Settings, then Environment Variables:

| Scope | `NEXT_PUBLIC_APP_ENV` | `NEXT_PUBLIC_API_ORIGIN` |
|---|---|---|
| Production | `production` | `https://api.agencyboost.id` |
| Preview, `development` branch | `staging` | `https://staging-api.agencyboost.id` |

Set both rows' values exactly as shown: no trailing slash, and no trailing newline from a pasted
value. The build refuses anything else. Scope the Preview pair to the `development` branch, not to
every preview.

Also set `ENABLE_EXPERIMENTAL_COREPACK=1` in both scopes. With it, Vercel installs the pnpm that
`packageManager` names. Without it, Vercel picks a pnpm version from the project's creation date.
A pnpm mismatch of that kind once left the backend's security overrides inert for nine days
(ADR-0041). Vercel takes the Node version from `engines.node` (`24.x`).

**These values are fixed when the bundle is built.** `next build` inlines every `NEXT_PUBLIC_*`
value into the JavaScript it ships, so changing one in the dashboard changes nothing until you
redeploy. For the same reason none of them may be secret: every browser receives them.

### What `scripts/vercel-build.mjs` checks

`vercel.json` sets the install command to `pnpm install --frozen-lockfile` and the build command to
`node scripts/vercel-build.mjs`, which runs three steps and fails the deployment if any one fails:

1. **The environment** (`scripts/lib/deploy-env.mjs`, with its spec beside it). Both variables must
   be set. A build is production if `VERCEL_ENV=production` or `NEXT_PUBLIC_APP_ENV=production`, and
   then it must have production's pair exactly. A build with `NEXT_PUBLIC_APP_ENV=staging` must have
   staging's pair exactly. Any other value is refused, `development` and `demo` included, because
   nothing else deploys from this project. The refusal names each wrong variable, its value and the
   value it should have.
2. **`next build`.**
3. **`check-no-demo-credentials.mjs`** on the build output, unless `NEXT_PUBLIC_APP_ENV` is
   `development` or `staging`. Those two builds keep the demo-accounts panel on purpose (ADR-0041),
   so the scan would fail them for being what they are. Every production build is scanned.

The First Load JS budget is checked in GitHub CI, not here.

The script reads the process environment that Vercel provides, not `.env.local`.

### Staging is public and not indexed

Staging is meant for testers who are not developers, and it runs only seeded data (plan D9).

- **Not indexed.** `next.config.mjs` sends `X-Robots-Tag: noindex` on every path of every build
  except `NEXT_PUBLIC_APP_ENV=production`, and `next.config.spec.mjs` pins that. Vercel adds its own
  noindex to preview deployment URLs, but leaves it off a custom domain assigned to a branch, which
  is exactly what `staging.agencyboost.id` is.
- **Public.** Vercel's default Deployment Protection, *Standard Protection*, puts every
  non-production domain behind a Vercel login, and that includes a branch domain. Add
  `staging.agencyboost.id` as a Deployment Protection Exception under Settings, then Deployment
  Protection. The generated deployment URLs stay protected.

### The CI gate is a person, not Deployment Checks

**Deployment Checks are not used** (ADR-0154). Vercel lists automatic production aliasing as a
prerequisite for them, and the release order below turns that aliasing off, so the two cannot be
combined. The gate is the promotion instead: every production deployment is staged until a person
promotes it.

- **Before you promote**, confirm on GitHub that the commit's `ci` checks (`quality`, `build`,
  `audit`) are green and that the backend's production deploy succeeded. Never use *Force Promote*.
- **Staging has no gate.** It serves a `development` push as soon as Vercel's build finishes,
  whatever CI says; CI still runs on that push, so a red check is visible beside it.

### Release order: backend first, then promote the frontend

Turn off **Auto-assign Custom Production Domains** (Settings, then Environments, then Production,
then Branch Tracking). A merge to `main` then produces a *staged* production deployment, and
`agencyboost.id` keeps serving the old one until someone promotes the new one.

1. Merge the backend's release PR (`development` into `main`). Its `deploy.yml` deploys
   `api.agencyboost.id` and runs the smoke test.
2. Merge this repository's release PR (`development` into `main`). Vercel builds and stages the
   production deployment.
3. Once the new API is live and `ci` is green on the frontend commit, **Promote** the staged
   deployment. Promotion does not rebuild: what goes live is the build that was checked.

The order matters because the API serves `v1` and keeps its changes additive
(`../docs/02-specs/api/conventions.md`). A new API under the old frontend is therefore a safe
in-between state, but a new frontend calling an endpoint the old API lacks is not. To roll back, use
Vercel's **Instant Rollback** to the previous production deployment.

Staging has no promotion step, so on staging the order is simply the order in which the two
`development` pushes land.

### Domains

- `agencyboost.id` is the production domain. The apex uses the A record Vercel provides.
- `www.agencyboost.id` redirects to `agencyboost.id`.
- `staging.agencyboost.id` is assigned to the `development` branch.
- `<project>.vercel.app` redirects to `agencyboost.id`, so the app is reachable on one production
  origin only: the one in the API's CORS list.

### Cookies

All four hosts, `agencyboost.id`, `staging.agencyboost.id`, `api.agencyboost.id` and
`staging-api.agencyboost.id`, share the registrable domain `agencyboost.id`. Calls between them are
therefore same-site, and the refresh cookie stays `SameSite=Lax` (`COOKIE_CROSS_SITE=false` on the
API). A frontend on any other registrable domain, such as `*.vercel.app`, would be cross-site to the
API. The browser would never send the cookie, so a user would appear to sign in and then be signed
out on every reload (`../docs/02-specs/api/auth-and-sessions.md`, *A deployment constraint the tests
cannot catch*).

Being same-site has a cost: the browser treats staging and production as one site, so a page on
`staging.agencyboost.id` sends production's cookie along with its requests to `api.agencyboost.id`.
To prevent that, the API refuses `/auth/refresh` and `/auth/logout` when they carry an `Origin`
outside its CORS list.

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

Phases 1 through 18.6 are built: every role's screens, each wired to the API. Phase 18.7, which sets
up environments and deployment (this Vercel setup among them), is in progress. Phase 19, hardening
and go-live, comes next. Production is being prepared *dark*, with no tenant on it, until P19-T7.
The roadmap is in `../docs/05-delivery/roadmap-and-phases.md`.
