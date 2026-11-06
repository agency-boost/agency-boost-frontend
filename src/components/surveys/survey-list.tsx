'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorBanner, buttonClass } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readSurveys, type SurveyList } from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

/**
 * **`/surveys` — the *Survei* tile's page** (C-R2; `survey-reminder-user-2026-11-03.html`, `list()`): the open runs the
 * member was invited to and has not sent, each with *"n pertanyaan · ±m menit · anonim"* or *"… · dilihat leader untuk
 * coaching"*, *"Dibuka <a> – <b>"* and *Isi sekarang* or *Lanjutkan*; *"Tidak ada survei yang perlu diisi"* when there are
 * none; then ***Riwayat***, each run they sent with *"Diisi <tanggal>"*. The tile is shown to every field role, invited
 * or not (D-37), so an empty list is a page every member can reach.
 */
export function SurveyListScreen() {
  const { t, name, day } = useSurveyWords();
  const [list, setList] = useState<SurveyList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readSurveys().then((next) => { if (live) setList(next); }).catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  if (error) return <ErrorBanner {...error} />;
  if (!list) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-2.5">
          {[0, 1].map((i) => <div key={i} className="rounded-lg bg-card p-4"><SkeletonBar className="h-4 w-1/2" /><SkeletonBar className="mt-2 w-1/3" /></div>)}
        </div>
      </Skeleton>
    );
  }

  return (
    <div data-survey-list="" className="max-w-[640px] space-y-2.5">
      {list.open.length === 0 ? (
        <div className="rounded-lg bg-card px-3.5 py-3">
          <b className="block text-md font-bold text-ink">{t.noneOpen}</b>
          {list.history.length > 0 && <span className="block text-xs text-muted">{t.noneOpenSent}</span>}
        </div>
      ) : list.open.map((run) => {
        const started = run.answeredCount > 0;
        return (
          <article key={run.runId} data-survey-open={run.runId} className="rounded-lg bg-card px-3.5 py-3">
            <h2 className="text-md font-bold text-ink">{name(run.kind, run.periodKey)}</h2>
            <p className="text-xs text-muted">
              {t.facts({ n: run.totalCount, m: run.minutes })} · {run.notice === 'per_person' ? t.seenByLeader : t.anonymous}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-primary-ink">{t.opens({ from: day(run.opensOn), to: day(run.closesOn) })}</p>
            {started && <p className="text-xs text-muted">{t.answered({ n: run.answeredCount, m: run.totalCount })}</p>}
            <Link href={`/surveys/${encodeURIComponent(run.runId)}`} className={buttonClass('primary', 'mt-2.5 w-full justify-center')}>
              {started ? t.resume : t.fillNow}
            </Link>
          </article>
        );
      })}

      <h2 className="pt-3 text-xs font-semibold text-muted">{t.history}</h2>
      {list.history.length === 0 ? (
        <p className="rounded-lg bg-card px-3.5 py-3 text-md text-muted">{t.noHistory}</p>
      ) : (
        <ul className="space-y-2">
          {list.history.map((h) => (
            <li key={h.runId} data-survey-history={h.runId} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3.5 py-3">
              <span className="text-md text-ink">{name(h.kind, h.periodKey)}</span>
              <span className="shrink-0 text-xs text-muted">{t.filledOn({ date: day(h.submittedOn) })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
