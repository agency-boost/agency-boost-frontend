import type { ReactNode } from 'react';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { formatPercent, formatRupiahCompact, formatRupiahCompactPair } from '@/lib/format';
import {
  agentsCount, candidates, everyRow, missingWords, namesMissing, namesNewHires, newHireWords,
  totalNote, type UnitDashboardView, type UnitPeriod,
} from '@/lib/unit-dashboard';

/**
 * The four tiles (`Overall.html:7241-7272`, CSS `:1556-1571`): *Your team*, *Direct Group production*,
 * *On pace to be active (Group)* (the prototype's *Potential Monthly Active Agents (Group)*, in plain words since
 * P18.95-T9 AC-4) and *Potential Recruits (Group)*, each over every row of the
 * roster below, as the prototype sums them (D-groups) — four across, two on a tablet, one on a phone.
 *
 * **On a unit below the reader** the words that would say *you* of somebody else name the unit's head
 * instead — *(including Sari Lestari)*, *Sari Lestari's unit* — as the title and the groups do (data
 * honesty): the reader is not in that unit.
 *
 * **Its words are the catalogue's** (`messages/unit-dashboard.ts`, P18.98-T4), its figures in `useFigureLanguage()`'s.
 */
export function UnitTiles({ view, period }: { view: UnitDashboardView; period: UnitPeriod }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const { team, directGroupProduction: production, potentialActive, potentialRecruits } = view.tiles;
  const own = view.head.isReader;
  const rows = everyRow(view);
  /*
   * **The new hires before a first sale both figures leave out** (P18.96-T5 AC-4; ADR-0172 §2): in *Your team*, and named
   * in the production's ⓘ beside who holds no figure, and in an ⓘ of *On pace*'s own — its `of` no longer every row.
   */
  const newHires = newHireWords(team.newHires, namesNewHires(rows, language), language);
  const missing = totalNote(missingWords(production.missing, namesMissing(rows, language), language), newHires);

  return (
    <div className="mb-3 mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      <Tile label={t.prototype.yourTeam}>
        <p className={HEADLINE}>{agentsCount(team.total, language)}</p>
        {/*
          * **The client's line, at every size** (P18.95-T7 AC-1, grey text row 19; ADR-0167 §7): *4 direct · 8 under
          * AABs*, where it read *"4 direct agents (including you) · 3 AAB units · 5 agents under AABs"*. Under AABs is
          * every AAB unit with its head — the units and everybody in them — so the two parts add up to the headline.
          */}
        {/* *AAB*'s first appearance on the dashboard, so its ⓘ is here (P18.95-T9 AC-3; UI-028). */}
        <p className="text-sm text-muted">{teamLine(team, language)} <TermTip term="AAB" /></p>
      </Tile>

      <Tile label={t.prototype.directGroupProduction}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2.5">
          <span className="flex items-start gap-1">
            <span className={production.actualMinor === null ? `${HEADLINE} text-muted` : HEADLINE}>
              {production.actualMinor === null
                ? t.own.notUploaded
                : production.targetMinor === null || production.targetMinor === 0
                  ? formatRupiahCompact(production.actualMinor, {}, figures)
                  : formatRupiahCompactPair(production.actualMinor, production.targetMinor, '/', figures)}
            </span>
            {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
          </span>
          {production.attainmentPct !== null && production.actualMinor !== null && (
            <span className="whitespace-nowrap text-md font-bold text-navy-soft">{formatPercent(production.attainmentPct, {}, figures)}</span>
          )}
        </div>
        {production.attainmentPct !== null && production.actualMinor !== null && (
          // Its figures carry it; the bar is their picture (`.mini-progress`, `:7256`).
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-[4px] bg-navy/[0.08]">
            <div className="h-full rounded-[4px] bg-navy-soft" style={{ width: `${Math.min(100, production.attainmentPct)}%` }} />
          </div>
        )}
        {production.actualMinor === null && production.targetMinor !== null && production.targetMinor > 0 && (
          <p className="text-sm text-muted">{t.goal.ofTarget({ sum: formatRupiahCompact(production.targetMinor, {}, figures) })}</p>
        )}
        {/* Every row with a target made its year before this month began (ADR-0047): no *of Rp 0*. */}
        {production.targetMinor === 0 && <p className="text-sm text-muted">{t.own.targetMade}</p>}
        {production.targetMinor === null && production.actualMinor !== null && (
          <p className="text-sm text-muted">{t.own.noGoal}</p>
        )}
        {/* Under *Last 7 days* the figures are this month's, and the tile says so (D-period). */}
        {period === '7d' && <p className="mt-1 text-sm text-muted">{t.own.thisMonth}</p>}
      </Tile>

      <Tile label={t.prototype.potentialActiveTile}>
        <span className="flex items-start gap-1">
          <span className={HEADLINE}>{t.agentsOf({ count: potentialActive.count, of: potentialActive.of })}</span>
          {newHires && <TippedGlyph glyph="ⓘ" name={newHires} tip={newHires} align="fit" className="-my-1" />}
        </span>
      </Tile>

      <Tile label={t.prototype.potentialRecruitsTile}>
        <TeamRow
          label={own ? t.prototype.yourUnitRecruits : t.unitLower({ name: view.head.name })}
          value={candidates(potentialRecruits.yourUnit, language)}
          first
        />
        <TeamRow label={own ? t.prototype.yourAabs : t.aabsOf({ name: view.head.name })} value={candidates(potentialRecruits.aabs, language)} />
      </Tile>
    </div>
  );
}

/** *4 direct · 8 under AABs*: the head's own unit, then every AAB unit beneath it, heads included (row 19). */
export const teamLine = (team: { direct: number; units: number; underUnits: number }, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(unitDashboardMessages, language).teamLine({ direct: team.direct, under: team.units + team.underUnits });

/** `.tile-headline` (`:1560`): 19px Manrope, navy. */
const HEADLINE = 'mb-0.5 font-display text-[1.1875rem] font-bold text-navy';

/** `.tile` (`:1557-1559`): a card at least 126px tall, its label in small grey capitals, its body centred. */
function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[126px] min-w-0 flex-col rounded-lg border border-hairline bg-card px-[18px] py-4">
      <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/** `.team-row` (`:1569-1571`): a label and its figure, ruled between. */
function TeamRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <p className={`flex items-center justify-between gap-2 py-1.5 text-sm text-muted ${first ? 'pt-0' : 'border-t border-hairline'}`}>
      <span>{label}</span>
      <strong className="font-body text-lg font-bold text-navy">{value}</strong>
    </p>
  );
}
