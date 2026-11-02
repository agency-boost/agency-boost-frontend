'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/modal';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  answerEntry, deleteEntry, initialsOf, notesParts, readEntry, titleOf,
  type Answer, type CalendarEntry, type CalendarInvitee,
} from '@/lib/calendar';
import { coachingSessionHref } from '@/lib/coaching';
import { formatDayClock, formatTripWhen, formatWhen } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCan } from '@/lib/session';
import { TEXT_TAP } from '@/components/ui/phone';

/** *Pick who to coach*'s search (UI-012), loaded when it is asked for: most details never draw it. */
const AgentSearch = dynamic(() => import('@/components/agent-search').then((m) => m.AgentSearch), { ssr: false });
import { Avatar, BADGE_TONE, CHIP, DETAIL_LABEL } from './calendar-parts';

/** An invitee's answer, as the organiser's chip shows it (ADR-0097, form 2): its glyph, and its name's message. */
const ANSWER_GLYPH: Record<Answer, { glyph: string; name: 'accepted' | 'declined' | 'noAnswer' }> = {
  accepted: { glyph: '✓', name: 'accepted' },
  declined: { glyph: '✕', name: 'declined' },
  pending: { glyph: '?', name: 'noAnswer' },
};

/**
 * The detail dialog (`Calendar_Section.html:422-449`, `:817-853`; P12-T2 AC-7, AC-9; P12-T4 AC-5,
 * AC-6; P12-T6 AC-1).
 *
 * The prototype's, verbatim: the badge, the title, *When*, *Location / notes* or *—*, *Invitees* or
 * *No one else invited*. **The badge names the type as the legend does** — *Internal meeting*, where the
 * prototype's capitalised its code, *Meeting* (P18.95-T8 AC-2; the client's UI review, UI-020: one set
 * of type names). **A meeting link in the notes is a link**: *Join Zoom* on a Zoom host, *Join meeting*
 * on any other, opening in a new tab (`NotesText`). **What it offers follows the server's `readerIs`,
 * and draws nothing the API would refuse** (D-write):
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
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const [entry, setEntry] = useState(opened);
  const [asking, setAsking] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = titleOf(entry, words);
  // A trip with times over several days (UI-104 point 8): each end its date and time.
  const overDays = !entry.allDay && entry.startsOn && entry.endsOn && entry.startsOn !== entry.endsOn;
  const when = entry.allDay
    ? formatTripWhen(entry.startsOn ?? '', entry.endsOn ?? '', language)
    : overDays
      ? `${formatDayClock(entry.startsOn ?? '', entry.start ?? '', language)} – ${formatDayClock(entry.endsOn ?? '', entry.end ?? '', language)}`
      : formatWhen(entry.date ?? '', entry.start ?? '', entry.end ?? '', language);

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
          setNotice(t.conflict);
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
            {t.types[entry.type]}
          </span>
        )}
      >
        <dl className="flex flex-col gap-4">
          <div>
            <dt className={DETAIL_LABEL}>{t.when}</dt>
            <dd className="text-md leading-normal text-navy">{when}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>{t.where}</dt>
            <dd className="whitespace-pre-line break-words text-md leading-normal text-navy">
              {entry.notes.trim() ? <NotesText notes={entry.notes.trim()} /> : '—'}
            </dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>{t.invitees}</dt>
            <dd>
              <People entry={entry} />
            </dd>
          </div>
        </dl>

        <CoachButtons entry={entry} />

        {notice && <p role="status" className="mt-3 text-md font-semibold text-navy">{notice}</p>}
        {banner && <div className="mt-3"><ErrorBanner {...banner} /></div>}

        <div className={cn('mt-5 flex gap-2', canDelete || canAnswer ? 'justify-between' : 'justify-end')}>
          {canDelete && (
            <Button variant="danger" disabled={busy} onClick={() => setAsking(true)}>{t.delete}</Button>
          )}
          {canAnswer && (
            <AnswerButton variant="danger" pressed={entry.myAnswer === 'declined'} disabled={busy} onClick={() => answer('declined')}>
              {t.decline}
            </AnswerButton>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t.close}</Button>
            {canEdit && <Button disabled={busy} onClick={() => onEdit(entry)}>{t.edit}</Button>}
            {canAnswer && (
              <AnswerButton variant="primary" pressed={entry.myAnswer === 'accepted'} disabled={busy} onClick={() => answer('accepted')}>
                {t.accept}
              </AnswerButton>
            )}
          </div>
        </div>
      </Modal>
      <Dialog
        open={asking}
        message={t.deleteQuestion({ title })}
        confirmLabel={t.delete}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

/**
 * ***Location / notes*, as the organiser wrote it, with each meeting link a link** (P18.95-T8 AC-2; the
 * client's UI review, UI-020: *the Zoom link in the event popup is plain text*). The link reads *Join
 * Zoom* or *Join meeting* (`notesParts`), is a 44px target on a phone (`TEXT_TAP`), opens in a new tab
 * with neither the opener nor the referrer handed on, and says so to a screen reader; its address is
 * its tooltip. Only an `http:` or `https:` address becomes one — nothing else the notes hold is made
 * something a press could run.
 */
