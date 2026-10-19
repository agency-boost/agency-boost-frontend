'use client';

import { useId } from 'react';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';
import {
  COMPLIANCE_LABELS, dayWords, OWN_COPY, pillOf, PROTOTYPE_COPY, sortRows,
  type ComplianceCategory, type ComplianceRow, type ComplianceSection, type ComplianceUnit, type PillWords,
  type SortDirection, type TreeKind,
} from '@/lib/kpm-compliance';
import { AchievedCell } from './standing-override';
import { CompliancePill, PersonLink, RoleTag } from './compliance-parts';

/** What a row needs beyond itself: the category's words, the office's day, and the campaign's override. */
export interface TreeContext {
  category: ComplianceCategory;
  kind: TreeKind;
  today: string;
  /** The campaign picked, for the *Achieved* cell's dialog. */
  campaign: { code: string; title: string } | null;
  canOverride: boolean;
  onChanged: () => void;
}

/**
 * **The tree** (`KPM_Owner.html:4017-4118`, `:3725-3750`, `:3906-3930`, CSS `:142-171`; P18.6-T1 AC-8): one
 * section per AB's agency, A to Z as the server sends them, each headed by the AB's name and *"{n} / {m} done
 * overall"*; inside it a card per unit — the AB's own first, then each AAB's — headed *"{name}'s Unit"* with its
 * tag and *"{done} / {total} done"*; each card's rows the head's own first, tagged *Personal*, then the rest in
 * the order chosen. Events count *joined*, campaigns *chasing* (`:3735`, `:3911`).
 *
 * Each section is a `section` named by its heading and each card's title a heading under it, so a screen reader
 * can move between agencies and units; every name is a link (D-drill, `PersonLink`).
 */
export function ComplianceTree({ sections, direction, context }: {
  sections: readonly ComplianceSection[];
  direction: SortDirection;
  context: TreeContext;
}) {
  return (
    <div>
      {sections.map((section) => (
        <AgencySection key={section.head.membershipId} section={section} direction={direction} context={context} />
      ))}
    </div>
  );
}

/** The figure a card or section header shows: *"{n} / {m}"* strong, then its verb (`:3698`). */
function Total({ done, of, verb, className }: { done: number; of: number; verb: string; className?: string }) {
  // Over nobody — a card whose people the item does not apply to — never *0 / 0*: the chips' dash, named the same way.
  if (of === 0) {
    return (
      <span className={cn('ml-auto whitespace-nowrap text-sm text-muted', className)}>
        <span aria-hidden="true"><strong className="font-bold text-navy">—</strong> {verb}</span>
        <span className="sr-only">{OWN_COPY.noRate}</span>
      </span>
    );
  }
  return (
    <span className={cn('ml-auto whitespace-nowrap text-sm text-muted', className)}>
      <strong className="font-bold text-navy">{done} / {of}</strong> {verb}
    </span>
  );
}

