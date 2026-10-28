'use client';

import { useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { CONTROL_PHONE } from '@/components/ui/phone';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { parseDecimal } from '@/lib/format';
import { groupDigits, parseDigits, toMajor, toMinor } from '@/lib/goals';
import {
  CADENCE_GROUP_LABEL, CADENCES, correctCell, figureLabel, METRIC_LABEL, MONEY_METRICS, PRODUCTION_METRICS,
  type Cadence, type CorrectionResult, type MetricCell, type MonthRow, type ProductionMetric,
} from '@/lib/production';
import { correctedNote, showFigure } from './correction-panel';
import { monthLabel } from './month-label';

/**
 * A field of the sheet: the sheet's width, and 48px tall on a phone — so that a field with *Rp* or *%* in its box, whose
 * 1.5px border is the box's, still gives the input inside it 44px to tap (P18.97-T7 AC-6). The sheet is a phone's alone.
 */
const SHEET_FIELD = 'w-full max-md:h-12';

/** One of an agent's twelve figures: `ape:monthly`. */
type FigureKey = `${ProductionMetric}:${Cadence}`;
const keyOf = (metric: ProductionMetric, cadence: Cadence): FigureKey => `${metric}:${cadence}`;
const FIGURES = CADENCES.flatMap((cadence) => PRODUCTION_METRICS.map((metric) => ({ metric, cadence, key: keyOf(metric, cadence) })));

/** A figure as its field holds it: rupiah grouped as typed, a decimal with a comma, nothing as empty. */
function asTyped(metric: ProductionMetric, value: number | null): string {
  if (value === null) return '';
  return MONEY_METRICS.includes(metric) ? groupDigits(toMajor(value)) : String(value).replace('.', ',');
}

/** What a field says, in the unit it is stored in — money in sen; `null` for an empty field; `NaN` for not a number. */
function asValue(metric: ProductionMetric, typed: string): number | null {
  if (typed.trim() === '') return null;
  return MONEY_METRICS.includes(metric) ? toMinor(parseDigits(typed)) : parseDecimal(typed);
}

/** One figure to send: the value, and what the server holds now. */
interface Change { metric: ProductionMetric; cadence: Cadence; key: FigureKey; value: number | null; held: number | null }

/**
 * **The order the figures are sent in.** Each is one `PATCH`, and the server checks every one against the figure its
 * pair holds at that moment — a month's APE never more than the year to date (`breaksYtd`). So where a metric's month
 * and year both change, the one that keeps the pair whole goes first: the year, when the month already held fits
 * under the new year; the month otherwise. One of the two always does, since the pair the reader typed is whole.
 */
export function inSafeOrder(changes: readonly Change[]): Change[] {
  const out = [...changes];
  for (const metric of PRODUCTION_METRICS) {
    const month = out.findIndex((c) => c.metric === metric && c.cadence === 'monthly');
    const year = out.findIndex((c) => c.metric === metric && c.cadence === 'ytd');
    if (month < 0 || year < 0) continue;
    const held = out[month].held;
    const next = out[year].value;
    const yearFirst = held === null || next === null || held <= next;
    if (yearFirst && year > month) out.splice(month, 0, ...out.splice(year, 1));
  }
  return out;
}

/**
 * **An agent's figures, in a sheet, on a phone** (P18.97-T7 AC-2, ADR-0178 §4; the client's KPM Owner review of
 * 2026-10-27, UI-034 and UI-040: *"Data upload: per-agent cards, tap to edit"* — 340 cells under 44px, a 13px editor).
 *
 * The card's tap opens it: `Modal placement="sheet"`, named *Correct figures for {name}*, the agent's code and the month
 * under it, opened on its title so no keyboard rises before a field is chosen. **Each of the twelve figures is a
 * labelled field** — *This Month* and *YTD*, the table's two groups, as fieldsets — 16px and at least 44px to tap on a
 * phone (`TextInput`, `SHEET_FIELD`): money in rupiah grouped as it is typed, a persistency with its comma and *%*, a count
 * as it is; a figure corrected by hand says who, when and why under its field, as the table's ✎ does.
 *
 * **Saved as the table's panel saves one** (`CorrectionPanel`, P9-T5): one reason, asked for before anything is sent,
 * and each figure that changed sent through the unchanged `PATCH /kpm/data-upload/cell` with it — the month's revision
 * the reader saw first, then each answer's, so the server writes, audits and checks every figure as it does one.
 * **A field emptied is a figure cleared**, which no file can do (ADR-0051): it is asked first, naming each figure. A
 * refusal lands on the figure it is about, or on the reason, or above the buttons; a figure saved before it stays saved
 * and the sheet stays open. Closing — saved or cancelled — hands the page every correction it made, which the page then
 * says and reads the month again.
 */
export function FiguresSheet({
  row, month, revision, onClose,
}: {
  row: MonthRow;
  month: string;
  /** The month's revision the reader saw: a month that moved since refuses the first figure. */
  revision: number;
  /** Closed, with every correction it saved — none if nothing was. */
  onClose: (saved: CorrectionResult[]) => void;
}) {
  const formId = useId();
  const reasonId = useId();
  const fieldId = useId();
  const [held, setHeld] = useState<Record<FigureKey, MetricCell>>(() => Object.fromEntries(
    FIGURES.map(({ metric, cadence, key }) => [key, row.metrics[metric][cadence]]),
  ) as Record<FigureKey, MetricCell>);
  const [typed, setTyped] = useState<Record<FigureKey, string>>(() => Object.fromEntries(
    FIGURES.map(({ metric, cadence, key }) => [key, asTyped(metric, row.metrics[metric][cadence].value)]),
  ) as Record<FigureKey, string>);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FigureKey, string>>>({});
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [refused, setRefused] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(revision);
  const [saved, setSaved] = useState<CorrectionResult[]>([]);
  const [clearing, setClearing] = useState<Change[] | null>(null);
  const label = monthLabel(month);

  /** The figures whose field no longer says what the server holds. */
  const changes: Change[] = FIGURES.flatMap(({ metric, cadence, key }) => {
    const value = asValue(metric, typed[key]);
    const was = held[key].value;
    return value === was ? [] : [{ metric, cadence, key, value, held: was }];
  });

  const close = () => onClose(saved);

  /** Each figure in turn, with the reason and the revision the last answer gave; a refusal stops the rest. */
  const send = async (all: readonly Change[]) => {
    setBusy(true);
    setRefused(null);
    let at = rev;
    const done = [...saved];
    for (const change of inSafeOrder(all)) {
      try {
        const result = await correctCell({
          month, membershipId: row.membershipId, metric: change.metric, cadence: change.cadence,
          value: change.value, revision: at, reason,
        });
        at = result.state.revision;
        done.push(result);
        // Held now as the server answered it; who and when arrive with the month's next read.
        setHeld((now) => ({ ...now, [change.key]: { value: result.after.value, provenance: result.after.provenance, correction: null } }));
      } catch (err) {
        const shown = toDisplayError(err);
        if (err instanceof ApiRequestError && shown.code === 'UPLOAD_VALUE_OUT_OF_RANGE') {
          setErrors((now) => ({ ...now, [change.key]: shown.message }));
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
    onClose(done);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setReasonError(undefined);
    const wrong = Object.fromEntries(changes
      .filter((c) => c.value !== null && Number.isNaN(c.value))
      .map((c) => [c.key, `${figureLabel(c.metric, c.cadence)} is not a number.`]));
    const noReason = reason.trim() === '';
    if (noReason) setReasonError('Say why the figure is being corrected.');
    if (Object.keys(wrong).length > 0) setErrors(wrong);
    if (noReason || Object.keys(wrong).length > 0 || changes.length === 0) return;
    // Emptying is clearing, and clearing is asked first (ADR-0051), as the panel's *Clear figure* is.
    const cleared = changes.filter((c) => c.value === null);
    if (cleared.length > 0) setClearing(changes);
    else void send(changes);
  };

  const clearedNames = (clearing ?? []).filter((c) => c.value === null).map((c) => figureLabel(c.metric, c.cadence));

  return (
    <>
      <Modal
        open
        placement="sheet"
        title={`Correct figures for ${row.name}`}
        description={`${row.agentCode} · ${label}`}
        focusDialog
        onClose={close}
        footer={(
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="submit" form={formId} disabled={busy || changes.length === 0} className={CONTROL_PHONE}>
              {busy ? 'Saving…' : 'Save corrections'}
            </Button>
            <Button variant="secondary" onClick={close} disabled={busy} className={CONTROL_PHONE}>Cancel</Button>
          </div>
        )}
      >
        <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
          {CADENCES.map((cadence) => (
            <fieldset key={cadence} className="flex flex-col gap-3">
              <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">{CADENCE_GROUP_LABEL[cadence]}</legend>
              {PRODUCTION_METRICS.map((metric) => {
                const key = keyOf(metric, cadence);
                const cell = held[key];
                const money = MONEY_METRICS.includes(metric);
                return (
                  <Field
                    key={key}
                    label={(
                      <>
                        {METRIC_LABEL[metric]}
                        {/* Named as a sentence names it — *APE this month* — where the legend says the group. */}
                        <span className="sr-only">{cadence === 'monthly' ? ' this month' : ' year to date'}</span>
                      </>
                    )}
                    htmlFor={`${fieldId}-${key}`}
                    hint={cell.provenance === 'corrected' ? correctedNote(cell) : undefined}
                    error={errors[key]}
                  >
                    <TextInput
                      id={`${fieldId}-${key}`}
                      inputMode={money ? 'numeric' : 'decimal'}
                      autoComplete="off"
                      placeholder="—"
                      prefix={money ? 'Rp' : undefined}
                      suffix={metric === 'persistency' ? '%' : undefined}
                      invalid={!!errors[key]}
                      value={typed[key]}
                      disabled={busy}
                      className={SHEET_FIELD}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTyped((now) => ({
                          ...now,
                          [key]: money ? (v.replace(/\D/g, '') === '' ? '' : groupDigits(parseDigits(v))) : v,
                        }));
                      }}
                    />
                  </Field>
                );
              })}
            </fieldset>
          ))}
          <Field
            label="Why is it being corrected?"
            htmlFor={reasonId}
            hint="Kept with the figure, and in the audit log."
            error={reasonError}
          >
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
        message={`Clear ${clearedNames.join(' and ')} for ${row.name} in ${label}? `
          + `${clearedNames.length === 1 ? 'The figure is' : 'The figures are'} emptied, as if nothing had been reported, `
          + 'and your reason is kept with the change.'}
        confirmLabel={clearedNames.length === 1 ? 'Clear figure' : 'Clear figures'}
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
 * Wijaya: Rp 1.500.000 → Rp 2.000.000."*), and for several each figure's change after a count of them.
 */
export function correctedWords(who: string, results: readonly CorrectionResult[]): string {
  const changed = results.filter((r) => r.changed);
  if (changed.length === 0) {
    const [first] = results;
    return `${figureLabel(first.metric, first.cadence)} for ${who} already reads ${showFigure(first.metric, first.after.value)} — nothing was changed.`;
  }
  const each = (r: CorrectionResult) => `${showFigure(r.metric, r.before.value)} → ${showFigure(r.metric, r.after.value)}`;
  if (changed.length === 1) {
    const [r] = changed;
    return `Corrected ${figureLabel(r.metric, r.cadence)} for ${who}: ${each(r)}.`;
  }
  return `Corrected ${changed.length} figures for ${who}: `
    + `${changed.map((r) => `${figureLabel(r.metric, r.cadence)} ${each(r)}`).join('; ')}.`;
}
