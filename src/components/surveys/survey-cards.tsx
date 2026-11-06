'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { SurveyPending } from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

/**
 * ***Perlu diisi*** — the cards heading the *Lainnya* sheet (C-R2, C-R6, C-R7, C-R9; `survey-reminder-user-2026-11-03.html`,
 * `.todo`): one per run open and not sent, *"<survei> <periode>"*, *"Berakhir <tanggal> · n hari lagi"* — *"Berakhir
 * besok, <tanggal>"* the day before — with *"n dari M terjawab"* once an answer is saved, and *Isi* or *Lanjutkan*.
 * After sending, the green *"Terima kasih, survei sudah diisi"* until the run closes. Nothing at all for a member who
 * was invited to nothing (C-R1).
 */
export function SurveyCards({ pending }: { pending: SurveyPending | null }) {
  const { t, name, day } = useSurveyWords();
  if (!pending) return null;
  if (pending.open.length === 0 && pending.sentOpen.length === 0) return null;
  return (
    <section aria-labelledby="survey-cards-heading" data-survey-cards="">
      {pending.open.length > 0 && (
        <h2 id="survey-cards-heading" className="mb-1 mt-3.5 text-xs font-semibold text-primary-ink">{t.needsFilling}</h2>
      )}
      <ul className="space-y-2">
        {pending.open.map((run) => {
          const started = run.answeredCount > 0;
          return (
            <li
              key={run.runId}
              data-survey-card={run.runId}
              className="flex items-center gap-2.5 rounded-row bg-pill-amber px-3 py-2.5 shadow-[inset_3px_0_0_var(--color-primary)]"
            >
              <span className="min-w-0 flex-1">
                <b className="block text-md font-bold text-ink">{name(run.kind, run.periodKey)}</b>
                <span className="block text-xs font-semibold text-primary-ink">
                  {run.daysLeft <= 1 ? t.endsTomorrow({ date: day(run.closesOn) }) : t.endsOn({ date: day(run.closesOn), n: run.daysLeft })}
                  {started && ` · ${t.answered({ n: run.answeredCount, m: run.totalCount })}`}
                </span>
              </span>
              <Link
                href={`/surveys/${encodeURIComponent(run.runId)}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-pill bg-primary px-3.5 text-sm font-bold text-primary-contrast"
              >
                {started ? t.resume : t.fill}
              </Link>
            </li>
          );
        })}
        {pending.open.length === 0 && pending.sentOpen.map((run) => (
          <li
            key={run.runId}
            data-survey-thanks={run.runId}
            className={cn('mt-3 rounded-row bg-pill-green px-3 py-2.5 shadow-[inset_3px_0_0_var(--color-success)]')}
          >
            <b className="block text-md font-bold text-ink">{t.thanksCard}</b>
            <span className="block text-xs font-semibold text-pill-green-ink">{t.thanksCardLine({ date: day(run.closesOn) })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
