import { StatTile } from '@/components/ui/stat-tile';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { formatMonthLong, formatNumber, formatPercent, formatRupiahCompact, percentOf } from '@/lib/format';
import {
  everyRow, goalShare, missingWords, namesMissing, namesNewHires, newHireWords, splitMoney, totalNote,
  type UnitDashboardView, type UnitPeriod,
} from '@/lib/unit-dashboard';

/**
 * **The four stat tiles** (UI V1, UI-003; `unit-dashboard-mobile` screen 1, `unit-dashboard-desktop` *Overview*): the
 * shared `StatTile`, ~90px, a 12px label, one number with its unit small and grey, one row of chips — *Unit* first, then
 * *AAB*. **Two by two below 1024px** (a tablet keeps its 2×2, the labels new), **one row of four from 1024px**; no names
 * in a tile.
 *
 * | Tile | Number | Extra | Chips |
 * |---|---|---|---|
 * | *Tim Anda* | 12 agent | — | 4 langsung · 8 AAB |
 * | *Produksi Group* | Rp 333,5 jt | *54%* badge, the bar, *dari Rp 612,3 jt* | — |
 * | *Active Agent {Bulan}* | 4 dari 12 | the ring, *33%* (UI-013: out of manpower) | Unit 1/4 · AAB 3/8 |
 * | *Recruitment {Bulan}* | 2 kandidat | — | Unit 1 · AAB 1 |
 *
 * **Every figure is the server's** (`GET /unit/dashboard`'s `tiles`); the ring's share is the two figures it shows, by
 * the shared `percentOf`, whole (UI-080). The production's ⓘ still names who holds no figure and the new hires before a
 * first sale it leaves out (the report's *Don't change*: *missing-upload explanations behind ⓘ*). The month in two
 * labels is the office's, in full, in the figures' language.
 */
export function UnitTiles({ view, period }: { view: UnitDashboardView; period: UnitPeriod }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const { team, directGroupProduction: production, potentialActive: active, potentialRecruits } = view.tiles;
  const rows = everyRow(view);
  const month = formatMonthLong(view.month, figures);
  const number = (n: number) => formatNumber(n, {}, figures);

  const missing = totalNote(
    missingWords(production.missing, namesMissing(rows, language), language),
    newHireWords(team.newHires, namesNewHires(rows, language), language),
  );
  const held = production.actualMinor !== null;
  const money = held ? splitMoney(formatRupiahCompact(production.actualMinor!, {}, figures)) : null;
  const target = production.targetMinor;
  const sub = !held
    ? target !== null && target > 0 ? t.goal.ofTarget({ sum: formatRupiahCompact(target, {}, figures) }) : null
    : target === null ? t.own.noGoal
      : target === 0 ? t.own.targetMade
        : t.v1.of({ of: formatRupiahCompact(target, {}, figures) });
  const recruits = potentialRecruits.yourUnit + potentialRecruits.aabs;
  const productionHeading = (
    <span className="inline-flex items-center gap-1">
      <span>{t.v1.groupProduction}</span>
      {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
    </span>
  );

  return (
    <div data-unit-tiles="" className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
      <StatTile
        label={t.prototype.yourTeam}
        value={number(team.total)}
        unit={t.v1.agentUnit({ n: team.total })}
        chips={teamChips(team, language, figures)}
      />
      <StatTile
        label={productionHeading}
        value={money ? money.value : <span className="text-lg font-semibold text-muted">{t.own.notUploaded}</span>}
        unit={money?.unit ?? undefined}
        badge={held && production.attainmentPct !== null && target ? formatPercent(production.attainmentPct, {}, figures) : undefined}
        bar={goalShare({ ...production, set: target !== null })}
        sub={sub === null ? undefined : period === '7d' ? `${sub} · ${t.own.thisMonth}` : sub}
      />
      <StatTile
        label={t.v1.activeAgent({ month })}
        value={number(active.count)}
        unit={t.v1.of({ of: number(active.of) })}
        ring={{ percent: percentOf(active.count, active.of) }}
        chips={[
          { key: 'unit', label: <>{t.v1.scope.unit} <b>{number(active.unit.count)}</b>/{number(active.unit.of)}</> },
          { key: 'aab', label: <>{AAB} <b>{number(active.aab.count)}</b>/{number(active.aab.of)}</> },
        ]}
      />
      <StatTile
        label={t.v1.recruitment({ month })}
        value={number(recruits)}
        unit={t.v1.candidateUnit({ n: recruits })}
        chips={[
          { key: 'unit', label: <>{t.v1.scope.unit} <b>{number(potentialRecruits.yourUnit)}</b></> },
          { key: 'aab', label: <>{AAB} <b>{number(potentialRecruits.aabs)}</b></> },
        ]}
      />
    </div>
  );
}

/** *AAB*, a role, kept in both languages (§A.5). */
const AAB = kept('AAB');

/**
 * *Tim Anda*'s chips (UI-003; P18.95-T7 AC-1's line, row 19): *4 langsung · 8 AAB* — the head's own unit, the head
 * included, then every AAB unit with everybody in it, so the two add up to the number.
 */
export function teamChips(
  team: { direct: number; units: number; underUnits: number },
  language: Language = SOURCE_LANGUAGE,
  figures: Language = language,
) {
  const t = messagesIn(unitDashboardMessages, language);
  const number = (n: number) => formatNumber(n, {}, figures);
  return [
    { key: 'direct', label: <><b>{number(team.direct)}</b> {t.v1.direct}</> },
    { key: 'aab', label: <><b>{number(team.units + team.underUnits)}</b> {AAB}</> },
  ];
}

/** *4 direct · 8 under AABs*: the head's own unit, then every AAB unit beneath it, heads included (row 19). */
export const teamLine = (team: { direct: number; units: number; underUnits: number }, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(unitDashboardMessages, language).teamLine({ direct: team.direct, under: team.units + team.underUnits });
