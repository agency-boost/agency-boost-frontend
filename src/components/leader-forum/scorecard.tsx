'use client';

import { Fragment, useRef } from 'react';
import { useMeetingWriter } from '@/components/leader-forum/meeting-writer';
import { TextInput } from '@/components/ui/field';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';
import {
  cellText, columnHeader, ItemWrites, leftOutLine, ROW_STYLE, runWrite, SECTION_BEFORE, TABS_COPY, TABS_OWN_COPY,
  useDraft, withTarget,
} from '@/lib/leader-meeting-tabs';
import {
  COLUMN_KEYS, saveMonthlyTarget, type MeetingView, type Scorecard as ScorecardData, type ScorecardCell,
  type ScorecardRow, type TargetRowKey,
} from '@/lib/leader-meetings';

/**
 * ***Overview & Stats*** (`KPM_Owner.html:2780-2799`; `functional/leader-forum.md`, OD-144, ADR-0129): the five
 * chips, the table of nine rows under its two section rows, and the footnotes.
 *
 * **Every figure is the server's** — live while the meeting is upcoming, frozen onto it once completed (F-183) —
 * and only rounded here for display. *pending data* where no source holds it, grey and italic (`:698`); *—*
 * over nothing; a blocked cell navy, as drawn, and named for a screen reader (I-255); a figure over part of its
 * period names what it leaves out. Only *Monthly Target* is typed, by whoever may edit: one write per cell, on
 * leaving it, only when it changed (*Saving*).
 */
