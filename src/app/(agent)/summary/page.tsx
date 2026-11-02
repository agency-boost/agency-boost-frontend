'use client';

import { Suspense, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SummaryCards, useSummaryViews, type SummaryView } from '@/components/personal-summary';
import { SummaryPeriodBar, useSummaryPeriod } from '@/components/summary-period';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { summaryMessages } from '@/i18n/messages/summary';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonth } from '@/lib/format';
import { printAs, restorePrintTitle } from '@/lib/print';
import { readSummary, summaryPeriodFrom, type Summary } from '@/lib/summary';
import { useQuery } from '@/lib/use-query';

/**
 * The Personal Summary (P10-T4): your goal against what you produced, this month and this year, and
 * what is left (`Overall.html:3080-3136`, `personal-summary.md`).
 *
 * **Read from what other screens own, and editing none of it** (ADR-0058). The prototype's *produced*
 * figure is an input that writes Goal Settings; here it is read-only, with a marker beside it whose
 * words say where it came from and for which month (ADR-0063 §5), and the agent's own figure is
 * changed on Goal Settings alone.
 *
 * **What you logged against the plan** (P10-T5): leads contacted, appointments and closings against the
 * cascade on the period's own APE target, a chip per summary tile (ADR-0064), and the activity pulse —
 * the ratio engine's answer for your rung, which the prototype printed as four hardcoded tiles.
 *
 * **The leads that need you** (P10-T6): your own open leads, nearest next action first, flagged as the
 * Leads screen flags them.
 *
 * **No footnotes** (P10.1-T6, ADR-0062, ADR-0063): the sentences that explained a card, and the links
 * under them to the screens each figure comes from, are gone — the prototype's cards have none, and
 * the manual does the explaining.
 *
 * **Download** (P10-T8, ADR-0061; P10.1-T8, ADR-0068): the prototype's *⬇ Download*, its label and its
 * handler both — `window.print()` (`Overall.html:2705`, `:6145`). The page as you see it, on paper or as
 * the browser's PDF, and no file through the API; while the print window is open the document is titled
 * for the period on the page, so the PDF is saved as *Personal Summary – Sep 2026* rather than
 * *AgencyBoost*. The app around the page, the period switch and the button itself stay off the paper,
 * and no card breaks across two sheets.
 *
 * **What to do next, and how to improve** (P10-T7, ADR-0060): fixed rules over your own numbers, at most
 * four, under the prototype's *AI-powered* badge (ADR-0069, at the client's request).
 *
 * **Campaigns you're chasing** (P18.5-T7 AC-6, replacing the sign of ADR-0070): the campaigns you chase
 * from the Campaign list that have not ended, each opening its dialog in place. Its own read, failing in
 * its own card.
 *
 * **The cards are `SummaryCards`** (P11-T7): the same cards draw a coachee's *Personal Summary* tab in
 * that person's pronoun. This page is the reader's own: its title, its Download, and its two reads.
 *
 * **An earlier month or year** (P18.8-T11, ADR-0161 §4): a month select under *Monthly*, a year select under
 * *Yearly*, from the office's first month to this one, the choice in the address (`?month=`, `?year=`). A closed
 * period shows its final figures, with no pace sentence and no *The gap*. While the next one is read the selects
 * stay and the cards wait as a skeleton: the old month's figures under the new month's name would lie.
 *
 * **Its words are the catalogue's** (P18.98-T4; `i18n/messages/summary.tsx`): the title, kept English (§A.2),
 * *Download*, the switch's *Monthly · Yearly* (`useSummaryViews`) and the wait, in the reader's language; the PDF's
 * month in the reader's figures'.
 *
 * **UI V1 (UI-051, UI-057)**: no line under the title at any size (Appendix A). Below 1024px the title row is the title
 * and the avatar, and under it one control row — *Bulanan | Tahunan*, the month pill (a sheet, no native select) and a
 * 44px download icon button — so the orange goal card is the first thing the eye meets. From 1024px *Unduh* keeps its
 * place at the title row's end as a secondary, outlined button with a line download icon. It prints the same page.
 */
