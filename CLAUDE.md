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
refuse it too. A permission enforced only in this repo is a blocking defect.

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

## Layout

```
src/
├── app/(app)/<route>/     page.tsx · <screen>-client.tsx · components · __tests__
├── components/ui/         shadcn, re-themed
├── lib/                   api client, formatters, hooks
└── styles/globals.css     the token definitions
```

## Working

Use the `frontend-screen-scaffold` skill for a new screen and `add-feature` for any change. Add every
new route to `../docs/02-specs/route-registry.md` and
`../docs/06-manuals/shared/screens-to-manual-map.md` in the same change.

A PR touching `src/` must name its companion docs PR or CI fails.
