import type { ReactNode } from 'react';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { formatRupiah } from '@/lib/goals';
import {
  agentsCount, candidates, everyRow, missingWords, namesMissing, OWN_COPY, PROTOTYPE_COPY,
  type UnitDashboardView, type UnitPeriod,
} from '@/lib/unit-dashboard';

/**
 * The four tiles (`Overall.html:7241-7272`, CSS `:1556-1571`): *Your team*, *Direct Group production*,
 * *Potential Monthly Active Agents (Group)* and *Potential Recruits (Group)*, each over every row of the
 * roster below, as the prototype sums them (D-groups) — four across, two on a tablet, one on a phone.
 *
 * **On a unit below the reader** the words that would say *you* of somebody else name the unit's head
 * instead — *(including Sari Lestari)*, *Sari Lestari's unit* — as the title and the groups do (data
 * honesty): the reader is not in that unit.
 */
export function UnitTiles({ view, period }: { view: UnitDashboardView; period: UnitPeriod }) {
  const { team, directGroupProduction: production, potentialActive, potentialRecruits } = view.tiles;
  const own = view.head.isReader;
  const including = own ? 'you' : view.head.name;
  const missing = missingWords(production.missing, namesMissing(everyRow(view)));

  return (
    <div className="mb-3 mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      <Tile label={PROTOTYPE_COPY.yourTeam}>
        <p className={HEADLINE}>{agentsCount(team.total)}</p>
        <p className="text-sm text-muted">
          {team.direct} direct agents (including {including}) · {team.units} AAB units · {team.underUnits} agents under AABs
        </p>
      </Tile>

      <Tile label={PROTOTYPE_COPY.directGroupProduction}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2.5">
          <span className="flex items-start gap-1">
            <span className={production.actualMinor === null ? `${HEADLINE} text-muted` : HEADLINE}>
              {production.actualMinor === null
                ? OWN_COPY.notUploaded
                : production.targetMinor === null || production.targetMinor === 0
                  ? formatRupiah(production.actualMinor)
                  : `${formatRupiah(production.actualMinor)} / ${formatRupiah(production.targetMinor)}`}
            </span>
            {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
          </span>
          {production.attainmentPct !== null && production.actualMinor !== null && (
            <span className="whitespace-nowrap text-md font-bold text-navy-soft">{production.attainmentPct}%</span>
          )}
        </div>
        {production.attainmentPct !== null && production.actualMinor !== null && (
          // Its figures carry it; the bar is their picture (`.mini-progress`, `:7256`).
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-[4px] bg-navy/[0.08]">
            <div className="h-full rounded-[4px] bg-navy-soft" style={{ width: `${Math.min(100, production.attainmentPct)}%` }} />
          </div>
        )}
        {production.actualMinor === null && production.targetMinor !== null && production.targetMinor > 0 && (
          <p className="text-sm text-muted">of {formatRupiah(production.targetMinor)} target</p>
        )}
        {/* Every row with a target made its year before this month began (ADR-0047): no *of Rp 0*. */}
        {production.targetMinor === 0 && <p className="text-sm text-muted">{OWN_COPY.targetMade}</p>}
        {production.targetMinor === null && production.actualMinor !== null && (
          <p className="text-sm text-muted">{OWN_COPY.noGoal}</p>
        )}
        {/* Under *Last 7 days* the figures are this month's, and the tile says so (D-period). */}
        {period === '7d' && <p className="mt-1 text-sm text-muted">{OWN_COPY.thisMonth}</p>}
      </Tile>

      <Tile label={PROTOTYPE_COPY.potentialActiveTile}>
        <p className={HEADLINE}>{potentialActive.count} / {potentialActive.of} agents</p>
      </Tile>

      <Tile label={PROTOTYPE_COPY.potentialRecruitsTile}>
        <TeamRow label={own ? PROTOTYPE_COPY.yourUnitRecruits : `${view.head.name}’s unit`} value={candidates(potentialRecruits.yourUnit)} first />
        <TeamRow label={own ? PROTOTYPE_COPY.yourAabs : `${view.head.name}’s AABs`} value={candidates(potentialRecruits.aabs)} />
      </Tile>
    </div>
  );
}

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
