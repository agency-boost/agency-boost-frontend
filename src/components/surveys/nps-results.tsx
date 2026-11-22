'use client';

import { useState } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import type { LabelPair, NpsLine, NpsResults, RunView } from '@/lib/surveys';
import { Quote, SectionHead, ShareBar, signed, TrendBars, usePct } from './survey-bits';
import { useSurveyWords } from './survey-words';

/**
 * **NPS › Hasil** (P19.22-T6 AC-2; ADR-0276 §1–§3): *Keseluruhan KPM* in its own navy card — the score in orange, the
 * change in *poin*, the four-quarter trend, the promoter · passive · detractor bar and the response line — then one row
 * per question, lowest first, each with its score, change, trend and bar. **Tapping a row shows why people scored it**:
 * on the right from 768px, right under the row on a phone (part C). The first row is open to begin with.
 *
 * *✦ Yang bisa diperbaiki (AI)* is not built while reading with Claude is on hold (ADR-0266 §5, OD-358): the headline's
 * panel shows the open question's own answers instead — the respondents' words, never a summary (parity I-1172).
 */
export function NpsResultsView({ nps, run, openQuestion }: {
  nps: NpsResults;
  run: RunView;
  /** The open question's words, for the headline's panel; `null` without one. */
  openQuestion: LabelPair | null;
}) {
  const t = useMessages(surveyAnalyticsMessages);
  const w = t.nps;
  const { pair, period } = useSurveyWords();
  const pct = usePct();
  const phone = useMediaQuery('phone');
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? nps.questions[0]?.kode ?? nps.headline?.kode ?? null;
  const whoName = t.who[nps.who];
  const short = (key: string) => {
    const label = period(key);
    return label.replace(/ (\d{2})(\d{2})$/, ' ’$2');
  };

  if (nps.respondents === 0 && nps.whoShown) {
    return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.noAnswers}</p>;
  }

  const panel = (line: NpsLine) => (
    <div data-nps-reasons={line.kode} className="space-y-3">
      <div>
        <p className="text-md font-bold text-ink">{w.why}</p>
        <p className="text-xs text-muted">{w.whyCount({ n: line.reasons?.length ?? 0, who: whoName })}</p>
      </div>
      {line.reasons && line.reasons.length > 0
        ? <ul className="space-y-1.5">{line.reasons.map((q, i) => <Quote key={`${i}-${q.text}`} quote={q} />)}</ul>
        : <p className="text-md text-muted">{line.reasons === null && !nps.whoShown ? t.hiddenView : w.noReasons}</p>}
      {line.kode === nps.headline?.kode && nps.improve && nps.improve.length > 0 && (
        <div className="rounded-row bg-secondary/[0.04] p-3">
          <p className="text-md font-bold text-navy">{w.improve}</p>
          {openQuestion && <p className="mb-1.5 text-xs text-muted">{pair(openQuestion)}</p>}
          <ul className="space-y-1.5">{nps.improve.map((q, i) => <Quote key={`${i}-${q.text}`} quote={q} />)}</ul>
        </div>
      )}
    </div>
  );

  const change = (line: NpsLine, onNavy = false) => (line.change === null ? null : (
    <span
      aria-label={w.changeName({ n: signed(line.change) })}
      className={cn('text-xs font-bold', line.change >= 0
        ? (onNavy ? 'text-on-navy-green' : 'text-signal-green')
        : (onNavy ? 'text-on-navy-red' : 'text-signal-red'))}
    >
      {line.change >= 0 ? '▲ ' : '▼ '}{w.change({ n: signed(line.change) })}
    </span>
  ));

  const headline = nps.headline;
  const chosen = [headline, ...nps.questions].find((l) => l?.kode === selected) ?? null;
  const { promoterMin, passiveMin } = nps.cutoffs;

  return (
    <div data-nps-results="" className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <div className="min-w-0 space-y-4">
        {headline && (
          <section className="rounded-lg bg-secondary text-secondary-contrast">
            <button
              type="button"
              aria-expanded={phone ? selected === headline.kode : undefined}
              aria-pressed={!phone ? selected === headline.kode : undefined}
              onClick={() => setPicked(headline.kode)}
              className="block w-full rounded-lg px-4 py-4 text-left"
            >
              <span className="block text-md font-bold">{w.overall({ who: whoName })}</span>
              <span className="mt-1 flex flex-wrap items-end gap-3">
                <b className="text-[44px] font-extrabold leading-none text-primary-on-secondary">{pct(headline.score)}</b>
                {change(headline, true)}
                <span className="ml-auto"><TrendBars values={headline.trend} onNavy /></span>
              </span>
              <span className="mt-3 block">{headline.shares ? <ShareBar shares={headline.shares} /> : null}</span>
              <span className="mt-2 block text-xs text-secondary-contrast/85">
                {w.responseLine({
                  invited: run.responses.invited, sent: run.responses.sent, l: run.responses.leaders, a: run.responses.agents,
                  pct: pct(run.responses.pct),
                })}
              </span>
              {!nps.whoShown && <span className="mt-2 block text-xs font-semibold text-secondary-contrast">{t.hiddenView}</span>}
            </button>
            {phone && selected === headline.kode && <div className="rounded-b-lg bg-card px-4 py-3 text-ink">{panel(headline)}</div>}
          </section>
        )}

        <section>
          <SectionHead title={w.perQuestion} note={w.perQuestionHint} />
          <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
            <ul>
              {nps.questions.map((q) => {
                const on = q.kode === selected;
                return (
                  <li key={q.kode} data-nps-question={q.kode} className="border-b border-divider last:border-0">
                    <button
                      type="button"
                      aria-expanded={phone ? on : undefined}
                      aria-pressed={!phone ? on : undefined}
                      onClick={() => setPicked(q.kode)}
                      className={cn('block w-full border-l-4 px-4 py-3 text-left', on ? 'border-primary bg-today' : 'border-transparent hover:bg-hover-row')}
                    >
                      <span className="flex items-start gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-md font-bold text-ink">{pair(q.text)}</span>
                          {change(q)}
                        </span>
                        <b className="text-[22px] font-extrabold leading-tight text-navy">{pct(q.score)}</b>
                        <TrendBars values={q.trend} />
                      </span>
                      {q.shares && <span className="mt-2 block"><ShareBar shares={q.shares} /></span>}
                    </button>
                    {phone && on && <div className="border-t border-divider bg-hover-row px-4 py-3">{panel(q)}</div>}
                  </li>
                );
              })}
            </ul>
            <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-divider px-4 py-2.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-nps-promoter" />{w.promoter({ min: promoterMin, max: 10 })}</span>
              <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-nps-passive" />{w.passive({ from: passiveMin, to: promoterMin - 1 })}</span>
              <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-nps-detractor" />{w.detractor({ max: passiveMin - 1 })}</span>
              {nps.trendPeriods.length > 1 && (
                <span>{w.trend({ from: short(nps.trendPeriods[0]), to: short(nps.trendPeriods[nps.trendPeriods.length - 1]) })}</span>
              )}
            </p>
          </div>
        </section>
      </div>

      {!phone && chosen && (
        <aside className="min-w-0 md:sticky md:top-4">
          <SectionHead title={pair(chosen.text)} />
          <div className="rounded-lg border border-card-edge bg-card px-4 py-4">{panel(chosen)}</div>
        </aside>
      )}
    </div>
  );
}
