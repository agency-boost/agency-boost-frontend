'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readResults, type SurveyKind, type SurveyResults, type SurveyWho } from '@/lib/surveys';
import { NpsResultsView } from './nps-results';
import { QualPeople } from './qual-people';
import { QualResultsView } from './qual-results';
import { PillSelect, ResponsePanel, SegmentPills } from './survey-bits';
import { SurveySend } from './survey-send';
import { useSurveyWords } from './survey-words';

type View = 'results' | 'people' | 'send';

/**
 * **Advanced analytics › NPS and *Kualitatif*** (P19.22-T6, T7; ADR-0276; `functional/surveys.md`), rebuilt to the
 * 19 November mockups: the controls *Hasil | Survei baru* (and *Per orang* on *Kualitatif*) · the period · *Semua |
 * Leader | Agent*, then the view. Every figure, every floor and who may see what are the server's.
 *
 * - ***Hasil***: NPS's *Keseluruhan KPM* card and its rows (`NpsResultsView`); *Analisa kualitatif*'s navy response panel
 *   and its two columns (`QualResultsView`).
 * - ***Per orang*** (*Kualitatif* only, never in the Super Admin's *Lihat sebagai KPM*): `QualPeople`.
 * - ***Survei baru***: `SurveySend`.
 *
 * `platformKpmId` (P19.5-T3 AC-12): the Super Admin's *Lihat sebagai KPM* reads the tab as a summary, nothing to send.
 */
export function SurveyResultsScreen({ kind, platformKpmId }: { kind: SurveyKind; platformKpmId?: string }) {
  const t = useMessages(surveyAnalyticsMessages);
  const { period, name, day } = useSurveyWords();
  const [view, setView] = useState<View>('results');
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [who, setWho] = useState<SurveyWho>('all');
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    let live = true;
    setError(null);
    readResults(kind, runId, platformKpmId, who)
      .then((r) => { if (live) setResults(r); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [kind, runId, platformKpmId, who]);
  useEffect(() => load(), [load, tick]);

  if (error) return <ErrorBanner {...error} />;
  if (!results) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-3"><SkeletonBar className="h-11" /><SkeletonBar className="h-28" /><SkeletonBar className="h-48" /></div>
      </Skeleton>
    );
  }
  if (!results.visible) return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.send.sectionOff}</p>;

  const views: { id: View; label: string }[] = [
    { id: 'results', label: t.views.results },
    ...(kind === 'qual' && platformKpmId === undefined ? [{ id: 'people' as const, label: t.views.people }] : []),
    { id: 'send', label: t.views.send },
  ];
  const opened = results.runs.filter((r) => r.state !== 'scheduled');
  const selected = results.selected;
  const closesOf = (periodKey: string) => {
    const run = results.runs.find((r) => r.periodKey === periodKey);
    return run ? day(run.closesOn, true) : '';
  };

  return (
    <div data-survey-results={kind} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1">
        <SegmentPills label={t.viewsLabel} options={views} value={view} onChange={setView} />
        {view === 'results' && selected && opened.length > 0 && (
          <PillSelect
            label={t.periodLabel}
            value={selected.runId}
            options={opened.map((r) => ({ id: r.runId, label: period(r.periodKey) }))}
            onChange={(id) => setRunId(id)}
          />
        )}
        {view === 'send' && (
          <span className="inline-flex min-h-11 shrink-0 items-center rounded-pill border border-card-edge bg-card px-4 text-md font-semibold text-ink">
            {period(results.send.periodKey)}
          </span>
        )}
        {view === 'results' && (
          <SegmentPills
            label={t.whoLabel}
            options={[{ id: 'all', label: t.who.all }, { id: 'leader', label: t.who.leader }, { id: 'agent', label: t.who.agent }]}
            value={who}
            onChange={setWho}
          />
        )}
      </div>

      {view === 'send' && <SurveySend kind={kind} results={results} onChanged={() => setTick((n) => n + 1)} />}

      {view === 'people' && (
        <QualPeople
          runId={runId ?? selected?.runId}
          onRun={setRunId}
          surveyName={(key) => name('qual', key)}
          closesOn={closesOf}
        />
      )}

      {view === 'results' && (!selected ? (
        <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{t.noRuns}</p>
      ) : (
        <>
          {kind === 'qual' && (
            <ResponsePanel
              sent={selected.responses.sent}
              invited={selected.responses.invited}
              leaders={selected.responses.leaders}
              agents={selected.responses.agents}
            />
          )}
          {selected.nps && (
            <NpsResultsView
              nps={selected.nps}
              run={selected}
              openQuestion={results.send.preview.find((p) => p.type === 'text')?.text ?? null}
            />
          )}
          {selected.qual && <QualResultsView qual={selected.qual} />}
        </>
      ))}
    </div>
  );
}
