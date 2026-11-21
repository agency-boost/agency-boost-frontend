'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  createMeeting, deleteMeeting, rescheduleMeeting, type MeetingCard, type MeetingView,
} from '@/lib/leader-meetings';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A new forum's time until changed: the mockup's every forum, 14.00. */
const DEFAULT_TIME = '14:00';

/**
 * ***Forum baru*** and ***Tanggal dan jam forum*** (P19.22-T8 AC-1; ADR-0276): a date and a time — no title, every
 * forum is *Forum #n*. Making one carries the previous forum's agenda and its action items not *Selesai* (the server's).
 * A forum to come moves its date or time here; one nobody has written in can be deleted, once asked. The server refuses
 * what this lets past: a past forum's move (`LEADER_MEETING_COMPLETED`), a delete with writing in it
 * (`LEADER_MEETING_HAS_MINUTES`), a version somebody moved past (`VERSION_CONFLICT`) — each said here.
 */
export function ForumDialog({ mode, open, today, meeting, onClose, onSaved, onDeleted }: {
  mode: 'create' | 'edit';
  open: boolean;
  /** The office's today: the date a new forum starts from. */
  today: string;
  meeting?: MeetingView;
  onClose: () => void;
  onSaved: (card: MeetingCard) => void;
  onDeleted?: () => void;
}) {
  const t = useMessages(forumMessages);
  const copy = t.dialog;
  const id = useId();
  const keep = useRef<HTMLButtonElement>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState(DEFAULT_TIME);
  const [dateError, setDateError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(meeting?.date ?? today);
    setTime(meeting?.time ?? DEFAULT_TIME);
    setDateError(false);
    setTimeError(false);
    setBanner(null);
    setAsking(false);
    setBusy(false);
  }, [open, meeting?.date, meeting?.time, meeting?.version, today]);

  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const badDate = !DATE.test(date);
    const badTime = !TIME.test(time);
    setDateError(badDate);
    setTimeError(badTime);
    setBanner(null);
    if (badDate || badTime) return;
    setBusy(true);
    try {
      if (mode === 'create' || !meeting) {
        onSaved(await createMeeting({ date, time }));
        return;
      }
      const body: { date?: string; time?: string; version: number } = { version: meeting.version };
      if (date !== meeting.date) body.date = date;
      if (time !== meeting.time) body.time = time;
      if (body.date === undefined && body.time === undefined) {
        onClose();
        return;
      }
      onSaved(await rescheduleMeeting(meeting.id, body));
    } catch (err) {
      setBanner(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!meeting || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      await deleteMeeting(meeting.id, meeting.version);
      onDeleted?.();
    } catch (err) {
      setAsking(false);
      setBanner(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? copy.newTitle : copy.whenTitle}
      placement="responsive"
      footer={asking ? undefined : (
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>{copy.cancel}</Button>
          <Button type="submit" form={`${id}-form`} disabled={busy} aria-busy={busy || undefined}>
            {mode === 'create' ? copy.create : copy.save}
          </Button>
        </div>
      )}
    >
      {banner && <div className="mb-4"><ErrorBanner {...banner} /></div>}
      {asking && meeting ? (
        <div>
          <p className="text-md leading-relaxed text-navy">{copy.deleteQuestion({ n: meeting.number })}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button ref={keep} variant="secondary" onClick={() => setAsking(false)} disabled={busy}>{copy.keep}</Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>{copy.confirmDelete}</Button>
          </div>
        </div>
      ) : (
        <form id={`${id}-form`} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
          <Field label={copy.date} htmlFor={`${id}-date`} error={dateError ? copy.needDate : undefined}>
            <DateField id={`${id}-date`} value={date} onChange={setDate} required invalid={dateError} className="w-full" />
          </Field>
          <Field label={copy.time} htmlFor={`${id}-time`} error={timeError ? copy.needTime : undefined}>
            <TextInput id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} required invalid={timeError} />
          </Field>
          {mode === 'edit' && meeting?.can.delete && (
            <div>
              <Button variant="inlineDanger" onClick={() => setAsking(true)} disabled={busy}>{copy.delete}</Button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
