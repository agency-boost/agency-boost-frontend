'use client';

import { Fragment, useId, useRef, useState } from 'react';
import { useMeetingWriter } from '@/components/leader-forum/meeting-writer';
import { TextInput } from '@/components/ui/field';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { forumStatsMessages } from '@/i18n/messages/forum-stats';
import { cn } from '@/lib/cn';
import {
  asOfText, cellText, changeText, chipsIn, columnHeader, footnotesIn, isPartial, ItemWrites, NONE, noneWords,
  numberedFootnotes, OUTLINED_ROWS, partialNotes, rateExample, rateFromTyped, ROW_STYLE, rowName, runWrite, statsTitle,
  targetDraftText, targetText, useDraft, withTarget,
} from '@/lib/leader-meeting-tabs';
import {
  COLUMN_KEYS, saveMonthlyTarget, type ColumnKey, type MeetingView, type MonthlyTarget, type RowKey,
  type Scorecard as ScorecardData, type ScorecardCell, type ScorecardRow, type TargetRowKey,
} from '@/lib/leader-meetings';
import { usePhone } from '@/lib/use-phone';

/**
 * ***Overview & Stats*** — **the client's reference slide** (*FinWinner – Jakarta & Serpong: Oct 2026*; ADR-0175,
 * P18.97-T1; parity I-479 to I-495), where it was the prototype's table (`KPM_Owner.html:2780-2799`): the title and
 * *AS OF*, the KPI strip, the table — seven columns under *Full Year & YTD View* and *Monthly View*, the slide's nine
 * rows — and numbered footnotes in our metrics' words with one *(\*)* note per partial period.
 *
 * **Every figure is the server's** — live while the meeting is upcoming, frozen onto it once completed (F-183), read
 * tolerantly when it was frozen before the slide's table (I-495) — and only written here, ADR-0174's way. Only
 * *Monthly Target* is typed, by whoever may edit: **a rate per unit**, shown as the server's *"{rate × units} ({rate} @
 * unit)"* (I-487); one write per cell, on leaving it, only when it changed (*Saving*).
 *
 * **On a phone, one card per metric** in place of the table (UI-014, I-493); **on a tablet the *Metrics* column stays in
 * view** while the table scrolls (UI-013, I-492). A desktop is the table as drawn.
 */
export function Scorecard({ meeting }: { meeting: MeetingView }) {
  const phone = usePhone();
  const { readOnly } = useMeetingWriter();
  return (
    <div>
      <StatsTitle meeting={meeting} />
      <Chips chips={meeting.scorecard.chips} />
      {phone ? <MetricCards meeting={meeting} readOnly={readOnly} /> : <ScorecardTable meeting={meeting} readOnly={readOnly} />}
      <ScorecardNotes scorecard={meeting.scorecard} />
    </div>
  );
}

/**
 * **The title, and *AS OF* at its right** (UI-010, I-489): *"BSD City Branch: Okt 2026"*, the meeting's month, and the
 * day the office's latest file was uploaded — *—* on a scorecard kept before the date was, and nothing with no file.
 */
export function StatsTitle({
  meeting, print = false,
}: { meeting: Pick<MeetingView, 'branch' | 'date' | 'scorecard'>; print?: boolean }) {
  const t = useMessages(forumStatsMessages);
  const language = useFigureLanguage();
  const asOf = asOfText(meeting.scorecard.asOf, language);
  const unrecorded = meeting.scorecard.asOf.kind === 'unrecorded';
  // On paper it sits under the print's own *Overview & Stats* heading, a level below.
  const Heading = print ? 'h4' : 'h3';
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <Heading className="text-lg font-extrabold text-navy">{statsTitle(meeting.branch, meeting.date, language)}</Heading>
      {asOf && (
        <p className="text-sm font-bold tracking-wide text-navy">
          {unrecorded ? (
            <>
              <span aria-hidden="true">{asOf}</span>
              <span className="sr-only">{t.asOfUnrecorded}</span>
            </>
          ) : asOf}
        </p>
      )}
    </div>
  );
}

/**
 * **The KPI strip** (UI-011, I-490): one line a cell, large, bold and centred — *"Manpower: 28"* — *Manpower* dark red
 * with white words (7.07:1), *# of agents* and *# of units* mid pink and *# of AB* and *# of AAB* light pink, each with
 * navy words (9.23:1 and 11.96:1, on the card): the alert token, whole and at a quarter and a tenth. On a tablet one row
 * of five equal tiles, its type smaller (UI-013); on a phone two a line, the last across both (F-192).
 */
