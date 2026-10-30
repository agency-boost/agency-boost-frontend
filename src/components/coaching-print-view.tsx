'use client';

import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { byDueDate } from '@/components/coaching-parts';
import {
  goalHasTarget, printActionLine, printGoalLine, printLeadActionLine, type SessionPrint,
} from '@/lib/coaching';
import { formatCalendarDay, formatCalendarDayLong, formatShortDay } from '@/lib/format';
import { formatRupiahCompact } from '@/lib/goals';

/*
 * **The session's paper, in a module of its own** (P18.99-T16, the bundle): *Download as PDF* (`coaching-print.tsx`)
 * fetches it with the print's read, so a screen that only offers the button does not carry the paper in its first load.
 */

/**
 * What the PDF is saved as: the page's title — kept in both languages (§A.2) — the coachee, and the day it was held in
 * the figures' language.
 */
export const printTitle = (print: Pick<SessionPrint, 'coachee' | 'date'>, figures: Language = DEFAULT_LANGUAGE) =>
  `${kept('Coaching Session')} – ${print.coachee.name} – ${formatCalendarDay(print.date, figures)}`;

/** A last-week item's box on paper, ticked or not, as the prototype's export draws it (`Overall.html:11160`): no words. */
const TICKED = '[x] ';
const UNTICKED = '[ ] ';

/**
 * The paper (`Overall.html:11145-11187`). Headings in the AA amber where the prototype's are its
 * amber-dark, which clears no contrast floor at that size (a Fix, `tokens.md`).
 */
export function SessionPrintView({ print, showCoach }: { print: SessionPrint; showCoach: boolean }) {
  const figures = useFigureLanguage();
  const language = useLanguage();
  const { agreement, goal, print: t } = useMessages(coachingSessionMessages);
  // The paper's figures in the reader's language, as the screen beside it writes them (P18.98-T3).
  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);
  const day = (date: string) => formatShortDay(date, {}, figures);
  const meta = [formatCalendarDayLong(print.date, figures), ...(showCoach ? [t.coachedBy({ name: print.coach.name })] : []), t.finalized];
  const h2 = 'mt-4 text-lg font-bold text-amber-ink';
  const line = 'text-md text-navy';
  const actionItems = [...print.actionItems].sort(byDueDate);
  return (
    <article data-print-view="" className="hidden bg-card p-2 font-body text-navy print:block">
      <h1 className="font-display text-xl font-bold text-navy">{t.title({ name: print.coachee.name })}</h1>
      {/* Two spaces each side of the dot, as the prototype draws it; kept, and wrapped where the paper is narrow (F3). */}
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{meta.join('  ·  ')}</p>

      {print.lastWeekItems.length > 0 && (
        <section>
          <h2 className={h2}>{agreement.lastWeek}</h2>
          {print.lastWeekItems.map((item, i) => (
            <p key={i} className={line}>{item.done ? TICKED : UNTICKED}{item.text}</p>
          ))}
        </section>
      )}

      <section>
        <h2 className={h2}>{goal.title}</h2>
        {goalHasTarget(print.goal) ? (
          <>
            <p className={line}>{printGoalLine('month', print.goal.monthly, money, language)}</p>
            <p className={line}>{printGoalLine('year', print.goal.yearly, money, language)}</p>
          </>
        ) : (
          <p className={line}>{goal.none}</p>
        )}
      </section>

      <section>
        <h2 className={h2}>{agreement.tips}</h2>
        {print.tips.length
          ? print.tips.map((tip, i) => <p key={i} className={line}>{`${i + 1}. ${tip.text}`}</p>)
          : <p className={line}>{t.noneAdded}</p>}
      </section>

      <section>
        <h2 className={h2}>{t.fromLeads}</h2>
        {print.leadActions.length
          ? print.leadActions.map((action, i) => (
            <p key={i} className={line}>{printLeadActionLine(i, action, day, language)}</p>
          ))
          : <p className={line}>{t.none}</p>}
      </section>

      <section>
        <h2 className={h2}>{t.other}</h2>
        {actionItems.length
          ? actionItems.map((item, i) => (
            <p key={i} className={line}>{printActionLine(i, item, day)}</p>
          ))
          : <p className={line}>{t.noneAdded}</p>}
      </section>
    </article>
  );
}
