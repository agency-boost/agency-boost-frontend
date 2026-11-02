'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { reopenSession, type CoachingSession } from '@/lib/coaching';

/*
 * **Edit again's dialog, in a module of its own** (P18.99-T16, the bundle): the Coaching Session and the record load it
 * with `next/dynamic` on the first *Edit again*, so neither carries it in its first load.
 */

/**
 * The longest reason the server keeps (`functional/coaching.md`, *Data contract*). A validation limit, not a
 * domain constant: its source is the backend's reopen DTO (`coaching-session.dto.ts`), carried as `maxLength`.
 */
const REASON_MAX = 500;

/**
 * *Edit again*'s question (ADR-0079, a Fill): why, in the reader's words, kept with the session. The
 * dialog says, before it is sent, that everybody who reads the session — the coachee included — reads
 * the reason too, so nobody writes in it what they would not say to them.
 */
export function ReopenDialog({
  open, coacheeName, session, onClose, onReopened, onConflict,
}: {
  open: boolean;
  coacheeName: string;
  session: Pick<CoachingSession, 'sessionId' | 'version'>;
  onClose: () => void;
  onReopened: (session: CoachingSession) => Promise<void>;
  onConflict: () => void;
}) {
  const t = useMessages(coachingSessionMessages).editAgain;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fieldId = useId();

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await reopenSession(session.sessionId, session.version, reason.trim());
      await onReopened(next);
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') onConflict();
      else setError(shown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t.title}
      description={t.line({ name: coacheeName })}
      onClose={onClose}
      className="text-left"
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label htmlFor={fieldId} className="text-sm font-semibold text-navy">{t.reason}</label>
        <Textarea
          id={fieldId}
          value={reason}
          maxLength={REASON_MAX}
          required
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <ErrorBanner {...error} />}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" disabled={busy || !reason.trim()}>{t.button}</Button>
        </div>
      </form>
    </Modal>
  );
}
