'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { messagesIn } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatDayLong } from '@/lib/format';
import { lockMonth, reopenMonth, type MonthState } from '@/lib/production';
import { useCan } from '@/lib/session';
import { monthLabel } from './month-label';

/**
 * What the month's state means, in a sentence a reader can act on (ADR-0050): its days in `figures`, its words in
 * `language` (English when passed none, P18.98-T4).
 */
export function describeLock(state: MonthState, figures: Language, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(dataUploadMessages, language);
  const when = state.changedAt ? formatDayLong(state.changedAt, figures) : null;
  switch (state.reason) {
    case 'open':
      return t.openUntil({ day: formatCalendarDay(state.editableUntil, figures) });
    case 'schedule':
      return t.lockedBySchedule({ day: formatCalendarDay(state.editableUntil, figures) });
    case 'locked_by_hand':
      return t.lockedBy({ who: state.changedBy, when });
    default:
      return t.reopenedBy({ who: state.changedBy, when });
  }
}

/**
 * **Is this month open, and why** — with the one act that changes it (P9-T4, ADR-0050).
 *
 * The prototype has no notion of a month ending (L-38). The lock is enforced by the writes; this
 * line is how a reader learns of it before a write is refused, and the button is `lock_month` or
 * `reopen_month`, each behind a confirmation because each is audited and each changes what everybody
 * in the office can do to the month.
 */
export function MonthLock({ state, onChanged }: { state: MonthState; onChanged: (next: MonthState) => void }) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const canLock = useCan('data_upload:lock_month');
  const canReopen = useCan('data_upload:reopen_month');
  const [asking, setAsking] = useState<'lock' | 'reopen' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const label = monthLabel(state.month, figures);

  const act = async () => {
    const which = asking;
    setAsking(null);
    setBusy(true);
    setError(null);
    try {
      onChanged(await (which === 'lock' ? lockMonth : reopenMonth)(state.month));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span
          className={cn(
            'rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
            state.locked ? 'bg-alert/10 text-alert' : 'bg-navy/[0.06] text-navy',
          )}
        >
          {state.locked ? t.locked : t.open}
        </span>
        <span className="text-muted">{describeLock(state, figures, language)}</span>
        {!state.locked && canLock && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('lock')}>{t.lockMonth}</Button>
        )}
        {state.locked && canReopen && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('reopen')}>{t.reopenMonth}</Button>
        )}
      </div>
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
      <Dialog
        open={asking !== null}
        message={asking === 'lock' ? t.askLock({ month: label }) : t.askReopen({ month: label })}
        confirmLabel={asking === 'lock' ? t.lockMonth : t.reopenMonth}
        cancelLabel={t.cancel}
        onConfirm={act}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
