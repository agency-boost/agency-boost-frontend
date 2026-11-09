'use client';

import { useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { SaveStateLabel } from '@/components/ui/save-state';
import { Segmented } from '@/components/ui/segmented';
import { messagesIn } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDecimalInput, moneyPrefix, parseDecimal } from '@/lib/format';
import { groupDigits, parseDigits, toMajor, toMinor } from '@/lib/goals';
import {
  columnHeading, columnLabel, correctCell, figureLabel, isMoney, ytdColumns, type CorrectionResult, type MetricCell,
  type MonthColumn, type MonthRow,
} from '@/lib/production';
import { YtdFigure } from '@/components/ytd-cell';
import { correctedNote, showFigure } from './correction-panel';
import { ActiveMark, Figure, formatFigure } from './figure-marks';
import { monthLabel } from './month-label';

/**
 * A field of the sheet: the sheet's width, and 48px tall on a phone and a tablet — so that a field with *Rp* or *%* in
 * its box, whose 1.5px border is the box's, still gives the input inside it 44px to tap (P18.9-T7 AC-6; P19.2-T3: the
 * sheet opens on a tablet too, UI-139).
 */
const SHEET_FIELD = 'w-full max-lg:h-12';

/** The switch's side: this month's figures, or the years to date. */
export type Side = 'monthly' | 'ytd';
export const SIDES: readonly Side[] = ['monthly', 'ytd'];

/** One of an agent's figures: `APE:monthly`, `KOMISI:ytd`. */
type FigureKey = `${string}:${Side}`;
const keyOf = (kode: string, side: Side): FigureKey => `${kode}:${side}`;

/**
 * **The figures a member's sheet edits** (P19.5-T2): this month's for each column of the template in force — a leaders'
 * column on an AB's or an AAB's row only — and the year to date of each column whose year to date is uploaded. A summed
 * year to date is calculated (R4), and is shown, never edited.
 */
function editable(columns: readonly MonthColumn[], row: Pick<MonthRow, 'leader'>) {
  return [
    ...columns.filter((c) => c.inForce && (c.rows === 'all' || row.leader)).map((column) => ({ column, side: 'monthly' as const })),
    ...columns.filter((c) => c.inForce && c.ytd === 'upload').map((column) => ({ column, side: 'ytd' as const })),
  ].map((f) => ({ ...f, key: keyOf(f.column.kode, f.side) }));
}

/** A figure as its field holds it: rupiah grouped as typed, a decimal with a comma, nothing as empty. */
function asTyped(column: MonthColumn, value: number | null, figures: Language): string {
  if (value === null) return '';
  return isMoney(column.unit) ? groupDigits(toMajor(value), figures) : formatDecimalInput(value, figures);
}

/** What a field says, in the unit it is stored in — money in sen; `null` for an empty field; `NaN` for not a number. */
function asValue(column: MonthColumn, typed: string): number | null {
  if (typed.trim() === '') return null;
  return isMoney(column.unit) ? toMinor(parseDigits(typed)) : parseDecimal(typed);
}

/** One figure to send: the value, and what the server holds now. */
interface Change { column: MonthColumn; side: Side; key: FigureKey; value: number | null; held: number | null }

/** The switch's two sides (UI-139: *"Bulan ini | YTD"*), in the cadences' order — the sheet's and the table's. */
export function useCadenceTabs() {
  const t = useMessages(dataUploadMessages);
  return SIDES.map((side) => ({ id: side, label: side === 'monthly' ? t.switchMonth : t.switchYtd }));
}

