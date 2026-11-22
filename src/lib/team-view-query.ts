/**
 * **The team views as a read sends them** (P19.18-T4, T5; ADR-0271 §7, §9): the four views and `?scope=`, with no words.
 * Apart from `team-views.ts` so that `lib/coaching.ts` and `lib/home.ts` — read by every coaching page and Home — do not
 * pull the Unit Dashboard's message catalogue into their bundles (the 200 kB first-load budget,
 * `docs/02-specs/nfr/performance-and-scale.md`); the picker's labels stay in `team-views.ts`.
 */
export type TeamView = 'unit' | 'direct' | 'informal' | 'downline';

/** The four, in the picker's order. */
export const TEAM_VIEWS: readonly TeamView[] = ['unit', 'direct', 'informal', 'downline'];

/** The views a read offers, in the order drawn, and what a read without `scope` answers. */
export interface TeamViews {
  offered: TeamView[];
  default: TeamView;
}

/** `?scope=` as a read sends it: one of the four, or nothing — the server's default. */
export const scopeQuery = (scope: TeamView | null | undefined): string =>
  (scope && TEAM_VIEWS.includes(scope) ? `?scope=${scope}` : '');