export function Scorecard({ meeting }: { meeting: MeetingView }) {
  const { scorecard } = meeting;
  return (
    <div>
      <Chips chips={scorecard.chips} />
      <div className="mb-2 overflow-hidden rounded-lg border border-hairline bg-card">
        {/* The table keeps its shape and scrolls inside its card on a phone; the page never does. */}
        <div className="overflow-x-auto">
          <table className="relative w-full min-w-[640px] border-collapse text-left text-base">
            <ScorecardHead periods={scorecard.periods} />
            <tbody>
              {scorecard.rows.map((row, i) => (
                <Fragment key={row.key}>
                  {SECTION_BEFORE[row.key] && <SectionRow name={SECTION_BEFORE[row.key]!} />}
                  <MetricRow meeting={meeting} row={row} first={i === 0} />
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* `.stats-caption` (`:701`, `:2798`): the two footnotes, verbatim. */}
      <p className="mb-6 mt-2.5 text-xs leading-relaxed text-muted">
        {TABS_COPY.note}
        <br />
        {TABS_COPY.source}
      </p>
    </div>
  );
}

/**
 * `.summary-bar` (`:675-686`, `:2788-2794`): *Manpower* filled red, white on it; the others on a red tint with
 * red labels. A list of terms and figures. On a phone the chips wrap two to a line rather than run off it.
 */
export function Chips({ chips }: { chips: ScorecardData['chips'] }) {
  return (
    <dl className="mb-5 flex flex-wrap gap-px overflow-hidden rounded-lg border border-hairline">
      {TABS_COPY.chips.map(({ key, label }, i) => (
        <div
          key={key}
          className={cn('min-w-[7.5rem] flex-1 px-4 py-3', i === 0 ? 'bg-alert' : 'bg-alert/[0.06]')}
        >
          <dt className={cn('mb-1 text-xs font-bold uppercase tracking-[0.02em]', i === 0 ? 'text-white/75' : 'text-alert')}>
            {label}
          </dt>
          <dd className={cn('text-lg font-extrabold', i === 0 ? 'text-white' : 'text-navy')}>{chips[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

const TH = 'whitespace-nowrap border-b border-hairline bg-navy/[0.02] px-3 py-2.5 text-xs font-bold uppercase tracking-[0.03em] text-muted';
const TD = 'border-b border-hairline px-3 py-2.5 text-navy';

/** *Metrics*, *FY {Y−1}*, *YTD {Y}*, the three months and *Monthly Target* (`:2796`), the years the meeting's (F-184). */
export function ScorecardHead({ periods }: { periods: ScorecardData['periods'] }) {
  return (
    <thead>
      <tr>
        <th scope="col" className={cn(TH, 'text-alert')}>{TABS_COPY.metrics}</th>
        {COLUMN_KEYS.map((column) => (
          <th key={column} scope="col" className={TH}>{columnHeader(column, periods)}</th>
        ))}
        <th scope="col" className={TH}>{TABS_COPY.monthlyTarget}</th>
      </tr>
    </thead>
  );
}

/** `tr.section-row` (`:696`, `:2783`): across the table, on the red tint. */
export function SectionRow({ name }: { name: string }) {
  return (
    <tr>
      <td colSpan={7} className={cn(TD, 'bg-alert/[0.06] py-2 font-bold text-alert')}>{name}</td>
    </tr>
  );
}

/** A row's name and its look (`:692-697`): indented in normal weight, bold on a tint, or semibold. */
export function rowClasses(row: Pick<ScorecardRow, 'key'>) {
  const style = ROW_STYLE[row.key];
  return {
    tr: style === 'bold' ? 'bg-alert/[0.04] font-bold' : undefined,
    name: style === 'indent' ? 'pl-6 font-normal' : style === 'bold' ? 'font-bold' : 'font-semibold',
  };
}

function MetricRow({ meeting, row, first }: { meeting: MeetingView; row: ScorecardRow; first: boolean }) {
  const classes = rowClasses(row);
  return (
    <tr className={classes.tr}>
      <th scope="row" className={cn(TD, 'text-left', classes.name)}>{TABS_COPY.rows[row.key]}</th>
      {COLUMN_KEYS.map((column) => <FigureCell key={column} row={row} cell={row.cells[column]} tipBelow={first} />)}
      {row.monthlyTarget === null
        ? <BlockedCell />
        : <TargetCell meeting={meeting} row={row as ScorecardRow & { key: TargetRowKey }} target={row.monthlyTarget} />}
    </tr>
  );
}

/** `td.blocked` (`:699`): solid navy, empty to the eye, *Not tracked* to a screen reader. */
function BlockedCell() {
  return (
    <td className={cn(TD, 'bg-navy')}>
      <span className="sr-only">{TABS_OWN_COPY.notTracked}</span>
    </td>
  );
}

/**
 * The bubble opens above its ⓘ, over the row above. On the first row that is only the header, and a long list of
 * months would run past the table's own scroll box and be cut off: there it opens below, as the analytics table's
 * total does.
 */
const BELOW_TIP = '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1';

function FigureCell({ row, cell, tipBelow }: { row: ScorecardRow; cell: ScorecardCell; tipBelow: boolean }) {
  if (cell.kind === 'blocked') return <BlockedCell />;
  if (cell.kind === 'pending') return <td className={cn(TD, 'italic text-muted')}>{TABS_COPY.pending}</td>;
  if (cell.kind === 'none') {
    return (
      <td className={TD}>
        <span aria-hidden="true">{TABS_COPY.none}</span>
        <span className="sr-only">{TABS_OWN_COPY.noPolicies}</span>
      </td>
    );
  }
  const left = leftOutLine(cell);
  return (
    <td className={TD}>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        {cellText(row, cell)}
        {/* Phase 15's rule, as the Overview's total draws it: ⓘ, its words as its name and its bubble. */}
        {left && <TippedGlyph glyph="ⓘ" name={left} tip={left} align="fit" className={cn('-my-1.5', tipBelow && BELOW_TIP)} />}
      </span>
    </td>
  );
}

/**
 * *Monthly Target* (`:2459-2472`): the leaders' own typed target, up to the served bound — a labelled input for
 * whoever may edit, plain text for anybody else. Never frozen (ADR-0132 §3).
 */
function TargetCell({
  meeting, row, target,
}: {
  meeting: MeetingView;
  row: ScorecardRow & { key: TargetRowKey };
  target: { value: string; version: number };
}) {
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const draft = useDraft(target.value, target.version);

  if (writer.readOnly) return <td className={TD}>{target.value}</td>;

  const leave = () => {
    const sent = draft.leave();
    if (sent === null) return;
    void runWrite(writer, () => writes.current.run(
      row.key,
      sent.read,
      (version) => saveMonthlyTarget(meeting.id, row.key, { value: sent.text, version }),
      (answer) => answer.version,
    )).then((outcome) => {
      if (outcome.kind === 'landed') writer.update((m) => withTarget(m, row.key, outcome.answer));
      draft.settle(outcome.kind);
    });
  };

  return (
    <td className={cn(TD, 'py-1.5')}>
      <TextInput
        density="cell"
        aria-label={TABS_OWN_COPY.targetName(TABS_COPY.rows[row.key])}
        value={draft.value}
        maxLength={meeting.limits.targetMax}
        onFocus={draft.focus}
        onChange={(e) => draft.change(e.target.value)}
        onBlur={leave}
        className="min-w-[6rem]"
      />
    </td>
  );
}