/**
 * **An agent's figures, in a sheet, on a phone and a tablet** (P18.9-T7 AC-2, ADR-0178 §4; *changed 2026-11-05,
 * P19.2-T3 AC-1*: the client's UI-139, `kpm-owner-mobile-2026-11-03` screen 3 — *"a sheet with the values, same switch,
 * each value editable (manual correction, ✎), pinned Simpan koreksi"*).
 *
 * A row's tap opens it: `Modal placement="responsive"` — a sheet below 1024px, where the rows are — with its drag
 * handle, named *Correct figures for {name}*, the agent's code and the month under it, opened on its title so no
 * keyboard rises before a field is chosen. **The figures sit under the page's *Bulan ini | YTD* switch**: one cadence's
 * six at a time, the other's kept as typed while it is out of sight, and a refusal on a figure brings its cadence back
 * into view. *Active (MAA)*, the server's answer, closes them, read-only.
 *
 * **For somebody who may correct a figure, in a month that is open** (`correctable`), each of the twelve is a labelled
 * field — 16px and at least 44px to tap below 1024px (`TextInput`, `SHEET_FIELD`): money in rupiah grouped as it is
 * typed, a persistency with its comma and *%*, a count as it is; a figure corrected by hand carries **✎** beside its
 * label and says who, when and why under its field, as the table's ✎ does. **Otherwise the sheet reads**: the six as the
 * cells write them, the ✎ with them, and *Close*.
 *
 * **Saved as the table's panel saves one** (`CorrectionPanel`, P9-T5): one reason, asked for before anything is sent,
 * and each figure that changed sent through the unchanged `PATCH /kpm/data-upload/cell` with it — the month's revision
 * the reader saw first, then each answer's, so the server writes, audits and checks every figure as it does one.
 * **A field emptied is a figure cleared**, which no file can do (ADR-0051): it is asked first, naming each figure. A
 * refusal lands on the figure it is about, or on the reason, or above the buttons; a figure saved before it stays saved
 * and the sheet stays open.
 *
 * **A save keeps the sheet open, saying *Tersimpan ✓* with ✎ on every figure it wrote** (UI-139's *Done when*: *"a
 * manual correction from the sheet shows 'Tersimpan' and ✎ on that value"*); *Cancel* becomes *Close*. Closing — saved
 * or cancelled — hands the page every correction it made, which the page then says and reads the month again.
 *
 * *Since P19.5-T2* (ADR-0214 §5, §10): **the figures are the template's columns**, by kode. This month's side holds each
 * column in force — a leaders' column a field on an AB's or an AAB's row only — and a column before its start reads *—*;
 * the YTD side holds each column with a year to date, a summed one **shown greyed, never a field** (R4, the shared
 * `YtdFigure`), an uploaded one a field. Each figure is sent `{ kode, ytd }`, in the order the sheet lists it.
 */
