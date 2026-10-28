'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import {
  createMeeting, deleteMeeting, deleteQuestion, FORUM_COPY, rescheduleMeeting,
  type ForumLimits, type MeetingCard, type MeetingView,
} from '@/lib/leader-meetings';

const COPY = FORUM_COPY.dialog;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * **The meeting dialog** (OD-145, ADR-0130; parity I-254): the product's dialog (F-72), the forum's one added
 * control, opened two ways.
 *
 * - ***New meeting***, from *+ New meeting*: *Title*, filled *"Strategic Check-in — #{n}"*, and *Date*, an
 *   office date; *Create meeting*, and the meeting opens.
 * - ***Meeting details***, from the head's date: on an upcoming meeting the title and the date may be changed;
 *   on a meeting nobody has written in, ***Delete meeting***, asked first in the dialog. A *Completed*
 *   meeting's date stays — its scorecard was frozen for it — so its fields are read-only.
 *
 * The server decides each of these too: its refusals stand under the field they are about, in the spec's
 * words, and anything else in the shared banner. Every field is bounded by the server's own `limits`.
 */
export function MeetingDialog({
  open,
  onClose,
  limits,
  meeting,
  defaultTitle = '',
  onCreated,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  limits: ForumLimits;
  /** Present: *Meeting details* for this meeting. Absent: *New meeting*. */
  meeting?: MeetingView;
  defaultTitle?: string;
  onCreated?: (card: MeetingCard) => void;
  /** The meeting changed on the server (saved here, or by somebody else): read it again. */
  onChanged?: () => Promise<void>;
  onDeleted?: () => void;
}) {
  const id = useId();
  const keep = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [conflict, setConflict] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const editable = !meeting || meeting.can.reschedule;
  const canDelete = Boolean(meeting?.can.delete);

  // Opened, it starts over from what the meeting says now.
  useEffect(() => {
    if (!open) return;
    setTitleError(undefined);
    setDateError(undefined);
    setDeleteError(undefined);
    setConflict(false);
    setBanner(null);
    setAsking(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opened, or read again after somebody else changed it: the fields show what was saved.
  useEffect(() => {
    if (!open) return;
    setTitle(meeting?.title ?? defaultTitle);
    setDate(meeting?.date ?? '');
  }, [open, meeting?.title, meeting?.date, meeting?.version, defaultTitle]);

  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);

  function refused(err: unknown, where: 'form' | 'delete') {
    const error = toDisplayError(err);
    if (err instanceof ApiRequestError && error.code === 'VERSION_CONFLICT') {
      setConflict(true);
      setAsking(false);
      void onChanged?.();
      return;
    }
    if (error.code === 'LEADER_MEETING_COMPLETED') {
      setDateError(COPY.completed);
      return;
    }
    if (error.code === 'LEADER_MEETING_HAS_MINUTES') {
      setAsking(false);
      setDeleteError(COPY.hasMinutes);
      return;
    }
    if (error.code === 'VALIDATION_FAILED' && where === 'form') {
      const violations = (error.details?.violations as string[] | undefined) ?? [];
      const onTitle = violations.some((v) => v.startsWith('title'));
      const onDate = violations.some((v) => v.startsWith('date'));
      if (onTitle) setTitleError(COPY.needTitle);
      if (onDate) setDateError(COPY.needDate);
      if (onTitle || onDate) return;
    }
    setBanner(error);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !editable) return;
    const trimmed = title.trim();
    const titleBad = trimmed.length === 0;
    const dateBad = !DATE.test(date);
    setTitleError(titleBad ? COPY.needTitle : undefined);
    setDateError(dateBad ? COPY.needDate : undefined);
    setBanner(null);
    setConflict(false);
    if (titleBad || dateBad) return;

    setBusy(true);
    try {
      if (!meeting) {
        onCreated?.(await createMeeting({ title: trimmed, date }));
        return;
      }
      const body: { title?: string; date?: string; version: number } = { version: meeting.version };
      if (trimmed !== meeting.title) body.title = trimmed;
      if (date !== meeting.date) body.date = date;
      if (body.title !== undefined || body.date !== undefined) {
        await rescheduleMeeting(meeting.id, body);
        // Its version, and a moved date's scorecard, are the meeting's: read it again.
        await onChanged?.();
      }
      onClose();
    } catch (err) {
      refused(err, 'form');
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
      refused(err, 'delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meeting ? COPY.detailsTitle : COPY.newTitle}
      // The form's *Cancel* and its submit, held at the foot; the delete question keeps its own two buttons.
      footer={asking && meeting ? undefined : (
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>{COPY.cancel}</Button>
          {editable && (
            <Button type="submit" form={`${id}-form`} disabled={busy} aria-busy={busy || undefined}>
              {meeting ? COPY.saveChanges : COPY.create}
            </Button>
          )}
        </div>
      )}
    >
      {banner && <div className="mb-4"><ErrorBanner {...banner} /></div>}
      {conflict && <p role="alert" className="mb-4 text-sm font-semibold text-alert">{FORUM_COPY.conflict}</p>}

      {asking && meeting ? (
        <div>
          <p className="text-md leading-relaxed text-navy">{deleteQuestion(meeting.title)}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button ref={keep} variant="secondary" onClick={() => setAsking(false)} disabled={busy}>{COPY.keep}</Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>{COPY.confirmDelete}</Button>
          </div>
        </div>
      ) : (
        <form id={`${id}-form`} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
          <Field label={COPY.title} htmlFor={`${id}-title`} error={titleError}>
            <TextInput
              id={`${id}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={limits.titleMax}
              required
              readOnly={!editable}
              invalid={Boolean(titleError)}
            />
          </Field>
          <Field label={COPY.date} htmlFor={`${id}-date`} error={dateError}>
            <DateField
              id={`${id}-date`}
              value={date}
              onChange={setDate}
              required
              readOnly={!editable}
              invalid={Boolean(dateError)}
              className="w-full"
            />
          </Field>

          {canDelete && (
            <div>
              <Button variant="inlineDanger" onClick={() => setAsking(true)} disabled={busy}>{COPY.delete}</Button>
            </div>
          )}
          {deleteError && <p role="alert" className="-mt-2 text-xs font-semibold text-alert">{deleteError}</p>}
        </form>
      )}
    </Modal>
  );
}
