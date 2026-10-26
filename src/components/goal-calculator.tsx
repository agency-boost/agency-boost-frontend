'use client';

import { useCallback, useEffect, useState } from 'react';
import { CascadeRow } from '@/components/ui/cascade-row';
import { ConfigBadge } from '@/components/ui/config-badge';
import {
  Button, Card, ErrorBanner, Field, FieldRow, ReadOnlyField, TextInput,
} from '@/components/ui/field';
import { KpiTile } from '@/components/ui/kpi-tile';
import { NumberBadge } from '@/components/ui/number-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { capitalized, PRONOUN_FORMS, type CoacheeSubject } from '@/lib/coaching';
import { formatDay, formatDayLong } from '@/lib/format';
import {
  formatRupiah, goalInputsOf, groupDigits, parseDigits, producedFrom, readGoal, saveGoal, toMajor, toMinor,
  type Goal, type GoalInputs, type GoalMode,
} from '@/lib/goals';
import { useSession } from '@/lib/session';
import { useTenantConfig, type TenantConfig } from '@/lib/tenant-config-cache';

/**
 * The goal calculator (P8-T3) — `Overall.html:2860-3030`, and the same tool inside a coachee's
 * *Goal Setting* tab (`buildGoalToolHtml`, `:5854-6104`, *"a replica of the main Goal Settings page"*).
 *
 * **Five numbered cards and a commitment**, back-solving an annual APE target into this week's
 * activity. The prototype has no Calculate button and neither does this: every change recomputes.
 *
 * **The server is the only source of the numbers.** The screen sends the six inputs and renders
 * what comes back — it holds no copy of the cascade, because the prototype's own three surfaces
 * disagree (markup 80 / 24, calculator 67 / 20, `PERIOD_DATA` 80 / 24 again) and a second
 * implementation is exactly how that happens.
 *
 * **Whose plan is the page's to say** (P11-T7 AC-5, AC-6). `/goals` renders it with no subject: the
 * reader's own plan. A coachee's *Goal Setting* tab renders it with one, and every read and the save
 * go to `GET` / `PUT /goals/:period?for=` — the save is the coachee's goal at once, carries the
 * leader's name, and tells the coachee (ADR-0046). With a subject the words are the coaching tool's —
 * *What's their APE target this year?*, *Current progress*, *Commitment*, *she will contact* — and
 * the prototype's footer says the three tabs agree. The *Whose plan* picker that stood in for this tab
 * on `/goals` (L-30) is gone (D-picker).
 *
 * **The step 1 savings copy is unchanged** (P11-T7 AC-11, D-picker): *Commission rate* and *That is an
 * APE target of* stay as `/goals` built them, on both pages, unless the client's sign-off of P10.1-T6
 * rejects them.
 *
 * **The prototype's screen, and no more** (P10.1-T6, ADR-0062, ADR-0063): no hint sentences under
 * step 2, no measured rate under the assumptions (ADR-0063 §7) — a coachee's read no longer even
 * carries one (D-rates) — and no history card. **Less, since the client's revisions of 2026-10-26**
 * (ADR-0160 §4–5): no 💡 tip and no helper line under the two percentages, the cascade in the client's
 * words, and policies per week to one decimal. What stays beyond the prototype is what a requirement
 * needs: *Set by your leader* (ADR-0046), the provenance marker on the APE already produced
 * (ADR-0063 §5), the disclaimer (L-29) and the target-passed state (ADR-0047).
 */

/** How the calculator's sentences read: the reader's own plan, or a coachee's in their pronoun. */
function voiceOf(subject?: CoacheeSubject) {
  if (!subject) return { pronoun: 'you', object: 'you', possessive: 'your', have: 'have' };
  const forms = PRONOUN_FORMS[subject.pronoun];
  return { pronoun: forms.subject, object: forms.object, possessive: forms.possessive, have: forms.have };
}

