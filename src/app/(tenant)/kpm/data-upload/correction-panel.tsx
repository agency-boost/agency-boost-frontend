'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { messagesIn } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDayLong, formatDecimalInput, formatNumber, formatPercent, moneyPrefix, parseDecimal } from '@/lib/format';
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

/**
 * `corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”` — whose a figure is, as the table's ✎ says it
 * and, on a phone, the edit sheet's field (P18.97-T7 AC-2). Its day in `figures`, its words in `language` (English when
 * passed none, P18.98-T4); the name and the reason as typed.
 */
export function correctedNote(cell: MetricCell, figures: Language, language: Language = SOURCE_LANGUAGE): string {
  const c = cell.correction;
  return messagesIn(dataUploadMessages, language).handNote({
    emptied: cell.value === null,
    by: c?.by ?? null,
    day: c?.at ? formatDayLong(c.at, figures) : null,
    reason: c?.reason ?? null,
  });
}

/**
 * A figure in the table's own format, or *nothing reported*: money in full, as Data upload's cells write it
 * (ADR-0174 §4), a persistency with **every decimal it was filed with** and no *,0* (§3) — a figure checked against
 * the carrier's file is never rounded on its way to the reader — and a count as it is. The figure in `figures`, the
 * words for none in `language` (English when passed none, P18.98-T4).
 */
export function showFigure(
  metric: ProductionMetric,
  value: number | null,
  figures: Language,
  language: Language = SOURCE_LANGUAGE,
): string {
  if (value === null) return messagesIn(dataUploadMessages, language).nothingReported;
  if (MONEY_METRICS.includes(metric)) return formatRupiah(value, figures);
  if (metric === 'persistency') return formatPercent(value, { lossless: true }, figures);
  return formatNumber(value, { maxDecimals: 4 }, figures);
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
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { metric, cadence, current, name } = editing;
  const money = MONEY_METRICS.includes(metric);
  const percent = metric === 'persistency';
  const label = figureLabel(metric, cadence, language);
  const headingId = useId();
  const figureId = useId();
  const reasonId = useId();

  const [typed, setTyped] = useState(() => {
    if (current.value === null) return '';
    return money ? groupDigits(toMajor(current.value), figures) : formatDecimalInput(current.value, figures);
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
    setReasonError(t.sayWhy);
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
    if (blank) setFigureError(current.value === null ? t.typeFigure : t.typeNewFigure);
    if (needReason() || blank) return;
    // A decimal with a comma or a point (`parseDecimal`, ADR-0167 §1); money in whole rupiah, digits only.
    const value = money ? toMinor(parseDigits(typed)) : parseDecimal(typed);
    if (Number.isNaN(value)) {
      setFigureError(t.notANumber({ label }));
      return;
    }
    void send(value);
  };

  return (
    <Card className="mb-5" role="region" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-md font-semibold text-navy">{t.correctHeading({ label, name })}</h2>
      <p className="mt-1 text-sm text-muted">
        {editing.agentCode} · {monthLabel(month, figures)} · {t.now({ figure: showFigure(metric, current.value, figures, language) })}
        {current.provenance ? t.sourceNote({
          source: t.source[current.provenance],
          by: current.correction?.by ?? null,
          day: current.correction?.at ? formatDayLong(current.correction.at, figures) : null,
          reason: current.correction?.reason ?? null,
        }) : ''}
      </p>

      <form onSubmit={save} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t.newFigure} htmlFor={figureId} error={figureError}>
          <TextInput
            id={figureId}
            inputMode={money ? 'numeric' : 'decimal'}
            autoComplete="off"
            prefix={money ? moneyPrefix(figures) : undefined}
            suffix={percent ? '%' : undefined}
            invalid={!!figureError}
            value={typed}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(money ? (v.replace(/\D/g, '') === '' ? '' : groupDigits(parseDigits(v), figures)) : v);
            }}
          />
        </Field>
        <Field label={t.why} htmlFor={reasonId} hint={t.whyHint} error={reasonError}>
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
          <Button type="submit" disabled={busy}>{busy ? t.saving : t.saveCorrection}</Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>{t.cancel}</Button>
          {current.value !== null && (
            <Button
              type="button"
              variant="inlineDanger"
              disabled={busy}
              onClick={() => { if (!needReason()) setClearing(true); }}
            >
              {t.clearFigure}
            </Button>
          )}
        </div>
      </form>

      <Dialog
        open={clearing}
        message={t.clearOne({ label, name, month: monthLabel(month, figures) })}
        confirmLabel={t.clearFigure}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={() => { setClearing(false); void send(null); }}
        onCancel={() => setClearing(false)}
      />
    </Card>
  );
}
