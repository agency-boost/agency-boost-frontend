import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';

/**
 * **The team views, as Home and Coaching read them** (P19.18-T4, T5; ADR-0271 §7, §9): the Unit Dashboard's four —
 * *Direct Unit · Grup langsung · Grup informal · Semua downline* — as `GET /home?scope=` and `GET /coaching/coachees?scope=`
 * take them. **The views offered and the default are the server's** (`scopes`); a screen draws them and never decides
 * them. The words are the Unit Dashboard's own (`unitDashboardMessages.views`), so the three pages name a view alike.
 */
import { TEAM_VIEWS, type TeamView } from './team-view-query';

export { scopeQuery, TEAM_VIEWS, type TeamView, type TeamViews } from './team-view-query';

/** The offered views as a picker's options, in the picker's order, each named in `language`. */
export function teamViewOptions(
  offered: readonly TeamView[], language: Language = SOURCE_LANGUAGE,
): { value: TeamView; label: string }[] {
  const t = messagesIn(unitDashboardMessages, language).views;
  return TEAM_VIEWS.filter((view) => offered.includes(view)).map((value) => ({ value, label: t[value] }));
}
