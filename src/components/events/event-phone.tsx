'use client';

import { useId } from 'react';
import { PlanIcon } from '@/components/plan/plan-icons';
import { ErrorBanner } from '@/components/ui/field';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  answerOf, isOnline, limitingScope, pillOf, timeSpanOf, type GuestEvent, type GuestEventCan,
} from '@/lib/events';

/**
 * **An event on a phone** (UI V1, UI-108; `campaign-event-mobile` 2; Mobile only): a **date block** — the day and the
 * month — centred on the card's height; the title; **start – end** with a clock (*14.00 – 15.00*), and the audience after
 * it only where it limits who can come (*Khusus leader*); the place on its own line with a pin, or a video glyph for an
 * online one. The card is the target that opens the event (a button stretched over it).
 *
 * - **Upcoming**: ***Ikut* and *Tidak ikut* both**, stacked at the right, the chosen one filled — *Ikut* orange with a ✓,
 *   *Tidak ikut* navy — each `aria-pressed`, the pair named *Jawaban Anda untuk {title}*. Tap the other to change, the
 *   chosen one again to undo (the caller's `onAnswer`). Drawn where the server lets the reader answer (`can.rsvp`); a
 *   read-only support session reads the card without them.
 * - **Past**: the reader's standing as a tinted pill — ***Feedback belum dikirim*** (amber; the card opens the event,
 *   where the feedback form is — D-01), *Feedback terkirim* (green), *Tidak ikut* (grey) — never a dot (D-27).
 *
 * Each of the two answers is 34px to the eye in a stack 72px tall, and takes a 44px tap through an invisible reach into
 * the card's padding above or below it, meeting the other's at the gap.
 */
export function PhoneEventCard({ event, timezone, can, busy, error, onOpen, onAnswer }: {
  event: GuestEvent;
  timezone: string;
  can: GuestEventCan;
  busy: boolean;
  error: ApiError | null;
  onOpen: (id: string) => void;
  onAnswer: (event: GuestEvent, tapped: 'going' | 'notGoing') => void;
}) {
  const t = useMessages(eventsMessages);
  const figures = useFigureLanguage();
  const titleId = useId();
  const scope = limitingScope(event.audience);
  const past = event.ended;
  const answer = answerOf(event);
  const pill = past ? pillOf(event) : null;
  const [day, month] = dayAndMonth(event.startsOn, figures);
  const answers = !past && can.rsvp;

  return (
    <div className="relative rounded-lg bg-card px-3 py-2.5" data-event={event.id}>
      <button
        type="button"
        aria-labelledby={titleId}
        onClick={() => onOpen(event.id)}
        data-open-event={event.id}
        className="absolute inset-0 rounded-lg focus-visible:[outline-offset:-2px]"
      />
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-[3.25rem] w-12 shrink-0 flex-col items-center justify-center rounded-[12px] bg-hover-row leading-tight">
          <b className="text-xl text-navy">{day}</b>
          <span className="text-sm font-bold uppercase text-amber-ink">{month}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="m-0 break-words text-lg font-bold leading-snug text-ink">{event.title}</h3>
          <p className="m-0 mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted">
            <PlanIcon name="clock" className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">{timeSpanOf(event, timezone, figures)}</span>
            {scope && <span>· {t.scopes[scope]}</span>}
          </p>
          <p className="m-0 mt-0.5 flex items-center gap-1 text-sm text-muted">
            <PlanIcon name={isOnline(event) ? 'video' : 'pin'} className="h-3.5 w-3.5" />
            <span className="min-w-0 break-words">{event.location}</span>
          </p>
          {pill && pill !== 'didntJoin' && (
            <TonePill tone={pill === 'feedbackSent' ? 'green' : 'amber'} className="mt-1.5">{t.pills[pill]}</TonePill>
          )}
        </div>
        {pill === 'didntJoin' && <TonePill tone="grey">{t.pills.didntJoin}</TonePill>}
        {past && pill !== 'didntJoin' && <PlanIcon name="chevronRight" className="h-[1.125rem] w-[1.125rem] text-line" />}
        {answers && (
          <div role="group" aria-label={t.answerName({ title: event.title })} className="relative z-[1] flex shrink-0 flex-col gap-1">
            <Answer
              on={answer === 'going'}
              tone="going"
              busy={busy}
              reach="top"
              onClick={() => onAnswer(event, 'going')}
            >
              {answer === 'going' && <PlanIcon name="check" className="h-3.5 w-3.5" />}
              {t.join}
            </Answer>
            <Answer
              on={answer === 'notGoing'}
              tone="notGoing"
              busy={busy || !can.cancelRsvp}
              reach="bottom"
              onClick={() => onAnswer(event, 'notGoing')}
            >
              {t.notGoing}
            </Answer>
          </div>
        )}
      </div>
      {error && <div className="relative z-[1] mt-2"><ErrorBanner {...error} /></div>}
    </div>
  );
}

function Answer({ on, tone, busy, reach, onClick, children }: {
  on: boolean;
  tone: 'going' | 'notGoing';
  busy: boolean;
  /** Where its 44px reach extends, into the card's padding: above the first, below the second. */
  reach: 'top' | 'bottom';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      // Ignored while a call is out, rather than disabled: a disabled button drops the focus.
      aria-disabled={busy || undefined}
      onClick={() => { if (!busy) onClick(); }}
      className={cn(
        'relative flex h-[2.125rem] min-w-[5.375rem] items-center justify-center gap-1 rounded-pill border-[1.5px] px-2.5',
        'text-sm font-bold',
        "after:absolute after:inset-x-0 after:content-['']",
        reach === 'top' ? 'after:-bottom-0.5 after:-top-2' : 'after:-bottom-2 after:-top-0.5',
        !on && 'border-hairline bg-card text-navy',
        on && tone === 'going' && 'border-amber bg-amber text-navy',
        on && tone === 'notGoing' && 'border-navy bg-navy text-white',
        busy && 'opacity-60',
      )}
    >
      {children}
    </button>
  );
}

/** The date block's two lines, in the office's calendar the server resolved: *2* and *Nov*. */
function dayAndMonth(day: string, figures: ReturnType<typeof useFigureLanguage>): [string, string] {
  // `formatShortDay` writes *2 Nov*: the shared formatter's day and month, never a second way of naming a month.
  const [d = '', month = ''] = formatShortDay(day, {}, figures).split(' ');
  return [d, month];
}
