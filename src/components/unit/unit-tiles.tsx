import { StatTile } from '@/components/ui/stat-tile';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { formatMonthLong, formatMonthName, formatNumber, formatPercent, formatRupiahCompact, percentOf } from '@/lib/format';
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
 * | *Produksi Group* | Rp 333,5 Jt | *54%* badge, the bar, *dari Rp 612,3 Jt* | — |
 * | *Active Agent {Bulan}* | 4 dari 12 | the ring, *33%* (UI-013: out of manpower) | Unit 1/4 · AAB 3/8 |
 * | *Recruitment {Bulan}* | 2 kandidat | — | Unit 1 · AAB 1 |
 *
 * **Every figure is the server's** (`GET /unit/dashboard`'s `tiles`); the ring's share is the two figures it shows, by
 * the shared `percentOf`, whole (UI-080). The production's ⓘ still names who holds no figure and the new hires before a
 * first sale it leaves out (the report's *Don't change*: *missing-upload explanations behind ⓘ*). The month in two
 * labels is the office's, in full, in the figures' language — **on a phone a 12px grey chip of it, *Nov***, as the
 * owner's mobile mockup draws both labels (P19.8-T4, `unit-mobile-stopmotion-2026-11-07`; MOB UI-167's chip on Home).
 *
 * **An empty unit** (P19.8-T4 AC-11, MOB UI-181; ADR-0229 §9): *Active Agent* reads ***0 dari –*** as Home does, with *–*
 * in its ring and its chips (*Unit 0/–*, *AAB 0/–*), where it read *0 dari 0*.
 *
 * **An AB below is never an AAB** (the client's message of 11 November 2026, item 5; ADR-0249 §3): the *AAB* chips count
 * the head's *Grup langsung* only, and while the view holds anybody outside it — *Grup informal*, *Semua downline* — a
 * third chip, ***AB***, counts them, on all three tiles. The chips add up to each tile's number.
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
  const recruits = potentialRecruits.yourUnit + potentialRecruits.aabs + potentialRecruits.abs;
  // ADR-0249 §3: the *AB* chip, while the view holds somebody outside the head's *Grup langsung*.
  const withAb = team.ab > 0;
  // Nobody to count (MOB UI-181): *–*, never a denominator of 0.
  const of = (n: number) => (view.empty ? '–' : number(n));
  const short = formatMonthName(view.month, figures);
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
        label={<MonthLabel short={t.v1.activeAgentShort} month={short} long={t.v1.activeAgent({ month })} />}
        value={number(active.count)}
        unit={t.v1.of({ of: of(active.of) })}
        ring={{ percent: view.empty ? null : percentOf(active.count, active.of) }}
        chips={[
          { key: 'unit', label: <>{t.v1.scope.unit} <b>{number(active.unit.count)}</b>/{of(active.unit.of)}</> },
          { key: 'aab', label: <>{AAB} <b>{number(active.aab.count)}</b>/{of(active.aab.of)}</> },
          ...(withAb ? [{ key: 'ab', label: <>{AB} <b>{number(active.ab.count)}</b>/{of(active.ab.of)}</> }] : []),
        ]}
      />
      <StatTile
        label={<MonthLabel short={t.v1.recruitmentShort} month={short} long={t.v1.recruitment({ month })} />}
        value={number(recruits)}
        unit={t.v1.candidateUnit({ n: recruits })}
        chips={[
          { key: 'unit', label: <>{t.v1.scope.unit} <b>{number(potentialRecruits.yourUnit)}</b></> },
          { key: 'aab', label: <>{AAB} <b>{number(potentialRecruits.aabs)}</b></> },
          ...(withAb ? [{ key: 'ab', label: <>{AB} <b>{number(potentialRecruits.abs)}</b></> }] : []),
        ]}
      />
    </div>
  );
}

/**
 * **A tile's label and its month** (the Unit mockup, `unit-mobile-stopmotion-2026-11-07`): on a phone one line — *Active
 * Agent* and a 12px grey chip, *Nov* — as Home's (MOB UI-167); from 768px *Active Agent November*, as before. A screen
 * reader hears the month in full at every size.
 */
function MonthLabel({ short, month, long }: { short: string; month: string; long: string }) {
  return (
    <>
      <span data-label-short="" aria-hidden="true" className="inline-flex items-center gap-1 whitespace-nowrap md:hidden">
        {short}
        <span data-month-chip="" className="rounded-pill bg-hover-row px-[7px] text-sm font-semibold text-muted">{month}</span>
      </span>
      <span data-label-long="" className="max-md:sr-only">{long}</span>
    </>
  );
}

/** *AAB* and *AB*, roles, kept in both languages (§A.5). */
const AAB = kept('AAB');
const AB = kept('AB');

/**
 * *Tim Anda*'s chips (UI-003; P18.7-T7 AC-1's line, row 19): *4 langsung · 8 AAB* — the head's own unit, the head
 * included, then the rest of their *Grup langsung* — and ***· 3 AB*** while the view holds anybody outside it (ADR-0249
 * §3): an AB below and their people. **An AB is never counted as an AAB.** The chips add up to the number.
 */
export function teamChips(
  team: { direct: number; aab: number; ab: number },
  language: Language = SOURCE_LANGUAGE,
  figures: Language = language,
) {
  const t = messagesIn(unitDashboardMessages, language);
  const number = (n: number) => formatNumber(n, {}, figures);
  return [
    { key: 'direct', label: <><b>{number(team.direct)}</b> {t.v1.direct}</> },
    { key: 'aab', label: <><b>{number(team.aab)}</b> {AAB}</> },
    ...(team.ab > 0 ? [{ key: 'ab', label: <><b>{number(team.ab)}</b> {AB}</> }] : []),
  ];
}

/** *4 direct · 8 under AABs*: the head's own unit, then the rest of their *Grup langsung*, heads included (row 19). */
export const teamLine = (team: { direct: number; aab: number }, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(unitDashboardMessages, language).teamLine({ direct: team.direct, under: team.aab });
