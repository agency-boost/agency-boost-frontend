'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
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
 * `language` (English when passed none, P18.10-T4).
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
    // P19.5-T2 AC-8 (ADR-0214 §11): a month of the required history never written, open until its first upload.
    case 'history':
      return t.historyOpen({ day: formatCalendarDay(state.editableUntil, figures) });
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
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-1; the client's UI-139, `kpm-owner-mobile` 2 and `kpm-owner-desktop` 2):* **a pill
 * strip** — green *Terbuka sampai 7 Des 2026* while the month is open, red *Terkunci* once it is not — and *Kunci bulan*
 * (or *Buka kembali bulan*) beside it. The sentence that said why — who locked it, when it locks itself — is the strip's
 * ⓘ, its words unchanged: one of the *"long explanations behind ⓘ"*. 44px tall below 1024px, 36px from it.
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
  const why = describeLock(state, figures, language);
  const short = state.locked
    ? t.locked
    : state.reason === 'open' ? t.openUntilShort({ day: formatCalendarDay(state.editableUntil, figures) }) : t.open;

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
    <div className="min-w-0 flex-1 lg:flex-none">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <p
          data-lock-strip=""
          data-tone={state.locked ? 'red' : 'green'}
          className={cn(
            'inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold lg:min-h-9',
            state.locked ? 'bg-pill-red text-pill-red-ink' : 'bg-pill-green text-pill-green-ink',
          )}
        >
          {state.locked && <LineIcon name="lock" className="h-4 w-4 shrink-0" />}
          <span className="truncate">{short}</span>
          <TippedGlyph glyph="ⓘ" name={why} tip={why} align="fit" />
        </p>
        {!state.locked && canLock && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('lock')} className="text-navy">{t.lockMonth}</Button>
        )}
        {state.locked && canReopen && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('reopen')} className="text-navy">{t.reopenMonth}</Button>
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