const TILE_TONE: Record<keyof ScorecardData['chips'], string> = {
  manpower: 'bg-alert text-white',
  agents: 'bg-alert/25 text-navy',
  units: 'bg-alert/25 text-navy',
  ab: 'bg-alert/10 text-navy',
  aab: 'bg-alert/10 text-navy',
};

export function Chips({ chips }: { chips: ScorecardData['chips'] }) {
  const words = useLanguage();
  return (
    <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-card-edge bg-card md:grid-cols-5">
      {chipsIn(words).map(({ key, label }) => (
        <div
          key={key}
          className={cn(
            'flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-center text-xl font-extrabold',
            'md:max-lg:px-1.5 md:max-lg:py-2.5 md:max-lg:text-md',
            key === 'aab' && 'max-md:col-span-2',
            TILE_TONE[key],
          )}
        >
          <dt>{`${label}:`}</dt>
          <dd>{chips[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

/*
 * ── The table ───────────────────────────────────────────────────────────────────────────────────
 *
 * Every tint is opaque — the token mixed into the card — so the *Metrics* column that sticks on a tablet hides what
 * scrolls beneath it whatever the row's ground.
 */
const HEAD_BG = 'bg-[color:color-mix(in_srgb,var(--color-navy)_2%,var(--color-card))]';
const BAND_BG = 'bg-[color:color-mix(in_srgb,var(--color-alert)_4%,var(--color-card))]';
const SECTION_BG = 'bg-[color:color-mix(in_srgb,var(--color-alert)_6%,var(--color-card))]';
/** A cell's box, without its lines: an outlined cell draws its own. */
const CELL = 'px-3 py-2.5 text-navy';
const LINE = 'border-b border-hairline';
const TD = cn(CELL, LINE);
const TH = cn('border-b border-hairline px-3 py-2 align-bottom text-xs font-bold text-alert', HEAD_BG);
/** *Metrics*, held in view while the table scrolls sideways on a tablet — 768 to 1023px only (UI-013, I-492). */
const STICKY = 'md:max-lg:sticky md:max-lg:left-0 md:max-lg:z-[1] md:max-lg:shadow-[1px_0_0_var(--color-hairline)]';
/** The dashed line between the two groups, down the table (UI-003, I-481). */
const DASHED = 'border-r-2 border-r-muted/40 [border-right-style:dashed]';
/** *Not tracked*: a light diagonal hatch from the hairline token, where the prototype drew a navy block (UI-005, I-484). */
const HATCH = 'bg-[repeating-linear-gradient(135deg,var(--color-hairline)_0_1px,transparent_1px_6px)]';
/** The red outline round the *YTD* pair (UI-006, I-485): one side each, the top and the bottom both. */
const OUTLINE: Partial<Record<ColumnKey, string>> = {
  ytdLastYear: 'border-y-2 border-l-2 border-y-alert border-l-alert',
  ytd: 'border-y-2 border-r-2 border-y-alert border-r-alert',
};

/**
 * **The table** (UI-001 to UI-012), the screen's and the print's: two header rows — the groups over their columns
 * (`scope="colgroup"`, so a screen reader names a cell's group) and each column's two lines — then the rows, the
 * section bands before *3M new agent %* and *Case submission*. In print every field is its text.
 */
export function ScorecardTable({
  meeting, print = false, readOnly = true,
}: { meeting: MeetingView; print?: boolean; readOnly?: boolean }) {
  const t = useMessages(forumStatsMessages);
  const sections: Partial<Record<RowKey, string>> = t.sections;
  const { scorecard } = meeting;
  const { marks } = numberedFootnotes(scorecard.rows.map((r) => r.key));
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-card-edge bg-card">
      {/* The table keeps its shape and scrolls inside its card on a tablet; a phone draws the cards instead. */}
      <div className={print ? undefined : 'overflow-x-auto'}>
        <table className={cn('relative w-full border-collapse text-left text-base', !print && 'min-w-[760px]')}>
          <colgroup><col /></colgroup>
          <colgroup span={3} />
          <colgroup span={4} />
          <ScorecardHead periods={scorecard.periods} />
          <tbody>
            {scorecard.rows.map((row) => (
              <Fragment key={row.key}>
                {sections[row.key] && <SectionRow name={sections[row.key]!} />}
                <MetricRow meeting={meeting} row={row} mark={marks[row.key]} print={print} editable={!print && !readOnly} />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The two groups with the slide's arrows (decorative), then *Metrics*, each column's name over its period, *Monthly Target*. */
export function ScorecardHead({ periods }: { periods: ScorecardData['periods'] }) {
  const t = useMessages(forumStatsMessages);
  const language = useFigureLanguage();
  const group = cn(TH, 'text-center text-sm');
  return (
    <thead>
      <tr>
        <th rowSpan={2} scope="col" className={cn(TH, STICKY, 'text-sm')}>{t.metrics}</th>
        <th colSpan={3} scope="colgroup" className={cn(group, DASHED)}>
          <span aria-hidden="true">⟵ </span>{t.groups.year}<span aria-hidden="true"> ⟶</span>
        </th>
        <th colSpan={4} scope="colgroup" className={group}>
          <span aria-hidden="true">⟵ </span>{t.groups.month}<span aria-hidden="true"> ⟶</span>
        </th>
      </tr>
      <tr>
        {COLUMN_KEYS.map((column) => {
          const { name, period } = columnHeader(column, periods, language);
          return (
            <th key={column} scope="col" className={cn(TH, 'whitespace-nowrap', column === 'ytd' && DASHED)}>
              <span className="block">{name}</span>
              <span className="block font-semibold">{period}</span>
            </th>
          );
        })}
        <th scope="col" className={cn(TH, 'whitespace-nowrap')}>{t.monthlyTarget}</th>
      </tr>
    </thead>
  );
}

/** A section band (UI-004): across the table, on the red tint, the dashed line through it. */
export function SectionRow({ name }: { name: string }) {
  return (
    <tr>
      <td className={cn(TD, SECTION_BG, STICKY, 'py-2 font-bold text-alert')}>{name}</td>
      <td colSpan={3} className={cn(TD, SECTION_BG, DASHED, 'py-2')} />
      <td colSpan={4} className={cn(TD, SECTION_BG, 'py-2')} />
    </tr>
  );
}

function MetricRow({
  meeting, row, mark, print, editable,
}: { meeting: MeetingView; row: ScorecardRow; mark: number | undefined; print: boolean; editable: boolean }) {
  const t = useMessages(forumStatsMessages);
  const language = useFigureLanguage();
  const style = ROW_STYLE[row.key];
  const ground = style.band ? BAND_BG : undefined;
  return (
    <tr className={cn(print && 'break-inside-avoid')}>
      <th
        scope="row"
        className={cn(TD, STICKY, ground ?? 'md:max-lg:bg-card', 'text-left', style.indent && 'pl-7', style.bold ? 'font-bold' : 'font-normal')}
      >
        {rowName(row.key, language)}
        {mark !== undefined && <sup className="ml-0.5 text-2xs font-semibold">{mark}</sup>}
      </th>
      {COLUMN_KEYS.map((column) => (
        <FigureCell key={column} row={row} column={column} cell={row.cells[column]} ground={ground} bold={style.bold} />
      ))}
      {row.monthlyTarget === null
        ? <td className={cn(TD, ground, HATCH)}><span className="sr-only">{t.notTracked}</span></td>
        : (
          <td className={cn(TD, ground, editable && 'py-1.5', style.bold ? 'font-bold' : 'font-normal')}>
            {editable
              ? <TargetInput meeting={meeting} row={row as ScorecardRow & { key: TargetRowKey }} target={row.monthlyTarget} />
              : targetText(row, row.monthlyTarget, language)}
          </td>
        )}
    </tr>
  );
}

/** A figure over part of its period: *\** to the eye, and a word to a screen reader (AC-12, I-488). */
function PartialMark() {
  const t = useMessages(forumStatsMessages);
  return (
    <>
      <span aria-hidden="true">*</span>
      <span className="sr-only">{`, ${t.partialMark}`}</span>
    </>
  );
}

/** A cell's figure and its states: *pending data* grey and italic (`:698`), *—* with its reason, *Not tracked* hatched. */
function CellContent({ row, cell }: { row: ScorecardRow; cell: ScorecardCell }) {
  const t = useMessages(forumStatsMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  if (cell.kind === 'pending') return <span className="italic text-muted">{t.pending}</span>;
  if (cell.kind === 'none' || cell.kind === 'unrecorded') {
    return (
      <>
        <span aria-hidden="true">{NONE}</span>
        <span className="sr-only">{noneWords(row, cell, words)}</span>
      </>
    );
  }
  if (cell.kind === 'blocked') return <span className="sr-only">{t.notTracked}</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {cellText(row, cell, language)}
      {isPartial(cell) && <PartialMark />}
    </span>
  );
}

function FigureCell({
  row, column, cell, ground, bold,
}: { row: ScorecardRow; column: ColumnKey; cell: ScorecardCell; ground?: string; bold?: true }) {
  const outlined = OUTLINED_ROWS.includes(row.key) ? OUTLINE[column] : undefined;
  return (
    <td
      className={cn(
        CELL,
        outlined ?? LINE,
        !outlined && column === 'ytd' && DASHED,
        ground,
        cell.kind === 'blocked' && HATCH,
        bold ? 'font-bold' : 'font-normal',
      )}
    >
      <CellContent row={row} cell={cell} />
    </td>
  );
}

/*
 * ── *Monthly Target*: a rate per unit (P18.97-T1 AC-10, ADR-0175 §4; I-487) ─────────────────────
 */

/**
 * ***Monthly Target***, for an editor: the server's *"{rate × units} ({rate} @ unit)"* — *TBD* on *APE* with no rate,
 * blank on the others, or the text a target was typed as before rates. **An editor types the rate** — the field holds
 * it while focused, a comma or a point, from 0, in the row's unit (*APE* in *miliar*) — and leaving it writes the rate
 * once, only when it changed; **a text that is no number is not sent**, and the field says so. Anybody else, and the
 * paper, read `targetText`. Never frozen (ADR-0132 §3).
 */
function TargetInput({
  meeting, row, target,
}: { meeting: MeetingView; row: ScorecardRow & { key: TargetRowKey }; target: MonthlyTarget }) {
  const t = useMessages(forumStatsMessages);
  const language = useFigureLanguage();
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const base = targetDraftText(row, target, language);
  const draft = useDraft(base, target.version);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  // While focused, a refused text, or a write in flight: what was typed. Otherwise the target as the table draws it.
  const shown = focused || invalid || draft.value !== base ? draft.value : targetText(row, target, language);

  const leave = () => {
    setFocused(false);
    const sent = draft.leave();
    if (sent === null) {
      setInvalid(false);
      return;
    }
    const typed = rateFromTyped(row.key, sent.text);
    if ('invalid' in typed) {
      setInvalid(true);
      draft.settle('failed');
      return;
    }
    setInvalid(false);
    void runWrite(writer, () => writes.current.run(
      row.key,
      sent.read,
      (version) => saveMonthlyTarget(meeting.id, row.key, { rate: typed.rate, version }),
      (answer) => answer.version,
    )).then((outcome) => {
      if (outcome.kind === 'landed') writer.update((m) => withTarget(m, row.key, outcome.answer));
      draft.settle(outcome.kind);
    });
  };

  return (
    <>
      <TextInput
        density="cell"
        inputMode="decimal"
        aria-label={t.targetName({ row: rowName(row.key, language) })}
        invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        placeholder={row.key === 'ape' ? t.tbd : undefined}
        value={shown}
        maxLength={meeting.limits.targetMax}
        onFocus={() => {
          setFocused(true);
          draft.focus();
        }}
        onChange={(e) => draft.change(e.target.value)}
        onBlur={leave}
        className="min-w-[7rem]"
      />
      {invalid && <p id={errorId} className="mt-1 whitespace-normal text-xs font-semibold text-alert">{t.notARate({ example: rateExample(language) })}</p>}
    </>
  );
}

/*
 * ── A phone: one card per metric (UI-014; P18.97-T1 AC-17, I-493) ─────────────────────────────
 */

/**
 * **One card per metric**, the table not drawn, below 768px: the metric's name and footnote mark; *YTD {Y}* against
 * *YTD {Y−1}* and the change the server computed — a whole percentage of last year's, or, on *3M new agent %*, the
 * difference in percentage points (P18.97-T8 F1, parity F-256) — *—* where there is none; *This Month* against *Last
 * Month*; and the target. A *Not tracked* figure is left off its card. The notes follow the cards.
 */
function MetricCards({ meeting, readOnly }: { meeting: MeetingView; readOnly: boolean }) {
  const { scorecard } = meeting;
  const { marks } = numberedFootnotes(scorecard.rows.map((r) => r.key));
  return (
    <ul className="mb-2 flex flex-col gap-3">
      {scorecard.rows.map((row) => <MetricCard key={row.key} meeting={meeting} row={row} mark={marks[row.key]} readOnly={readOnly} />)}
    </ul>
  );
}

export function MetricCard({
  meeting, row, mark, readOnly,
}: { meeting: MeetingView; row: ScorecardRow; mark: number | undefined; readOnly: boolean }) {
  const t = useMessages(forumStatsMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const titleId = useId();
  const { periods } = meeting.scorecard;
  /*
   * A column's name and its period, each kept whole (P18.97-T8 F2): where the two do not fit on one line they break
   * between them — *YTD 2026* over *(Jan-Okt '26)* — never inside either.
   */
  const label = (column: ColumnKey) => {
    const { name, period } = columnHeader(column, periods, language);
    return (
      <span className="flex flex-wrap items-baseline gap-x-1">
        <span className="whitespace-nowrap">{name}</span>
        <span className="whitespace-nowrap text-xs font-normal text-muted">{period}</span>
      </span>
    );
  };
  const tracked = (column: ColumnKey) => row.cells[column].kind !== 'blocked';
  const DT = 'text-sm font-semibold text-navy';
  const DD = 'text-right text-sm text-navy';
  return (
    <li aria-labelledby={titleId} className="rounded-lg border border-card-edge bg-card px-4 py-3">
      <h4 id={titleId} className="mb-2 text-md font-bold text-navy">
        {rowName(row.key, language)}
        {mark !== undefined && <sup className="ml-0.5 text-2xs font-semibold">{mark}</sup>}
      </h4>
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
        <dt className={DT}>{label('ytd')}</dt>
        <dd className={DD}><CellContent row={row} cell={row.cells.ytd} /></dd>
        <dt className={DT}>{label('ytdLastYear')}</dt>
        <dd className={DD}><CellContent row={row} cell={row.cells.ytdLastYear} /></dd>
        <dt className={DT}>{t.change}</dt>
        <dd className={cn(DD, 'tabular-nums')}>{changeText(row.ytdChange, language, words)}</dd>
        {tracked('thisMonth') && (
          <>
            <dt className={DT}>{label('thisMonth')}</dt>
            <dd className={DD}><CellContent row={row} cell={row.cells.thisMonth} /></dd>
          </>
        )}
        {tracked('lastMonth') && (
          <>
            <dt className={DT}>{label('lastMonth')}</dt>
            <dd className={DD}><CellContent row={row} cell={row.cells.lastMonth} /></dd>
          </>
        )}
      </dl>
      {/*
        * **The target on a line of its own, under the figures** (P18.97-T8 F2). In their grid an editor's field — 16px
        * on a phone, wider than any figure — set the width of every row's value column, and the labels beside the
        * figures wrapped mid-phrase. Here it sets nothing but its own line: the label, then the field filling the rest —
        * under the label on a card too narrow for both.
        */}
      {row.monthlyTarget && (
        <dl className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <dt className={cn(DT, 'shrink-0')}>{t.monthlyTarget}</dt>
          <dd className={cn(DD, 'min-w-[7rem] flex-1')}>
            {readOnly
              ? targetText(row, row.monthlyTarget, language)
              : <TargetInput meeting={meeting} row={row as ScorecardRow & { key: TargetRowKey }} target={row.monthlyTarget} />}
          </dd>
        </dl>
      )}
    </li>
  );
}

/*
 * ── The notes (UI-009; P18.97-T1 AC-12, I-488) ────────────────────────────────────────────────
 */

/**
 * **The numbered footnotes, in our metrics' words, and one *(\*)* note per partial period**, under the table or the
 * cards — where the prototype drew twelve ⓘ, a *Note* line and a *Source* line. The slide's footnote 1, *Net APE*,
 * waits with OD-231, so the numbering starts at *Annual Active Agents*.
 */
export function ScorecardNotes({ scorecard }: { scorecard: ScorecardData }) {
  const words = useLanguage();
  const language = useFigureLanguage();
  const { list } = numberedFootnotes(scorecard.rows.map((r) => r.key), footnotesIn(words));
  const notes = partialNotes(scorecard, language, words);
  return (
    <div className="mb-6 mt-2.5 text-xs leading-relaxed text-muted">
      <ol>
        {list.map(({ n, text }) => (
          <li key={n}>
            {/* `text-xs`: a `<sup>` alone is 0.75em, 9px under these 12px notes (UI-008, T16). */}
            <sup className="mr-0.5 text-xs font-semibold">{n}</sup>
            {text}
          </li>
        ))}
      </ol>
      {notes.length > 0 && (
        <ul className="mt-1">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </div>
  );
}
