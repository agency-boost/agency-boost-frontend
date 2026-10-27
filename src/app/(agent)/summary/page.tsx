'use client';

import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SUMMARY_VIEWS, SummaryCards, type SummaryView } from '@/components/personal-summary';
import { SummaryPeriodSelect, useSummaryPeriod } from '@/components/summary-period';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonth } from '@/lib/format';
import { printAs, restorePrintTitle } from '@/lib/print';
import { readSummary, summaryPeriodFrom, type Summary } from '@/lib/summary';

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
 */
type View = SummaryView;

const VIEWS = SUMMARY_VIEWS;

type Query = { month?: string | string[]; year?: string | string[] };

/**
 * *⬇ Download* (ADR-0068): the browser's print, as the prototype's handler is, under a title that says what
 * the page holds (`printAs`, shared with a coaching session's *⬇ Download as PDF*, ADR-0077).
 */
/** The PDF's name: the page's title and the period on it — the month on *Monthly*, the year on *Yearly*. */
const downloadTitle = (summary: Summary, view: View) =>
  `Personal Summary – ${view === 'month' ? formatMonth(summary.month) : summary.year}`;

export default function PersonalSummaryPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = searchParams ? use(searchParams) : {};
  const { asked, view, chooseView, choose, key } = useSummaryPeriod(summaryPeriodFrom(query));
  /** The last Summary read, and the period it was read for. */
  const [held, setHeld] = useState<{ key: string; summary: Summary } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The pulse is the ratio screen's own read (P10-T2, P10-T3), fetched once — it is the last 30 days
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

  // The Summary on the page is the asked period's; until it arrives, the last one only holds the selects.
  const summary = held?.key === key ? held.summary : null;
  const frame = held?.summary ?? null;

  return (
    <Page
      title="Personal Summary"
      subtitle="Your goals, activity and leads — on one page."
      // The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 25): from 768px it reads as before.
      subtitleOnPhone={false}
      actions={summary && (
        // The prototype's glyph before its label (`Overall.html:2705`), as *⬇ Download template* has it on
        // the data upload; hidden from the accessible name, which is the word alone.
        <Button variant="primary" onClick={() => printAs(downloadTitle(summary, view))} className="gap-1 print:hidden">
          <span aria-hidden="true">⬇</span>Download
        </Button>
      )}
    >
      <div className="mx-auto max-w-[860px]">
        {error && <ErrorBanner {...error} />}
        {!frame && !error && <SkeletonCards count={2} label="Putting your summary together…" />}
        {frame && (
          <Segmented
            label="Period"
            tabs={VIEWS}
            active={view}
            onSelect={(id) => chooseView(id as View)}
            className="w-fit print:hidden [&_button]:whitespace-nowrap [&_button]:px-3.5"
          >
            {() => (
              <>
                <SummaryPeriodSelect view={view} frame={frame} asked={asked} onChoose={(value) => choose(value, frame.period)} />
                {summary
                  ? <SummaryCards summary={summary} view={view} pulse={{ ratios: pulse, error: pulseError }} />
                  : !error && <SkeletonCards count={2} label="Putting your summary together…" />}
              </>
            )}
          </Segmented>
        )}
      </div>
    </Page>
  );
}