export function GoalCalculator({
  period,
  subject,
}: {
  /**
   * The plan's period: v1 is annual (ADR-0049), so a year. `null` while the page is still finding out
   * which year it is — nothing is read until it knows.
   */
  period: string | null;
  /** The coachee whose plan this is, on their *Goal Setting* tab. Absent on the reader's own `/goals`. */
  subject?: CoacheeSubject;
}) {
  const { me } = useSession();
  const { config } = useTenantConfig();
  const forId = subject?.membershipId;
  const voice = voiceOf(subject);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalInputs | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (period === null) return;
    setError(null);
    try {
      const next = await readGoal(period, forId);
      setGoal(next);
      setDraft(goalInputsOf(next));
      setSaved(next.savedAt !== null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [period, forId]);

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
    if (period === null) return;
    setDraft(next);
    setBusy(true);
    setError(null);
    try {
      const result = await saveGoal(period, next, forId);
      setGoal(result);
      setDraft(goalInputsOf(result));
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  if (!goal || !draft) {
    return (
      <>
        {error && <ErrorBanner {...error} />}
        {!error && <SkeletonCards count={5} label={`Loading ${voice.possessive} plan…`} />}
      </>
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
  const mine = !subject;
  const byLeader = mine
    && goal.savedByMembershipId !== null
    && goal.savedByMembershipId !== me?.membership?.membershipId;
  const numbers = activityNumbers(config, goal.cascadeBinding);
  const produced = producedFrom(goal.achieved, 'year', subject?.pronoun);

  return (
    <>
      {/*
        * **A measure, and centred** — `.content` is `max-width:820px; margin:0 auto` (`:632`). Five
        * cards stretched across a 1,600px window put a two-word label a hand's width from its input,
        * and the cascade's three columns 400px apart. A plan is read top to bottom, not across.
        *
        * **Everything on the screen is inside it, including the banner.** It was outside, at `p-6`
        * against the steps' `px-5 py-4`, so the first card a reader saw was wider and more thickly
        * padded than the plan underneath — the same thing said in two shapes.
        */}
      <div className="mx-auto flex max-w-[51.25rem] flex-col gap-3">
        {error && <ErrorBanner {...error} />}

        {/*
          * **Who set this, when it was not you** (ADR-0046). A leader saves a downline's goal
          * directly — there is no acceptance step anywhere in the prototype, and the consent one
          * would model already happens in the room — so what the agent is owed is knowing. On a
          * coachee's tab it would describe the reader to themselves, so it is the reader's own only.
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
          // The coaching tool's own words for somebody else's plan (`Overall.html:5860`), verbatim.
          title={mine ? "What's your APE target this year?" : "What's their APE target this year?"}
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
            label={mine ? 'How you want to set it' : 'How to set it'}
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

        <Step n={2} title={mine ? 'Your current progress' : 'Current progress'}>
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
                    * The prototype's `.auto-badge` (`:662-667`, `:2913`), which says the field fills
                    * itself in. With the placeholder's figure it is all that says so: the hint sentence
                    * under the box went in P10.1-T6 (ADR-0062), and the manual explains the override.
                    */}
                  {/*
                    * `-my-0.5` takes back the badge's own padding, so the label is a line of text tall
                    * with it or without: otherwise this box sat a pixel below the APE figure's beside
                    * it, and jumped when the badge went (P10.1-T8).
                    */}
                  {draft.monthsLeft === null && (
                    <ConfigBadge tone="navy" className="-my-0.5 ml-1 align-middle">auto</ConfigBadge>
                  )}
                </>
              )}
              htmlFor="goal-months"
              className="w-56"
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
              *
              * **No sentence says so** (P10.1-T6, ADR-0063 §5): whose figure it is, and for which
              * month, is the marker on *Already produced* below, as on the Summary.
              */}
            {/*
              * Either way it takes the rest of the row, as the prototype's `flex:1 1 220px` does
              * (`Overall.html:2919`), and the office's figure is laid out as a field beside the months —
              * its label on their label's line, its figure level with their box (P10.1-T8).
              */}
            {/*
              * **A leader never types somebody else's production** (ADR-0075, ADR-0058): on a coachee's
              * plan the figure is read-only whatever its source, and the server keeps the stored figure
              * on a leader's save. Only the member's own plan offers the box.
              */}
            {goal.achieved.provenance === 'self_reported' && !subject ? (
              <Rupiah
                label="APE already produced this year"
                id="goal-achieved"
                value={draft.apeAchievedMinor}
                onChange={(apeAchievedMinor) => set({ apeAchievedMinor })}
                className="grow basis-56"
              />
            ) : (
              <ReadOnlyField
                layout="field"
                className="grow basis-56"
                label={projected ? 'APE already produced this year' : (
                  <>
                    APE already produced this year{' '}
                    {/*
                      * No plan, no *Already produced* tile to carry the marker — so it is here, once,
                      * rather than leaving a carrier's figure with nothing to say whose it is.
                      */}
                    <TippedGlyph
                      glyph="ⓘ"
                      name={produced}
                      tip={produced}
                      align="fit"
                      className="-my-2 align-middle"
                    />
                  </>
                )}
                value={formatRupiah(goal.achieved.minor)}
              />
            )}
          </FieldRow>
          {projected && (
            <>
              {/* Two-up, as `.kpi-row` is (`:686`) — a grid rather than a wrap, so they stay equal. */}
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <KpiTile
                  label={(
                    <>
                      Already produced{' '}
                      {/*
                        * The provenance marker (ADR-0063 §5), the Summary's: its words say whose figure
                        * this is and for which month. The negative margin keeps the 28px tap target
                        * from making this tile's label taller than its neighbour's.
                        */}
                      <TippedGlyph
                        glyph="ⓘ"
                        name={produced}
                        tip={produced}
                        align="fit"
                        className="-my-2 align-middle"
                      />
                    </>
                  )}
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
              {/*
                * **One decimal** (ADR-0160 §5): the server divides by 4.33 to a tenth and a whole figure
                * comes back whole, so six a month reads *≈ 1.4* where it read *≈ 2*. The 💡 tip under this
                * step went at the client's request.
                */}
              <KpiTile label="Policies per week" value={`≈ ${projected.policiesPerWeek}`} />
            </div>
          )}
        </Step>

        <Step n={4} title="Conversion assumptions">
          <FieldRow>
            {/*
              * **The client's label, and no helper lines** (ADR-0160 §4, 2026-10-26): the prototype reads
              * *Leads to Appointment* (`:2981-2999`), with a `.field-sub` under each field and a 💡 tip
              * under both, and the client asked for all three to go. *Closing rate* is the prototype's.
              *
              * **Unsaved, each opens on the office's benchmark** — *Set appointment to meeting* and *Selling
              * success rate* — or 30 (ADR-0160 §3). The server answers it; the screen holds no copy.
              *
              * **Not the measured rate** (ADR-0063 §7): *Your logged rate* left this screen in
              * P10.1-T6. `GET /goals` keeps `measured`; where coaching shows it is P11-T1's.
              */}
            <Percent
              label="Appointment to Sales meeting"
              id="goal-leads-to-appt"
              className="min-w-[14rem] flex-1"
              value={draft.leadsToApptPct}
              onChange={(leadsToApptPct) => set({ leadsToApptPct })}
            />
            <Percent
              label="Closing rate"
              id="goal-closing"
              className="min-w-[14rem] flex-1"
              value={draft.closingRatePct}
              onChange={(closingRatePct) => set({ closingRatePct })}
            />
          </FieldRow>
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
              <strong>{capitalized(voice.pronoun)} {voice.have} passed {voice.possessive} annual target.</strong> Set a new one above, or keep
              going — there is nothing left for this plan to ask of {voice.object}.
            </p>
          ) : projected ? (
            /*
             * **The cascade, as a cascade** (`:3014-3060`). Three filled panels with an icon plate and
             * the activity each counts against, joined by arrows carrying the rate — which is what makes
             * it read as *67 leads, of which 30% become 20 appointments, of which 30% become 6
             * closings*. It was five bare divs in a flex row with `—30%→` as grey caption text, so the
             * three numbers were adjacent rather than consequent.
             *
             * **The client's words, and the month written out** (ADR-0160 §4–5, 2026-10-26): *Set appointment*,
             * *Sales meeting* and *Submission polis*, where the prototype reads *Leads contacted*, *Appointments*
             * and *Closings*; each figure *n/month* above *≈ n/week* — the policies' to one decimal, the two
             * counts to do whole.
             */
            <CascadeRow
              columns={[
                {
                  label: 'Set appointment',
                  chip: chipOf(numbers.leads),
                  icon: 'clipboard',
                  month: `${projected.leadsPerMonth}/month`,
                  week: `≈ ${projected.leadsPerWeek}/week`,
                },
                {
                  label: 'Sales meeting',
                  chip: chipOf(numbers.appointments),
                  icon: 'calendar',
                  month: `${projected.appointmentsPerMonth}/month`,
                  week: `≈ ${projected.appointmentsPerWeek}/week`,
                },
                {
                  label: 'Submission polis',
                  chip: chipOf(numbers.closings),
                  icon: 'target',
                  month: `${projected.policiesPerMonth}/month`,
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
            * The prototype's 🔗 tip, verbatim (`:3062-3065`), with the office's own numbers in place of
            * its literal *#3, #4, #6*: display order, which an office can drag, read from configuration
            * by code (invariant §4) — so a reordered list renumbers the tip and never rebinds the plan.
            * Until the configuration has answered there is nothing true to print, so nothing is.
            */}
          {numbers.leads !== null && numbers.appointments !== null && numbers.closings !== null && (
            <Tip glyph="🔗">
              Maps to activities {[numbers.leads, numbers.appointments, numbers.closings].map(hashes).join(', ')} in
              {' '}Activity Management.
            </Tip>
          )}
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
            {/* *Commitment* on the coaching tool (`Overall.html:5971`), whose sentence is in their pronoun. */}
            {mine ? 'My commitment' : 'Commitment'}
            {goal.savedAt && (
              <> (as of {formatDay(goal.savedAt)})</>
            )}
          </h2>
          {projected && !projected.targetMet && (
            <p className="mt-2 text-lg leading-relaxed text-white">
              To reach APE <Figure>{formatRupiah(projected.annualApeTargetMinor)}</Figure> this year
              ({goal.monthsLeft} months left), this month&apos;s target is APE{' '}
              <Figure>{formatRupiah(projected.monthlyApeTargetMinor)}</Figure> — {mine ? 'I' : voice.pronoun} will contact{' '}
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

        {/*
          * The coaching tab's footer, verbatim and left-aligned (`Overall.html:4327`, `.footer-note`
          * `:746`). True as written: the Summary, this tab and the session all read the one goal this
          * saves (P8-T5), so nothing is copied that could fall out of step (P11-T7 AC-5).
          */}
        {!mine && (
          <p className="text-xs leading-relaxed text-muted">
            Changes here update instantly in Personal Summary and Coaching Session — all three stay in sync.
          </p>
        )}
      </div>
    </>
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
 * **The numbers the log screen shows beside each cascade stage's types** (P10.1-T6 AC-11): their display order
 * in the office's published configuration, found by the codes the **office's activity binding** names for the
 * stage (`goal.cascadeBinding`, ADR-0163; invariant §4) — the prototype's *Activity #3* (`Overall.html:3021`,
 * `:3038`, `:3055`). A stage bound to a replaced activity and its replacement shows both. The code is an internal
 * id and is never shown (ADR-0062 §3). `null` until the configuration arrives, and for a stage it holds no live
 * type for: a number pointing at nothing on the log is not printed — so an archived type, still counted for its
 * history, is not numbered.
 */
function activityNumbers(config: TenantConfig | null, binding: Goal['cascadeBinding']) {
  const types = (config?.activity ?? [])
    .filter((category) => category.status === 'active')
    .flatMap((category) => category.types)
    .filter((type) => type.status === 'active');
  const numbersOf = (codes: readonly string[] | undefined) => {
    const found = (codes ?? [])
      .map((code) => types.find((type) => type.code === code)?.displayOrder)
      .filter((n): n is number => n !== undefined);
    return found.length ? found : null;
  };
  return {
    leads: numbersOf(binding?.leads),
    appointments: numbersOf(binding?.appointments),
    closings: numbersOf(binding?.closings),
  };
}

/** `#3`, or `#3, #13` for a stage that counts two. */
const hashes = (numbers: readonly number[]) => numbers.map((n) => `#${n}`).join(', ');

/** The chip over a cascade column: *Activity #3*, verbatim, or none while the number is unknown. */
const chipOf = (numbers: readonly number[] | null) => (numbers === null ? undefined : `Activity ${hashes(numbers)}`);


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
export function Rupiah({
  label, id, value, onChange, className,
}: {
  label: string; id: string; value: number; onChange: (minor: number) => void;
  /** How the field sits in its row. */
  className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} className={className}>
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
  label, id, value, onChange, hint, className,
}: {
  label: string; id: string; value: number; onChange: (pct: number) => void; hint?: string;
  /** How the field sits in its row. A long description otherwise sizes it, and the pair stops sharing a line. */
  className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
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
