'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { FilterChips, SearchPill } from '@/components/ui/list-rows';
import { LineIcon } from '@/components/ui/line-icon';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { YtdFigure } from '@/components/ytd-cell';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import { formatMonthLong } from '@/lib/format';
import {
  columnHeading, figureLabel, ytdColumns, type MetricCell, type MonthColumn, type MonthRow, type MonthView,
  type UnregisteredRow, type YtdCell,
} from '@/lib/production';
import { corrected, formatFigure, unreported } from './figure-marks';

/** How many rows the table shows before *Lihat semua* (P19.21-T1 AC-3: "eight rows + Lihat semua"). */
export const ROWS_SHOWN = 8;

export type Show = 'all' | 'unreported' | 'corrected' | 'notYet';
export type Cadence = 'month' | 'ytd';

/** The cell a person taps to correct: which member, which column, which side. */
export interface Tapped {
  row: MonthRow;
  column: MonthColumn;
  ytd: boolean;
}

const EMPTY: MetricCell = { value: null, provenance: null, correction: null };

/** A name or a code holds what was searched, any case (`Cari nama`). */
const matches = (query: string, ...texts: (string | null | undefined)[]) => {
  const q = query.trim().toLowerCase();
  return q === '' || texts.some((text) => (text ?? '').toLowerCase().includes(q));
};

/**
 * **The month's members, and the rows kept for codes nobody holds yet** (P19.21-T1 AC-3, AC-4, AC-6; frames 4, 8, 9):
 * *Bulan ini | YTD*; *Semua n · Belum dilaporkan n · Dikoreksi n* and, once a file kept any, *Belum jadi anggota n*;
 * *Cari nama*. A row is the person's photo, the orange *AB* / *AAB* before the NAME in capitals, the agent code under it,
 * then the template's columns — **money as exact rupiah**, a value not reported a faint *—*, *Aktif* ✓. Eight rows, then
 * *Lihat semua (n) ›*. **Tapping a number opens *Koreksi*** for whoever may correct, in a month that is open; a corrected
 * cell has an orange tint and ✎.
 *
 * **On a phone the table scrolls sideways inside its card, the name column held** (DESIGN-RULES *Sizes*: wide data tables
 * keep their columns). Test accounts never reach it: the server leaves them out (ADR-0267 §1).
 */
