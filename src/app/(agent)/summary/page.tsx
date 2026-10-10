'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SUMMARY_VIEWS, SummaryCards, type SummaryView } from '@/components/personal-summary';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonth } from '@/lib/format';
import { printAs, restorePrintTitle } from '@/lib/print';
import { readSummary, type Summary } from '@/lib/summary';

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
 * for the period on the page, so the PDF is saved as *Personal Summary – September 2026* rather than
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
 */
type View = SummaryView;

const VIEWS = SUMMARY_VIEWS;

/**
 * *⬇ Download* (ADR-0068): the browser's print, as the prototype's handler is, under a title that says what
 * the page holds (`printAs`, shared with a coaching session's *⬇ Download as PDF*, ADR-0077).
 */
/** The PDF's name: the page's title and the period on it — the month on *Monthly*, the year on *Yearly*. */
const downloadTitle = (summary: Summary, view: View) =>
  `Personal Summary – ${view === 'month' ? formatMonth(summary.month) : summary.year}`;

export default function PersonalSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<View>('month');
  // The pulse is the ratio screen's own read (P10-T2, P10-T3), fetched once — it is the last 30 days
  // whichever period is showing, so switching views does not ask again.
  const [pulse, setPulse] = useState<ActivityRatios | null>(null);
  // Leaving the page puts the title back, for a browser whose `afterprint` never came: the app's own
  // title is static, so nothing else would, and every screen after this one would carry the period's.
  useEffect(() => restorePrintTitle, []);
  const [pulseError, setPulseError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readSummary()
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    readActivityRatios()
      .then((next) => { if (live) setPulse(next); })
      .catch((err) => { if (live) setPulseError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  return (
    <Page
      title="Personal Summary"
      subtitle="Your goals, activity and leads — on one page."
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
        {!summary && !error && <SkeletonCards count={2} label="Putting your summary together…" />}
        {summary && (
          <Segmented
            label="Period"
            tabs={VIEWS}
            active={view}
            onSelect={(id) => setView(id as View)}
            className="w-fit print:hidden [&_button]:whitespace-nowrap [&_button]:px-3.5"
          >
            {() => <SummaryCards summary={summary} view={view} pulse={{ ratios: pulse, error: pulseError }} />}
          </Segmented>
        )}
      </div>
    </Page>
  );
}
