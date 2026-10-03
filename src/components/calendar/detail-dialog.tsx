'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner } from '@/components/ui/field';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  answerEntry, deleteEntry, initialsOf, OWN_COPY, PROTOTYPE_COPY, readEntry, titleOf, TYPE_BADGE,
  type Answer, type CalendarEntry, type CalendarInvitee,
} from '@/lib/calendar';
import { coachingSessionHref } from '@/lib/coaching';
import { formatTripWhen, formatWhen } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar, BADGE_TONE, CHIP, DETAIL_LABEL } from './calendar-parts';

/** An invitee's answer, as the organiser's chip shows it (ADR-0097, form 2). */
const ANSWER_GLYPH: Record<Answer, { glyph: string; name: string }> = {
  accepted: { glyph: '✓', name: OWN_COPY.accepted },
  declined: { glyph: '✕', name: OWN_COPY.declined },
  pending: { glyph: '?', name: OWN_COPY.noAnswer },
};

/**
 * The detail dialog (`Calendar_Section.html:422-449`, `:817-853`; P12-T2 AC-7, AC-9; P12-T4 AC-5,
 * AC-6; P12-T6 AC-1).
 *
 * The prototype's, verbatim: the badge in the type's own word (*Meeting*, not *Internal meeting*), the
 * title, *When*, *Location / notes* or *—*, *Invitees* or *No one else invited*. **What it offers
 * follows the server's `readerIs`, and draws nothing the API would refuse** (D-write):
 *
 * | Reader | Left | Right |
 * |---|---|---|
 * | organiser | *Delete* | *Close*, *Edit* |
 * | invitee | *Decline* | *Close*, *Accept* — in *Delete*'s and *Edit*'s places (ADR-0097) |
 * | placed, ancestor | — | *Close* (ADR-0098, D-write) |
 *
 * **And only what the reader may write** (`may`): in a read-only support session every one of them is
 * withheld, and the organiser and the invitee alike are offered *Close* alone (roles §3.13).
 *
 * The invitee's current answer is the pressed one; pressing the other changes it. The organiser sees
 * each invitee's answer as an icon on their chip; anybody else sees **the organiser's chip first**, so
 * an invitee, or a member a block was placed on, can tell who put it there (an Improve, data honesty).
 * On a *1:1 coaching* entry, the chip of each invitee the reader coaches opens that person's *Coaching
 * Session* tab (ADR-0099): the server says which, in `readerCoaches`.
 *
 * **Delete asks first, in the product's dialog** (F-72): *Delete "{title}"?*, without the prototype's
 * *This can't be undone.*, which a soft delete makes false (H-06, I-101).
 */
/** The writes the reader may make: none in a read-only support session (D-write). */
export interface DetailWrites {
  edit: boolean;
  delete: boolean;
  answer: boolean;
}

