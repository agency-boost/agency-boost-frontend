'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ConfigBadge } from '@/components/ui/config-badge';
import { CascadeRow } from '@/components/ui/cascade-row';
import { KpiTile } from '@/components/ui/kpi-tile';
import { NumberBadge } from '@/components/ui/number-badge';
import { formatDay, formatDayLong, formatMonth } from '@/lib/format';
import { SaveStatus } from '@/components/ui/save-status';
import { Segmented } from '@/components/ui/segmented';
import {
  Button, Card, ErrorBanner, Field, FieldRow, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  changesBetween, FIELD_LABEL, formatRupiah, groupDigits, parseDigits, readGoal, readGoalHistory,
  saveGoal, toMajor, toMinor,
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

  /**
   * Editing anything means what is on screen is no longer what is stored.
   *
   * Without this the dot stayed green while the agent typed a new target, so the screen said *Saved*
   * about numbers nobody had saved. The prototype gets this right — `refreshSaveStatus()` reports
   * `Not yet saved` from a dirty flag (`Overall.html:4935-4947`) — and it only became visible here
   * once the status had a dot to be wrong with.
   */
  const set = (patch: Partial<GoalInputs>) => {
    setDraft({ ...draft, ...patch });
    setSaved(false);
  };
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
    >
      {/*
        * **A measure, and centred** — `.content` is `max-width:820px; margin:0 auto` (`:632`). Five
        * cards stretched across a 1,600px window put a two-word label a hand's width from its input,
        * and the cascade's three columns 400px apart. A plan is read top to bottom, not across.
        *
        * **Everything on the screen is inside it, including the picker and the banners.** They were
        * outside, at `p-6` against the steps' `px-5 py-4`, so the first two cards a leader saw were
        * wider and more thickly padded than the plan underneath — the same thing said in two shapes.
        */}
      <div className="mx-auto flex max-w-[51.25rem] flex-col gap-3">
        {error && <ErrorBanner {...error} />}

        {team.length > 0 && (
          <Card density="compact">
            <FieldRow>
              <Field
                label="Whose plan"
                htmlFor="goal-subject"
                className="w-64"
                hint="Saving somebody else’s becomes their goal at once, carries your name, and tells them."
              >
                <Select
                  id="goal-subject"
                  className="w-full"
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
          <Card density="compact" className="border-navy/30 bg-navy/5">
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
          <Card density="compact" className="border-amber/40 bg-amber/5">
            <p className="text-md text-navy">
              <strong>Set by your leader</strong>
              {goal.savedAt ? ` on ${formatDayLong(goal.savedAt)}` : ''}. You can change it — it is your plan.
            </p>
          </Card>
        )}

        <Step
          n={1}
          title="What's your APE target this year?"
          actions={(
            <div className="flex items-center gap-3">
              {/*
                * **The status beside the button, not at the bottom of the page.** Its job is to answer
                * *did that land* where you are already looking (`:2854-2862`, `:627-632`). It was 500
                * pixels below the button, which is nowhere.
                */}
              <SaveStatus state={saved && !busy ? 'saved' : 'unsaved'}>
                {busy ? 'Saving…' : saved ? 'Saved' : 'Not yet saved'}
              </SaveStatus>
              <Button onClick={() => commit(draft)} disabled={busy}>
                {busy ? 'Saving…' : 'Save goal'}
              </Button>
            </div>
          )}
        >
          {/*
            * **Two segments, both visible** (`:2865-2868`). This was a `<select>`, and a dropdown hides
            * the alternative behind a click: an agent who thinks in take-home pay rather than in APE
            * could not see the product had a mode for them. It also sat in the same row as the value it
            * governs, so the mode competed with the number.
            */}
          <Segmented
            label="How you want to set it"
            tabs={[
              { id: 'direct', label: 'Set APE target directly' },
              { id: 'from_savings', label: 'Calculate from savings target' },
            ]}
            active={draft.mode}
            onSelect={(mode) => set({ mode: mode as GoalMode })}
          >
            {(mode) => (mode === 'direct' ? (
              <FieldRow>
                <Rupiah
                  label="Annual APE target"
                  id="goal-ape"
                  value={draft.annualApeTargetMinor}
                  onChange={(annualApeTargetMinor) => set({ annualApeTargetMinor })}
                />
              </FieldRow>
            ) : (
              <>
                <FieldRow>
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
                    hint="% of APE that becomes income / savings"
                  />
                </FieldRow>
                {projected && (
                  <KpiTile
                    className="mt-3"
                    variant="insight"
                    label="That is an APE target of"
                    value={formatRupiah(projected.annualApeTargetMinor)}
                  />
                )}
              </>
            ))}
          </Segmented>
        </Step>

        <Step n={2} title="Your current progress">
          <FieldRow>
            {/*
              * **`null` means *use the office's calendar***, and that is what is sent unless the
              * agent types over the figure. Sending the number back would store it, and a stored
              * divisor goes stale: a plan saved in January with 11.9 months left claimed 11.9 in
              * October, with a monthly target a fifth of the truth (client PRD §17).
              */}
            <Field
              label={(
                <>
                  Months left this year{' '}
                  {/*
                    * The prototype's `.auto-badge` (`:662-667`, `:2913`), which said the field fills
                    * itself in. It was dropped when the field became a plain input, and the hint below
                    * had to do its work in a sentence.
                    */}
                  {draft.monthsLeft === null && (
                    <ConfigBadge tone="navy" className="ml-1 align-middle">auto</ConfigBadge>
                  )}
                </>
              )}
              htmlFor="goal-months"
              className="w-56"
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
                suffix="months"
                className="w-full"
                placeholder={String(goal.monthsLeft)}
                value={draft.monthsLeft ?? ''}
                onChange={(e) => set({
                  monthsLeft: e.target.value === '' ? null : Number(e.target.value),
                })}
              />
            </Field>
            {/*
              * **The agent's own figure until the carrier's file says otherwise** (P9-T6, ADR-0008) —
              * the promise Phase 8 made. Once the office holds a year-to-date figure the plan is
              * measured against that, and the box becomes a statement of where the number came from:
              * a field you could type into and that nothing would read would be a lie with a cursor.
              * The typed figure is kept, and still saved, for the year a file stops arriving.
              */}
            {goal.achieved.provenance === 'self_reported' ? (
              <Rupiah
                label="APE already produced this year"
                id="goal-achieved"
                value={draft.apeAchievedMinor}
                onChange={(apeAchievedMinor) => set({ apeAchievedMinor })}
                hint="By your own count — used until your office uploads the carrier’s monthly production."
              />
            ) : (
              <ReadOnlyField
                label="APE already produced this year"
                value={formatRupiah(goal.achieved.minor)}
                reason={achievedReason(goal)}
              />
            )}
          </FieldRow>
          {projected && (
            <>
              {/* Two-up, as `.kpi-row` is (`:686`) — a grid rather than a wrap, so they stay equal. */}
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <KpiTile
                  label={<>Already produced <span className="font-normal normal-case">· {SOURCE_SHORT[goal.achieved.provenance]}</span></>}
                  value={formatRupiah(projected.apeAchievedMinor)}
                />
                <KpiTile label="Remaining needed" value={formatRupiah(projected.remainingApeMinor)} />
              </div>
              {/*
                * **The one number this card is for.** It was the third of three identical figures, so
                * the answer looked like the two echoes of what you had just typed (`:2938-2941`).
                */}
              <KpiTile
                className="mt-2.5"
                variant="insight"
                label="This month's APE target"
                value={formatRupiah(projected.monthlyApeTargetMinor)}
              />
            </>
          )}
        </Step>

        <Step n={3} title="From APE to policy count">
          <FieldRow>
            <Rupiah
              label="Average case size (APE per policy)"
              id="goal-case-size"
              value={draft.caseSizeMinor}
              onChange={(caseSizeMinor) => set({ caseSizeMinor })}
            />
          </FieldRow>
          {projected && (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <KpiTile
                label="Policies per month"
                value={projected.policiesPerMonth}
                unit="policies"
              />
              <KpiTile label="Policies per week" value={`≈ ${projected.policiesPerWeek}`} />
            </div>
          )}
          <Tip glyph="💡">
            APE per closing. Increase if one appointment often yields multiple policies.
          </Tip>
        </Step>

        <Step n={4} title="Conversion assumptions">
          <FieldRow>
            {/*
              * The prototype's own labels, with its `.field-sub` explanation underneath as the hint
              * (`:2981-2999`). The sub-line is a `<span>` inside the label there, which makes it part of
              * the field's accessible name; ours is a `hint` bound by `aria-describedby`, so it is
              * announced after the name rather than as part of it (L-20).
              */}
            <Percent
              label="Leads to Appointment"
              id="goal-leads-to-appt"
              value={draft.leadsToApptPct}
              onChange={(leadsToApptPct) => set({ leadsToApptPct })}
              hint="% of contacted leads that become an appointment"
            />
            <Percent
              label="Closing rate"
              id="goal-closing"
              value={draft.closingRatePct}
              onChange={(closingRatePct) => set({ closingRatePct })}
              hint="% of appointments that become a closing"
            />
          </FieldRow>
          <Tip glyph="💡">Use your real conversion ratios for accuracy.</Tip>
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
            /*
             * **The cascade, as a cascade** (`:3014-3060`). Three filled panels with an icon plate and
             * the activity each counts against, joined by arrows carrying the rate — which is what makes
             * it read as *67 leads, of which 30% become 20 appointments, of which 30% become 6
             * closings*. It was five bare divs in a flex row with `—30%→` as grey caption text, so the
             * three numbers were adjacent rather than consequent.
             */
            <CascadeRow
              columns={[
                {
                  label: 'Leads contacted',
                  chip: goal.cascadeMapping.leadsCode,
                  icon: 'clipboard',
                  month: String(projected.leadsPerMonth),
                  week: `≈ ${projected.leadsPerWeek}/week`,
                },
                {
                  label: 'Appointments',
                  chip: goal.cascadeMapping.appointmentsCode,
                  icon: 'calendar',
                  month: String(projected.appointmentsPerMonth),
                  week: `≈ ${projected.appointmentsPerWeek}/week`,
                },
                {
                  label: 'Closings',
                  chip: goal.cascadeMapping.closingsCode,
                  icon: 'target',
                  month: String(projected.policiesPerMonth),
                  week: `≈ ${projected.policiesPerWeek}/week`,
                  hero: true,
                },
              ]}
              links={[`${draft.leadsToApptPct}%`, `${draft.closingRatePct}%`]}
            />
          ) : (
            <p className="text-md text-alert">
              This plan cannot be worked out from the numbers above. Check the case size and the two
              conversion rates — each has to be more than zero.
            </p>
          )}
          {/*
            * The prototype's 🔗 tip reads *"Maps to activities #3, #4, #6 in Activity Management"* — and
            * those numbers are display order, which an office can drag (invariant §4). The chips above
            * carry the codes; this says where they are counted.
            */}
          <Tip glyph="🔗">Counted in Activity management, against the codes above.</Tip>
        </Step>

        {/*
          * **The one inverted panel on the screen** (`.commit-card`, `:738-744`). Navy ground, 16px
          * text at 1.6, and every figure in amber. It is the sentence an agent reads back to
          * themselves, and it was a white card with 14px navy text and plain bold — indistinguishable
          * from the five cards of working above it, so the conclusion looked like another step.
          */}
        <div className="rounded-lg bg-navy px-5 py-4 text-sidebar-text">
          {/*
            * `.commit-eyebrow` is a `<p>` in the prototype (`:3070`); ours is an `<h2>` painted the same
            * way. The commitment is a section of the page, and leaving it out of the heading outline
            * means a screen-reader user tabbing by heading lands on the five steps and never on the
            * conclusion. Nothing about it looks different.
            */}
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-sidebar-text/60">
            My commitment
            {goal.savedAt && (
              <> (as of {formatDay(goal.savedAt)})</>
            )}
          </h2>
          {projected && !projected.targetMet && (
            <p className="mt-2 text-lg leading-relaxed text-white">
              To reach APE <Figure>{formatRupiah(projected.annualApeTargetMinor)}</Figure> this year
              ({goal.monthsLeft} months left), this month&apos;s target is APE{' '}
              <Figure>{formatRupiah(projected.monthlyApeTargetMinor)}</Figure> — I will contact{' '}
              <Figure>{projected.leadsPerMonth} leads</Figure>, get{' '}
              <Figure>{projected.appointmentsPerMonth} appointments</Figure>, and close{' '}
              <Figure>{projected.policiesPerMonth} policies</Figure> this month.
            </p>
          )}
          {/*
            * The one sentence in the whole prototype set that admits the cascade is an estimate,
            * and it survives only in three retired section files. A screen printing *contact 67
            * leads* without it reads as an instruction from the office (L-29).
            */}
          <p className="mt-3 text-sm text-sidebar-text/70">
            Estimates for personal planning — assumptions vary per individual.
          </p>
        </div>

        {history.length > 1 && <History entries={history} />}
      </div>
    </Page>
  );
}

