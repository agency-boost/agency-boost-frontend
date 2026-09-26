'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import {
  Button, Card, ErrorBanner, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  changesBetween, FIELD_LABEL, formatRupiah, readGoal, readGoalHistory, saveGoal, toMajor, toMinor,
  type Goal, type GoalHistoryEntry, type GoalInputs, type GoalMode,
} from '@/lib/goals';
import { readMyTeam, type TeamMember } from '@/lib/org';
import { useSession } from '@/lib/session';

/**
 * Goal Settings (P8-T3) — `Overall.html:2860-3030`.
 *
 * **Five numbered cards and a commitment**, back-solving an annual APE target into this week's
 * activity. The prototype has no Calculate button and neither does this: every change recomputes.
 *
 * **The server is the only source of the numbers.** The screen sends the six inputs and renders
 * what comes back — it holds no copy of the cascade, because the prototype's own three surfaces
 * disagree (markup 80 / 24, calculator 67 / 20, `PERIOD_DATA` 80 / 24 again) and a second
 * implementation is exactly how that happens.
 */

export default function GoalSettingsPage() {
  const { me } = useSession();
  /*
   * v1 is annual (ADR-0049), so there is no selector — and `period` is a **field** on the record
   * rather than a constant, which is where a second shape would arrive without a migration.
   */
  const period = String(new Date().getFullYear());

  /**
   * Whose plan is on screen (P8-T4).
   *
   * **A Fill.** §3.6 lets a leader, an Owner and an Admin set somebody else's goal, and until the
   * coaching session arrives in Phase 13 there is nowhere to do it — the prototype's leader-facing
   * copy of this calculator lives inside that session and nothing like it exists on this screen.
   * This is the smallest honest surface for a permission the matrix already grants: a picker and a
   * banner, not a coaching session.
   */
  const [subject, setSubject] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalInputs | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<GoalHistoryEntry[]>([]);

  useEffect(() => {
    // A reader who leads nobody gets an empty list and no picker. Failing is the same answer:
    // the screen is about their own plan either way.
    void readMyTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await readGoal(period, subject ?? undefined);
      setGoal(next);
      setDraft(inputsOf(next));
      setSaved(next.savedAt !== null);
      // Beside the plan, not after it: the panel is closed until somebody opens it, and a history
      // that arrives a round trip late reads as a panel that does not work.
      readGoalHistory(period, subject ?? undefined).then(setHistory).catch(() => setHistory([]));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [period, subject]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Every change asks the server (P8-T3 AC-2).
   *
   * **A save, not a calculation.** There is no separate compute route: the cascade the screen shows
   * is the one the server stored, so what is on screen and what is agreed cannot drift. The
   * prototype recomputes locally on every keystroke and marks the goal unsaved — including on page
   * load, and including when another tab reads it.
   */
  async function commit(next: GoalInputs) {
    setDraft(next);
    setBusy(true);
    setError(null);
    try {
      const result = await saveGoal(period, next, subject ?? undefined);
      setGoal(result);
      setDraft(inputsOf(result));
      setSaved(true);
      // A save is what adds to it, so it reloads with the plan.
      readGoalHistory(period, subject ?? undefined).then(setHistory).catch(() => setHistory([]));
    } catch (err) {
      setError(toDisplayError(err));
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  if (!goal || !draft) {
    return (
      <Page title="Goal settings" subtitle="From this year's target back to this week's work.">
        {error && <ErrorBanner {...error} />}
        {!error && <SkeletonCards count={5} label="Loading your plan…" />}
      </Page>
    );
  }

  const set = (patch: Partial<GoalInputs>) => setDraft({ ...draft, ...patch });
  const projected = goal.projected;
  const mine = subject === null;
  const byLeader = mine
    && goal.savedByMembershipId !== null
    && goal.savedByMembershipId !== me?.membership?.membershipId;
  const whose = team.find((m) => m.membershipId === subject);

  return (
    <Page
      title="Goal settings"
      subtitle="From this year's target back to this week's work."
      permission="goal:read"
      actions={(
        <Button onClick={() => commit(draft)} disabled={busy}>
          {busy ? 'Saving…' : 'Save goal'}
        </Button>
      )}
    >
      {error && <div className="mb-4"><ErrorBanner {...error} /></div>}

      {team.length > 0 && (
        <Card className="mb-4">
          <FieldRow>
            <Field
              label="Whose plan"
              htmlFor="goal-subject"
              hint="Saving somebody else’s becomes their goal at once, carries your name, and tells them."
            >
              <Select
                id="goal-subject"
                value={subject ?? ''}
                onChange={(e) => setSubject(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">Mine</option>
                {team.map((member) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>
        </Card>
      )}

      {whose && (
        <Card className="mb-4 border-navy/30 bg-navy/5">
          <p className="text-md text-navy">
            You are setting <strong>{whose.fullName}</strong>&apos;s plan. It becomes their goal as
            soon as you save, their screen will say you set it, and they will be told.
          </p>
        </Card>
      )}

      {/*
        * **Who set this, when it was not you** (ADR-0046). A leader saves a downline's goal
        * directly — there is no acceptance step anywhere in the prototype, and the consent one
        * would model already happens in the room — so what the agent is owed is knowing.
        */}
      {byLeader && (
        <Card className="mb-4 border-amber/40 bg-amber/5">
          <p className="text-md text-navy">
            <strong>Set by your leader</strong>
            {goal.savedAt ? ` on ${new Date(goal.savedAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}` : ''}. You can change it — it is your plan.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <Step n={1} title="Annual APE target">
          <FieldRow>
            <Field label="How you want to set it" htmlFor="goal-mode">
              <Select
                id="goal-mode"
                value={draft.mode}
                onChange={(e) => set({ mode: e.target.value as GoalMode })}
              >
                <option value="direct">Set APE target directly</option>
                <option value="from_savings">Calculate from savings target</option>
              </Select>
            </Field>

            {draft.mode === 'direct' ? (
              <Rupiah
                label="Annual APE target"
                id="goal-ape"
                value={draft.annualApeTargetMinor}
                onChange={(annualApeTargetMinor) => set({ annualApeTargetMinor })}
              />
            ) : (
              <>
                <Rupiah
                  label="Annual savings target"
                  id="goal-savings"
                  value={draft.savingsTargetMinor}
                  onChange={(savingsTargetMinor) => set({ savingsTargetMinor })}
                />
                <Percent
                  label="Commission rate"
                  id="goal-commission"
                  value={draft.commissionRatePct}
                  onChange={(commissionRatePct) => set({ commissionRatePct })}
                />
              </>
            )}
          </FieldRow>
          {draft.mode === 'from_savings' && projected && (
            <Result label="That is an APE target of" value={formatRupiah(projected.annualApeTargetMinor)} />
          )}
        </Step>

        <Step n={2} title="Current progress">
          <FieldRow>
            {/*
              * **`null` means *use the office's calendar***, and that is what is sent unless the
              * agent types over the figure. Sending the number back would store it, and a stored
              * divisor goes stale: a plan saved in January with 11.9 months left claimed 11.9 in
              * October, with a monthly target a fifth of the truth (client PRD §17).
              */}
            <Field
              label="Months left"
              htmlFor="goal-months"
              hint={draft.monthsLeft === null
                ? `Your office\u2019s calendar says ${goal.monthsLeft}. Type a number to use your own.`
                : 'Your own figure. Empty the box to go back to your office\u2019s calendar.'}
            >
              {/*
                * **Empty means the office's calendar**, with the figure as the placeholder — not
                * prefilled. Prefilling it made clearing the box refill it, so typing over the
                * number appended to it: `3.1` became `3.12`. An empty box that says what it will
                * fall back to is the honest control.
                */}
              <TextInput
                id="goal-months"
                type="number"
                step="0.1"
                min="0.1"
                placeholder={String(goal.monthsLeft)}
                value={draft.monthsLeft ?? ''}
                onChange={(e) => set({
                  monthsLeft: e.target.value === '' ? null : Number(e.target.value),
                })}
              />
            </Field>
            <Rupiah
              label="APE produced so far"
              id="goal-achieved"
              value={draft.apeAchievedMinor}
              onChange={(apeAchievedMinor) => set({ apeAchievedMinor })}
            />
          </FieldRow>
          {projected && (
            <div className="mt-3 flex flex-wrap gap-6">
              <Figure label="Already produced" value={formatRupiah(projected.apeAchievedMinor)} />
              <Figure label="Remaining needed" value={formatRupiah(projected.remainingApeMinor)} />
              <Figure
                label="This month's APE target"
                value={formatRupiah(projected.monthlyApeTargetMinor)}
              />
            </div>
          )}
        </Step>

        <Step n={3} title="From APE to policy count">
          <FieldRow>
            <Rupiah
              label="Average case size"
              id="goal-case-size"
              value={draft.caseSizeMinor}
              onChange={(caseSizeMinor) => set({ caseSizeMinor })}
              hint="APE per closing. Increase if one appointment often yields multiple policies."
            />
          </FieldRow>
          {projected && (
            <div className="mt-3 flex flex-wrap gap-6">
              <Figure label="Policies per month" value={String(projected.policiesPerMonth)} />
              <Figure label="Policies per week" value={`≈ ${projected.policiesPerWeek}`} />
            </div>
          )}
        </Step>

        <Step n={4} title="Conversion assumptions">
          <FieldRow>
            <Percent
              label="Contacted leads that become an appointment"
              id="goal-leads-to-appt"
              value={draft.leadsToApptPct}
              onChange={(leadsToApptPct) => set({ leadsToApptPct })}
            />
            <Percent
              label="Appointments that become a closing"
              id="goal-closing"
              value={draft.closingRatePct}
              onChange={(closingRatePct) => set({ closingRatePct })}
            />
          </FieldRow>
          <p className="mt-2 text-sm text-muted">Use your real conversion ratios for accuracy.</p>
        </Step>

        <Step n={5} title="Monthly activity target">
          {/*
            * **Passing the target replaces the cascade rather than printing zeroes** (ADR-0047).
            * The arithmetic is right — a plan that has been met needs nothing more — but *contact
            * 0 leads* read as this week's plan is an instruction to stop working, printed to the
            * best producer in the office.
            */}
          {projected?.targetMet ? (
            <p className="text-md text-navy">
              <strong>You have passed your annual target.</strong> Set a new one above, or keep
              going — there is nothing left for this plan to ask of you.
            </p>
          ) : projected ? (
            <div className="flex flex-wrap items-end gap-4">
              <Column label="Leads contacted" month={projected.leadsPerMonth} week={projected.leadsPerWeek} />
              <Arrow pct={draft.leadsToApptPct} />
              <Column label="Appointments" month={projected.appointmentsPerMonth} week={projected.appointmentsPerWeek} />
              <Arrow pct={draft.closingRatePct} />
              <Column label="Closings" month={projected.policiesPerMonth} week={projected.policiesPerWeek} hero />
            </div>
          ) : (
            <p className="text-md text-alert">
              This plan cannot be worked out from the numbers above. Check the case size and the two
              conversion rates — each has to be more than zero.
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            Counts against {goal.cascadeMapping.leadsCode}, {goal.cascadeMapping.appointmentsCode} and{' '}
            {goal.cascadeMapping.closingsCode} in Activity management.
          </p>
        </Step>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">
            My commitment
            {goal.savedAt && (
              <span className="ml-2 text-sm font-normal text-muted">
                (as of {new Date(goal.savedAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })})
              </span>
            )}
          </h2>
          {projected && !projected.targetMet && (
            <p className="mt-2 text-md text-navy">
              To reach APE <strong>{formatRupiah(projected.annualApeTargetMinor)}</strong> this year
              ({goal.monthsLeft} months left), this month&apos;s target is APE{' '}
              <strong>{formatRupiah(projected.monthlyApeTargetMinor)}</strong> — I will contact{' '}
              <strong>{projected.leadsPerMonth} leads</strong>, get{' '}
              <strong>{projected.appointmentsPerMonth} appointments</strong>, and close{' '}
              <strong>{projected.policiesPerMonth} policies</strong> this month.
            </p>
          )}
          {/*
            * The one sentence in the whole prototype set that admits the cascade is an estimate,
            * and it survives only in three retired section files. A screen printing *contact 67
            * leads* without it reads as an instruction from the office (L-29).
            */}
          <p className="mt-3 text-sm text-muted">
            Estimates for personal planning — assumptions vary per individual.
          </p>
          <p className="mt-2 text-sm text-muted" role="status">
            {busy ? 'Saving…' : saved ? 'Saved' : 'Not yet saved'}
          </p>
        </Card>

        {history.length > 1 && <History entries={history} />}
      </div>
    </Page>
  );
}

/**
 * Every plan agreed for this period, and what each one changed (P8-T6, AC-3).
 *
 * **The difference is worked out here, from two whole states.** Nothing had to decide in advance
 * which fields were worth recording, and a field added later is compared without a migration —
 * which is the reasoning ADR-0042 gives for keeping states rather than diffs.
 *
 * Only shown once there is something to compare: a plan agreed once and never revised has no
 * history worth a panel.
 */
function History({ entries }: { entries: GoalHistoryEntry[] }) {
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">What this plan has been</h2>
      <p className="mt-1 text-md text-muted">
        Every version, newest first. A plan somebody coached against does not stop having existed
        because it was revised.
      </p>

      <ol className="mt-4 flex flex-col gap-4">
        {entries.map((entry, i) => {
          const changes = changesBetween(entry, entries[i + 1]);
          return (
            <li key={entry.version} className="border-l-2 border-hairline pl-3">
              <p className="text-md font-semibold text-navy">
                {i === 0 ? 'Now' : `Version ${entry.version}`}
                {entry.at && (
                  <span className="ml-2 text-sm font-normal text-muted">
                    {new Date(entry.at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                )}
                {entry.byName && (
                  <span className="ml-2 text-sm font-normal text-muted">· {entry.byName}</span>
                )}
              </p>

              {changes.length === 0 ? (
                <p className="text-sm text-muted">
                  {i === entries.length - 1 ? 'The first plan for this year.' : 'Nothing changed.'}
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted">
                  {changes.map((change) => (
                    <li key={change.field}>
                      <span className="text-navy">{FIELD_LABEL[change.field]}</span>
                      {': '}
                      {change.from} → <strong className="text-navy">{change.to}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** The six the server takes. Everything else on a goal is derived or stamped. */
function inputsOf(goal: Goal): GoalInputs {
  return {
    mode: goal.mode,
    annualApeTargetMinor: goal.annualApeTargetMinor,
    savingsTargetMinor: goal.savingsTargetMinor,
    commissionRatePct: goal.commissionRatePct,
    // The **override**, not the figure in force: `null` says *use the office's calendar*.
    monthsLeft: goal.monthsLeftIsOverride ? goal.monthsLeft : null,
    apeAchievedMinor: goal.apeAchievedMinor,
    caseSizeMinor: goal.caseSizeMinor,
    leadsToApptPct: goal.leadsToApptPct,
    closingRatePct: goal.closingRatePct,
  };
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-2xs text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/**
 * Money, typed in **rupiah** and sent in **sen**.
 *
 * The one place the conversion happens, so no screen holds a second opinion about the unit — and
 * the reader never types twelve digits for a figure they think of as nine.
 */
function Rupiah({
  label, id, value, onChange, hint,
}: {
  label: string; id: string; value: number; onChange: (minor: number) => void; hint?: string;
}) {
  return (
    <Field label={`${label} (Rp)`} htmlFor={id} hint={hint}>
      <TextInput
        id={id}
        type="number"
        min="0"
        value={toMajor(value)}
        onChange={(e) => onChange(toMinor(Number(e.target.value)))}
      />
    </Field>
  );
}

/** A percentage, with decimals — which the prototype's parser cannot read (I-108). */
function Percent({
  label, id, value, onChange,
}: {
  label: string; id: string; value: number; onChange: (pct: number) => void;
}) {
  return (
    <Field label={`${label} (%)`} htmlFor={id}>
      <TextInput
        id={id}
        type="number"
        step="0.1"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-3 text-md text-navy">
      {label} <strong>{value}</strong>
    </p>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-bold text-navy">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function Column({
  label, month, week, hero,
}: { label: string; month: number; week: number; hero?: boolean }) {
  return (
    <div>
      <div className={hero ? 'font-display text-2xl font-bold text-navy' : 'font-display text-xl font-bold text-navy'}>
        {month}
      </div>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-2xs text-muted">≈ {week}/week</div>
    </div>
  );
}

function Arrow({ pct }: { pct: number }) {
  return (
    <div className="pb-6 text-sm text-muted" aria-hidden="true">
      —{pct}%→
    </div>
  );
}