function AgencySection({ section, direction, context }: { section: ComplianceSection; direction: SortDirection; context: TreeContext }) {
  const headingId = useId();
  const verb = PROTOTYPE_COPY.verb[context.kind];
  return (
    <section aria-labelledby={headingId} className="mb-6 last:mb-0" data-section={section.head.membershipId}>
      {/* `.ab-section-header` (`:144`): the name, its AB tag, the agency's total, on the navy rule. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b-2 border-navy pb-[9px]">
        <h3 id={headingId} className="min-w-0 break-words font-display text-md font-bold text-navy">
          <PersonLink person={section.head} />
        </h3>
        <RoleTag kind="AB">{PROTOTYPE_COPY.tagAb}</RoleTag>
        <Total done={section.done} of={section.of} verb={`${verb} ${PROTOTYPE_COPY.overall}`} />
      </div>
      {section.units.map((unit) => (
        <UnitCard key={unit.head.membershipId} unit={unit} direction={direction} context={context} />
      ))}
    </section>
  );
}

function UnitCard({ unit, direction, context }: { unit: ComplianceUnit; direction: SortDirection; context: TreeContext }) {
  const rows = sortRows(unit.rows, context.kind, direction);
  const columns = context.kind === 'status' ? null : PROTOTYPE_COPY.columns[context.kind];
  return (
    // No `overflow-hidden` (the prototype's `.unit-card`, `:153`): it would clip a tooltip's bubble opened from a cell —
    // the override's marker, an expired activation's end — so the header rounds its own top corners instead, and no
    // row below it paints a background that could cross the card's rounded bottom.
    <div className="mb-2.5 ml-4 rounded-[10px] border border-hairline bg-card last:mb-0" data-unit={unit.head.membershipId}>
      {/* `.unit-card-header` (`:155-158`). */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-[9px] border-b border-hairline bg-base px-4 py-2.5">
        {/* The link holds *'s Unit* too, so its new-tab hint follows the whole title rather than splitting it. */}
        <h4 className="min-w-0 break-words text-base font-bold text-navy">
          <PersonLink person={unit.head}>{`${unit.head.name}${PROTOTYPE_COPY.unitOf}`}</PersonLink>
        </h4>
        <RoleTag kind={unit.rung}>{unit.rung}</RoleTag>
        <Total done={unit.done} of={unit.of} verb={PROTOTYPE_COPY.verb[context.kind]} />
      </div>
      {columns && (
        // `.unit-columns-label` (`:165-166`): drawn for the eye; each cell names its own column for a screen reader.
        <div aria-hidden="true" className={cn(ROW, 'bg-base py-1.5')}>
          <div className={NAME} />
          <div className={cn(COLUMN, LABEL)}>{columns[0]}</div>
          <div className={cn(COLUMN, LABEL)}>{columns[1]}</div>
        </div>
      )}
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.membershipId} className={cn(ROW, 'border-b border-hairline last:border-b-0')} data-row={row.membershipId}>
            <div className={cn(NAME, 'text-base text-navy')}>
              <PersonLink person={row} className="break-words" />
              {/* The space the prototype writes between the name and its tag (`:3681`). */}
              {row.personal && <>{' '}<RoleTag kind="personal">{PROTOTYPE_COPY.personal}</RoleTag></>}
            </div>
            {context.kind === 'status' ? <StatusCells row={row} context={context} /> : <TwoColumns row={row} context={context} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * `.unit-member-row` (`:160-164`): the name, then the pill and the date. **Below `sm` the pills stack under the
 * name** (contradiction 17): at 360px two 116px columns beside a name leave the name no room, so the row wraps
 * and nothing scrolls sideways.
 */
const ROW = 'flex flex-wrap items-center gap-x-3.5 gap-y-1.5 py-2.5 pl-[30px] pr-4';
const NAME = 'min-w-0 basis-full sm:flex-1';
/** `.unit-member-status-col` (`:163`): 116px, right-aligned beside the name; left under it on a phone. */
const COLUMN = 'w-[116px] shrink-0 sm:text-right';
const LABEL = 'text-2xs font-bold uppercase tracking-wide text-muted';

/** The single-column categories: the pill, and the day it was done — only when done (`:3027-3028`). */
function StatusCells({ row, context }: { row: ComplianceRow; context: TreeContext }) {
  const { cell } = row;
  const map = COMPLIANCE_LABELS[context.category as 'training' | 'goals' | 'activity' | 'activation'];
  const words = pillOf(map, cell.status);
  const day = cell.done === true && cell.on ? dayWords(cell.on, context.today) : null;
  return (
    <>
      <div className="sm:ml-auto">
        {context.category === 'activation' && cell.status === 'overdue' && cell.endedOn
          ? <ExpiredPill words={words} ended={dayWords(cell.endedOn, context.today)} />
          : <CompliancePill words={words} />}
      </div>
      {/*
        `.unit-member-date` (`:162`) is a fixed 70px column, which every row's date fits. Ours can carry its year
        (*Nov 25, 2025*, ≈76px), so it is fixed at the width the longest needs, and every row's pill stays in line.
      */}
      <div className="ml-auto w-[84px] shrink-0 whitespace-nowrap text-right text-sm text-muted sm:ml-0">
        {day ?? <span aria-hidden="true">—</span>}
      </div>
    </>
  );
}

/**
 * **An expired activation's *Overdue*** (OD-159; contradiction 6): the pill as every *Overdue* is drawn, with its
 * end in the accessible name and in a tooltip on hover, focus and tap (ADR-0062 §2, form 2). **One sentence for
 * both**, so the bubble is not read again as a description.
 */
function ExpiredPill({ words, ended }: { words: PillWords; ended: string }) {
  const sentence = OWN_COPY.expiredName(ended);
  return (
    <TippedGlyph
      glyph={words.label}
      name={sentence}
      tip={sentence}
      align="fit"
      face="h-auto w-auto whitespace-nowrap rounded-pill bg-alert/10 px-2.5 py-1 text-sm font-semibold text-alert hover:bg-alert/15 hover:text-alert"
    />
  );
}

/**
 * The two-column categories (`eventMemberRowHtml`, `:3716-3730`; `campaignMemberRowHtml`, `:3895-3909`):
 * *Joined* · *Feedback*, or *Chasing* · *Achieved* — the last drawn by `AchievedCell`, the override's only
 * control (D-override), and by nothing else.
 */
function TwoColumns({ row, context }: { row: ComplianceRow; context: TreeContext }) {
  const columns = PROTOTYPE_COPY.columns[context.kind as 'events' | 'campaigns'];
  const first = context.kind === 'events'
    ? pillOf(COMPLIANCE_LABELS.events.joined, row.cell.status)
    : pillOf(COMPLIANCE_LABELS.campaigns.chasing, row.cell.status);
  // A past event's *—* for a member nobody has confirmed yet is not the *—* of somebody outside the audience: a
  // screen reader hears which (ADR-0062 §2, form 4); the eye sees the prototype's dash.
  const awaiting = context.kind === 'events' && row.cell.status === 'unconfirmed';
  return (
    <>
      <div className={COLUMN}>
        <span className="sr-only">{columns[0]}: </span>
        {awaiting ? (
          <>
            <span aria-hidden="true"><CompliancePill words={first} /></span>
            <span className="sr-only">{OWN_COPY.awaitingConfirmation}</span>
          </>
        ) : <CompliancePill words={first} />}
      </div>
      <div className={COLUMN}>
        <span className="sr-only">{columns[1]}: </span>
        {context.kind === 'events' ? (
          <CompliancePill words={pillOf(COMPLIANCE_LABELS.events.feedback, row.cell.second)} />
        ) : context.campaign ? (
          <AchievedCell
            row={{ membershipId: row.membershipId, name: row.name, cell: row.cell }}
            campaign={context.campaign}
            canOverride={context.canOverride}
            onChanged={context.onChanged}
          />
        ) : (
          <CompliancePill words={pillOf(COMPLIANCE_LABELS.campaigns.achieved, null)} />
        )}
      </div>
    </>
  );
}

/**
 * The tree in outline while it is read — two sections of two cards — and, on the first read, the six chips
 * above it: a shape, not figures. One live region, so a screen reader hears one sentence.
 */
export function TreeSkeleton({ withChips = false }: { withChips?: boolean }) {
  return (
    <Skeleton label={OWN_COPY.loading}>
      {withChips && (
        <div className="mb-4 flex flex-wrap gap-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="min-w-[128px] rounded-[10px] border border-hairline bg-card px-3.5 py-2.5">
              <SkeletonBar className="h-5 w-12" />
              <SkeletonBar className="mt-2 h-2.5 w-20" />
            </div>
          ))}
        </div>
      )}
      {[0, 1].map((s) => (
        <div key={s} className="mb-6">
          <div className="mb-3 flex items-center gap-3 border-b-2 border-hairline pb-[9px]">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="ml-auto h-3 w-24" />
          </div>
          {[0, 1].map((u) => (
            <div key={u} className="mb-2.5 ml-4 overflow-hidden rounded-[10px] border border-hairline bg-card">
              <div className="flex gap-3 border-b border-hairline bg-base px-4 py-3">
                <SkeletonBar className="h-3 w-32" />
                <SkeletonBar className="ml-auto h-3 w-16" />
              </div>
              {[0, 1, 2].map((r) => (
                <div key={r} className="flex items-center gap-3.5 border-b border-hairline py-3 pl-[30px] pr-4 last:border-b-0">
                  <SkeletonBar className="h-3 w-1/3" />
                  <SkeletonBar className="ml-auto h-5 w-20 rounded-pill" />
                  <SkeletonBar className="h-3 w-12" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </Skeleton>
  );
}
