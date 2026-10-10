'use client';

import Link from 'next/link';
import { useId } from 'react';
import { Button } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  changeDateLabel, editorsInOrder, FORUM_COPY, initialsOf, rungShort, stateLabel,
  type ForumPerson, type MeetingView,
} from '@/lib/leader-meetings';
import { useMeetingSave } from './meeting-writer';

/** `.lm-btn-sm` (`:610`); *Share* and *Save as PDF* outlined in navy (`.lm-btn-secondary`, `:606`). */
const SMALL = 'h-auto rounded-[7px] px-[13px] py-[7px] text-sm';
const OUTLINED = 'border-[1.5px] border-navy bg-transparent text-navy hover:bg-navy/5';

/**
 * **A meeting's head** (`:2709-2733`; *The head*): the title; *"{date} · Upcoming"* — the date a button for
 * whoever may move or delete the meeting, opening *Meeting details* (ADR-0130 §4); the cadence note; *Share*,
 * *Save as PDF* and *Save* for whoever may do each, *Save* navy with white text (I-88); then *Can edit this
 * MOM* and its chips, and *Manage tags →* for whoever may tag.
 *
 * In print the head stays — the title, the date and who can edit, as the prototype prints them — and its
 * controls, the cadence note and *Manage tags →* go (`:756-765`).
 */
export function MeetingHead({
  meeting,
  onDetails,
  onShare,
  onPrint,
}: {
  meeting: MeetingView;
  onDetails: () => void;
  onShare: () => void;
  onPrint: () => void;
}) {
  const { flush, line } = useMeetingSave();
  const date = formatShortDay(meeting.date, { year: true });
  const movable = meeting.can.reschedule || meeting.can.delete;
  const anyButton = meeting.can.share || meeting.can.print || meeting.can.edit;

  return (
    <section
      aria-labelledby={`meeting-${meeting.id}-title`}
      className="mb-[18px] rounded-[14px] border border-hairline bg-card px-6 py-5 print:border-0 print:px-0"
    >
      <div className="mb-[14px] flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-60">
          <h2 id={`meeting-${meeting.id}-title`} className="mb-1 break-words text-2xl font-extrabold text-navy">
            {meeting.title}
          </h2>
          <p className="text-sm text-muted">
            {movable ? (
              <button
                type="button"
                onClick={onDetails}
                // The spec's words, then the date it shows, so the name holds what is read on the screen.
                aria-label={`${changeDateLabel(meeting.title)}, ${date}`}
                className="rounded-sm font-semibold text-navy-soft underline decoration-dashed underline-offset-2 hover:decoration-solid print:font-normal print:text-muted print:no-underline"
              >
                {date}
              </button>
            ) : date}
            {' · '}{stateLabel(meeting.state)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2.5 print:hidden max-sm:items-start">
          <span className="whitespace-nowrap rounded-pill bg-navy/5 px-[9px] py-[3px] text-xs text-muted">
            {FORUM_COPY.cadence}
          </span>
          {anyButton && (
            <div className="flex flex-wrap gap-2">
              {meeting.can.share && (
                <Button variant="secondary" className={cn(SMALL, OUTLINED)} onClick={onShare}>{FORUM_COPY.share}</Button>
              )}
              {meeting.can.print && (
                <Button variant="secondary" className={cn(SMALL, OUTLINED)} onClick={onPrint}>{FORUM_COPY.savePdf}</Button>
              )}
              {meeting.can.edit && (
                <Button className={SMALL} onClick={() => void flush()}>{FORUM_COPY.save}</Button>
              )}
            </div>
          )}
          {line && <p className="max-w-[22rem] text-right text-xs font-semibold text-alert max-sm:text-left">{line}</p>}
        </div>
      </div>
      <Editors meeting={meeting} />
    </section>
  );
}

/**
 * ***Can edit this MOM*** (`:2722-2726`; D-coeditors): the Owner first, on the amber avatar (`:659`), then the
 * Admins, then the Core Leaders, each once, *"{name} · {rung}"* and *"(You)"* after the reader's own name.
 * Live while the meeting is upcoming; once it is over, the list written onto it then (F-186).
 */
function Editors({ meeting }: { meeting: MeetingView }) {
  const labelId = useId();
  const owner = meeting.editors.owner;
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-hairline pt-[14px]">
      <span id={labelId} className="text-xs font-bold uppercase tracking-wide text-muted">{FORUM_COPY.canEdit}</span>
      <ul aria-labelledby={labelId} className="flex flex-wrap items-center gap-2.5">
        {editorsInOrder(meeting.editors).map((person) => (
          <Chip key={person.membershipId} person={person} owner={person.membershipId === owner?.membershipId} />
        ))}
      </ul>
      {meeting.can.manageTags && (
        <Link
          href="/people/members"
          className="ml-auto text-sm font-semibold text-navy-soft underline-offset-2 hover:underline print:hidden"
        >
          {FORUM_COPY.manageTags}
        </Link>
      )}
    </div>
  );
}

function Chip({ person, owner }: { person: ForumPerson; owner: boolean }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-pill bg-navy/5 py-[3px] pl-[3px] pr-2.5 text-sm font-semibold text-navy">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full text-2xs font-bold',
          owner ? 'bg-amber text-navy' : 'bg-navy-soft text-white',
        )}
      >
        {initialsOf(person.name)}
      </span>
      {person.name}{person.isReader ? ` ${FORUM_COPY.you}` : ''} · {rungShort(person.rung)}
    </li>
  );
}
