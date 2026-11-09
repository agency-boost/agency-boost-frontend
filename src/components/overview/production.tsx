'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { PersonRow } from '@/components/ui/person-row';
import { RoleBadge } from '@/components/ui/role-badge';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { formatMonth, formatRupiahCompact } from '@/lib/format';
import { StatTile } from '@/components/ui/stat-tile';
import {
  leftOutWords, ofTarget, projectedWords, RANKING_SHOWN, unitNums, uploadHref,
  type OverviewAgency, type OverviewProduction,
} from '@/lib/kpm-overview';
import { useCan } from '@/lib/session';
import { Bar, FILL_TONE, OverviewPanel, Pct, PctPill, ShowAll, TEXT_TONE, useTone } from './parts';

/**
 * *Production — this year* (`KPM_Owner.html:1075-1220`): the office's APE so far against the sum of its members' goals
 * (OD-143), *"Rp {achieved} of Rp {target} target"* in the product's compact money formatter (*Rp 8,4 M*, ADR-0167 §1) —
 * never the prototype's *8.4B* — its share, the projection, and *Units furthest behind target*.
 *
 * **The projection is a run-rate** (D-figures): the year to date as of the latest month held ÷ that month's number × 12,
 * the server's — a missing month before it is already in the carrier's year to date. It is not drawn until a month of
 * the year is held.
 *
 * **No figure is 0 for want of data.** A year with no file says *Not uploaded yet*, a target nobody set says so, and the
 * total names in its tooltip the months and the members it leaves out (Phase 15's rule).
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-5; the client's UI-143):* the card becomes **the first row's fourth stat tile** — the
 * figure, the bar, *of Rp … target*, its share and the projection under it, as `kpm-owner-mobile-2026-11-03` 1 draws
 * *"Production this year with bar"* — **and a list in the second row**, *Units furthest behind target*, three shown and
 * *Semua n ›*. The projection's marker on a bar of its own gave way to the tile's bar; its figure stays, in words.
 */
export function ProductionTile({ production }: { production: OverviewProduction }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { ytd, projectionMinor } = production;
  const left = leftOutWords(ytd, language, figures);
  const showBar = ytd.pct !== null && ytd.targetMinor !== null && ytd.targetMinor > 0;
  return (
    <StatTile
      label={t.production}
      value={ytd.achievedMinor === null
        ? <span className="text-md font-semibold text-muted">{t.notUploaded}</span>
        : formatRupiahCompact(ytd.achievedMinor, {}, figures)}
      unit={left ? <TippedGlyph glyph="ⓘ" name={left} tip={left} align="fit" /> : undefined}
      bar={showBar ? ytd.pct : undefined}
      sub={(
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{ytd.targetMinor === null ? t.noGoal : ofTarget(ytd.targetMinor, language, figures)}</span>
            {ytd.pct !== null && <PctPill pct={ytd.pct} size="sm" />}
          </span>
          {projectionMinor !== null && (
            <span className="text-xs font-bold text-navy">{projectedWords(projectionMinor, language, figures)}</span>
          )}
          <MissingPills production={production} />
        </span>
      )}
    />
  );
}

/**
 * **"Belum diunggah" always carries its next step** (P19.3-T2 AC-7, AC-8; UI-150, UI-157, Overview R3): one pill per
 * month still open for upload, each opening Data upload on itself (`?month=`) — *"Okt belum diunggah ›"*, or, while
 * nothing was ever uploaded, the orange *"Unggah Nov 2026 ›"*. A month before the KPM, or one already locked, is never
 * named (the server's `missingMonths`). Drawn for whoever may open Data upload (`data_upload:read`).
 */
function MissingPills({ production }: { production: OverviewProduction }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const opens = useCan('data_upload:read');
  const { ytd } = production;
  if (!opens || ytd.missingMonths.length === 0) return null;
  const never = ytd.achievedMinor === null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1.5">
      {ytd.missingMonths.map((month) => (
        <Link
          key={month}
          href={uploadHref(month)}
          data-missing-month={month}
          className="inline-flex items-center rounded-pill bg-pill-amber px-2.5 text-xs font-semibold text-pill-amber-ink max-lg:min-h-11 lg:min-h-7 lg:hover:underline"
        >
          {never ? t.uploadPill({ month: formatMonth(month, figures) }) : t.missingPill({ month: formatMonth(month, figures) })}
        </Link>
      ))}
    </span>
  );
}

/**
 * *Units furthest behind target*: the agencies lowest by attainment, as the server orders them (D-units; a figure not
 * held sorts last), three shown and the rest in place behind *Semua n ›* (D-coverage). *Since P19.3-T2 (AC-1, AC-6;
 * UI-148, Overview case 6):* **each row opens that AB's Unit Dashboard**, where it opened to the AABs inside it — which
 * the Unit Dashboard shows — and **the list is hidden while no unit has a target** (the page leaves it out, D-08).
 */
export function UnitsList({ production }: { production: OverviewProduction }) {
  const t = useMessages(kpmOverviewMessages);
  const { agencies } = production;
  const [all, setAll] = useState(false);
  const listId = useId();
  const shown = all ? agencies : agencies.slice(0, RANKING_SHOWN);

  return (
    <OverviewPanel
      title={t.unitsTitle}
      tip={t.unitsSub}
      action={agencies.length > RANKING_SHOWN && (
        <ShowAll open={all} total={agencies.length} controls={listId} onToggle={() => setAll((was) => !was)} />
      )}
    >
      {agencies.length === 0 ? <p className="text-base text-muted">{t.noUnits}</p> : (
        <ul id={listId}>
          {shown.map((agency) => <AgencyRow key={agency.membershipId} agency={agency} />)}
        </ul>
      )}
    </OverviewPanel>
  );
}

/**
 * `.unit-row` (`:544-561`) as a person row (UI-148, `kpm-overview-*` 2): the AB's NAME and badge, *"Rp {a} / Rp {t}
 * unit target"* with its bar, the percentage on the right, and a › — **the whole row opens their Unit Dashboard**
 * (`/unit/dashboard/[membershipId]`), drawn for whoever may open one (`unit_dashboard:read`).
 */
function AgencyRow({ agency }: { agency: OverviewAgency }) {
  const toneFor = useTone();
  const opens = useCan('unit_dashboard:read');
  const tone = toneFor(agency.pct);
  return (
    <li className="border-b border-hairline last:border-b-0">
      <PersonRow
        name={agency.name}
        seed={agency.membershipId}
        href={opens ? `/unit/dashboard/${encodeURIComponent(agency.membershipId)}` : undefined}
        chevron
        height={56}
        className="gap-2 rounded-none bg-transparent px-0"
        badge={<RoleBadge role="AB" className="align-middle" />}
        meta={<UnitFigures money={agency} agency className="mt-0 w-full" />}
        trailing={<span className={cn('text-base font-bold', TEXT_TONE[tone])}><Pct pct={agency.pct} /></span>}
      />
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
