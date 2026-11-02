'use client';

import { useId, useState } from 'react';
import { RoleBadge } from '@/components/ui/role-badge';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { formatRupiahCompact } from '@/lib/format';
import {
  leftOutWords, markerAt, ofTarget, projectedWords, RANKING_SHOWN, showingWords,
  targetLegend, unitNums, type OverviewAabUnit, type OverviewAgency, type OverviewProduction,
} from '@/lib/kpm-overview';
import { Bar, FILL_TONE, OverviewCard, Pct, PctPill, TEXT_TONE, useTone } from './parts';

/**
 * *Production — this year* (`KPM_Owner.html:1075-1220`, CSS `:533-563`): the office's APE so far against
 * the sum of its members' goals (OD-143), *"Rp {achieved} of Rp {target} target"* in the product's compact money
 * formatter (*Rp 8,4 M*, ADR-0167 §1) — never the prototype's *8.4B* — the bar, the projection marker, and *Units furthest behind
 * target*.
 *
 * **The projection is a run-rate** (D-figures): the year to date as of the latest month held ÷ that month's
 * number × 12, the server's — a missing month before it is already in the carrier's year to date. It is not drawn until a month of the year is held, and the marker sits where it falls against
 * the target, its label above it.
 *
 * **No figure is 0 for want of data.** A year with no file says *Not uploaded yet*, a target nobody set says
 * so, and the total names in its tooltip the months and the members it leaves out (Phase 15's rule).
 */
export function Production({ production }: { production: OverviewProduction }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const tone = useTone();
  const { ytd, projectionMinor, agencies } = production;
  const left = leftOutWords(ytd, language, figures);
  const marker = markerAt(projectionMinor, ytd.targetMinor);
  const showBar = ytd.pct !== null && ytd.targetMinor !== null && ytd.targetMinor > 0;

  return (
    <OverviewCard className="p-5">
      {/* Each piece wraps on its own: on a phone the line breaks rather than pushing the card past the screen. */}
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('font-body text-2xl font-bold sm:text-3xl', ytd.achievedMinor === null ? 'text-muted' : 'text-navy')}>
          {ytd.achievedMinor === null ? t.notUploaded : formatRupiahCompact(ytd.achievedMinor, {}, figures)}
        </span>
        {left && <TippedGlyph glyph="ⓘ" name={left} tip={left} align="fit" className="-my-1 self-center" />}
        <span className="text-md text-muted">
          {ytd.targetMinor === null ? t.noGoal : ofTarget(ytd.targetMinor, language, figures)}
        </span>
        {ytd.pct !== null && <PctPill pct={ytd.pct} className="ml-auto" />}
      </div>

      {showBar && ytd.targetMinor !== null && (
        <div className="mt-1">
          {marker !== null && projectionMinor !== null && (
            // The label above the marker (`:1087`), on the side of it with room: in flow, so on a phone it
            // wraps inside the card rather than running off it.
            <p
              className={cn('mb-1 text-2xs font-bold text-navy', marker > 50 ? 'text-right' : 'text-left')}
              style={marker > 50 ? { paddingRight: `${100 - marker}%` } : { paddingLeft: `${marker}%` }}
            >
              {projectedWords(projectionMinor, language, figures)}
            </p>
          )}
          <div className="relative">
            <Bar pct={ytd.pct ?? 0} fill={tone(ytd.pct) === 'alert' ? 'bg-alert' : 'bg-amber'} height="wide" />
            {marker !== null && (
              <span aria-hidden="true" className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-navy" style={{ left: `${marker}%` }} />
            )}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
            <span>0</span>
            <span>{targetLegend(ytd.targetMinor, language, figures)}</span>
          </div>
        </div>
      )}
      {/* Without a target there is no bar to place it on; the projection is still a figure. */}
      {!showBar && projectionMinor !== null && (
        <p className="text-xs font-bold text-navy">{projectedWords(projectionMinor, language, figures)}</p>
      )}

      <div className="mt-[18px] border-t border-hairline pt-3.5">
        <h3 className="mb-0.5 text-base font-bold text-navy">{t.unitsTitle}</h3>
        <p className="mb-3 text-xs text-muted">{t.unitsSub}</p>
        <Units agencies={agencies} />
      </div>
    </OverviewCard>
  );
}

