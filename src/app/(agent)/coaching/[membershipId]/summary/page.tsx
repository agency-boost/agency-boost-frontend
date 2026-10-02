'use client';

import { useEffect, useState } from 'react';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';
import { SUMMARY_VIEWS, SummaryCards, type SummaryView } from '@/components/personal-summary';
import { ErrorBanner } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { PRONOUN_FORMS, type Coachee } from '@/lib/coaching';
import { readSummary, type Summary } from '@/lib/summary';

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
 * - ***Campaigns she's chasing* is a sign in its slot** (`:4124`), as *Campaigns you're chasing* is on
 *   `/summary` (ADR-0070 rule 2): the same unbuilt section, in the coachee's pronoun, with no row and no
 *   read until a member's chased campaigns can be read.
 *
 * No *Download* and no page title of its own: the prototype's person view has neither, and the shell
 * above names the person.
 */
export default function CoacheeSummaryTab() {
  const coachee = useCoachee();
  return (
    <Page permission="personal_summary:read">
      <CoacheeSummary coachee={coachee} />
    </Page>
  );
}

function CoacheeSummary({ coachee }: { coachee: Coachee }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<SummaryView>('month');
  const [ratios, setRatios] = useState<ActivityRatios | null>(null);
  const [ratiosError, setRatiosError] = useState<ApiError | null>(null);
  const { membershipId, pronoun } = coachee;

  useEffect(() => {
    let live = true;
    setSummary(null);
    setError(null);
    setRatios(null);
    setRatiosError(null);
    readSummary(membershipId)
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    // Its own read, failing in its own card: the Summary stands without it.
    readActivityRatios(membershipId)
      .then((next) => { if (live) setRatios(next); })
      .catch((err) => { if (live) setRatiosError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipId]);

  return (
    <div className="mx-auto max-w-[860px]">
      {error && <ErrorBanner {...error} />}
      {!summary && !error && (
        <SkeletonCards count={2} label={`Putting ${PRONOUN_FORMS[pronoun].possessive} summary together…`} />
      )}
      {summary && (
        <Segmented
          label="Period"
          tabs={SUMMARY_VIEWS}
          active={view}
          onSelect={(id) => setView(id as SummaryView)}
          className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5"
        >
          {() => (
            <SummaryCards
              summary={summary}
              view={view}
              pulse={{ ratios, error: ratiosError }}
              subject={{ membershipId, pronoun }}
            />
          )}
        </Segmented>
      )}
    </div>
  );
}