/**
 * A figure inside the commitment sentence: `.commit-text b` is `font-weight:700; color:var(--amber)`
 * (`Overall.html:744`).
 *
 * **Amber rather than amber-deep, because the ground is navy.** The contrast question is the other way
 * round here — plain amber on navy is 6.3:1, and it is the one place in the product where amber is a
 * text colour that comfortably clears AA. Pinned in `a11y.spec.tsx`.
 *
 * Still a `<strong>`: the emphasis is semantic, and a reader who cannot see the colour still hears it.
 */
function Figure({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-amber">{children}</strong>;
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
    // Same padding as every other card on this screen. A panel that is more thickly padded than the
    // plan above it reads as a different kind of thing.
    <Card density="compact">
      <h2 className="font-display text-md font-bold text-navy">What this plan has been</h2>
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
                    {formatDay(entry.at)}
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

/**
 * One of the five steps: an outlined ordinal, a question, and the fields that answer it.
 *
 * The badge is **outlined navy** (`Overall.html:637-640`), not the filled disc with white 10px text
 * this screen had — which announces rather than numbers, and made a step head read as a status.
 * `aria-hidden` lives in `NumberBadge`: the heading beside it is the name.
 *
 * `actions` is card 1's only: the prototype puts Save and the save status in the **first** step's
 * header (`:2854-2862`), where the plan starts rather than at the bottom of the page.
 */
function Step({
  n, title, actions, children,
}: {
  n: number;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card density="compact">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-md font-bold text-navy">
          <NumberBadge n={n} size="md" />
          {title}
        </h2>
        {actions}
      </div>
      <div className="mt-3.5">{children}</div>
    </Card>
  );
}

/**
 * The prototype's `.tip` (`:701-702`, used at `:2969`, `:3001`, `:3062`): an emoji in its own span, a
 * sentence beside it.
 *
 * The emoji is not decoration — 💡 says *this is advice you can act on* and 🔗 says *this points at
 * another screen*, and they are the difference between a hint and a footnote at a glance. It is
 * `aria-hidden` because the sentence says the same thing in words.
 */
function Tip({ glyph, children }: { glyph: string; children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted">
      <span aria-hidden="true" className="shrink-0">{glyph}</span>
      <span>{children}</span>
    </p>
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
    <Field label={label} htmlFor={id} hint={hint}>
      {/*
        * **Text, not `type="number"`**, so the figure can be grouped while it is being typed —
        * `500.000.000` rather than `500000000`. A number input cannot carry a separator, and nine
        * digits in a row is a figure you have to count rather than read. `inputMode="numeric"` keeps
        * the phone keypad; the prototype does exactly this (`Overall.html:2874`).
        */}
      <TextInput
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        prefix="Rp"
        className="w-full"
        value={groupDigits(toMajor(value))}
        onChange={(e) => onChange(toMinor(parseDigits(e.target.value)))}
      />
    </Field>
  );
}

/** A percentage, with decimals — which the prototype's parser cannot read (I-108). */
function Percent({
  label, id, value, onChange, hint,
}: {
  label: string; id: string; value: number; onChange: (pct: number) => void; hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <TextInput
        id={id}
        type="number"
        step="0.1"
        min="0"
        max="100"
        suffix="%"
        className="w-full"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

/** The KPI's word for whose figure it is (P9-T6). */
const SOURCE_SHORT: Record<Goal['achieved']['provenance'], string> = {
  imported: 'carrier’s file',
  corrected: 'corrected by the office',
  self_reported: 'your own figure',
};

/** Where the figure the plan is measured against came from, and what happened to the typed one. */
function achievedReason(goal: Goal): string {
  const { achieved, apeAchievedMinor: typed } = goal;
  const asOf = achieved.month ? `, year to date as of ${formatMonth(achieved.month)}` : '';
  const source = achieved.provenance === 'corrected'
    ? `From your office’s production, corrected by hand${asOf}.`
    : `From the carrier’s monthly file${asOf}.`;
  return typed > 0 && typed !== achieved.minor
    ? `${source} The ${formatRupiah(typed)} typed on this plan is kept, and no longer used.`
    : source;
}

