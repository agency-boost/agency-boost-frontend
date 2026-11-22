'use client';

import { useId, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  cancelRun, changeRun, startRun, type PreviewLine, type RoleClass, type SurveyKind, type SurveyResults,
} from '@/lib/surveys';
import { ResponsePanel, SectionHead, usePct } from './survey-bits';
import { useSurveyWords } from './survey-words';

/** How many of *Belum menjawab* are listed before *Lihat semua (n)*. */
const FIRST_SHOWN = 4;
const EVERY_ROLE: RoleClass[] = ['agent', 'aab', 'ab'];

/**
 * ***Survei baru*** (P19.22-T6 AC-3, T7 AC-4; ADR-0276 §2), NPS's and *Analisa kualitatif*'s alike. Left: the survey's
 * preview — NPS's questions, or the qualitative blocks after *Profil*, whose facts come from the profile and are never
 * asked again — then ***Kirim ke n anggota*** with the closing date. Right: the period's run once sent — its live progress
 * in the navy panel, who has not answered with ***Ingatkan n orang*** (a WhatsApp message with their names, OD-359), and
 * the earlier runs. **The run is sent to every role** with the template's defaults; a qualitative run outside June and
 * December is scheduled for the next of them. Sending, the closing date of a scheduled run and cancelling one are a
 * steward's (`canWrite`); the server refuses anybody else.
 */
