'use client';

import { Suspense, useEffect, useState } from 'react';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';
import { SUMMARY_VIEWS, SummaryCards, type SummaryView } from '@/components/personal-summary';
import { SummaryPeriodSelect, useSummaryPeriod } from '@/components/summary-period';
import { ErrorBanner } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { PRONOUN_FORMS, type Coachee } from '@/lib/coaching';
import { readSummary, summaryPeriodFrom, type Summary, type SummaryPeriodQuery } from '@/lib/summary';
import { useQuery } from '@/lib/use-query';

/**
 * A coachee's *Personal Summary* tab (`Overall.html:3998-4162`, P11-T7 AC-4): the agent's own Summary,
 * *"exact copy of the agent's own screen"* (`:3998`), about the person whose page this is.
 *
 * - **The same cards as `/summary`** (`SummaryCards`), read from `GET /summary?for=`: the coachee's
 *   goal, production and its source, log, leads and insights, on their rung. The server answers it
 *   for a person the reader coaches and audits the read (roles §3.5).
 * - **In their pronoun**, from the person read: *Her sales activity targets*, *Leads that need her*,
 *   *How she can improve*.
 * - **The APE produced is read-only** with its source (ADR-0058), where the prototype has an input
 *   (`#producedInput-cs`, `:4021`, contradiction #7).
 * - **The insight rules under the prototype's *AI-powered* badge** (ADR-0069), as `/summary` has them.
 * - **The *Activity pulse* is the coachee's ratios**, from `GET /activity/ratios?for=` on their rung
 *   (ADR-0020), read beside the Summary and failing on its own card, as `/summary`'s does.
 * - ***Campaigns she's chasing*** (`:4121-4130`, P18.5-T9): the coachee's chases of campaigns not ended, 🚀
 *   chips by title, from `GET /campaigns/chasing?for=` — the read `/summary`'s card makes for the member, so
 *   the two cannot disagree. Its own read, failing in its own card.
 *
 * No *Download* and no page title of its own: the prototype's person view has neither, and the shell
 * above names the person.
 *
 * **An earlier month or year** (P18.8-T11 AC-2): the same month and year selects as `/summary`, the choice in this
 * tab's own address — `/coaching/{id}/summary?month=2026-08` — read with `?for=` and the period together, and
 * audited as every read of the coachee's Summary is.
 */
export default function CoacheeSummaryTab() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <SummaryTab />
    </Suspense>
  );
}

function SummaryTab() {
  const coachee = useCoachee();
  const query = useQuery();
  return (
    <Page permission="personal_summary:read">
      <CoacheeSummary coachee={coachee} address={summaryPeriodFrom(query)} />
    </Page>
  );
}

function CoacheeSummary({ coachee, address }: { coachee: Coachee; address: SummaryPeriodQuery }) {
  const { asked, view, chooseView, choose, key } = useSummaryPeriod(address);
  /** The last Summary read: whose, for which period, and what it said. */
  const [held, setHeld] = useState<{ membershipId: string; key: string; summary: Summary } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [ratios, setRatios] = useState<ActivityRatios | null>(null);
  const [ratiosError, setRatiosError] = useState<ApiError | null>(null);
  const { membershipId, pronoun } = coachee;

  useEffect(() => {
    let live = true;
    setError(null);
    readSummary(membershipId, asked)
      .then((next) => { if (live) setHeld({ membershipId, key, summary: next }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
    // `key` is the period, said once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId, key]);

  useEffect(() => {
    let live = true;
    setRatios(null);
    setRatiosError(null);
    // Its own read, failing in its own card: the Summary stands without it.
    readActivityRatios(membershipId)
      .then((next) => { if (live) setRatios(next); })
      .catch((err) => { if (live) setRatiosError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipId]);

  // The period's Summary of this person; another person's, or another period's, only holds the selects meanwhile.
  const frame = held?.membershipId === membershipId ? held.summary : null;
  const summary = frame && held?.key === key ? frame : null;
  const waiting = <SkeletonCards count={2} label={`Putting ${PRONOUN_FORMS[pronoun].possessive} summary together…`} />;

  return (
    <div className="mx-auto max-w-[860px]">
      {error && <ErrorBanner {...error} />}
      {!frame && !error && waiting}
      {frame && (
        <Segmented
          label="Period"
          tabs={SUMMARY_VIEWS}
          active={view}
          onSelect={(id) => chooseView(id as SummaryView)}
          className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5"
        >
          {() => (
            <>
              <SummaryPeriodSelect view={view} frame={frame} asked={asked} onChoose={(value) => choose(value, frame.period)} />
              {summary ? (
                <SummaryCards
                  summary={summary}
                  view={view}
                  pulse={{ ratios, error: ratiosError }}
                  subject={{ membershipId, pronoun }}
                />
              ) : !error && waiting}
            </>
          )}
        </Segmented>
      )}
    </div>
  );
}