type View = SummaryView;

/**
 * *⬇ Download* (ADR-0068): the browser's print, as the prototype's handler is, under a title that says what
 * the page holds (`printAs`, shared with a coaching session's *⬇ Download as PDF*, ADR-0077).
 */
/**
 * The PDF's name: the page's title and the period on it — the month on *Monthly*, the year on *Yearly*. The title is
 * kept English (§A.2), and the month is written in the reader's figures' language (P18.98-T4).
 */
const downloadTitle = (title: string, summary: Summary, view: View, figures: Language) =>
  `${title} – ${view === 'month' ? formatMonth(summary.month, figures) : summary.year}`;

export default function PersonalSummaryPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <PersonalSummary />
    </Suspense>
  );
}

function PersonalSummary() {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  const views = useSummaryViews();
  const { asked, view, chooseView, choose, key } = useSummaryPeriod(summaryPeriodFrom(useQuery()));
  /** The last Summary read, and the period it was read for. */
  const [held, setHeld] = useState<{ key: string; summary: Summary } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The ratio card is the ratio screen's own read (P10-T2, P10-T3), fetched once — it is the last 30 days
  // whichever period is showing, so switching views does not ask again.
  const [pulse, setPulse] = useState<ActivityRatios | null>(null);
  // Leaving the page puts the title back, for a browser whose `afterprint` never came: the app's own
  // title is static, so nothing else would, and every screen after this one would carry the period's.
  useEffect(() => restorePrintTitle, []);
  const [pulseError, setPulseError] = useState<ApiError | null>(null);

  // The period's Summary: read again whenever the period changes.
  useEffect(() => {
    let live = true;
    setError(null);
    readSummary(undefined, asked)
      .then((next) => { if (live) setHeld({ key, summary: next }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
    // `key` is the period, said once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let live = true;
    readActivityRatios()
      .then((next) => { if (live) setPulse(next); })
      .catch((err) => { if (live) setPulseError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  // The Summary on the page is the asked period's; until it arrives, the last one only holds the controls.
  const summary = held?.key === key ? held.summary : null;
  const frame = held?.summary ?? null;
  const download = summary ? () => printAs(downloadTitle(t.title, summary, view, figures)) : null;

  return (
    <Page
      title={t.title}
      // UI-051: below 1024px the title row is the title and the avatar; the controls are the row under it.
      control={null}
      actions={download && (
        // From 1024px, today's place — the title row's end — as a secondary, outlined button (UI-051), its glyph a line icon (UI-057).
        <Button variant="secondary" onClick={download} className="gap-1.5 rounded-pill border-[1.5px] border-navy print:hidden">
          <LineIcon name="download" className="h-[18px] w-[18px]" />{t.download}
        </Button>
      )}
    >
      <div className="max-w-[1200px]">
        {error && <ErrorBanner {...error} />}
        {!frame && !error && <SkeletonCards count={2} label={t.loading} />}
        {frame && (
          <>
            <SummaryPeriodBar
              views={views}
              view={view}
              onView={chooseView}
              frame={frame}
              asked={asked}
              onChoose={(value) => choose(value, frame.period)}
              trailing={download && (
                // Below 1024px: a 44px icon button at the control row's end, named by the word (UI-051).
                <button
                  type="button"
                  aria-label={t.download}
                  onClick={download}
                  data-download="compact"
                  className="flex h-11 w-11 items-center justify-center rounded-pill bg-card text-navy hover:bg-hover-row lg:hidden"
                >
                  <LineIcon name="download" />
                </button>
              )}
            />
            {summary
              ? <SummaryCards summary={summary} view={view} pulse={{ ratios: pulse, error: pulseError }} />
              : !error && <SkeletonCards count={2} label={t.loading} />}
          </>
        )}
      </div>
    </Page>
  );
}
