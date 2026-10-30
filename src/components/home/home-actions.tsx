'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { LeadContactButtons, MemberContactButtons } from '@/components/contact-buttons';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { homeMessages } from '@/i18n/messages/home';
import { cn } from '@/lib/cn';
import { formatClock, formatShortDay } from '@/lib/format';
import type { HomeAction, HomeAgendaAction, HomeCoachingAction, HomeLeadAction } from '@/lib/home';
import { calendarToday } from './home-tiles';

/**
 * ***Aksi hari ini*** (UI-100; the owner, 30 Oct): **always the top three things on the reader's list, never more** —
 * today's *Tugas* first, in the Agenda checklist's order (coaching action items, then the leads' next actions), then the
 * next timed items, soonest first, today's and then the days after. The server picks them (`GET /home`); nothing here
 * reorders or adds.
 *
 * - **52px rows.** A coaching item: a round mark and *Dari: NAME* over the item. A lead: its avatar, the NAME in
 *   capitals, the next action under it. An agenda item: the start time in a small grey box, the title, the type under
 *   it in grey (with its day when it is not today), and a ›.
 * - **WhatsApp and Call** on every row with a person (UI-081): a lead's save their number to the lead; the coach's are
 *   drawn only when their number is on file — it is the coach's account, which the reader cannot fill in.
 * - **The row, and *Semua ›*, open Calendar on today in Agenda.** The buttons are their own targets, above the row's.
 * - A phone and a tablet draw the person over the line; a desktop puts the name, the next action and the buttons on
 *   one line.
 * - **Hidden when there is nothing** (D-08): no task and nothing ahead.
 */
export function HomeActions({ actions, today, className }: { actions: readonly HomeAction[]; today: string; className?: string }) {
  const t = useMessages(homeMessages).actions;
  if (actions.length === 0) return null;
  const href = calendarToday(today);
  return (
    <section data-home-actions="" aria-labelledby="home-actions" className={className}>
      <SectionHeading id="home-actions" title={t.heading}>
        <Link
          href={href}
          aria-label={t.allLabel}
          className="-my-3 inline-flex min-h-11 items-center gap-0.5 text-md font-semibold text-muted hover:text-navy lg:min-h-8"
        >
          {t.all}
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </Link>
      </SectionHeading>
      <ul className="overflow-hidden rounded-lg bg-card">
        {actions.map((action) => (
          <li key={keyOf(action)} className="border-t border-divider first:border-t-0">
            <ActionRowOf action={action} href={href} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const keyOf = (action: HomeAction) =>
  action.kind === 'coaching' ? `c:${action.sessionId}:${action.itemId}` : action.kind === 'lead' ? `l:${action.leadId}` : `a:${action.id}`;

/** A section's heading row: 14px/700, and whatever stands at its right. */
export function SectionHeading({ id, title, children }: { id: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
      <h2 id={id} className="text-md font-bold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function ActionRowOf({ action, href, today }: { action: HomeAction; href: string; today: string }) {
  if (action.kind === 'coaching') return <CoachingRow action={action} href={href} />;
  if (action.kind === 'lead') return <LeadRow action={action} href={href} />;
  return <AgendaRow action={action} href={href} today={today} />;
}

/**
 * One row: a lead mark, the words (stretched over the row as its one link), and the row's own buttons above it.
 * `title` is the line on top; `line` the grey one under it; on a desktop the two share a line.
 */
function Row({
  href, lead, title, line, trailing, caps = true, chevron = false,
}: {
  href: string; lead: ReactNode; title: string; line: string | null; trailing?: ReactNode; caps?: boolean;
  /** The › of a row with no buttons (D-09): part of the row's target, never its own. */
  chevron?: boolean;
}) {
  return (
    <div
      data-action-row=""
      className="relative flex min-h-[3.25rem] items-center gap-2 px-3 py-1.5 has-[a[data-row-main]:focus-visible]:outline has-[a[data-row-main]:focus-visible]:outline-2 has-[a[data-row-main]:focus-visible]:-outline-offset-2 has-[a[data-row-main]:focus-visible]:outline-amber lg:hover:bg-hover-row"
    >
      {lead}
      <Link
        href={href}
        data-row-main=""
        className="min-w-0 flex-1 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none lg:flex lg:items-center lg:gap-3"
      >
        <span className={cn('block truncate text-md font-bold text-ink lg:w-[14.5rem] lg:shrink-0', caps && 'uppercase')}>{title}</span>
        {line && <span className="block truncate text-sm text-muted lg:flex-1">{line}</span>}
      </Link>
      {trailing && <div className="relative z-[1] flex shrink-0 items-center gap-1">{trailing}</div>}
      {chevron && <LineIcon name="chevronRight" className="pointer-events-none h-4 w-4 shrink-0 text-signal-grey" />}
    </div>
  );
}

function CoachingRow({ action, href }: { action: HomeCoachingAction; href: string }) {
  const t = useMessages(homeMessages).actions;
  const [phone, setPhone] = useState(action.from?.phone ?? null);
  return (
    <Row
      href={href}
      lead={(
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavender/20 text-navy">
          <LineIcon name="chat" className="h-[1.0625rem] w-[1.0625rem]" />
        </span>
      )}
      // *Dari: WILSON TANOTO*: the word as written, the name in capitals.
      title={t.from({ name: (action.from?.name ?? '').toUpperCase() })}
      caps={false}
      line={action.text}
      trailing={action.from && phone ? (
        <MemberContactButtons
          membershipId={action.from.membershipId}
          name={action.from.name}
          phone={phone}
          size={36}
          onSaved={setPhone}
        />
      ) : undefined}
    />
  );
}

function LeadRow({ action, href }: { action: HomeLeadAction; href: string }) {
  const [lead, setLead] = useState({ id: action.leadId, name: action.name, contact: action.contact, version: action.version });
  return (
    <Row
      href={href}
      lead={<Avatar name={action.name} seed={action.leadId} size={36} />}
      title={action.name}
      line={action.note}
      trailing={(
        <LeadContactButtons
          lead={lead}
          size={36}
          onSaved={(next) => setLead({ id: next.id, name: next.name, contact: next.contact, version: next.version })}
        />
      )}
    />
  );
}

function AgendaRow({ action, href, today }: { action: HomeAgendaAction; href: string; today: string }) {
  const t = useMessages(homeMessages).actions;
  const types = useMessages(calendarMessages).types as Record<string, string>;
  const figures = useFigureLanguage();
  // An entry's type is a code, its label the Calendar's; a joined event's is the office's own name for it.
  const type = action.source === 'entry' ? types[action.type] ?? action.type : action.type;
  const line = action.date === today ? type : t.typeOn({ type, day: formatShortDay(action.date, {}, figures) });
  return (
    <Row
      href={href}
      lead={(
        <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-row bg-base text-sm font-semibold tabular-nums text-navy">
          {formatClock(action.start, figures)}
        </span>
      )}
      title={action.title || type}
      caps={false}
      line={line}
      chevron
    />
  );
}
