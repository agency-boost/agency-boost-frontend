'use client';

import { useId, useState } from 'react';
import { Button, ErrorBanner, Switch } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { Modal } from '@/components/ui/modal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  changeRun, startRun, suggestedDates, type RoleClass, type RunInput, type RunView, type SurveyKind, type SurveyResults,
} from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

const ROLE_CLASSES: readonly RoleClass[] = ['agent', 'aab', 'ab'];

/**
 * ***Mulai survei*** and *Ubah* (P19.5-T4 AC-1; ADR-0216 §2; spec §2's *survey start dates*, OD-267): the start and end
 * dates, the roles invited, *Anonim* — starting from the template's default — for a qualitative run *Tampilkan jawaban
 * per orang*, off and disabled while *Anonim* is on (B-R2), and *Ingatkan di tengah*. ***Ingatkan 1 hari sebelum
 * berakhir*** is a line, *selalu aktif* (C-R10). The cadence is said under the dates; the server refuses dates outside
 * it, a second run in the period, or a section that is off (`409 SURVEY_RUN_CONFLICT`), and the refusal shows here.
 */
export function SurveyRunDialog({
  kind, results, run, onClose, onSaved,
}: {
  kind: SurveyKind;
  results: SurveyResults;
  /** The scheduled run to change; absent, a new one. */
  run?: RunView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useSurveyWords();
  const d = t.kpm.dialog;
  const uid = useId();
  const start = suggestedDates(kind, results.today, results.template.cadence, results.template.qualMonths);
  const [input, setInput] = useState<RunInput>(run
    ? {
      opensOn: run.opensOn, closesOn: run.closesOn, invitedRoleClasses: run.invitedRoleClasses, anonymous: run.anonymous,
      perPerson: run.perPerson, remindHalfway: run.remindHalfway,
    }
    : { ...start, invitedRoleClasses: [...ROLE_CLASSES], ...results.template.defaults });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<RunInput>) => setInput((now) => ({ ...now, ...patch }));
  const toggleRole = (role: RoleClass) => set({
    invitedRoleClasses: input.invitedRoleClasses.includes(role)
      ? input.invitedRoleClasses.filter((r) => r !== role)
      : ROLE_CLASSES.filter((r) => r === role || input.invitedRoleClasses.includes(r)),
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...input, perPerson: kind === 'qual' && !input.anonymous && input.perPerson === true };
      if (run) await changeRun(run.runId, body);
      else await startRun(kind, body);
      onSaved();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  const cadence = kind === 'qual' ? d.cadence.qual : d.cadence[results.template.cadence];
  return (
    <Modal
      open
      title={run ? d.editTitle : d.startTitle}
      onClose={onClose}
      placement="responsive"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{d.cancel}</Button>
          <Button disabled={saving || input.invitedRoleClasses.length === 0} onClick={() => void save()}>
            {run ? d.save : d.startButton}
          </Button>
        </div>
      )}
    >
      <div data-survey-run-dialog={kind} className="space-y-4">
        {error && <ErrorBanner {...error} />}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold text-muted">
            {d.opensOn}
            <DateField value={input.opensOn} onChange={(opensOn: string) => set({ opensOn })} aria-label={d.opensOn} className="mt-1" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            {d.closesOn}
            <DateField value={input.closesOn} onChange={(closesOn: string) => set({ closesOn })} aria-label={d.closesOn} className="mt-1" />
          </label>
        </div>
        <p className="text-xs text-muted">{cadence}</p>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-muted">{d.roles}</legend>
          <div className="flex flex-wrap gap-2">
            {ROLE_CLASSES.map((role) => (
              <label key={role} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline bg-card px-3 text-md text-ink">
                <input type="checkbox" checked={input.invitedRoleClasses.includes(role)} onChange={() => toggleRole(role)} />
                {t.roles[role]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2.5">
          <Switch id={`${uid}-anon`} label={d.anonymous} checked={input.anonymous} onChange={(anonymous) => set({ anonymous })} phoneTarget />
          {kind === 'qual' && (
            <div>
              <Switch
                id={`${uid}-person`}
                label={d.perPerson}
                checked={!input.anonymous && input.perPerson === true}
                disabled={input.anonymous}
                describedBy={input.anonymous ? `${uid}-person-off` : undefined}
                onChange={(perPerson) => set({ perPerson })}
                phoneTarget
              />
              {input.anonymous && <p id={`${uid}-person-off`} className="ml-12 text-xs text-muted">{d.perPersonOff}</p>}
            </div>
          )}
          <Switch id={`${uid}-half`} label={d.remindHalfway} checked={input.remindHalfway} onChange={(remindHalfway) => set({ remindHalfway })} phoneTarget />
          <p className="text-md text-ink">
            {d.remindLastDay} · <span className="text-muted">{d.alwaysOn}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}
