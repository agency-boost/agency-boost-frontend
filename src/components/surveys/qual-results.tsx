'use client';

import { useState, type ReactNode } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { cn } from '@/lib/cn';
import type { QualBlockResult, QualResults } from '@/lib/surveys';
import { useMediaQuery } from '@/lib/use-media-query';
import { CountStack, IssuePill, LastHalf, Quote, SectionHead, usePct } from './survey-bits';
import { useSurveyWords } from './survey-words';

/**
 * ***Analisa kualitatif › Hasil*** (P19.22-T7 AC-2; ADR-0276 §4, §5): two balanced columns — left *Siapa yang menjawab ·
 * A Penjualan · C Aktivasi · Coaching leader downline · Dukungan leader*, right *Aspirasi jangka panjang · B Rekrutmen ·
 * D Manajemen unit · Suara responden*; one column on a phone, in that order. A–D share one row format — rank · item ·
 * *% masalah* · *semester lalu* ▲/▼ — and each says what its % means. **Quotes only on tap**: *Lihat catatan responden*
 * under *Aspirasi*, a voice under *Suara responden*. The agents' view says of each leader block that it was not asked.
 * The *Coaching leader downline* table names its people as the server sends them (a named run's alone).
 */
export function QualResultsView({ qual }: { qual: QualResults }) {
  const t = useMessages(surveyAnalyticsMessages);
  const w = t.qual;
  const { pair } = useSurveyWords();
  const pct = usePct();
  const [notesOpen, setNotesOpen] = useState(false);
  const [voice, setVoice] = useState<number | null>(null);
  const phone = useMediaQuery('phone');
  const max = qual.cutoffs.qualIssueMaxRating;
  const whoName = t.who[qual.who];

  if (qual.respondents === 0 && qual.whoShown) {
    return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.noAnswers}</p>;
  }

  const block = (kode: string) => qual.blocks.find((b) => b.kode === kode);
  const card = (children: ReactNode, className?: string) => (
    <div className={cn('overflow-hidden rounded-lg border border-card-edge bg-card', className)}>{children}</div>
  );
  const leaderOnly = (title: string) => (
    <section>
      <SectionHead title={title} note={w.leaderOnly} />
      {card(<p className="px-4 py-3 text-md text-muted">{w.notAsked}</p>)}
    </section>
  );

  /** One of A–D, in the one row format, with the sentence saying what its % means. */
  const ranked = (b: QualBlockResult | undefined, meaning: string, comfort = false) => {
    if (!b) return null;
    const title = pair(b.title).replace(/^([A-D])\.\s*/, '$1 · ');
    if (!b.asked) return leaderOnly(title);
    const who = b.audience === 'leader' ? t.who.leader : whoName;
    return (
      <section data-qual-block={b.kode}>
        <SectionHead title={title} note={w.whoN({ who, n: b.respondents })} />
        {card(
          <>
            <p className="px-4 pt-3 text-xs text-muted">{meaning}</p>
            <table className="relative w-full table-fixed text-md">
              <thead>
                <tr className="text-2xs font-bold uppercase tracking-wide text-muted">
                  <th scope="col" className="w-8 px-2 py-1.5"><span className="sr-only">#</span></th>
                  <th scope="col" className="px-1 py-1.5 text-left"><span className="sr-only">{pair(b.title)}</span></th>
                  <th scope="col" className="w-20 px-1 py-1.5">{w.pctIssue}</th>
                  <th scope="col" className="w-20 px-2 py-1.5 text-right">{w.lastHalf}</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={`${r.questionKode}-${r.itemKode}`} className="border-t border-divider">
                    <td className="px-2 py-1.5 text-center text-xs text-muted">{i + 1}</td>
                    <td className="px-1 py-1.5 font-semibold text-ink">
                      {pair(r.label)}
                      {comfort && r.comfortPct !== null && <em className="block text-xs font-normal not-italic text-muted">{w.comfort({ n: pct(r.comfortPct) })}</em>}
                    </td>
                    <td className="px-1 py-1.5 text-center"><IssuePill pct={r.issuePct} severity={r.severity} /></td>
                    <td className="px-2 py-1.5 text-right"><LastHalf pct={r.previousPct} trend={r.trend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>,
        )}
      </section>
    );
  };

  const meaningA = qual.who === 'agent' ? w.meaning.salesAgent({ max }) : qual.who === 'leader' ? w.meaning.salesLeader({ max }) : w.meaning.salesAll({ max });
  const tenure = qual.profile.tenure;

  const whoAnswered = (
    <section>
      <SectionHead title={w.who} note={w.n({ n: qual.respondents })} />
      {card(
        qual.profile.workStatus && tenure ? (
          <div className="divide-y divide-divider">
            <div className="px-4 py-3">
              <p className="mb-1.5 text-md font-bold text-ink">{w.workStatus}</p>
              <CountStack parts={[
                { key: 'ft', n: qual.profile.workStatus.fullTime, label: w.fullTime({ n: qual.profile.workStatus.fullTime }), cls: 'bg-nps-promoter' },
                { key: 'pt', n: qual.profile.workStatus.partTime, label: w.partTime({ n: qual.profile.workStatus.partTime }), cls: 'bg-survey-part-time', ink: 'text-navy' },
                ...(qual.profile.workStatus.unknown > 0
                  ? [{ key: 'u', n: qual.profile.workStatus.unknown, label: w.unknown({ n: qual.profile.workStatus.unknown }), cls: 'bg-pill-grey', ink: 'text-ink' }]
                  : []),
              ]}
              />
            </div>
            <div className="px-4 py-3">
              <p className="mb-1.5 text-md font-bold text-ink">{w.tenure}</p>
              <CountStack parts={[
                { key: '0', n: tenure.counts[0], label: w.under({ a: tenure.bands[0], n: tenure.counts[0] }), cls: 'bg-tenure-1', ink: 'text-navy' },
                { key: '1', n: tenure.counts[1], label: w.between({ a: tenure.bands[0], b: tenure.bands[1], n: tenure.counts[1] }), cls: 'bg-tenure-2', ink: 'text-navy' },
                { key: '2', n: tenure.counts[2], label: w.between({ a: tenure.bands[1], b: tenure.bands[2], n: tenure.counts[2] }), cls: 'bg-tenure-3' },
                { key: '3', n: tenure.counts[3], label: w.over({ c: tenure.bands[2], n: tenure.counts[3] }), cls: 'bg-tenure-4' },
                ...(tenure.unknown > 0 ? [{ key: 'u', n: tenure.unknown, label: w.unknown({ n: tenure.unknown }), cls: 'bg-pill-grey', ink: 'text-ink' }] : []),
              ]}
              />
            </div>
          </div>
        ) : <p className="px-4 py-3 text-md text-muted">{t.hiddenView}</p>,
      )}
    </section>
  );

  const notes = qual.aspirationNotes ?? [];
  const aspiration = (
    <section data-qual-aspiration="">
      <SectionHead title={w.aspiration} note={w.manyAllowed} />
      {card(
        <>
          <ul className="divide-y divide-divider">
            {qual.aspiration.map((a) => (
              <li key={a.kode} className="px-4 py-2.5">
                <p className="flex justify-between gap-2 text-md font-bold text-ink"><span>{pair(a.label)}</span><span>{pct(a.pct)}</span></p>
                <div className="mt-1.5 h-1.5 rounded-pill bg-secondary/10" aria-hidden="true">
                  <span style={{ width: `${a.pct ?? 0}%` }} className="block h-full rounded-pill bg-primary" />
                </div>
                {qual.who === 'all' && a.leaderPct !== null && a.agentPct !== null && (
                  <p className="mt-1 text-xs text-muted">{w.aspirationSplit({ l: pct(a.leaderPct), a: pct(a.agentPct) })}</p>
                )}
              </li>
            ))}
          </ul>
          {notesOpen && notes.length > 0 && <ul className="space-y-1.5 px-4 pb-2">{notes.map((q, i) => <Quote key={`${i}-${q.text}`} quote={q} />)}</ul>}
          {notes.length > 0 && (
            <button
              type="button"
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen((o) => !o)}
              className="min-h-11 w-full border-t border-divider px-4 text-left text-md font-bold text-navy"
            >
              {notesOpen ? w.hideNotes : w.notes({ n: notes.length })}
            </button>
          )}
        </>,
      )}
    </section>
  );

  const cd = qual.coachingDownline;
  const areas = ['SALES', 'RECRUIT', 'ACTIVATION', 'UNIT'] as const;
  const coaching = !cd.asked ? leaderOnly(w.coaching) : (
    <section data-qual-coaching="">
      <SectionHead title={w.coaching} note={w.whoN({ who: t.who.leader, n: cd.n })} />
      {card(
        <>
          <p className="px-4 py-3">
            <b className="text-[18px] text-navy">{cd.yes === null ? '—' : w.coachingOf({ x: cd.yes, y: cd.n })}</b>{' '}
            <span className="text-md text-muted">{w.coachingLine}</span>
          </p>
          {cd.rows && cd.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="relative w-full min-w-[30rem] text-md">
                <thead>
                  <tr className="border-t border-divider text-xs font-bold text-muted">
                    <th scope="col" className="px-4 py-1.5 text-left">{w.downlineLeader}</th>
                    <th scope="col" className="px-2 py-1.5 text-left">{w.upline}</th>
                    {areas.map((a) => <th key={a} scope="col" className="px-1 py-1.5">{w.areas[a]}</th>)}
                    <th scope="col" className="px-2 py-1.5 text-left">{w.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {cd.rows.map((r) => (
                    <tr key={`${r.uplineId}-${r.leaderId}`} className="border-t border-divider">
                      <td className="px-4 py-1.5 font-bold uppercase text-ink">{r.leaderName || '—'}</td>
                      <td className="px-2 py-1.5 text-ink">{r.uplineName || '—'}</td>
                      {areas.map((a) => (
                        <td key={a} className="px-1 py-1.5 text-center">
                          {r.areas.includes(a) && <span role="img" aria-label={`${w.areas[a]}: ${w.stillCoached}`} className="inline-block h-2.5 w-2.5 rounded-full bg-signal-red" />}
                        </td>
                      ))}
                      <td className={cn('px-2 py-1.5 font-bold', r.independent ? 'text-signal-green' : 'text-pill-red-ink')}>
                        {r.independent ? w.independent : w.notIndependent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>,
      )}
    </section>
  );

  const support = (
    <section data-qual-support="">
      <SectionHead title={w.support} note={w.supportScale} />
      {card(
        <ul className="divide-y divide-divider">
          {qual.support.map((s) => (
            <li key={s.rater} className="px-4 py-3">
              <p className="flex items-baseline justify-between gap-2 text-md font-bold text-ink">
                <span>{s.rater === 'agent' ? w.agentRates : w.leaderRates}</span>
                <span className="text-[18px] text-navy">{s.average === null ? '—' : String(s.average).replace('.', ',')}<small className="text-xs text-muted">{w.outOf({ max: 10 })}</small></span>
              </p>
              {s.satisfiedPct !== null && s.fairPct !== null && s.poorPct !== null && (
                <div className="mt-1.5">
                  <CountStack parts={[
                    { key: 'p', n: s.satisfiedPct, label: '', cls: 'bg-nps-promoter' },
                    { key: 'f', n: s.fairPct, label: '', cls: 'bg-nps-passive', ink: 'text-navy' },
                    { key: 'd', n: s.poorPct, label: '', cls: 'bg-nps-detractor' },
                  ].filter((x) => x.n > 0).map((x) => ({ ...x, label: `${pct(x.n)}` }))}
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-muted">{w.supportLegend({ p: qual.cutoffs.supportPromMin, f: qual.cutoffs.supportPasMin, n: s.n })}</p>
            </li>
          ))}
        </ul>,
      )}
    </section>
  );

  const voices = qual.voices === null ? null : (
    <section data-qual-voices="">
      <SectionHead title={w.voices} note={w.voicesHint} />
      {card(
        qual.voices.length === 0 ? <p className="px-4 py-3 text-md text-muted">{w.noVoices}</p> : (
          <ul className="divide-y divide-divider">
            {qual.voices.map((q, i) => (
              // A voice's place in the server's scrambled order: two people can write the same words.
              // eslint-disable-next-line react/no-array-index-key
              <li key={i}>
                <button
                  type="button"
                  aria-expanded={voice === i}
                  onClick={() => setVoice(voice === i ? null : i)}
                  className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left"
                >
                  <b className={cn('min-w-0 flex-1 text-md text-ink', voice !== i && 'line-clamp-1')}>{q.text}</b>
                  <span aria-hidden="true" className="text-muted">{voice === i ? '˄' : '›'}</span>
                </button>
                {voice === i && <ul className="px-4 pb-3"><Quote quote={q} /></ul>}
              </li>
            ))}
          </ul>
        ),
      )}
    </section>
  );

  if (phone) {
    return (
      <div data-qual-results="" className="space-y-4">
        {whoAnswered}
        {aspiration}
        {ranked(block('SALES'), meaningA)}
        {ranked(block('RECRUIT'), w.meaning.recruit({ max }))}
        {ranked(block('ACTIVATION'), w.meaning.activation)}
        {ranked(block('UNIT'), w.meaning.unit, true)}
        {coaching}
        {support}
        {voices}
      </div>
    );
  }
  return (
    <div data-qual-results="" className="grid grid-cols-2 items-start gap-4">
      <div className="min-w-0 space-y-4">
        {whoAnswered}
        {ranked(block('SALES'), meaningA)}
        {ranked(block('ACTIVATION'), w.meaning.activation)}
        {coaching}
        {support}
      </div>
      <div className="min-w-0 space-y-4">
        {aspiration}
        {ranked(block('RECRUIT'), w.meaning.recruit({ max }))}
        {ranked(block('UNIT'), w.meaning.unit, true)}
        {voices}
      </div>
    </div>
  );
}