export function MembersTable({
  view, query, onQuery, correctable, onTap,
}: {
  view: MonthView;
  query: string;
  onQuery: (query: string) => void;
  /** Whoever may correct, in a month that takes a write. */
  correctable: boolean;
  onTap: (tapped: Tapped) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const ladder = useLadder();
  const [cadence, setCadence] = useState<Cadence>('month');
  const [show, setShow] = useState<Show>('all');
  const [everyone, setEveryone] = useState(false);

  const columns = cadence === 'month' ? view.config.columns : ytdColumns(view.config.columns);
  const counts = {
    all: view.rows.length,
    unreported: view.rows.filter(unreported).length,
    corrected: view.rows.filter(corrected).length,
    notYet: view.unregistered.length,
  };
  const members = useMemo(() => view.rows
    .filter((r) => show === 'all' || (show === 'unreported' && unreported(r)) || (show === 'corrected' && corrected(r)))
    .filter((r) => matches(query, r.name, r.agentCode)), [view.rows, show, query]);
  const notYet = (show === 'all' || show === 'notYet')
    ? view.unregistered.filter((r) => matches(query, r.fileName, r.agentCode))
    : [];
  const shownMembers = show === 'notYet' ? [] : members;
  const total = shownMembers.length + notYet.length;
  // A search shows every match; otherwise eight rows, the members first, until *Lihat semua*.
  const limit = everyone || query.trim() !== '' ? Infinity : ROWS_SHOWN;
  const memberRows = shownMembers.slice(0, limit);
  const notYetRows = notYet.slice(0, Math.max(0, limit - memberRows.length));
  const month = `${formatMonthLong(view.month, figures)} ${view.month.slice(0, 4)}`;

  const cellOf = (row: { values: Record<string, MetricCell>; ytd: Record<string, YtdCell> }, column: MonthColumn): MetricCell =>
    (cadence === 'month' ? row.values[column.kode] : row.ytd[column.kode]) ?? EMPTY;

  const figure = (cell: MetricCell, column: MonthColumn) => {
    if (cell.value === null) return <span className="text-signal-grey" aria-label={t.nothingReported}>—</span>;
    return <span>{formatFigure(column.unit, cell.value, figures)}</span>;
  };

  const memberCell = (row: MonthRow, column: MonthColumn) => {
    const cell = cellOf(row, column);
    const fixed = cell.provenance === 'corrected';
    const ytdCell = cadence === 'ytd' ? (cell as YtdCell) : null;
    // A summed year to date is the months' and is never typed (R4); a leaders' column is not an agent's.
    const tappable = correctable && !(ytdCell?.calculated) && !(column.rows === 'leaders' && !row.leader) && column.inForce;
    const body = ytdCell
      ? (
        <YtdFigure
          text={ytdCell.value === null ? null : formatFigure(column.unit, ytdCell.value, figures)}
          calculated={ytdCell.calculated}
          missingMonths={ytdCell.calculated ? column.ytdMissingMonths : []}
        />
      )
      : figure(cell, column);
    const content = (
      <>
        {fixed && <LineIcon name="pencil" className="mr-1 inline h-3 w-3 text-primary-ink" />}
        {body}
        {fixed && <span className="sr-only">{`, ${t.legendCorrected}`}</span>}
      </>
    );
    return (
      <td
        key={column.kode}
        data-kode={column.kode}
        data-corrected={fixed ? '' : undefined}
        // Never *Rp* over *34.000.000* (found 2026-11-20 at 1280): a figure is one line; the table scrolls in its own box.
        className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
      >
        {tappable ? (
          <button
            type="button"
            onClick={() => onTap({ row, column, ytd: cadence === 'ytd' })}
            aria-label={`${t.correctFigure({ label: figureLabel(column, cadence === 'ytd', language), name: row.name })}: ${
              cell.value === null ? t.nothingReported : formatFigure(column.unit, cell.value, figures)}`}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-end rounded-md px-1.5 text-navy hover:bg-hover-row lg:min-h-9',
              fixed && 'bg-primary-50 text-ink',
            )}
          >
            {content}
          </button>
        ) : (
          <span className={cn('inline-flex min-h-9 items-center justify-end rounded-md px-1.5 text-navy', fixed && 'bg-primary-50 text-ink')}>
            {content}
          </span>
        )}
      </td>
    );
  };

  const activeCell = (active: boolean | null) => (
    <td className="px-2 py-1.5 text-center">
      {active === true
        ? <span role="img" aria-label={t.active}><LineIcon name="check" className="inline h-4 w-4 text-success" /></span>
        : <span role="img" aria-label={active === false ? t.notActive : t.notReported} className="text-signal-grey">—</span>}
    </td>
  );

  const nameCell = (content: React.ReactNode) => (
    <th scope="row" className="sticky left-0 z-[1] min-w-44 bg-card px-3 py-2 text-left font-normal md:min-w-56">{content}</th>
  );

  return (
    <section data-members-table="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          label={t.views}
          chips={[{ key: 'month', label: t.thisMonth }, { key: 'ytd', label: t.ytd }]}
          active={cadence}
          onSelect={(next) => setCadence(next as Cadence)}
          className="rounded-pill bg-card p-0.5"
        />
        <FilterChips
          label={t.showLabel}
          chips={[
            { key: 'all', label: t.all, count: counts.all },
            { key: 'unreported', label: t.unreported, count: counts.unreported },
            { key: 'corrected', label: t.corrected, count: counts.corrected },
            ...(counts.notYet > 0 ? [{ key: 'notYet', label: t.notYetMembers, count: counts.notYet }] : []),
          ]}
          active={show}
          onSelect={(next) => { setShow(next as Show); setEveryone(false); }}
          className="rounded-pill bg-card p-0.5"
        />
        <SearchPill label={t.search} value={query} onChange={onQuery} className="w-full sm:ml-auto sm:w-56" />
      </div>

      <div className="overflow-hidden rounded-lg bg-card">
        <div className="overflow-x-auto">
          <table className="relative w-full min-w-[44rem] border-collapse text-md">
            <caption className="sr-only">{t.tableOf({ month })}</caption>
            <thead>
              <tr className="border-b border-hairline text-sm font-semibold text-muted">
                <th scope="col" className="sticky left-0 z-[1] bg-card px-3 py-2.5 text-left font-semibold">{t.member}</th>
                {columns.map((c) => (
                  <th key={c.kode} scope="col" className="px-2 py-2.5 text-right font-semibold">{columnHeading(c, language)}</th>
                ))}
                {cadence === 'month' && <th scope="col" className="px-2 py-2.5 text-center font-semibold">{t.active}</th>}
              </tr>
            </thead>
            <tbody>
              {view.rows.length === 0 && view.unregistered.length === 0 && (
                <tr><td colSpan={columns.length + 2} className="px-3 py-6 text-center text-muted">{t.noMembers}</td></tr>
              )}
              {total === 0 && (view.rows.length > 0 || view.unregistered.length > 0) && (
                <tr><td colSpan={columns.length + 2} className="px-3 py-6 text-center text-muted">{t.noMatch}</td></tr>
              )}
              {memberRows.map((row) => (
                <tr key={row.membershipId} data-member={row.membershipId} className="border-b border-hairline last:border-b-0">
                  {nameCell(<MemberName row={row} label={leaderLabel(row, ladder)} />)}
                  {columns.map((c) => memberCell(row, c))}
                  {cadence === 'month' && activeCell(row.monthlyActiveAgent)}
                </tr>
              ))}
              {notYetRows.length > 0 && (
                <tr>
                  <th colSpan={columns.length + 2} scope="colgroup" className="bg-base px-3 py-2 text-left text-sm font-semibold text-pill-grey-ink">
                    {t.notYetSection}
                  </th>
                </tr>
              )}
              {notYetRows.map((row) => (
                <tr key={row.agentCode} data-not-yet={row.agentCode} className="border-b border-hairline bg-base/60 last:border-b-0">
                  {nameCell(<NotYetName row={row} />)}
                  {columns.map((c) => (
                    <td key={c.kode} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-navy">
                      <span className="inline-flex min-h-9 items-center px-1.5">{figure(cellOf(row, c), c)}</span>
                    </td>
                  ))}
                  {cadence === 'month' && activeCell(activeOf(row))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > ROWS_SHOWN && query.trim() === '' && (
          <button
            type="button"
            onClick={() => setEveryone((v) => !v)}
            className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-hairline text-md font-bold text-navy hover:bg-hover-row"
          >
            {everyone ? t.seeFewer : t.seeAll({ count: total })}
            {!everyone && <LineIcon name="chevronRight" className="h-4 w-4" />}
          </button>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label={t.member}>
        {correctable && <li>{t.legendTap}</li>}
        <li><LineIcon name="pencil" className="mr-1 inline h-3 w-3 text-primary-ink" />{t.legendCorrected}</li>
        <li>{t.legendActive}</li>
        <li>{t.legendKept}</li>
        <li>{t.legendTest}</li>
      </ul>
    </section>
  );
}

/** *AB* / *AAB* before a leader's name (DESIGN-RULES *Names*); an agent has none. */
function leaderLabel(row: MonthRow, ladder: ReturnType<typeof useLadder>): string | null {
  const role = (row.role ?? (row.leader ? 'ab' : 'agent')).toLowerCase();
  if (role !== 'ab' && role !== 'aab') return null;
  return rungShort(row.orgLevelCode ?? role.toUpperCase(), ladder);
}

/** Active for a not-yet member's month, as the server writes it for a member: APE or policies above zero. */
function activeOf(row: UnregisteredRow): boolean | null {
  const ape = row.values.APE?.value ?? null;
  const policies = row.values.POLICY_COUNT?.value ?? null;
  if ((ape ?? 0) > 0 || (policies ?? 0) > 0) return true;
  return ape === null && policies === null ? null : false;
}

function MemberName({ row, label }: { row: MonthRow; label: string | null }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={row.name} photoUrl={row.photoUrl ?? null} seed={row.membershipId} size={28} />
      <span className="min-w-0">
        <span className="block text-base font-bold uppercase leading-tight text-ink">
          {label && <span className="mr-1 text-sm font-extrabold text-primary-ink">{label}</span>}
          {row.name}
        </span>
        <span className="block text-sm text-muted">{row.agentCode}</span>
      </span>
    </span>
  );
}

function NotYetName({ row }: { row: UnregisteredRow }) {
  const t = useMessages(dataUploadMessages);
  const name = row.fileName || row.agentCode;
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pill-grey text-navy">
        <LineIcon name="user" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold uppercase leading-tight text-ink">{name}</span>
        <span className="block text-sm text-muted">
          {row.agentCode} · {t.notRegistered} ·{' '}
          <Link href="/user-management/add" aria-label={t.inviteWho({ name })} className="font-bold text-primary-ink hover:underline">
            {t.invite}
          </Link>
        </span>
      </span>
    </span>
  );
}