export function SurveySend({ kind, results, onChanged }: { kind: SurveyKind; results: SurveyResults; onChanged: () => void }) {
  const t = useMessages(surveyAnalyticsMessages);
  const w = t.send;
  const { pair, period, day, name } = useSurveyWords();
  const pct = usePct();
  const send = results.send;
  const run = send.run;
  const [closesOn, setClosesOn] = useState(run?.closesOn ?? send.closesOnMax);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [all, setAll] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const write = results.canWrite;
  const closesId = useId();

  const act = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    work().then(onChanged).catch((err) => setError(toDisplayError(err))).finally(() => setBusy(false));
  };
  const sendNow = () => act(() => startRun(kind, {
    opensOn: send.opensOn, closesOn, invitedRoleClasses: EVERY_ROLE, anonymous: results.template.defaults.anonymous,
    perPerson: results.template.defaults.perPerson, remindHalfway: results.template.defaults.remindHalfway,
  }));

  const line = (p: PreviewLine): string => {
    const title = pair(p.text).replace(/^[A-D]\.\s*/, '');
    const leader = p.audience === 'leader' ? w.leaderOnly : '';
    switch (p.type) {
      case 'score': return w.score({ text: title });
      case 'text': return w.open({ text: title });
      case 'aspiration': return w.aspiration({ title });
      case 'scale_items': return `${w.scale({ title, n: p.items })}${leader}`;
      case 'state_items': return `${w.state({ title, n: p.items })}${leader}`;
      case 'unit_items': return `${w.unit({ title, n: p.items })}${leader}`;
      case 'support': return w.support({ title });
      default: return `${title}${leader}`;
    }
  };
  const chip = (label: string, round = false) => (
    <span className={cn('flex h-7 shrink-0 items-center justify-center bg-today px-2 text-xs font-bold text-primary-ink', round ? 'w-7 rounded-full' : 'rounded-pill')}>{label}</span>
  );

  const waiting = send.notAnswered ?? [];
  const survey = name(kind, send.periodKey);
  const remindHref = `https://wa.me/?text=${encodeURIComponent(w.remindText({
    survey, date: day(run?.closesOn ?? closesOn, true), names: waiting.map((p) => p.name).join(', '),
  }))}`;
  const previous = results.runs.filter((r) => r.periodKey !== send.periodKey && r.state !== 'scheduled');

  return (
    <div data-survey-send={kind} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <section className="min-w-0">
        <SectionHead
          title={w.preview}
          note={kind === 'nps' ? w.npsMeta({ n: send.preview.length, m: send.minutes }) : w.qualMeta({ m: send.minutes })}
        />
        <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
          <ol>
            {kind === 'qual' && (
              <li className="flex items-start gap-3 border-b border-divider px-4 py-2.5 text-md text-ink">{chip(w.profile)}<span>{w.profileLine}</span></li>
            )}
            {send.preview.map((p, i) => (
              <li key={p.kodes.join('-')} className="flex items-start gap-3 border-b border-divider px-4 py-2.5 text-md text-ink last:border-0">
                {kind === 'nps' ? chip(String(i + 1), true) : chip(p.kodes.length > 1 ? `${p.kodes[0]}–${p.kodes[p.kodes.length - 1]}` : p.kodes[0])}
                <span className="pt-0.5">{line(p)}</span>
              </li>
            ))}
          </ol>
          <div className="space-y-2 border-t border-divider px-4 py-3">
            {error && <ErrorBanner {...error} />}
            {!results.sectionOn && !run && <p className="text-md text-muted">{w.sectionOff}</p>}
            {!run && results.sectionOn && (write ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={sendNow} disabled={busy}>{busy ? w.sending : w.sendTo({ n: send.invitable })}</Button>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-card-edge px-3 text-md font-semibold text-ink">
                  <label htmlFor={closesId}>{w.closes}</label>
                  <DateField
                    id={closesId}
                    density="text"
                    value={closesOn}
                    min={send.opensOn}
                    max={send.closesOnMax}
                    onChange={setClosesOn}
                    faceClassName="text-md"
                  />
                </span>
              </div>
            ) : <p className="text-md text-muted">{w.readOnly}</p>)}
            {run?.state === 'scheduled' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-pill bg-pill-blue px-3 py-1 text-xs font-semibold text-pill-blue-ink">{w.scheduled({ date: day(run.opensOn, true) })}</span>
                {write ? (
                  <>
                    <span className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-card-edge px-3 text-md font-semibold text-ink">
                      <label htmlFor={closesId}>{w.closes}</label>
                      <DateField
                        id={closesId}
                        density="text"
                        value={closesOn}
                        min={run.opensOn}
                        max={send.closesOnMax}
                        onChange={(next) => { setClosesOn(next); act(() => changeRun(run.runId, { closesOn: next })); }}
                        faceClassName="text-md"
                      />
                    </span>
                    <Button variant="inline" onClick={() => setCancelling(true)}>{w.cancel}</Button>
                  </>
                ) : <span className="text-md text-muted">{w.closesOn({ date: day(run.closesOn, true) })}</span>}
              </div>
            )}
            {run?.state === 'open' && <p className="text-md font-semibold text-ink">{w.closesOn({ date: day(run.closesOn, true) })}</p>}
            {run?.state === 'closed' && <p className="text-md text-muted">{w.closedOn({ date: day(run.closesOn, true) })}</p>}
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <SectionHead title={w.live({ period: period(send.periodKey) })} />
        {run && run.state !== 'scheduled' ? (
          <>
            <ResponsePanel
              title={w.answered}
              sent={run.responses.sent}
              invited={run.responses.invited}
              leaders={run.responses.leaders}
              agents={run.responses.agents}
            />
            {send.notAnswered !== null && (
              <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <b className="text-md text-ink">{w.notAnswered({ n: waiting.length })}</b>
                  {waiting.length > 0 && run.state === 'open' && (
                    <a
                      href={remindHref}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-primary px-4 text-md font-bold text-primary-contrast"
                    >
                      <LineIcon name="whatsapp" className="h-4 w-4" />
                      {w.remind({ n: waiting.length })}
                    </a>
                  )}
                </div>
                {waiting.length === 0 ? <p className="border-t border-divider px-4 py-3 text-md text-muted">{w.allAnswered}</p> : (
                  <ul>
                    {(all ? waiting : waiting.slice(0, FIRST_SHOWN)).map((p) => (
                      <li key={p.membershipId} className="flex items-center gap-2 border-t border-divider px-4 py-2 text-md">
                        <b className="uppercase text-ink">{p.name}</b>
                        <span className="text-xs text-muted">{p.roleClass === 'agent' ? t.who.agent : p.roleClass.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {waiting.length > FIRST_SHOWN && (
                  <button
                    type="button"
                    aria-expanded={all}
                    onClick={() => setAll((x) => !x)}
                    className="min-h-11 w-full border-t border-divider text-center text-md font-bold text-navy"
                  >
                    {all ? w.seeFewer : w.seeAll({ n: waiting.length })}
                  </button>
                )}
              </div>
            )}
          </>
        ) : <p className="rounded-lg bg-card px-4 py-4 text-md text-muted">{w.notSentYet}</p>}

        <SectionHead title={w.previous} />
        <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
          {previous.length === 0 ? <p className="px-4 py-3 text-md text-muted">{w.noPrevious}</p> : (
            <ul>
              {previous.map((r) => (
                <li key={r.runId} data-previous-run={r.runId} className="border-b border-divider px-4 py-2.5 last:border-0">
                  <p className="flex justify-between gap-2 text-md font-bold text-ink">
                    <span>{period(r.periodKey)}</span>
                    <span className="text-navy">
                      {kind === 'nps' ? w.previousNps({ score: pct(r.headlineScore) }) : w.previousLine({ n: r.responses.sent, pct: pct(r.responses.pct) })}
                    </span>
                  </p>
                  {kind === 'nps' && <p className="text-xs text-muted">{w.previousLine({ n: r.responses.sent, pct: pct(r.responses.pct) })}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {cancelling && run && (
        <Modal
          open
          title={w.cancel}
          onClose={() => setCancelling(false)}
          placement="popup"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelling(false)}>{w.keep}</Button>
              <Button variant="danger" onClick={() => { setCancelling(false); act(() => cancelRun(run.runId)); }}>{w.cancel}</Button>
            </div>
          )}
        >
          <p className="text-md text-ink">{w.cancelConfirm}</p>
        </Modal>
      )}
    </div>
  );
}