export function DetailDialog({
  entry: opened,
  may,
  onClose,
  onEdit,
  onDeleted,
  onAnswered,
}: {
  entry: CalendarEntry;
  may: DetailWrites;
  onClose: () => void;
  onEdit: (entry: CalendarEntry) => void;
  onDeleted: (entry: CalendarEntry) => void;
  onAnswered: (entry: CalendarEntry) => void;
}) {
  const [entry, setEntry] = useState(opened);
  const [asking, setAsking] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = titleOf(entry);
  const when = entry.allDay
    ? formatTripWhen(entry.startsOn ?? '', entry.endsOn ?? '')
    : formatWhen(entry.date ?? '', entry.start ?? '', entry.end ?? '');

  async function remove() {
    setAsking(false);
    setBusy(true);
    setBanner(null);
    try {
      await deleteEntry(entry.entryId, entry.version);
      onDeleted(entry);
    } catch (err) {
      const error = toDisplayError(err);
      if (error.code === 'VERSION_CONFLICT') {
        try {
          setEntry(await readEntry(entry.entryId));
          setNotice(OWN_COPY.conflict);
        } catch (again) {
          setBanner(toDisplayError(again));
        }
      } else {
        setBanner(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function answer(to: Exclude<Answer, 'pending'>) {
    setBusy(true);
    setBanner(null);
    setNotice(null);
    try {
      const answered = await answerEntry(entry.entryId, to);
      setEntry(answered);
      onAnswered(answered);
    } catch (err) {
      setBanner(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const organiser = entry.readerIs === 'organiser';
  const invitee = entry.readerIs === 'invitee';
  const canDelete = organiser && may.delete;
  const canEdit = organiser && may.edit;
  const canAnswer = invitee && may.answer;

  return (
    <>
      <Modal
        open
        focusDialog
        title={title}
        onClose={onClose}
        className="max-w-[420px]"
        eyebrow={(
          <span className={cn('mb-[11px] inline-block rounded-pill px-[11px] py-1 text-xs font-bold', BADGE_TONE[entry.type])}>
            {TYPE_BADGE[entry.type]}
          </span>
        )}
      >
        <dl className="flex flex-col gap-4">
          <div>
            <dt className={DETAIL_LABEL}>{PROTOTYPE_COPY.when}</dt>
            <dd className="text-md leading-normal text-navy">{when}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>{PROTOTYPE_COPY.where}</dt>
            <dd className="whitespace-pre-line break-words text-md leading-normal text-navy">{entry.notes.trim() || '—'}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>{PROTOTYPE_COPY.invitees}</dt>
            <dd>
              <People entry={entry} />
            </dd>
          </div>
        </dl>

        {notice && <p role="status" className="mt-3 text-md font-semibold text-navy">{notice}</p>}
        {banner && <div className="mt-3"><ErrorBanner {...banner} /></div>}

        <div className={cn('mt-5 flex gap-2', canDelete || canAnswer ? 'justify-between' : 'justify-end')}>
          {canDelete && (
            <Button variant="danger" disabled={busy} onClick={() => setAsking(true)}>{PROTOTYPE_COPY.delete}</Button>
          )}
          {canAnswer && (
            <AnswerButton variant="danger" pressed={entry.myAnswer === 'declined'} disabled={busy} onClick={() => answer('declined')}>
              {OWN_COPY.decline}
            </AnswerButton>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{PROTOTYPE_COPY.close}</Button>
            {canEdit && <Button disabled={busy} onClick={() => onEdit(entry)}>{PROTOTYPE_COPY.edit}</Button>}
            {canAnswer && (
              <AnswerButton variant="primary" pressed={entry.myAnswer === 'accepted'} disabled={busy} onClick={() => answer('accepted')}>
                {OWN_COPY.accept}
              </AnswerButton>
            )}
          </div>
        </div>
      </Modal>
      <Dialog
        open={asking}
        message={OWN_COPY.deleteQuestion(title)}
        confirmLabel={PROTOTYPE_COPY.delete}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

/** *Accept* or *Decline*, pressed when it is the reader's answer — a ✓ beside it, and `aria-pressed`. */
function AnswerButton({
  variant,
  pressed,
  disabled,
  onClick,
  children,
}: {
  variant: 'primary' | 'danger';
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button variant={variant} aria-pressed={pressed} disabled={disabled} onClick={onClick} className="gap-1.5">
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
    </Button>
  );
}

/**
 * *Invitees* (`:436-439`, `:829-832`). For anybody but the organiser, the organiser's chip leads; then
 * everybody on the entry; *No one else invited* when there is nobody else.
 */
function People({ entry }: { entry: CalendarEntry }) {
  const organiser = entry.readerIs === 'organiser';
  if (organiser && entry.invitees.length === 0) {
    return <p className="text-sm text-muted">{PROTOTYPE_COPY.noOneElse}</p>;
  }
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {!organiser && (
          <li className={CHIP}>
            <Avatar initials={initialsOf(entry.organiser.name)} />
            {entry.organiser.name}
            <TippedGlyph glyph="★" name={OWN_COPY.organiser} tip={OWN_COPY.organiser} align="fit" className="-my-1 -mr-1.5" />
          </li>
        )}
        {entry.invitees.map((person) => (
          <PersonChip key={person.membershipId} person={person} entry={entry} />
        ))}
      </ul>
      {!organiser && entry.invitees.length === 0 && (
        <p className="mt-2 text-sm text-muted">{PROTOTYPE_COPY.noOneElse}</p>
      )}
    </>
  );
}

function PersonChip({ person, entry }: { person: CalendarInvitee; entry: CalendarEntry }) {
  const face = (
    <>
      <Avatar initials={initialsOf(person.name)} />
      {person.name}
      {person.placed && <span className="sr-only">{OWN_COPY.placedChip}</span>}
    </>
  );
  // ADR-0099: the chip of a coachee on a 1:1 entry opens their *Coaching Session* tab.
  const link = entry.type === 'coaching' && person.readerCoaches;
  const answer = entry.readerIs === 'organiser' && !person.placed && person.answer ? ANSWER_GLYPH[person.answer] : null;
  return (
    <li className={cn(CHIP, link && 'p-0 pr-0')}>
      {link ? (
        <Link
          href={coachingSessionHref(person.membershipId)}
          className="inline-flex items-center gap-1.5 rounded-pill py-1 pl-1 pr-2.5 underline-offset-2 hover:underline"
        >
          {face}
        </Link>
      ) : face}
      {answer && <TippedGlyph glyph={answer.glyph} name={answer.name} tip={answer.name} align="fit" className="-my-1 -mr-1.5" />}
    </li>
  );
}
