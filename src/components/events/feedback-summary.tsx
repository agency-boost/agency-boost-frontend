'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { eventsOfficeMessages } from '@/i18n/messages/events-office';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  awaitingLine, npsFigure, npsFormula, readFeedbackSummary, responsesLine, scoreOutOf,
  summaryTitle, type FeedbackRow, type FeedbackSummary, type NpsBucket,
} from '@/lib/events-admin';

/**
 * `.feedback-score` (`KPM_Owner.html:185-188`), each bucket's tint. **Navy words on the amber tint** for a
 * passive (F-126's paint): the prototype's amber-dark on its own 14% tint is under 4.5:1.
 */
const BUCKET: Record<NpsBucket, string> = {
  promoter: 'bg-success/10 text-success',
  passive: 'bg-amber/[0.14] text-navy',
  detractor: 'bg-alert/10 text-alert',
};

/**
 * **The *Feedback Summary* card** (`KPM_Owner.html:3751-3795`, CSS `:174-191`; P18.5-T6 AC-5) — the one
 * component, and the one read, Phase 18.6 mounts above its tree.
 *
 * *"{title} — Feedback Summary"*; the NPS with its formula and *"· {n} responses"*; then every answer by
 * score, each with its author's name (OD-151, ADR-0141), *"{s}/10"* tinted by its bucket, *Why:* and *How to
 * improve:* — a line not given is not drawn.
 *
 * **The NPS counts confirmed attendees only** (roles §3.11, OD-31): a claim nobody has confirmed is not in it.
 * So the line says how many answers wait on a confirmation (*"· {k} awaiting attendance confirmation"*, form
 * 5), and each answer outside the NPS carries an icon whose words say why (form 2). With nobody to count the
 * NPS reads *—*, never 0, and the list says *No feedback yet.* (contradiction 22). **The prototype's two
 * *Overall* columns are not drawn** (D-insights): fixed prose cannot be true of a real event, and the rows
 * already hold every *why* and every *how to improve*.
 *
 * Every word a member wrote is rendered as text (contradiction 25).
 */
export function FeedbackSummaryCard({ summary }: { summary: FeedbackSummary }) {
  const t = useMessages(eventsOfficeMessages);
  const language = useLanguage();
  const titleId = useId();
  const c = summary.constants;
  return (
    <section aria-labelledby={titleId} className="overflow-hidden rounded-lg border border-hairline bg-card" data-part="feedback-summary">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline bg-base px-[18px] py-3.5">
        <h3 id={titleId} className="min-w-0 break-words font-display text-md font-bold text-navy">{summaryTitle(summary.title, language)}</h3>
        <p className="ml-auto text-right text-base text-muted" data-part="nps">
          <strong className="mr-1 text-xl text-navy">{npsFigure(summary.nps)}</strong>
          {' '}{t.nps}{' '}
          <span className="block text-2xs font-normal">{npsFormula(c, language)}</span>
          {' '}{responsesLine(summary.counted, language)}
          {summary.awaitingConfirmation > 0 && <> {awaitingLine(summary.awaitingConfirmation, language)}</>}
        </p>
      </div>
      {summary.rows.length === 0 ? (
        <p className="px-[18px] py-4 text-base text-muted">{t.noFeedback}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {summary.rows.map((row) => <FeedbackItem key={row.membershipId} row={row} c={c} />)}
        </ul>
      )}
    </section>
  );
}

function FeedbackItem({ row, c }: { row: FeedbackRow; c: FeedbackSummary['constants'] }) {
  const t = useMessages(eventsOfficeMessages);
  const tip = row.attendance === 'absent' ? t.absentTip : t.unconfirmedTip;
  return (
    <li className="border-b border-hairline px-[18px] py-[11px] last:border-b-0" data-row={row.membershipId} data-counted={row.counted}>
      <div className="mb-1 flex items-center gap-2.5">
        <span className="min-w-0 break-words text-base font-semibold text-navy">{row.name}</span>
        <span className={cn('shrink-0 rounded-[6px] px-1.5 py-0.5 text-sm font-bold', BUCKET[row.bucket])}>{scoreOutOf(row.score, c)}</span>
        {!row.counted && <TippedGlyph glyph="⚠️" name={tip} tip={tip} align="fit" />}
      </div>
      {row.why && (
        <p className="break-words text-base leading-snug text-muted">
          <strong className="font-semibold text-navy">{t.why}</strong> {row.why}
        </p>
      )}
      {row.improve && (
        <p className="mt-0.5 break-words text-base leading-snug text-muted">
          <strong className="font-semibold text-navy">{t.improve}</strong> {row.improve}
        </p>
      )}
    </li>
  );
}

/** The card, read: a skeleton, an error with a retry, then the card. `version` reads it again. */
export function FeedbackSummarySection({ eventId, version }: { eventId: string; version: number }) {
  const t = useMessages(eventsOfficeMessages);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readFeedbackSummary(eventId)
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [eventId, version, attempt]);

  if (error && !summary) {
    return (
      <div>
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
      </div>
    );
  }
  if (!summary) {
    return (
      <Skeleton label={t.loadingSummary}>
        <div className="rounded-lg border border-hairline bg-card p-4">
          <SkeletonBar className="h-4 w-2/3" />
          <SkeletonBar className="mt-3 w-full" />
          <SkeletonBar className="mt-2 w-5/6" />
        </div>
      </Skeleton>
    );
  }
  return <FeedbackSummaryCard summary={summary} />;
}
