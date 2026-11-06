'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Boost } from '@/components/boost';
import { buttonClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useHostToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { markPopupShown, refreshPending, useSurveyPending, type MySurveyRun, type SurveyPending } from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

/** Another dialog or sheet already over the page: the popup never stands over one (C-R5). */
const anotherDialogOpen = () => typeof document !== 'undefined'
  && document.querySelector('[role="dialog"][aria-modal="true"]') !== null;

/**
 * **The survey popup on Home** (C-R3 to C-R7; `survey-reminder-user-2026-11-03.html`, `.pop`). **The server decides
 * whether one is due** (`GET /surveys/pending`'s `popup`): at most once a KPM day, at the run's opening (*Survei baru*),
 * halfway when the KPM turned it on (*Tinggal n hari*) and one day before the end, always (red *Berakhir besok*). Two
 * runs due make one popup, *"2 survei menunggu Anda"*. **This decides only where**: on Home, and never over another
 * dialog or sheet (C-R5).
 *
 * Drawn, it is recorded at once (`POST /surveys/popup/shown`), so no second popup that day on any device. *Isi
 * sekarang* or *Lanjutkan* opens the form where the member stopped (C-R6); *Nanti saja* closes it (C-R4). A view-as
 * session is never shown one.
 */
export function SurveyPopup() {
  const pending = useSurveyPending();
  const [shown, setShown] = useState<{ popup: NonNullable<SurveyPending['popup']>; runs: MySurveyRun[]; kpmCode: string } | null>(null);
  const [closed, setClosed] = useState(false);
  const recorded = useRef(false);
  const toast = useHostToast();
  const { t, name, day } = useSurveyWords();

  useEffect(() => {
    if (closed || shown || !pending?.popup || anotherDialogOpen()) return;
    const runs = pending.open.filter((r) => pending.popup!.runIds.includes(r.runId));
    if (runs.length === 0) return;
    setShown({ popup: pending.popup, runs, kpmCode: pending.kpmCode });
  }, [pending, shown, closed]);

  useEffect(() => {
    if (!shown || recorded.current) return;
    recorded.current = true;
    // Recorded, not refreshed: the popup stays until the member answers it.
    markPopupShown(shown.popup.moment, shown.popup.runIds).catch(() => undefined);
  }, [shown]);

  if (!shown || closed) return null;
  const { popup, runs, kpmCode } = shown;
  const first = runs[0];
  const urgent = popup.moment === 'last_day';
  const started = first.answeredCount > 0;
  const badge = urgent ? t.popup.lastDay : popup.moment === 'halfway' ? t.popup.halfway({ n: first.daysLeft }) : t.popup.opened;
  const title = runs.length > 1 ? t.popup.many({ n: runs.length }) : name(first.kind, first.periodKey);
  const line = urgent
    ? t.popup.lastDayLine({ date: day(first.closesOn) })
    : popup.moment === 'halfway'
      ? t.popup.halfwayLine({ date: day(first.closesOn) })
      : t.popup.openedLine({ kpm: kpmCode, date: day(first.closesOn) });

  const close = (later: boolean) => {
    setClosed(true);
    void refreshPending();
    if (later) toast?.(urgent ? t.popup.laterToastLast : t.popup.laterToast);
  };

  return (
    <Modal open title={title} onClose={() => close(true)} placement="popup" className="text-center">
      <div data-survey-popup={popup.moment} className="flex flex-col items-center">
        <Boost pose="pointing" size={64} />
        <span
          className={cn(
            'mt-2.5 inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold',
            urgent ? 'bg-pill-red text-pill-red-ink' : 'bg-pill-amber text-primary-ink',
          )}
        >
          {badge}
        </span>
        <p className="mt-2 text-md text-muted">{line}</p>
        <ul className="my-3 flex flex-wrap justify-center gap-1.5">
          {runs.map((run) => (
            <li key={run.runId} className="rounded-pill bg-pill-grey px-2.5 py-0.5 text-xs text-ink">
              {runs.length > 1 && `${t.name[run.kind]} · `}
              {t.facts({ n: run.totalCount, m: run.minutes })}
            </li>
          ))}
          {runs.some((run) => run.kind === 'nps' && run.anonymous) && (
            <li className="rounded-pill bg-pill-grey px-2.5 py-0.5 text-xs text-ink">{t.popup.npsAnonymous}</li>
          )}
        </ul>
        {started && (
          <p className="-mt-1 mb-3 text-md font-semibold text-primary-ink">{t.popup.progress({ n: first.answeredCount, m: first.totalCount })}</p>
        )}
        <Link
          href={`/surveys/${encodeURIComponent(first.runId)}`}
          onClick={() => close(false)}
          className={buttonClass('primary', 'w-full justify-center')}
        >
          {started ? t.resume : t.fillNow}
        </Link>
        <button type="button" onClick={() => close(true)} className={buttonClass('inline', 'mt-2 min-h-11 w-full justify-center')}>
          {t.popup.later}
        </button>
      </div>
    </Modal>
  );
}
