'use client';

import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner, Field, Switch, TextInput } from '@/components/ui/field';
import { updateSubscription, type TenantRow } from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { dayInZone, formatCalendarDay } from '@/lib/format';
import { groupDigits, parseDigits, toMajor, toMinor } from '@/lib/goals';

/** The five fields, as typed. Money and the limit are text until saved: an empty box is "none". */
interface Draft {
  startDate: string;
  endDate: string;
  price: string;
  maxLeaders: string;
  keepActiveAfterEnd: boolean;
}

type FieldName = 'startDate' | 'endDate' | 'pricePerLeaderMinor' | 'maxLeaders' | 'keepActiveAfterEnd';

function draftOf(row: TenantRow): Draft {
  const s = row.subscription;
  return {
    startDate: s?.startDate ?? '',
    endDate: s?.endDate ?? '',
    price: s?.pricePerLeaderMinor === null || s?.pricePerLeaderMinor === undefined
      ? '' : groupDigits(toMajor(s.pricePerLeaderMinor)),
    maxLeaders: s?.maxLeaders === null || s?.maxLeaders === undefined ? '' : String(s.maxLeaders),
    keepActiveAfterEnd: s?.keepActiveAfterEnd ?? false,
  };
}

/**
 * **Edit subscription** (ADR-0112 §2, P13.2-T3 AC-7; ADR-0113 §3, P13.2-T4 AC-7): an office's start and
 * end dates, its price per leader, its leader limit and *keep active*, opened from the offices list.
 *
 * A form in the product's titled dialog, `Modal` — the client asked for the subscription to be entered
 * *"directly from here"*, and the list has no column a form could live in (ADR-0062 §2, its third form;
 * parity row, *Improve*, the client's request). It shows **the leaders used now**, and warns, before
 * anything is saved, when the limit is below them (nobody is demoted) and when the end date has already
 * passed (everybody would be refused the moment it saves, unless *keep active* is on).
 *
 * Bounds are the API's: a price or a limit past them is refused there and named under its field, so
 * this screen holds no second copy of them (invariant §7). What it checks itself is only what one field
 * says about another: dates both or neither, the end on or after the start.
 */
export function SubscriptionDialog({
  row,
  open,
  onClose,
  onSaved,
}: {
  row: TenantRow;
  open: boolean;
  onClose: () => void;
  onSaved: (row: TenantRow) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<{ field: FieldName; message: string } | null>(null);

  // Opened again, it starts from what is saved, with no old refusal on it.
  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(row));
    setError(null);
    setFieldError(null);
  }, [open, row]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const max = draft.maxLeaders.trim() === '' ? null : Number(draft.maxLeaders);
  const overLimit = max !== null && Number.isFinite(max) && max < row.leadersUsed;
  // The office's today, in its own zone — never the browser's (invariant §9).
  const today = dayInZone(row.timezone, new Date());
  const endPassed = draft.endDate !== '' && draft.endDate < today;

  function refuse(field: FieldName, message: string) {
    setFieldError({ field, message });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const startDate = draft.startDate || null;
    const endDate = draft.endDate || null;
    if ((startDate === null) !== (endDate === null)) {
      refuse(startDate === null ? 'startDate' : 'endDate', 'Enter a start date and an end date, or neither.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      refuse('endDate', 'The end date is on or after the start date.');
      return;
    }
    if (draft.maxLeaders.trim() !== '' && !/^\d+$/.test(draft.maxLeaders.trim())) {
      refuse('maxLeaders', 'Enter a whole number of leaders, or leave it empty for no limit.');
      return;
    }

    setBusy(true);
    try {
      const saved = await updateSubscription(row._id, {
        startDate,
        endDate,
        pricePerLeaderMinor: draft.price.trim() === '' ? null : toMinor(parseDigits(draft.price)),
        maxLeaders: max,
        keepActiveAfterEnd: draft.keepActiveAfterEnd,
      });
      onSaved(saved);
    } catch (err) {
      const field = err instanceof ApiRequestError
        ? (err.error.details as { field?: FieldName } | undefined)?.field : undefined;
      if (err instanceof ApiRequestError && err.error.code === 'VALIDATION_FAILED' && field) {
        refuse(field, err.error.message);
      } else {
        setError(toDisplayError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const errorOf = (field: FieldName) => (fieldError?.field === field ? fieldError.message : undefined);

  return (
    <Modal
      open={open}
      title="Edit subscription"
      description={`KPM ${row.code} · ${row.branchName}`}
      onClose={onClose}
      className="max-w-[30rem]"
    >
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date" htmlFor={`${id}-start`} error={errorOf('startDate')}>
            <TextInput
              id={`${id}-start`}
              type="date"
              value={draft.startDate}
              invalid={Boolean(errorOf('startDate'))}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field
            label="End date"
            htmlFor={`${id}-end`}
            hint="The last day the office can be used."
            error={errorOf('endDate')}
          >
            <TextInput
              id={`${id}-end`}
              type="date"
              value={draft.endDate}
              invalid={Boolean(errorOf('endDate'))}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Price per leader per month"
          htmlFor={`${id}-price`}
          hint="Recorded with the office. Nothing is charged from it."
          error={errorOf('pricePerLeaderMinor')}
        >
          <TextInput
            id={`${id}-price`}
            inputMode="numeric"
            prefix="Rp"
            value={draft.price}
            invalid={Boolean(errorOf('pricePerLeaderMinor'))}
            onChange={(e) => set('price', e.target.value.trim() === '' ? '' : groupDigits(parseDigits(e.target.value)))}
          />
        </Field>

        <Field
          label="Maximum leaders"
          htmlFor={`${id}-max`}
          hint="ABs and AABs together, the Owner included. Empty for no limit."
          error={errorOf('maxLeaders')}
        >
          <TextInput
            id={`${id}-max`}
            inputMode="numeric"
            value={draft.maxLeaders}
            invalid={Boolean(errorOf('maxLeaders'))}
            onChange={(e) => set('maxLeaders', e.target.value)}
          />
        </Field>

        <p className="text-md text-navy">
          Leaders used now: <span className="font-semibold">{row.leadersUsed}</span>
        </p>

        <Switch
          id={`${id}-keep`}
          label="Keep active after the end date"
          checked={draft.keepActiveAfterEnd}
          onChange={(next) => set('keepActiveAfterEnd', next)}
        />

        {/* Said as the values change, so a reader who cannot see the box still hears it. */}
        <div aria-live="polite" className="flex flex-col gap-2">
          {overLimit && (
            <p className="rounded-md border border-alert/30 bg-alert/5 p-3 text-md text-navy">
              This office has {row.leadersUsed} leaders now, more than {max}. Nobody is demoted, and no new
              AB or AAB can be added until it has fewer than {max}.
            </p>
          )}
          {endPassed && (
            <p className="rounded-md border border-alert/30 bg-alert/5 p-3 text-md text-navy">
              {draft.keepActiveAfterEnd
                ? `This end date, ${formatCalendarDay(draft.endDate)}, has passed. The office stays open because it is kept active.`
                : `This end date, ${formatCalendarDay(draft.endDate)}, has passed. Once you save, nobody in this office can use AgencyBoost until the date is moved or it is kept active.`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
