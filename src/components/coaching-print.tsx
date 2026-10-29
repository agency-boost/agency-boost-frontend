'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { byDueDate } from '@/components/coaching-parts';
import { Button, ErrorBanner } from '@/components/ui/field';
import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  goalHasTarget, printActionLine, printGoalLine, printLeadActionLine, readSessionPrint, type SessionPrint,
} from '@/lib/coaching';
import { formatCalendarDay, formatCalendarDayLong, formatShortDay } from '@/lib/format';
import { formatRupiahCompact } from '@/lib/goals';
import { printAs } from '@/lib/print';
import { useCan } from '@/lib/session';

/**
 * *⬇ Download as PDF* (`Overall.html:4312`; ADR-0077, P11-T10 AC-3): **a print of the session's frozen
 * snapshot**, as the Summary's *⬇ Download* is a print of the Summary (ADR-0061).
 *
 * - **From its own read**, `GET /coaching/sessions/:sessionId/print`, which the server audits and which
 *   holds no leader note: never the page on screen, which a correction or a later read could have moved.
 *   The latest finalized version, so a session being corrected prints the version that still counts.
 * - **Its content is the prototype's export** (`:11145-11187`): the title, the date line, last week's
 *   items with `[x]` and `[ ]`, the goal, the tips and the two lists of next actions, under the
 *   prototype's headings and in its empty words. No ratios, activity, leads table or notes, as there.
 * - **The session's date, not today's** (a Fix): the prototype printed the browser's today under every
 *   session it exported. A coachee's print says who led it, as the prototype's leader's own export does
 *   (`:11677`), and so does anybody's who did not lead it.
 * - **Money in the one formatter** (F-02), where the prototype's export wrote *Rp1.2M+*: **compact**, *Rp 6,5 jt / Rp 8 jt*,
 *   as every figure is but a price and the file's own (ADR-0174 §4) — a print is read, not checked against a field.
 * - **Numbered as the screen numbers them** (F1 of P11's final walk): the other action items by date,
 *   undated last, with the screen's own comparator, as the prototype sorts them before it exports
 *   (`:11044-11049`, `:11181`). *No goal set* where the archive says it, by the archive's condition (F2).
 *
 * The print view is off the screen (`hidden print:block`) and, while it is mounted, the only thing on
 * the paper (`globals.css`, `[data-print-view]`). While the print window is open the document is titled
 * for the coachee and the day, so the PDF is saved as *Coaching Session – Rina Wijaya – October 2, 2026*.
 * It leaves the page once the window closes.
 *
 * **Its words are the catalogue's** (`messages/coaching-session.tsx`, P18.98-T4) in the reader's language, the paper's
 * as the screen's; its figures in `useFigureLanguage()`'s. *Coaching Session*, its title, is kept in both (§A.2).
 */
export function DownloadPdfButton({
  sessionId, showCoach, className,
}: {
  sessionId: string;
  /** Say who led it on the paper: for a coachee, and anybody else who did not lead it. */
  showCoach: boolean;
  className?: string;
}) {
  const figures = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).print;
  const canExport = useCan('coaching_session:export_pdf');
  const [print, setPrint] = useState<SessionPrint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Printed once it is on the page, and taken off it once the window closes. Its title in the language it was asked
  // for in: a change of language while the browser's window is open prints nothing again.
  useEffect(() => {
    if (print) printAs(printTitle(print, figures), () => setPrint(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [print]);

  if (!canExport) return null;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      setPrint(await readSessionPrint(sessionId));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => void download()} disabled={busy} className={cn('gap-1', className)}>
        {/* The prototype's glyph before its label, out of the accessible name, as the Summary's *⬇ Download*. */}
        <span aria-hidden="true">⬇</span>{t.download}
      </Button>
      {error && <div className="basis-full text-left"><ErrorBanner {...error} /></div>}
      {print && createPortal(<SessionPrintView print={print} showCoach={showCoach} />, document.body)}
    </>
  );
}

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