function NotesText({ notes }: { notes: string }) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  return (
    <>
      {notesParts(notes, words).map((part, i) => ('href' in part ? (
        <a
          // The notes are the organiser's words: a part's place in them is its identity.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          title={part.href}
          className={cn(
            'inline-flex items-center rounded-pill bg-navy-soft/[0.12] px-2.5 py-0.5 align-baseline text-sm font-semibold text-navy hover:bg-navy-soft/20',
            TEXT_TAP,
          )}
        >
          {part.label}
          <span className="sr-only">{t.newTab}</span>
        </a>
      ) : (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i}>{part.text}</span>
      )))}
    </>
  );
}

/**
 * ***Start coaching session*** **from a 1:1** (UI V1, 2026-10-30, UI-104 point 6; mockup 4). On a *1:1 coaching* entry
 * **its organiser** opens — never an invitee, an ancestor or the member a block was placed on:
 *
 * - one person on it whom they coach: a primary *Start coaching session* → that person's *Coaching Session* tab;
 * - several: one *Coach {name}* each;
 * - nobody invited: *Pick who to coach* → the agent search (UI-012), and the person picked → their session.
 *
 * **Who they may coach is the server's**: `readerCoaches`, worked out when the entry is read (`COACH`, ADR-0099); the
 * agent search lists only people the reader reaches, and the session refuses anybody they do not coach. Held to
 * `coaching_session:create` as well, so a role that coaches nobody sees none of it.
 */
function CoachButtons({ entry }: { entry: CalendarEntry }) {
  const t = useMessages(calendarMessages);
  const router = useRouter();
  const mayCoach = useCan('coaching_session:create');
  const [picking, setPicking] = useState(false);
  if (entry.type !== 'coaching' || entry.readerIs !== 'organiser' || !mayCoach) return null;
  const coachable = entry.invitees.filter((person) => person.readerCoaches);
  const start = <LineIcon name="play" className="h-4 w-4" />;
  if (coachable.length === 1) {
    return (
      <div className="mt-5">
        <ButtonLink href={coachingSessionHref(coachable[0].membershipId)} className="h-[52px] w-full gap-1.5 rounded-pill text-base">
          {start}
          {t.startCoaching}
        </ButtonLink>
      </div>
    );
  }
  if (coachable.length > 1) {
    return (
      <div className="mt-5 flex flex-col gap-2">
        {coachable.map((person) => (
          <ButtonLink key={person.membershipId} href={coachingSessionHref(person.membershipId)} className="h-[52px] w-full gap-1.5 rounded-pill text-base">
            {start}
            {t.coachPerson({ name: person.name.split(/\s+/)[0] ?? person.name })}
          </ButtonLink>
        ))}
      </div>
    );
  }
  if (entry.invitees.length > 0) return null;
  return (
    <div className="mt-5">
      {picking ? (
        <AgentSearch autoFocus onPick={(hit) => router.push(coachingSessionHref(hit.membershipId))} />
      ) : (
        <Button onClick={() => setPicking(true)} className="h-[52px] w-full gap-1.5 rounded-pill text-base">
          {start}
          {t.pickWhoToCoach}
        </Button>
      )}
    </div>
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
  const t = useMessages(calendarMessages);
  const organiser = entry.readerIs === 'organiser';
  if (organiser && entry.invitees.length === 0) {
    return <p className="text-sm text-muted">{t.noOneElse}</p>;
  }
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {!organiser && (
          <li className={CHIP}>
            <Avatar initials={initialsOf(entry.organiser.name)} />
            {entry.organiser.name}
            <TippedGlyph glyph="★" name={t.organiser} tip={t.organiser} align="fit" className="-my-1 -mr-1.5" />
          </li>
        )}
        {entry.invitees.map((person) => (
          <PersonChip key={person.membershipId} person={person} entry={entry} />
        ))}
      </ul>
      {!organiser && entry.invitees.length === 0 && (
        <p className="mt-2 text-sm text-muted">{t.noOneElse}</p>
      )}
    </>
  );
}

function PersonChip({ person, entry }: { person: CalendarInvitee; entry: CalendarEntry }) {
  const t = useMessages(calendarMessages);
  const face = (
    <>
      <Avatar initials={initialsOf(person.name)} />
      {person.name}
      {person.placed && <span className="sr-only">{t.placedChip}</span>}
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
      {answer && <TippedGlyph glyph={answer.glyph} name={t[answer.name]} tip={t[answer.name]} align="fit" className="-my-1 -mr-1.5" />}
    </li>
  );
}