export function FiguresSheet({
  row, columns, month, revision, correctable = true, onClose,
}: {
  row: MonthRow;
  /** The template's columns, as the month read names them (P19.5-T2). */
  columns: readonly MonthColumn[];
  month: string;
  /** The month's revision the reader saw: a month that moved since refuses the first figure. */
  revision: number;
  /** Somebody who may correct a figure, in a month that is open: the figures are fields. Otherwise the sheet reads. */
  correctable?: boolean;
  /** Closed, with every correction it saved — none if nothing was. */
  onClose: (saved: CorrectionResult[]) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const ui = useMessages(uiV1Messages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const tabs = useCadenceTabs();
  const formId = useId();
  const reasonId = useId();
  const fieldId = useId();
  const [cadence, setCadence] = useState<Side>('monthly');
  const fields = editable(columns, row);
  const cellOf = (kode: string, side: Side): MetricCell =>
    (side === 'monthly' ? row.values[kode] : row.ytd[kode]) ?? { value: null, provenance: null, correction: null };
  const [held, setHeld] = useState<Record<FigureKey, MetricCell>>(() => Object.fromEntries(
    fields.map(({ column, side, key }) => [key, cellOf(column.kode, side)]),
  ) as Record<FigureKey, MetricCell>);
  const [typed, setTyped] = useState<Record<FigureKey, string>>(() => Object.fromEntries(
    fields.map(({ column, side, key }) => [key, asTyped(column, cellOf(column.kode, side).value, figures)]),
  ) as Record<FigureKey, string>);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FigureKey, string>>>({});
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [refused, setRefused] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(revision);
  const [saved, setSaved] = useState<CorrectionResult[]>([]);
  const [clearing, setClearing] = useState<Change[] | null>(null);
  const label = monthLabel(month, figures);

  /** The figures whose field no longer says what the server holds. */
  const changes: Change[] = fields.flatMap(({ column, side, key }) => {
    const value = asValue(column, typed[key]);
    const was = held[key].value;
    return value === was ? [] : [{ column, side, key, value, held: was }];
  });
  /** Something saved, and nothing typed since: the sheet says *Tersimpan ✓* and offers *Close*. */
  const settled = saved.length > 0 && changes.length === 0;

  const close = () => onClose(saved);

  /** Each figure in turn, with the reason and the revision the last answer gave; a refusal stops the rest. */
  const send = async (all: readonly Change[]) => {
    setBusy(true);
    setRefused(null);
    let at = rev;
    const done = [...saved];
    for (const change of all) {
      try {
        const result = await correctCell({
          month, membershipId: row.membershipId, kode: change.column.kode, ytd: change.side === 'ytd',
          value: change.value, revision: at, reason,
        });
        at = result.state.revision;
        done.push(result);
        // Held now as the server answered it — and its field says so, ✎ and all; who and when arrive with the month's
        // next read.
        setHeld((now) => ({ ...now, [change.key]: { value: result.after.value, provenance: result.after.provenance, correction: null } }));
        setTyped((now) => ({ ...now, [change.key]: asTyped(change.column, result.after.value, figures) }));
      } catch (err) {
        const shown = toDisplayError(err);
        if (err instanceof ApiRequestError && shown.code === 'UPLOAD_VALUE_OUT_OF_RANGE') {
          setErrors((now) => ({ ...now, [change.key]: shown.message }));
          // The refused figure in sight, whichever side of the switch it is on.
          setCadence(change.side);
        } else if (err instanceof ApiRequestError && shown.details?.field === 'reason') {
          setReasonError(shown.message);
        } else {
          setRefused(shown);
        }
        setRev(at);
        setSaved(done);
        setBusy(false);
        return;
      }
    }
    setRev(at);
    setSaved(done);
    setBusy(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setReasonError(undefined);
    const wrongChanges = changes.filter((c) => c.value !== null && Number.isNaN(c.value));
    const wrong = Object.fromEntries(wrongChanges
      .map((c) => [c.key, t.notANumber({ label: figureLabel(c.column, c.side === 'ytd', language) })]));
    const noReason = reason.trim() === '';
    if (noReason) setReasonError(t.sayWhy);
    if (wrongChanges.length > 0) {
      setErrors(wrong);
      // The first figure that is not a number in sight.
      if (!wrongChanges.some((c) => c.side === cadence)) setCadence(wrongChanges[0].side);
    }
    if (noReason || wrongChanges.length > 0 || changes.length === 0) return;
    // Emptying is clearing, and clearing is asked first (ADR-0051), as the panel's *Clear figure* is.
    const cleared = changes.filter((c) => c.value === null);
    if (cleared.length > 0) setClearing(changes);
    else void send(changes);
  };

  const clearedNames = (clearing ?? []).filter((c) => c.value === null).map((c) => figureLabel(c.column, c.side === 'ytd', language));

  /** A column's figure, read-only: *—* before its start, or on an agent's row for a leaders' column; a summed YTD greyed. */
  const readOnly = (column: MonthColumn, side: Side) => {
    if (!column.inForce) return <span className="text-muted" title={t.startsIn({ month: monthLabel(column.effectiveFrom, figures) })}>—</span>;
    if (side === 'monthly') {
      if (column.rows === 'leaders' && !row.leader) return <span className="text-muted" aria-label={t.nothingReported}>—</span>;
      return <Figure unit={column.unit} cell={cellOf(column.kode, side)} />;
    }
    const cell = cellOf(column.kode, side);
    return (
      <YtdFigure
        text={cell.value === null ? null : formatFigure(column.unit, cell.value, figures)}
        calculated={column.ytd === 'sum'}
        missingMonths={column.ytd === 'sum' ? column.ytdMissingMonths : []}
      />
    );
  };
  const sideColumns = (side: Side) => (side === 'monthly' ? columns : ytdColumns(columns));

  /** The switch, the figures of its side, and *Active (MAA)*: what both kinds of sheet open on. */
  const switched = (panel: (c: Side) => React.ReactNode) => (
    <>
      <Segmented
        label={t.switchLabel}
        tabs={tabs}
        active={cadence}
        onSelect={(id) => setCadence(id as Side)}
        phoneLayout="wrap"
        className="rounded-pill"
      >
        {() => panel(cadence)}
      </Segmented>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span>{t.activeColumn}:</span>
        <ActiveMark active={row.monthlyActiveAgent} />
      </p>
    </>
  );

  if (!correctable) {
    return (
      <Modal
        open
        placement="responsive"
        handle
        closeLabel={ui.close}
        title={t.figuresOf({ name: row.name })}
        description={`${row.agentCode} · ${label}`}
        focusDialog
        onClose={close}
        footer={<Button variant="secondary" onClick={close} className="max-lg:h-11">{t.close}</Button>}
      >
        {switched((c) => (
          <dl aria-label={c === 'monthly' ? t.switchMonth : t.switchYtd} className="grid grid-cols-2 gap-1.5">
            {sideColumns(c).map((column) => (
              <div key={column.kode} className="flex min-h-14 flex-col justify-center rounded-row bg-hover-row px-2.5 py-2">
                <dt className="text-sm font-semibold text-muted">{columnHeading(column, language)}</dt>
                <dd className="text-md font-bold">{readOnly(column, c)}</dd>
              </div>
            ))}
          </dl>
        ))}
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open
        placement="responsive"
        handle
        closeLabel={ui.close}
        title={t.correctFiguresFor({ name: row.name })}
        description={`${row.agentCode} · ${label}`}
        focusDialog
        onClose={close}
        footer={(
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="submit" form={formId} disabled={busy || changes.length === 0} className="max-lg:h-11">
              {busy ? t.saving : t.saveCorrections}
            </Button>
            <Button variant="secondary" onClick={close} disabled={busy} className="max-lg:h-11">
              {settled ? t.close : t.cancel}
            </Button>
            {settled && <SaveStateLabel state="saved" />}
          </div>
        )}
      >
        <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
          {switched((shown) => SIDES.map((c) => (
            // Both sides stay mounted, so what was typed on the other is kept; only the switch's side is drawn.
            <fieldset key={c} hidden={c !== shown} className="flex flex-col gap-3">
              <legend className="sr-only">{c === 'monthly' ? t.switchMonth : t.switchYtd}</legend>
              {sideColumns(c).map((column) => {
                const key = keyOf(column.kode, c);
                if (!fields.some((f) => f.key === key)) {
                  // Not a field: before its start, an agent's row for a leaders' column, or a summed year to date.
                  return (
                    <div key={key} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-navy">{columnHeading(column, language)}</span>
                      <span className="text-base font-semibold">{readOnly(column, c)}</span>
                    </div>
                  );
                }
                const cell = held[key];
                const money = isMoney(column.unit);
                const mended = cell.provenance === 'corrected';
                // Named as a sentence names it — *APE this month* — where the switch says the group.
                const named = (
                  <>
                    {columnLabel(column, language)}
                    <span className="sr-only">{c === 'monthly' ? t.thisMonth : t.yearToDate}</span>
                  </>
                );
                return (
                  <div key={key} className="relative">
                    {/* ✎ on a figure corrected by hand, beside its label; who, when and why are its field's description. */}
                    {mended && (
                      <span aria-hidden="true" data-corrected="" className="absolute right-0 top-0 text-sm font-bold text-navy">✎</span>
                    )}
                    <Field
                      label={named}
                      htmlFor={`${fieldId}-${key}`}
                      hint={mended ? correctedNote(cell, figures, language) : undefined}
                      error={errors[key]}
                    >
                      <TextInput
                        id={`${fieldId}-${key}`}
                        inputMode={money ? 'numeric' : 'decimal'}
                        autoComplete="off"
                        placeholder="—"
                        prefix={money ? moneyPrefix(figures) : undefined}
                        suffix={column.unit === 'percent' ? '%' : undefined}
                        invalid={!!errors[key]}
                        value={typed[key]}
                        disabled={busy}
                        className={SHEET_FIELD}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTyped((now) => ({
                            ...now,
                            [key]: money ? (v.replace(/\D/g, '') === '' ? '' : groupDigits(parseDigits(v), figures)) : v,
                          }));
                        }}
                      />
                    </Field>
                  </div>
                );
              })}
            </fieldset>
          )))}
          <Field label={t.why} htmlFor={reasonId} hint={t.whyHint} error={reasonError}>
            <TextInput
              id={reasonId}
              maxLength={500}
              invalid={!!reasonError}
              value={reason}
              disabled={busy}
              className={SHEET_FIELD}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {refused && <ErrorBanner {...refused} />}
        </form>
      </Modal>
      <Dialog
        open={clearing !== null}
        message={t.clearSome({ labels: clearedNames, name: row.name, month: label })}
        confirmLabel={clearedNames.length === 1 ? t.clearFigure : t.clearFigures}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={() => {
          const all = clearing ?? [];
          setClearing(null);
          void send(all);
        }}
        onCancel={() => setClearing(null)}
      />
    </>
  );
}

/**
 * **What the sheet did, in a sentence** — the panel's own words for one figure (*"Corrected APE this month for Rina
 * Wijaya: Rp 1.500.000 → Rp 2.000.000."*), and for several each figure's change after a count of them. Its figures in
 * `figures`, its words in `language` (English when passed none, P18.10-T4).
 */
export function correctedWords(
  who: string,
  results: readonly CorrectionResult[],
  columns: readonly MonthColumn[],
  figures: Language,
  language: Language = SOURCE_LANGUAGE,
): string {
  const t = messagesIn(dataUploadMessages, language);
  const columnOf = (r: CorrectionResult): Pick<MonthColumn, 'label' | 'unit'> =>
    columns.find((c) => c.kode === r.kode) ?? { label: { id: r.kode, en: r.kode }, unit: 'count' };
  const label = (r: CorrectionResult) => figureLabel(columnOf(r), r.ytd, language);
  const shown = (r: CorrectionResult, value: number | null) => showFigure(columnOf(r).unit, value, figures, language);
  const changed = results.filter((r) => r.changed);
  if (changed.length === 0) {
    const [first] = results;
    return t.unchanged({ label: label(first), who, after: shown(first, first.after.value) });
  }
  if (changed.length === 1) {
    const [r] = changed;
    return t.corrected({ label: label(r), who, before: shown(r, r.before.value), after: shown(r, r.after.value) });
  }
  const changes = changed.map((r) => `${label(r)} ${shown(r, r.before.value)} → ${shown(r, r.after.value)}`).join('; ');
  return t.correctedMany({ n: changed.length, who, changes });
}