/**
 * The agencies lowest by attainment, as the server orders them (D-units; a figure not held sorts last),
 * four shown and the rest in place behind *view full ranking →* (D-coverage).
 */
function Units({ agencies }: { agencies: OverviewAgency[] }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const listId = useId();
  if (agencies.length === 0) return <p className="text-base text-muted">{t.noUnits}</p>;
  const shown = all ? agencies : agencies.slice(0, RANKING_SHOWN);
  const toggle = (id: string) => setOpen((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <>
      <ul id={listId}>
        {shown.map((agency) => (
          <AgencyRow key={agency.membershipId} agency={agency} open={open.has(agency.membershipId)} onToggle={() => toggle(agency.membershipId)} />
        ))}
      </ul>
      {agencies.length > RANKING_SHOWN && (
        <p className="mt-2.5 text-sm text-muted">
          {showingWords(shown.length, agencies.length, language)}
          <button
            type="button"
            aria-expanded={all}
            aria-controls={listId}
            onClick={() => setAll((was) => !was)}
            className="font-semibold text-amber-ink underline-offset-2 hover:underline"
          >
            {all ? t.showFewer : t.viewFullRanking}
          </button>
        </p>
      )}
    </>
  );
}

/**
 * `.unit-row` (`:544-561`): the whole row is the prototype's click target, so it is one button saying
 * whether it is open, its name, its percentage and *"Rp {a} / Rp {t} unit target"* its accessible name.
 */
function AgencyRow({ agency, open, onToggle }: { agency: OverviewAgency; open: boolean; onToggle: () => void }) {
  const t = useMessages(kpmOverviewMessages);
  const toneFor = useTone();
  const childId = useId();
  const tone = toneFor(agency.pct);
  return (
    <li className="border-b border-hairline py-[9px] last:border-b-0">
      <button type="button" aria-expanded={open} aria-controls={childId} onClick={onToggle} className="block w-full text-left">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="w-3 flex-none text-2xs text-muted">{open ? '▾' : '▸'}</span>
          <span className="min-w-0 flex-1 text-md font-semibold text-navy">
            {agency.name} <RoleBadge role="AB" className="ml-[3px] align-middle" />
          </span>
          <span className={cn('flex-none text-base font-bold', TEXT_TONE[tone])}><Pct pct={agency.pct} /></span>
        </span>
        <UnitFigures money={agency} agency className="pl-5" />
      </button>
      <div id={childId} hidden={!open} className="ml-5 mt-[9px] border-l-[1.5px] border-hairline pl-5">
        {agency.aabUnits.length === 0 ? (
          <p className="py-[7px] pl-2 text-base font-medium text-navy">
            {t.noAab}{' '}
            <span aria-hidden="true" className="ml-[3px] inline-flex rounded-pill bg-role-aab/15 px-2 py-0.5 text-2xs font-bold text-navy-soft">—</span>
          </p>
        ) : (
          <ul>
            {agency.aabUnits.map((unit) => <AabRow key={unit.membershipId} unit={unit} />)}
          </ul>
        )}
      </div>
    </li>
  );
}

/** `.unit-row-sub` (`:559-561`): an AAB's unit inside the agency. */
function AabRow({ unit }: { unit: OverviewAabUnit }) {
  const toneFor = useTone();
  const tone = toneFor(unit.pct);
  return (
    <li className="py-[7px] pl-2">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-base font-medium text-navy">
          {unit.name} <RoleBadge role="AAB" className="ml-[3px] align-middle" />
        </span>
        <span className={cn('flex-none text-base font-bold', TEXT_TONE[tone])}><Pct pct={unit.pct} /></span>
      </span>
      <UnitFigures money={unit} agency={false} />
    </li>
  );
}

/** `.unit-row-bottom` (`:553-556`): the figures, and the bar where there is a percentage to draw. */
function UnitFigures({
  money,
  agency,
  className,
}: {
  money: Pick<OverviewAgency, 'achievedMinor' | 'targetMinor' | 'pct'>;
  agency: boolean;
  className?: string;
}) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const tone = useTone();
  return (
    <span className={cn('mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1', className)}>
      <span className="text-xs text-muted">{unitNums(money, agency, language, figures)}</span>
      {money.pct !== null && (
        <Bar pct={money.pct} fill={FILL_TONE[tone(money.pct)]} height="thin" className="min-w-16 flex-1" />
      )}
    </span>
  );
}
