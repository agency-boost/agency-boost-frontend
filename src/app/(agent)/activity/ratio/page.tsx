'use client';

import { ActivityTabs, useActivityTitle } from '@/components/activity-tabs';
import { Page } from '@/components/page';
import { PersonalRatioCard } from '@/components/ratio-card';
import type { MessagesOf } from '@/i18n/catalogue';
import { useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
import type { ActivityRatio, RatioTerm } from '@/lib/activity';

/**
 * Activity Ratios (P10-T2, P10-T3): the office's ratios over your last 30 days
 * (`Overall.html:2776-2782`, `:5197-5357`, `activity-management.md` §2.4).
 *
 * **Every number is the server's**, from the office's own definitions and benchmarks. The prototype
 * computes five hardcoded formulas in the page from `mockData`, so nothing an agent logs reaches it.
 *
 * **The shared ratio card, exactly as Personal Summary and the Unit Dashboard draw it** (UI V1, UI-106 and UI-053;
 * O-3 *rows*): *Ratio · 30 hari terakhir*, the Selling vs Recruitment bar, then each ratio as a row — its name, *Target
 * X* under it, its value on the right, green when it meets its benchmark and red when not, a whole percentage (UI-080).
 * **Every ratio always shows** (the owner): a ratio with too little data reads *–*, where until 2026-10-30 it was left
 * off the page (P18.95-T5 AC-6, reversed). No per-ratio cards, pills or benchmark sentence. **What a ratio is sits
 * behind a tap on its row**: what it measures, where the office says, and its formula in the office's own words.
 *
 * **A ratio that is not a question about your rung is not here at all** (ADR-0020) — the server leaves
 * it out, so there is nothing to hide and nothing to show as failed.
 */
export default function ActivityRatioPage() {
  const t = useMessages(activityMessages);
  const title = useActivityTitle();
  return (
    <Page title={title} subtitle={t.ratio.subtitle} subtitleOnPhone={false}>
      <ActivityTabs />
      <PersonalRatioCard explain={(ratio) => <Explanation ratio={ratio} />} className="md:max-w-xl" />
    </Page>
  );
}

/** The module's words, in the reader's language (`messages/activity.tsx`; P18.98-T4). */
type ActivityWords = MessagesOf<typeof activityMessages.en>;

/**
 * *What is this ratio?* — the prototype's hover tooltip (`Overall.html:5341-5348`), behind a tap on the row (UI-106):
 * what it measures, where the office's formula is still the platform's, and **the formula in words** — the office's
 * activity types by name, never by the numbers the log no longer draws.
 */
function Explanation({ ratio }: { ratio: ActivityRatio }) {
  const t = useMessages(activityMessages);
  return (
    <>
      <p className="font-semibold text-white">{t.ratio.whatIs}</p>
      {ratio.purpose && <p className="mt-1">{ratio.purpose}</p>}
      <p className="mt-1">{sentence(ratio, t)}</p>
      {ratio.divergesFromStandard && <p className="mt-1">{t.ratio.ownFormula}</p>}
    </>
  );
}

/** The formula in words, for a screen reader: `Submission polis divided by …` — the types' names as the office typed them. */
function sentence(ratio: ActivityRatio, t: ActivityWords): string {
  const side = (terms: RatioTerm[]) => t.ratio.sum({ labels: terms.map((term) => term.label) });
  return ratio.comparison === 'band'
    ? t.ratio.against({ a: side(ratio.numerator), b: side(ratio.denominator) })
    : t.ratio.dividedBy({ a: side(ratio.numerator), b: side(ratio.denominator) });
}
