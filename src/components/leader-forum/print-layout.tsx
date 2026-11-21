'use client';

import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import { forumWhen, personOf, type MeetingView } from '@/lib/leader-meetings';
import { STATUS_PILL } from './action-items';

/**
 * ***PDF*** (P19.22-T8 AC-2): what the browser prints for a forum — its name and when, the agenda's lines with their box
 * and PIC, and the action items with PIC, *tenggat* and state, *dari forum #n* where carried. Hidden on the screen,
 * shown in print; the page around it hides itself in print. *MAPA driver* and *Informal group* are Advanced analytics'
 * own and print from there.
 */
export function PrintLayout({ meeting }: { meeting: MeetingView }) {
  const t = useMessages(forumMessages);
  const language = useFigureLanguage();
  const who = (id: string | null, all = false) => (all ? t.agenda.everyone : personOf(meeting, id)?.firstName ?? '—');
  const th = 'border-b border-card-edge px-3 py-2 text-left text-sm font-semibold text-muted';
  const td = 'border-b border-divider px-3 py-2 align-top text-base text-ink';
  return (
    <section className="hidden font-body text-navy print:block" data-forum-print="">
      <h2 className="text-xl font-extrabold">{t.forumN({ n: meeting.number })}</h2>
      <p className="mb-5 text-md text-muted">{forumWhen(meeting, language)} · {t.state[meeting.state]}</p>

      <h3 className="mb-2 text-lg font-extrabold">{t.tabs.agenda}</h3>
      <ul className="mb-6 rounded-lg border border-card-edge">
        {meeting.agenda.map((line) => (
          <li key={line.id} className="flex break-inside-avoid gap-3 border-b border-divider px-3 py-2 last:border-0">
            <span aria-hidden="true">{line.done ? '☑' : '☐'}</span>
            <span className={cn('flex-1', line.done && 'line-through')}>{line.text}</span>
            <span className="text-muted">{who(line.picMembershipId, line.picAll)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 text-lg font-extrabold">{t.tabs.actions}</h3>
      <table className="relative w-full border-collapse rounded-lg border border-card-edge">
        <thead>
          <tr>
            <th className={th}>{t.actions.headers.item}</th>
            <th className={th}>{t.actions.headers.pic}</th>
            <th className={th}>{t.actions.headers.due}</th>
            <th className={th}>{t.actions.headers.status}</th>
          </tr>
        </thead>
        <tbody>
          {meeting.actionItems.map((item) => (
            <tr key={item.id} className="break-inside-avoid">
              <td className={td}>
                {item.text}
                {item.fromNumber !== null && <span className="block text-sm text-primary-ink">{t.actions.from({ n: item.fromNumber })}</span>}
              </td>
              <td className={td}>{who(item.picMembershipId)}</td>
              <td className={td}>{item.dueOn ? formatShortDay(item.dueOn, {}, language) : '—'}</td>
              <td className={td}><span className={cn('rounded-pill px-2.5 py-0.5 text-sm font-semibold', STATUS_PILL[item.status])}>{t.actions.status[item.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
