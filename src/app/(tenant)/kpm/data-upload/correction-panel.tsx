'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDayLong, formatNumber, formatPercent, parseDecimal } from '@/lib/format';
import { formatRupiah, groupDigits, parseDigits, toMajor, toMinor } from '@/lib/goals';
import {
  correctCell, figureLabel, MONEY_METRICS, type Cadence, type CorrectionResult, type MetricCell,
  type ProductionMetric,
} from '@/lib/production';
import { monthLabel } from './month-label';

/** The figure somebody chose to correct, and what it reads now. */
export interface Editing {
  membershipId: string;
  name: string;
  agentCode: string;
  metric: ProductionMetric;
  cadence: Cadence;
  current: MetricCell;
}

const SOURCE: Record<string, string> = {
  imported: 'from the carrier’s file',
  corrected: 'corrected by hand',
  self_reported: 'reported by the agent',
};

/**
 * `corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”` — whose a figure is, as the table's ✎ says
 * it and, on a phone, the edit sheet's field (P18.97-T7 AC-2).
 */
export function correctedNote(cell: MetricCell): string {
  const c = cell.correction;
  const verb = cell.value === null ? 'emptied by hand' : 'corrected by hand';
  if (!c) return verb;
  return `${verb}${c.by ? ` by ${c.by}` : ''}${c.at ? ` on ${formatDayLong(c.at)}` : ''}${c.reason ? ` — “${c.reason}”` : ''}`;
}

/**
 * A figure in the table's own format, or *nothing reported*: money in full, as Data upload's cells write it
 * (ADR-0174 §4), a persistency with **every decimal it was filed with** and no *,0* (§3) — a figure checked against
 * the carrier's file is never rounded on its way to the reader — and a count as it is.
 */
export function showFigure(metric: ProductionMetric, value: number | null): string {
  if (value === null) return 'nothing reported';
  if (MONEY_METRICS.includes(metric)) return formatRupiah(value);
  if (metric === 'persistency') return formatPercent(value, { lossless: true });
  return formatNumber(value, { maxDecimals: 4 });
}

/**
 * **Correct one figure** (P9-T5) — the prototype's *"click any number to correct it manually"*
 * (`KPM_Owner.html:1316`), made safe.
 *
 * **A form, not a cell that edits itself.** The prototype makes every number `contenteditable` and
 * saves on blur, so a stray click and a tab away writes a figure, and invalid text silently becomes
 * `null` (`:4801-4803`). Here the figure is typed in the unit the table shows — rupiah in full, grouped
 * as it is typed — a reason is asked for, because a figure the carrier reported is being changed by
 * somebody who is not the carrier (ADR-0042), and **a refusal comes back on the figure it is about**.
 *
 * **Clear figure** is here and nowhere else (ADR-0051), behind a confirmation: no file can empty a
 * figure, so emptying one is a deliberate act with a name and a reason on it.
 */
export function CorrectionPanel({
  editing, month, revision, onDone, onCancel,
}: {
  editing: Editing;
  month: string;
  revision: number;
  onDone: (result: CorrectionResult) => void;
  onCancel: () => void;
}) {
  const { metric, cadence, current, name } = editing;
  const money = MONEY_METRICS.includes(metric);
  const percent = metric === 'persistency';
  const label = figureLabel(metric, cadence);
  const headingId = useId();
  const figureId = useId();
  const reasonId = useId();

  const [typed, setTyped] = useState(() => {
    if (current.value === null) return '';
    return money ? groupDigits(toMajor(current.value)) : String(current.value).replace('.', ',');
  });
  const [reason, setReason] = useState('');
  const [figureError, setFigureError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [refused, setRefused] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { document.getElementById(figureId)?.focus(); }, [figureId]);

  const needReason = () => {
    if (reason.trim()) return false;
    setReasonError('Say why the figure is being corrected.');
    return true;
  };

  const send = async (value: number | null) => {
    setBusy(true);
    setFigureError(undefined);
    setReasonError(undefined);
    setRefused(null);
    try {
      onDone(await correctCell({
        month, membershipId: editing.membershipId, metric, cadence, value, revision, reason,
      }));
    } catch (err) {
      const shown = toDisplayError(err);
      // A refusal about the figure goes on the figure; about the reason, on the reason (AC-1).
      if (err instanceof ApiRequestError && shown.code === 'UPLOAD_VALUE_OUT_OF_RANGE') setFigureError(shown.message);
      else if (err instanceof ApiRequestError && shown.details?.field === 'reason') setReasonError(shown.message);
      else setRefused(shown);
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const blank = typed.trim() === '';
    if (blank) setFigureError(current.value === null
      ? 'Type the figure.'
      : 'Type the new figure — to empty it, use Clear figure.');
    if (needReason() || blank) return;
    // A decimal with a comma or a point (`parseDecimal`, ADR-0167 §1); money in whole rupiah, digits only.
    const value = money ? toMinor(parseDigits(typed)) : parseDecimal(typed);
    if (Number.isNaN(value)) {
      setFigureError(`${label} is not a number.`);
      return;
    }
    void send(value);
  };

  return (
    <Card className="mb-5" role="region" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-md font-semibold text-navy">Correct {label} for {name}</h2>
      <p className="mt-1 text-sm text-muted">
        {editing.agentCode} · {monthLabel(month)} · Now: {showFigure(metric, current.value)}
        {current.provenance ? ` (${SOURCE[current.provenance]}` : ''}
        {current.correction?.by ? ` by ${current.correction.by}` : ''}
        {current.correction?.at ? ` on ${formatDayLong(current.correction.at)}` : ''}
        {current.correction?.reason ? ` — “${current.correction.reason}”` : ''}
        {current.provenance ? ')' : ''}
      </p>

      <form onSubmit={save} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="New figure" htmlFor={figureId} error={figureError}>
          <TextInput
            id={figureId}
            inputMode={money ? 'numeric' : 'decimal'}
            autoComplete="off"
            prefix={money ? 'Rp' : undefined}
            suffix={percent ? '%' : undefined}
            invalid={!!figureError}
            value={typed}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(money ? (v.replace(/\D/g, '') === '' ? '' : groupDigits(parseDigits(v))) : v);
            }}
          />
        </Field>
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
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {refused && <div className="sm:col-span-2"><ErrorBanner {...refused} /></div>}

        <div className="flex flex-wrap items-center gap-2.5 sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          {current.value !== null && (
            <Button
              type="button"
              variant="inlineDanger"
              disabled={busy}
              onClick={() => { if (!needReason()) setClearing(true); }}
            >
              Clear figure
            </Button>
          )}
        </div>
      </form>

      <Dialog
        open={clearing}
        message={`Clear ${label} for ${name} in ${monthLabel(month)}? The figure is emptied, as if nothing had been reported, and your reason is kept with the change.`}
        confirmLabel="Clear figure"
        tone="danger"
        onConfirm={() => { setClearing(false); void send(null); }}
        onCancel={() => setClearing(false)}
      />
    </Card>
  );
}
