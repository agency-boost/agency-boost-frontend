# AgencyBoost — frontend

Next.js app for a multi-tenant SaaS. **This is a git submodule** of the `agency-boost` superproject (ADR-0009) — a complete, independent repository
(`agency-boost-frontend`). The documentation that governs it lives in the docs repo one level up:
`../docs/`, with the working rules in `../.claude/`.

Read `../CLAUDE.md` first. In particular:

- **[Never commit](../.claude/rules/no-auto-commit.md)** — propose a message; the user commits.
- **[Docs and tests ship with the change](../.claude/rules/docs-and-tests-required.md)**.

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui, re-themed to the project tokens ·
Vitest · Playwright.

## The rules that bite here

**Tokens only.** Colours, spacing, radii and type come from the Tailwind theme mapped to CSS custom
properties in `globals.css`. A raw hex value in a component — `bg-[#F2994A]` — fails review. See
`../docs/02-specs/design-system/tokens.md`.

**The prototype is the visual target.** `../prototype/` is frozen. Copy is reproduced **verbatim**,
including Indonesian labels. Any divergence is registered in
`../docs/02-specs/design-system/prototype-parity.md`; an unregistered one is a defect. Use the
`prototype-parity-check` skill before handing off a screen.

**Role gating here is convenience, not control.** Hide what a role cannot use — but the API must
refuse it too. A permission enforced only in this repo is a blocking defect. `RequireSession` and
`useCan` decide what to *render*; the server decides what happens.

**The access token lives in memory and nowhere else.** Never `localStorage`, never `sessionStorage`,
never a non-httpOnly cookie — any XSS reads all three. The refresh token is an httpOnly cookie the
browser sends on its own; a reload re-authenticates through `/auth/refresh` without script ever
touching it. This is why navigation uses `next/link`: a full page load drops the token and costs a
refresh round-trip before the first request on the next screen.

**Impersonation suppresses the transparent 401 retry.** The refresh cookie belongs to the real Super
Admin, so refreshing during a support session would replay the request as *them*. See
`src/lib/api-client.ts` and `../docs/02-specs/api/auth-and-sessions.md`.

**Every state.** Loading, empty, error, permission-denied, and conditional visibility. The prototypes
have almost none of these; each flow doc lists what is missing for its screen.

**Accessibility.** Keep the amber focus ring; never `outline: none` without a replacement. Role
colour is never the only cue — badges always carry their text label.

**Responsive.** Wide tables scroll inside their own container; the page body never scrolls
horizontally. The agent's daily loop must work on a mid-range Android phone over 4G — that is the
performance budget.

**Formatters are shared.** Money and tenant-timezone dates go through the shared helpers. Never
re-implement one; the prototype has three inconsistent currency formats and that is a defect list,
not a pattern.

**Errors go through `toDisplayError`.** Three outcomes, and they send the reader to three different
places: the server said no, the app is misconfigured, the request never arrived. Collapsing the last
two — which every screen did while this was an inline ternary — points whoever hits a missing
environment variable at a backend that is running perfectly.

**Hiding is not excluding.** A runtime guard keeps something off the screen; it does not keep it out
of the bundle. Anything that must not ship needs a literal `process.env.<VAR> === '...'` comparison
the compiler can fold away, plus a check on the build output. See `src/lib/demo-accounts.ts` and
`scripts/check-no-demo-credentials.mjs` — the first version of that panel was correctly hidden and
still shipped its credentials.

Key it on `NEXT_PUBLIC_APP_ENV`, not `NODE_ENV`: `next build` sets `NODE_ENV=production` for *every*
deployment, so it cannot tell staging from production and gating on it means "not a dev server"
rather than "not public" (ADR-0041).

## Layout

```
src/
├── app/(group)/<route>/      one group per application — (auth) (agent) (tenant) (admin)
│   ├── layout.tsx            renders that family's shell; the chrome lives here, not in pages
│   └── page.tsx              the screen, with page.spec.tsx beside it
├── app/<route>/page.tsx      cross-family routes only — /, /join, /notifications, /profile.
│                             These render RoleShell, which picks the chrome by the reader
├── app/screens.a11y.spec.tsx every screen through axe, in its populated state
├── components/               app-shell, admin-shell, session-provider, require-session
├── components/ui/            the primitives — field, data-table, status-pill, role-badge, skeleton
│                             every wait is a Skeleton shaped like what is coming, never `Loading…`
├── lib/                      api.ts (URLs) · api-client.ts (fetch, tokens) · session.ts · admin.ts
└── styles/globals.css        the token definitions
test/
├── setup.ts                  jest-dom, and the API origin every test needs
└── harness.tsx               renderWithSession · stubFetch · routeParams · makeMe
```

Tests live beside what they test. `test/harness.tsx` holds the doubles: a session provider, a
URL-routed `fetch` stub, and `routeParams`, which builds the settled thenable `use(params)` needs —
a bare `Promise.resolve` suspends and never resumes under jsdom, and the failure reads as a missing
element rather than a missing boundary.

## Working

Use the `frontend-screen-scaffold` skill for a new screen and `add-feature` for any change. Add every
new route to `../docs/02-specs/route-registry.md` and
`../docs/06-manuals/shared/screens-to-manual-map.md` in the same change.

A PR touching `src/` must name its companion docs PR or CI fails.

Before handing off:

```bash
pnpm lint && pnpm typecheck && pnpm test:coverage
pnpm build | node scripts/check-bundle-size.mjs
```
