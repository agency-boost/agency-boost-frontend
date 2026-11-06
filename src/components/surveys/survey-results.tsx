'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { cancelRun, readResults, type NpsResults, type QualResults, type RunView, type SurveyKind, type SurveyResults } from '@/lib/surveys';
import { SurveyRunDialog } from './survey-run-dialog';
import { useSurveyWords } from './survey-words';

/**
 * **The KPM's *NPS* and *Kualitatif* tabs** (P19.5-T4 AC-1 to AC-4, AC-13; ADR-0216 §2, §4; `functional/surveys.md`).
 * **No KPM-side mockup exists** (OD-268): built in the app's card and row idiom from the spec and the glossary, its parity
 * row says so.
 *
 * - ***Periode survei***: every run, newest first — its period, dates, *Terjadwal · Berjalan · Selesai* and *n dari M*;
 *   a scheduled one *Ubah* and *Batalkan* for the Owner and the Admins. ***Mulai survei*** opens the dialog
 *   (`SurveyRunDialog`) while the section is on.
 * - **One run's results**, the newest that opened unless another is chosen. NPS: the score with promoters, passives and
 *   detractors on the run's own cut-offs and the change from the previous run; per aspect; per question with
 *   *"Pertanyaan diubah sejak periode lalu"*; the breakdowns by role, tenure and age, a cell under three respondents
 *   *—*; the open answers with no names. Qualitative: each item's share with an issue, *Masalah besar* or *Perlu
 *   perhatian*; the aspirations; *Dukungan leader* (the Owner's and the Admins' only); *Coaching downline*.
 * - **A section off in the template** hides the tab once no run of it is open (AT-12); while one runs it stays.
 *
 * **What the reader may see is the server's**: a Core Leader's results come without *Dukungan leader*, a view-as
 * session's with no free text and no write.
 */
export function SurveyResultsScreen({ kind, platformKpmId }: {
  kind: SurveyKind;
  /** P19.5-T3 AC-12: the Super Admin's *Lihat sebagai KPM* — the KPM's tab as a summary, nothing to start or change. */
  platformKpmId?: string;
}) {
  const { t, period, day } = useSurveyWords();
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [dialog, setDialog] = useState<{ run?: RunView } | null>(null);
  const [cancelling, setCancelling] = useState<RunView | null>(null);

  const load = useCallback((id?: string) => {
    readResults(kind, id, platformKpmId).then(setResults).catch((err) => setError(toDisplayError(err)));
  }, [kind, platformKpmId]);
  useEffect(() => { load(runId); }, [load, runId]);

  if (error) return <ErrorBanner {...error} />;
  if (!results) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-3"><SkeletonBar className="h-24" /><SkeletonBar className="h-40" /></div>
      </Skeleton>
    );
  }
  if (!results.visible) return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.kpm.hidden}</p>;

  const selected = results.selected;
  const previous = results.runs.find((r) => r.runId === selected?.previousRunId);
  const write = results.canWrite && platformKpmId === undefined;

  return (
    <div data-survey-results={kind} className="space-y-4">
      <section className="rounded-lg border border-card-edge bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3">
          <h2 className="text-md font-bold text-ink">{t.kpm.runs}</h2>
          {write && results.sectionOn && <Button onClick={() => setDialog({})}>{t.kpm.start}</Button>}
        </div>
        {results.runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-md text-muted">{t.kpm.noRuns}</p>
        ) : (
          <ul>
            {results.runs.map((run) => (
              <li
                key={run.runId}
                data-survey-run={run.runId}
                className={cn('flex flex-wrap items-center gap-2.5 border-b border-divider px-4 py-2.5 last:border-0', run.runId === selected?.runId && 'bg-hover-row')}
              >
                <button
                  type="button"
                  disabled={run.state === 'scheduled'}
                  onClick={() => setRunId(run.runId)}
                  aria-current={run.runId === selected?.runId ? 'true' : undefined}
                  className="min-h-11 min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <b className="block text-md text-ink">{t.name[run.kind]} {period(run.periodKey)}</b>
                  <span className="block text-xs text-muted">{day(run.opensOn)} – {day(run.closesOn, true)}</span>
                </button>
                <span className={cn(
                  'rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                  run.state === 'open' ? 'bg-pill-green text-pill-green-ink' : run.state === 'scheduled' ? 'bg-pill-blue text-pill-blue-ink' : 'bg-pill-grey text-pill-grey-ink',
                )}
                >
                  {t.kpm.state[run.state]}
                </span>
                <span className="text-xs text-muted" aria-label={t.kpm.responsesName({ n: run.responses.sent, m: run.responses.invited })}>
                  {t.kpm.responses({ n: run.responses.sent, m: run.responses.invited })}
                </span>
                {write && run.state === 'scheduled' && (
                  <span className="flex gap-1">
                    <Button variant="inline" onClick={() => setDialog({ run })}>{t.kpm.edit}</Button>
                    <Button variant="inline" onClick={() => setCancelling(run)}>{t.kpm.cancel}</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected?.nps && <NpsPanel nps={selected.nps} previousLabel={previous ? period(previous.periodKey) : null} />}
      {selected?.qual && <QualPanel qual={selected.qual} />}

      {dialog && (
        <SurveyRunDialog
          kind={kind}
          results={results}
          run={dialog.run}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); load(runId); }}
        />
      )}
      {cancelling && (
        <Modal
          open
          title={t.kpm.cancel}
          onClose={() => setCancelling(null)}
          placement="popup"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelling(null)}>{t.kpm.keep}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const run = cancelling;
                  setCancelling(null);
                  cancelRun(run.runId).then(() => load(runId)).catch((err) => setError(toDisplayError(err)));
                }}
              >
                {t.kpm.cancel}
              </Button>
            </div>
          )}
        >
          <p className="text-md text-ink">{t.kpm.cancelConfirm}</p>
        </Modal>
      )}
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function NpsPanel({ nps, previousLabel }: { nps: NpsResults; previousLabel: string | null }) {
  const { t, pair } = useSurveyWords();
  const w = t.kpm.nps;
  if (nps.respondents === 0) return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{w.noAnswers}</p>;
  const tenure = nps.cutoffs.tenureBands;
  const bandName = {
    roleClass: (k: string) => t.roles[k as 'agent' | 'aab' | 'ab'] ?? k,
    tenureBand: (k: string) => [`< ${tenure[0]}`, `${tenure[0]}–${tenure[1]}`, `${tenure[1]}–${tenure[2]}`, `> ${tenure[2]}`][Number(k)] ?? k,
    ageBand: (k: string) => [t.coaching.generations.z, t.coaching.generations.y, t.coaching.generations.x][Number(k)]
      ?? k,
  } as const;
  return (
    <div data-nps-results="" className="space-y-4">
      <section className="flex flex-wrap items-end gap-5 rounded-lg border border-card-edge bg-card px-4 py-4">
        <div>
          <p className="text-xs font-semibold text-muted">{w.score}</p>
          <p className="text-[40px] font-bold leading-none text-navy">{nps.overall?.score ?? '—'}</p>
          {nps.change !== null && previousLabel && <p className="mt-1 text-xs text-muted">{w.change({ n: signed(nps.change), period: previousLabel })}</p>}
        </div>
        {/* An anonymous run under three respondents: the server sends no overall, and each count reads — (ADR-0216 §3). */}
        <dl className="flex gap-4 text-md">
          <div><dt className="text-xs text-muted">{w.promoters}</dt><dd className="font-bold text-ink">{nps.overall?.promoters ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">{w.passives}</dt><dd className="font-bold text-ink">{nps.overall?.passives ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">{w.detractors}</dt><dd className="font-bold text-ink">{nps.overall?.detractors ?? '—'}</dd></div>
        </dl>
        <p className="ml-auto text-xs text-muted">{w.respondents({ n: nps.respondents })}</p>
      </section>

      <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
        <h3 className="mb-1 text-md font-bold text-ink">{w.aspects}</h3>
        {nps.aspects.map((a) => (
          <div key={a.aspect} className="flex min-h-11 items-center gap-3 border-b border-divider py-1.5 last:border-0">
            <span className="flex-1 text-md text-ink">{a.aspect}</span>
            {a.change !== null && <span className="text-xs text-muted">{signed(a.change)}</span>}
            <b className="w-12 text-right text-md text-ink">{a.score ?? '—'}</b>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
        <h3 className="mb-1 text-md font-bold text-ink">{w.questions}</h3>
        {nps.questions.map((q) => (
          <div key={q.kode} className="flex min-h-11 items-start gap-3 border-b border-divider py-2 last:border-0">
            <span className="rounded-[6px] bg-ink px-1.5 py-0.5 text-2xs font-bold text-white">{q.kode}</span>
            <span className="flex-1 text-md text-ink">
              {pair(q.text)}
              {q.textChanged && <span className="mt-0.5 block text-xs font-semibold text-primary-ink">{w.textChanged}</span>}
            </span>
            <b className="w-12 text-right text-md text-ink">{q.score ?? '—'}</b>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
        <h3 className="mb-1 text-md font-bold text-ink">{w.breakdown}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(['roleClass', 'tenureBand', 'ageBand'] as const).map((key) => (
            <div key={key}>
              <p className="text-xs font-semibold text-muted">{key === 'roleClass' ? w.byRole : key === 'tenureBand' ? w.byTenure : w.byAge}</p>
              {nps.breakdowns[key].map((cell) => (
                <div key={cell.key} className="flex justify-between border-b border-divider py-1.5 text-md last:border-0">
                  <span className="text-ink">{bandName[key](cell.key)}</span>
                  <b className="text-ink">{cell.score ?? '—'}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {nps.openAnswers && (
        <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
          <h3 className="mb-1 text-md font-bold text-ink">{w.openAnswers}</h3>
          {nps.openAnswers.length === 0 ? <p className="text-md text-muted">{w.noOpenAnswers}</p> : (
            <ul className="space-y-1.5">
              {nps.openAnswers.map((text, i) => <li key={`${i}-${text}`} className="rounded-row bg-hover-row px-3 py-2 text-md italic text-ink">“{text}”</li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function QualPanel({ qual }: { qual: QualResults }) {
  const { t, pair } = useSurveyWords();
  const w = t.kpm.qual;
  if (qual.respondents === 0) return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.kpm.nps.noAnswers}</p>;
  return (
    <div data-qual-results="" className="space-y-4">
      <p className="text-xs text-muted">{t.kpm.nps.respondents({ n: qual.respondents })}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {qual.blocks.map((b) => (
          <section key={b.kode} data-qual-block={b.kode} className="rounded-lg border border-card-edge bg-card px-4 py-3">
            <h3 className="mb-1 flex items-center gap-2 text-md font-bold text-ink">
              <span className="rounded-[6px] bg-ink px-1.5 py-0.5 text-2xs font-bold text-white">{b.questionKodes.join(' · ')}</span>
              {pair(b.title)}
            </h3>
            {b.items.map((i) => (
              <div key={`${i.questionKode}-${i.itemKode}`} className="flex min-h-11 items-center gap-2.5 border-b border-divider py-1.5 last:border-0">
                <span className="min-w-0 flex-1 text-md text-ink">{pair(i.label)}</span>
                {i.severity && (
                  <span className={cn('rounded-pill px-2 py-0.5 text-xs font-semibold', i.severity === 'big' ? 'bg-pill-red text-pill-red-ink' : 'bg-pill-amber text-pill-amber-ink')}>
                    {i.severity === 'big' ? w.big : w.watch}
                  </span>
                )}
                <b className="w-20 text-right text-xs text-ink">{i.issuePct === null ? '—' : w.issuePct({ n: i.issuePct })}</b>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
          <h3 className="mb-1 text-md font-bold text-ink">{w.aspiration}</h3>
          {qual.aspiration.map((a) => (
            <div key={a.kode} className="flex justify-between gap-2 border-b border-divider py-1.5 text-md last:border-0">
              <span className="text-ink">{pair(a.label)}</span><b className="text-ink">{a.pct === null ? '—' : `${a.pct}%`}</b>
            </div>
          ))}
        </section>
        {qual.support && (
          <section data-qual-support="" className="rounded-lg border border-card-edge bg-card px-4 py-3">
            <h3 className="mb-1 text-md font-bold text-ink">{w.support}</h3>
            {([['satisfiedPct', w.satisfied], ['fairPct', w.fair], ['poorPct', w.poor]] as const).map(([key, label]) => (
              <div key={key} className="flex justify-between border-b border-divider py-1.5 text-md last:border-0">
                <span className="text-ink">{label}</span><b className="text-ink">{qual.support![key] === null ? '—' : `${qual.support![key]}%`}</b>
              </div>
            ))}
          </section>
        )}
        <section className="rounded-lg border border-card-edge bg-card px-4 py-3">
          <h3 className="mb-1 text-md font-bold text-ink">{w.coachingDownline}</h3>
          <p className="text-[28px] font-bold text-navy">{qual.coachingDownline.pct === null ? '—' : `${qual.coachingDownline.pct}%`}</p>
          {qual.coachingDownline.good !== null && (
            <span className={cn('rounded-pill px-2 py-0.5 text-xs font-semibold', qual.coachingDownline.good ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-amber text-pill-amber-ink')}>
              {qual.coachingDownline.good ? w.good : w.low}
            </span>
          )}
        </section>
      </div>
    </div>
  );
}
