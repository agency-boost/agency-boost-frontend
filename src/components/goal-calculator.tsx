'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AutoMarker } from '@/components/ui/auto-marker';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NumberBadge } from '@/components/ui/number-badge';
import { PhoneTip } from '@/components/ui/phone-tip';
import {
  FLOATING_SAVE_ROOM, FloatingSavePill, SaveStateLabel, sameValue, useSaveState,
} from '@/components/ui/save-state';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { SliderWithValue } from '@/components/ui/slider-with-value';
import { StepperRow } from '@/components/ui/stepper-row';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { Toast, useToast } from '@/components/ui/toast';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import type { TermKey } from '@/lib/terms';
import { PRONOUN_FORMS, type CoacheeSubject } from '@/lib/coaching';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { voiceOf } from '@/i18n/messages/goal-words';
import { goalsMessages } from '@/i18n/messages/goals';
import { formatDay, formatDayLong, formatDecimalInput, formatNumber, formatRupiahCompact, moneyPrefix, parseDecimal } from '@/lib/format';
import {
  goalInputsOf, groupDigits, parseDigits, previewGoal, producedFrom, readGoal, saveGoal, toMajor, toMinor,
  type Goal, type GoalInputs, type GoalMode, type GoalPreview,
} from '@/lib/goals';
import { useMediaQuery } from '@/lib/use-media-query';
import { useSession } from '@/lib/session';
import { useTenantConfig, type TenantConfig } from '@/lib/tenant-config-cache';

/**
 * The goal calculator (P8-T3) — `/goals`, and the same tool inside a coachee's *Goal Setting* tab (P11-T7 AC-5).
 *
 * **Since UI V1 (P18.99-T5, 2026-10-30) the revision is its design** (ADR-0180 §1; the report's UI-014 to UI-022 and
 * the `goals-mobile` and `goals-desktop` mockups):
 *
 * - **The answer first** (UI-014): an orange *Monthly activity target* card with this month's APE in a navy pill and
 *   three tiles — *Set appointment*, *Sales meeting*, and *Submission polis* on navy — each a month's count over
 *   *≈ n/week*. Step 5 is gone; its two rates are step 4's.
 * - **Sliders and steppers** (UI-016): the APE target, the savings target and the case size on a `SliderWithValue`,
 *   whose value opens a field for an exact amount; the two rates and the commission on a `StepperRow`, 5 points a
 *   press. *Appointment to meeting*, the owner's name.
 * - **One commitment sentence, from the result card's own names** (UI-017).
 * - **The save is always in reach** (UI-015, UI-018): the shared floating pill above the tab bar below 1024px, the
 *   foot of the sticky right column from 1024px (UI-022).
 * - **The save state compares, it does not remember** (UI-019): `useSaveState` against the plan as saved, so a mode
 *   switched and back, or a value changed and changed back, reads *Tersimpan* again.
 * - **Step 2's two prefilled figures look alike and look editable** (UI-020): a white pill in normal ink with ✎, the
 *   ⚡ where the figure fills itself in.
 * - **No description pill under *Sales meeting*** (UI-021): on a tablet and a desktop an ⓘ beside a result tile says
 *   which of the office's activities it counts, where that differs from its name; on a phone nothing.
 * - **Two columns on a desktop** (UI-022): the four steps on the left; the result, the commitment and the save in a
 *   sticky right column.
 *
 * **Below 1024px and from 1024px are two arrangements of the same parts** (`useMediaQuery`, the rules' *render a
 * separate variant for the affected range*), so the reading order is the order on the screen at both, and one save
 * status is the live region at either.
 *
 * **The server is still the only source of the numbers** (P8-T3 AC-2). The screen holds no copy of the cascade: every
 * change asks `POST /goals/:period/preview`, which works the plan out by the formula a save uses and writes nothing,
 * and the figures on screen are its answer. While the inputs are the saved plan's, they are the read's.
 *
 * **Whose plan is the page's to say** (P11-T7 AC-5, AC-6). `/goals` renders it with no subject: the reader's own
 * plan. A coachee's *Goal Setting* tab renders it with one, and every read, preview and save go to `?for=` — the save
 * is the coachee's goal at once, carries the leader's name, and tells the coachee (ADR-0046).
 *
 * What stays beyond the revision is what a requirement needs: *Set by your leader* (ADR-0046), the provenance marker
 * on the APE already produced (ADR-0063 §5), the disclaimer (L-29), the target-passed state (ADR-0047) — and **a figure
 * the office uploaded is not typed over** (P9-T6): it wears the same pill, with no ✎, and its ⓘ says whose it is.
 *
 * **Its words are the catalogue's** (`i18n/messages/goals.tsx`; the marker's `goal-words.ts`; the save state's and the
 * ⚡'s `ui-v1.ts`), every figure in the reader's figures (`useFigureLanguage()`). The activities a tile's ⓘ names are
 * the office's, as typed.
 */

/** How long the screen waits after the last change before it asks what the plan would be. A slider moves fast. */
const PREVIEW_DELAY_MS = 250;

/**
 * **The tracks' reach** (UI-016), in rupiah: where a thumb at the end stands. An exact amount may be typed past the end
 * (`exactMax`); the server bounds what it stores. The steps are what a thumb moves by.
 */
const TRACK = {
  annualApe: { min: 0, max: 1_000_000_000, step: 10_000_000 },
  savings: { min: 0, max: 500_000_000, step: 5_000_000 },
  caseSize: { min: 1_000_000, max: 60_000_000, step: 500_000 },
} as const;

/**
 * **The steppers' bounds** (UI-016: 5 points a press, up to 100%). **From 5, not 0**: a rate of nothing cannot make a
 * plan (`GOAL_INVALID_ASSUMPTION`), so a press that reaches it would only reach a refusal.
 */
const RATE = { min: 5, max: 100, step: 5 } as const;

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
  const t = useMessages(goalsMessages);
  const confirmed = useMessages(confirmationMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const below = useMediaQuery(['phone', 'tablet']);
  const forId = subject?.membershipId;
  /** Whose plan the sentences say: the reader's, or a coachee's in their pronoun. */
  const voice = voiceOf(subject ? PRONOUN_FORMS[subject.pronoun] : undefined);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalInputs | null>(null);
  /** The figures on screen: the read's, then each preview's. */
  const [shown, setShown] = useState<GoalPreview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [previewError, setPreviewError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  /** *Goal saved ✓* once *Save goal* lands (P18.95-T1 AC-6; the shared toast, UI-070). */
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    if (period === null) return;
    setError(null);
    try {
      const next = await readGoal(period, forId);
      setGoal(next);
      setDraft(goalInputsOf(next));
      setShown(previewOf(next));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [period, forId]);

  useEffect(() => { void load(); }, [load]);

  /** The plan as saved — what the save state compares the form with (UI-019). `null` until it is read. */
  const saved = useMemo(() => (goal ? goalInputsOf(goal) : null), [goal]);

  /*
   * **Every change asks the server what the plan would be** (UI-014, UI-017: *updates live*), once the changes pause.
   * The inputs back at the saved plan's are the read's figures again, and nothing is asked. An answer that arrives after
   * a later change is dropped. **A 400** — a figure the server cannot take, a month count of nothing — is a plan that
   * cannot be worked out, said in the result card as an unusable assumption is; anything else is a banner, and the
   * figures stay as they were.
   */
  useEffect(() => {
    if (period === null || !goal || !draft) return;
    if (sameValue(draft, goalInputsOf(goal))) {
      setShown(previewOf(goal));
      setPreviewError(null);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      previewGoal(period, draft, forId).then(
        (next) => {
          if (!current) return;
          setShown(next);
          setPreviewError(null);
        },
        (err: unknown) => {
          if (!current) return;
          if (err instanceof ApiRequestError && err.status === 400) {
            setShown((before) => (before ? { ...before, projected: null } : before));
            setPreviewError(null);
          } else {
            setPreviewError(toDisplayError(err));
          }
        },
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [draft, goal, period, forId]);

  /*
   * **The shared save state** (UI-019): *Belum disimpan* while the form differs from the plan as saved, *Tersimpan ✓*
   * when it does not — and *Belum disimpan* for a plan nobody has saved yet, whose figures are only the office's
   * defaults. Leaving with changes asks first; leaving defaults nobody touched does not.
   */
  const changed = draft !== null && saved !== null && !sameValue(draft, saved);
  const savedOnce = goal?.savedAt != null;
  const { state, guard } = useSaveState(draft, saved, {
    saving: busy,
    warnOnLeave: changed,
    compare: (a, b) => savedOnce && sameValue(a, b),
  });

  /** One write for the whole plan (P8-T3): the server answers what it stored, and the screen shows that. */
  async function commit() {
    if (period === null || !draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveGoal(period, draft, forId);
      setGoal(result);
      setDraft(goalInputsOf(result));
      setShown(previewOf(result));
      show(confirmed.goalSaved);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!goal || !draft || !shown) {
    return (
      <>
        {error && <ErrorBanner {...error} />}
        {!error && <SkeletonCards count={5} label={t.loading({ who: voice })} />}
      </>
    );
  }

  const set = (patch: Partial<GoalInputs>) => setDraft({ ...draft, ...patch });
  const projected = shown.projected;
  const mine = !subject;
  const byLeader = mine
    && goal.savedByMembershipId !== null
    && goal.savedByMembershipId !== me?.membership?.membershipId;
  const numbers = activityNumbers(config, goal.cascadeBinding);
  const names = activityNames(config, goal.cascadeBinding);
  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);

  /*
   * **A figure the office uploaded is not the reader's to type** (P9-T6; ADR-0063 §5), and **nobody types somebody
   * else's** (ADR-0075, ADR-0058): the same pill, in the same ink, with no ✎ — and its ⚡ and ⓘ say whose it is.
   */
  const ownFigure = shown.achieved.provenance === 'self_reported';
  const producedTypable = ownFigure && mine;
  const produced = producedFrom(shown.achieved, 'year', subject?.pronoun, figures, language);

  const monthsField = (
    <PillDecimal
      id="goal-months"
      label={t.monthsLeftThisYear}
      // The ⚡ while the figure is the office's calendar (UI-020, D-25); gone once it is typed over.
      marker={draft.monthsLeft === null ? <AutoMarker name={t.monthsLeftThisYear} /> : null}
      value={draft.monthsLeft ?? shown.monthsLeft}
      unit={t.months}
      onValueChange={(monthsLeft) => set({ monthsLeft })}
      layout={below ? 'row' : 'stacked'}
    />
  );
  const producedField = producedTypable ? (
    <PillMoney
      id="goal-achieved"
      label={t.produced}
      marker={null}
      value={draft.apeAchievedMinor}
      onChange={(apeAchievedMinor) => set({ apeAchievedMinor })}
      layout={below ? 'row' : 'stacked'}
    />
  ) : (
    <PillReadOnly
      label={t.produced}
      marker={ownFigure
        ? <TippedGlyph glyph="ⓘ" name={produced} tip={produced} align="fit" className="-my-2 align-middle" />
        : <AutoMarker name={t.produced} explanation={produced} />}
      value={money(shown.achieved.minor)}
      layout={below ? 'row' : 'stacked'}
    />
  );

  const stepOne = (
    <Step n={1} title={mine ? t.target.mine : t.target.theirs} term="APE">
      {/*
        * **Two segments, both visible** (`:2865-2868`), sharing the track on a phone (P18.95-T5 AC-7). Switching and
        * switching back leaves the plan as saved (UI-019): both targets are kept in either mode.
        */}
      <Segmented
        phoneLayout="wrap"
        label={mine ? t.how.mine : t.how.theirs}
        tabs={[
          { id: 'direct', label: t.modes.direct },
          { id: 'from_savings', label: t.modes.fromSavings },
        ]}
        active={draft.mode}
        onSelect={(mode) => set({ mode: mode as GoalMode })}
      >
        {(mode) => (mode === 'direct' ? (
          <RupiahSlider
            label={t.annualApe}
            track={TRACK.annualApe}
            value={draft.annualApeTargetMinor}
            onChange={(annualApeTargetMinor) => set({ annualApeTargetMinor })}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <RupiahSlider
              label={t.annualSavings}
              track={TRACK.savings}
              value={draft.savingsTargetMinor}
              onChange={(savingsTargetMinor) => set({ savingsTargetMinor })}
            />
            {/* The hint: an ⓘ beside the label on a phone, a line under the row from 768px (the report's Appendix A). */}
            <StepperRow
              label={t.commissionRate}
              value={draft.commissionRatePct}
              onChange={(commissionRatePct) => set({ commissionRatePct })}
              min={RATE.min}
              max={RATE.max}
              step={RATE.step}
              info={<PhoneTip text={t.commissionHint} />}
            />
            <p className="text-sm text-muted max-md:hidden">{t.commissionHint}</p>
            {projected && (
              <GoalTile className="mt-1" variant="insight" label={t.apeTargetOf} value={money(projected.annualApeTargetMinor)} />
            )}
          </div>
        ))}
      </Segmented>
    </Step>
  );

  const stepTwo = (
    <Step n={2} title={mine ? t.progress.mine : t.progress.theirs}>
      {/*
        * **`null` months means *use the office's calendar***, and that is what is sent unless the figure is typed over:
        * a stored divisor goes stale (client PRD §17). Clearing the field goes back to the calendar.
        */}
      {below ? (
        <>
          {monthsField}
          {producedField}
          {projected && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <GoalTile label={t.remaining} value={money(projected.remainingApeMinor)} />
              <GoalTile variant="insight" label={t.monthlyTarget} value={money(projected.monthlyApeTargetMinor)} />
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-4 items-end gap-2.5">
          {monthsField}
          {producedField}
          {projected && <GoalTile label={t.remaining} value={money(projected.remainingApeMinor)} />}
          {projected && <GoalTile variant="insight" label={t.monthlyTarget} value={money(projected.monthlyApeTargetMinor)} />}
        </div>
      )}
    </Step>
  );

  const caseSizeSlider = (
    <RupiahSlider
      label={t.caseSize}
      track={TRACK.caseSize}
      value={draft.caseSizeMinor}
      onChange={(caseSizeMinor) => set({ caseSizeMinor })}
      // The prototype's 💡 tip (`Overall.html:2971`), behind an ⓘ beside the label at every size, as both mockups draw it.
      info={<TippedGlyph glyph="ⓘ" name={t.caseSizeTip} tip={t.caseSizeTip} align="fit" className="-my-2" />}
    />
  );
  const policyTiles = projected && (
    <>
      <GoalTile label={t.policiesPerMonth} value={formatNumber(projected.policiesPerMonth, {}, figures)} unit={t.policies} />
      {/* One decimal (ADR-0160 §5): six a month is *≈ 1,4*. */}
      <GoalTile label={t.policiesPerWeek} value={`≈ ${formatNumber(projected.policiesPerWeek, { maxDecimals: 1 }, figures)}`} />
    </>
  );
  const stepThree = (
    <Step n={3} title={t.toPolicies}>
      {below ? (
        <>
          {caseSizeSlider}
          {policyTiles && <div className="mt-3 grid grid-cols-2 gap-2">{policyTiles}</div>}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
          {caseSizeSlider}
          {policyTiles}
        </div>
      )}
    </Step>
  );

  /*
   * **The two rates, 5 points a press** (UI-016): *Appointment to meeting* (the owner's name, as the ratio *Set
   * appointment to meeting*) and *Closing rate*. Unsaved, each opens on the office's benchmark (ADR-0160 §3). Side by side
   * on a desktop, one under the other below it.
   */
  const stepFour = (
    <Step n={4} title={t.assumptions}>
      <div className={cn('grid gap-2', !below && 'grid-cols-2')}>
        <StepperRow
          label={t.appointmentToMeeting}
          value={draft.leadsToApptPct}
          onChange={(leadsToApptPct) => set({ leadsToApptPct })}
          min={RATE.min}
          max={RATE.max}
          step={RATE.step}
        />
        <StepperRow
          label={t.closingRate}
          value={draft.closingRatePct}
          onChange={(closingRatePct) => set({ closingRatePct })}
          min={RATE.min}
          max={RATE.max}
          step={RATE.step}
        />
      </div>
    </Step>
  );

  const result = (
    <ResultCard
      title={t.activityTarget}
      pill={projected && !projected.targetMet ? money(projected.monthlyApeTargetMinor) : null}
    >
      {/*
        * **Passing the target replaces the counts rather than printing zeroes** (ADR-0047): *contact 0 leads* read as
        * this month's plan is an instruction to stop working, printed to the best producer in the office.
        */}
      {projected?.targetMet ? (
        <p className="rounded-row bg-card px-3 py-2.5 text-md text-ink">
          {t.passed({ who: voice, strong: (words) => <strong>{words}</strong> })}
        </p>
      ) : projected ? (
        <div className="grid grid-cols-3 gap-2">
          <ResultTile
            label={LABEL.leads}
            n={formatNumber(projected.leadsPerMonth, {}, figures)}
            week={t.perWeek({ n: formatNumber(projected.leadsPerWeek, { maxDecimals: 1 }, figures) })}
            counts={countsOf(names.leads, LABEL.leads)}
          />
          <ResultTile
            label={LABEL.appointments}
            n={formatNumber(projected.appointmentsPerMonth, {}, figures)}
            week={t.perWeek({ n: formatNumber(projected.appointmentsPerWeek, { maxDecimals: 1 }, figures) })}
            counts={countsOf(names.appointments, LABEL.appointments)}
          />
          <ResultTile
            hero
            label={LABEL.closings}
            n={formatNumber(projected.policiesPerMonth, {}, figures)}
            week={t.perWeek({ n: formatNumber(projected.policiesPerWeek, { maxDecimals: 1 }, figures) })}
            counts={countsOf(names.closings, LABEL.closings)}
          />
        </div>
      ) : (
        <p className="rounded-row bg-card px-3 py-2.5 text-md text-alert">{t.unworkable}</p>
      )}
    </ResultCard>
  );

  /*
   * The prototype's 🔗 tip, with the office's own numbers in place of its literal *#3, #4, #6* (invariant §4): display
   * order read from configuration by code. **A desktop's alone** since UI V1 (the report's Appendix A: removed on a phone
   * and a tablet), under the result card. Nothing until the configuration has answered.
   */
  const mapsTo = numbers.leads !== null && numbers.appointments !== null && numbers.closings !== null ? (
    <p className="flex items-start gap-2 px-1 text-sm leading-relaxed text-muted">
      <span aria-hidden="true" className="shrink-0">🔗</span>
      <span>{t.mapsTo({ numbers: [numbers.leads, numbers.appointments, numbers.closings].map(hashes).join(', ') })}</span>
    </p>
  ) : null;

  /*
   * **The one inverted panel** (`.commit-card`): navy, every figure amber. Its sentence is the result card's figures
   * under the result card's names (UI-017). The disclaimer (L-29): a footnote on a desktop, an ⓘ in the header on a
   * tablet, nothing on a phone (the report's Appendix A).
   */
  const commitment = (
    <div className="rounded-lg bg-navy px-4 py-3.5 text-sidebar-text">
      <div className="flex items-center gap-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-amber">
          {t.commitment({ mine, date: goal.savedAt ? formatDay(goal.savedAt, figures) : null })}
        </h2>
        {below && (
          <TippedGlyph
            glyph="ⓘ"
            name={t.disclaimer}
            tip={t.disclaimer}
            align="fit"
            className="-my-2 max-md:hidden"
            face="text-on-navy-muted"
          />
        )}
      </div>
      {projected && !projected.targetMet && (
        <p className="mt-1.5 text-[0.9375rem] font-medium leading-relaxed text-white">
          {t.pledge({
            strong: (words) => <Figure>{words}</Figure>,
            monthly: money(projected.monthlyApeTargetMinor),
            annual: money(projected.annualApeTargetMinor),
            stages: [
              { n: formatNumber(projected.leadsPerMonth, {}, figures), label: LABEL.leads },
              { n: formatNumber(projected.appointmentsPerMonth, {}, figures), label: LABEL.appointments },
              { n: formatNumber(projected.policiesPerMonth, {}, figures), label: LABEL.closings },
            ],
          })}
        </p>
      )}
      {!below && <p className="mt-2 text-sm text-sidebar-text/70">{t.disclaimer}</p>}
    </div>
  );

  /* The coaching tab's footer, verbatim (`Overall.html:4327`): the Summary, this tab and the session read one goal. */
  const inSync = !mine && <p className="px-1 text-xs leading-relaxed text-muted">{t.inSync}</p>;

  const banners = (
    <>
      {error && <ErrorBanner {...error} />}
      {previewError && <ErrorBanner {...previewError} />}
      {/*
        * **Who set this, when it was not you** (ADR-0046): a leader saves a downline's goal directly, and what the agent
        * is owed is knowing. On a coachee's tab it would describe the reader to themselves.
        */}
      {byLeader && (
        <Card density="compact" className="border-amber/40 bg-amber/5">
          <p className="text-md text-navy">
            {t.setByLeader({
              strong: (words) => <strong>{words}</strong>,
              date: goal.savedAt ? formatDayLong(goal.savedAt, figures) : null,
            })}
          </p>
        </Card>
      )}
    </>
  );

  return (
    <>
      {guard}
      {below ? (
        /*
         * **A phone and a tablet** (UI-014, UI-015): the answer, the four steps, the commitment — about 1.8 screens at
         * 375px — and the floating save pill above the tab bar at every scroll position, room left under the last line.
         */
        <div className={cn('mx-auto flex max-w-[51.25rem] flex-col gap-2.5', FLOATING_SAVE_ROOM)}>
          {banners}
          {result}
          {stepOne}
          {stepTwo}
          {stepThree}
          {stepFour}
          {commitment}
          {inSync}
          {/* `data-action-bar` lifts the shell's toast above the pill on a phone (`toast.tsx`). */}
          <div data-action-bar="">
            <FloatingSavePill state={state} label={t.save} onSave={() => void commit()} />
          </div>
        </div>
      ) : (
        /*
         * **A desktop** (UI-022): the four steps on the left (~60%), and on the right (~40%) the result, the 🔗 line,
         * the commitment and the save, sticky 24px from the top while the left column scrolls. The title's left edge is
         * the cards' (the page's own column, no centred measure).
         */
        <div className="flex flex-col gap-3">
          {banners}
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-4">
            <div className="flex min-w-0 flex-col gap-2.5">
              {stepOne}
              {stepTwo}
              {stepThree}
              {stepFour}
            </div>
            <div className="sticky top-6 flex min-w-0 flex-col gap-2.5" data-goal-aside="">
              {result}
              {mapsTo}
              {commitment}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-2.5">
                <SaveStateLabel state={state} />
                <Button
                  className="h-12 rounded-pill px-5 font-bold"
                  onClick={() => void commit()}
                  disabled={busy}
                >
                  {t.save}
                </Button>
              </div>
              {inSync}
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  );
}

/** A goal's figures as its read answered them, in the preview's shape. */
function previewOf(goal: Goal): GoalPreview {
  return {
    period: goal.period,
    monthsLeft: goal.monthsLeft,
    monthsLeftIsOverride: goal.monthsLeftIsOverride,
    achieved: goal.achieved,
    projected: goal.projected,
  };
}

/**
 * A figure inside the commitment sentence: amber on navy (6.3:1, pinned in `a11y.spec.tsx`). Still a `<strong>`: the
 * emphasis is semantic, and a reader who cannot see the colour still hears it.
 */
function Figure({ children }: { children: ReactNode }) {
  return <strong className="font-extrabold text-amber">{children}</strong>;
}

/**
 * **The orange result card** (UI-014): its heading, this month's APE in a navy pill, and what it holds. **Words on the
 * accent are navy** (parity I-542: white on it is 2.38:1).
 */
function ResultCard({ title, pill, children }: { title: string; pill: string | null; children: ReactNode }) {
  return (
    <section aria-labelledby="goal-result-title" data-goal-result="" className="rounded-lg bg-amber p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="goal-result-title" className="text-[0.9375rem] font-bold text-navy">{title}</h2>
        {pill && <span className="whitespace-nowrap rounded-pill bg-navy px-2.5 py-0.5 text-xs font-bold text-card">{pill}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * **One of the result card's three tiles** (UI-014): the month's count 30px/800, the stage's name 12px/700, *≈ n/week*
 * 12px. *Submission polis* (`hero`) on navy with its figure amber. `counts` is which of the office's activities the stage
 * counts, where that differs from its name (UI-021): an ⓘ from 768px, nothing on a phone.
 */
function ResultTile({ label, n, week, counts, hero = false }: {
  label: string; n: string; week: string; counts?: string; hero?: boolean;
}) {
  return (
    <div
      data-result-tile=""
      data-hero={hero ? 'true' : undefined}
      className={cn('flex min-w-0 flex-col rounded-row px-2.5 py-2', hero ? 'bg-navy text-card' : 'bg-card text-ink')}
    >
      <span className={cn('text-[1.875rem] font-extrabold leading-tight tabular-nums', hero && 'text-amber')}>{n}</span>
      <span className="flex items-start gap-0.5 text-xs font-bold leading-snug">
        <span className="min-w-0">{label}</span>
        {counts && (
          <TippedGlyph
            glyph="ⓘ"
            name={counts}
            tip={counts}
            align="fit"
            className="-my-1.5 max-md:hidden"
            face={hero ? 'text-on-navy-muted' : undefined}
          />
        )}
      </span>
      <span className={cn('mt-auto pt-0.5 text-xs font-medium', hero ? 'text-on-navy-muted' : 'text-muted')}>{week}</span>
    </div>
  );
}

/**
 * **A step's tile** (UI-016: the label 13px/500, the figure 22px/800): plain on the warm grey, or `insight`, the
 * number the step is for, in the accent's tint and its deep ink (the prototype's amber on its tint fails contrast).
 */
function GoalTile({ label, value, unit, variant = 'plain', className }: {
  label: string; value: string; unit?: string; variant?: 'plain' | 'insight'; className?: string;
}) {
  return (
    <div
      data-variant={variant}
      className={cn('min-w-0 rounded-row px-3 py-2.5', variant === 'plain' ? 'bg-base' : 'bg-amber/[0.14]', className)}
    >
      <span className="block text-base font-medium text-muted">{label}</span>
      <span className={cn('text-[1.375rem] font-extrabold leading-tight', variant === 'plain' ? 'text-ink' : 'text-amber-deep')}>
        {value}
        {unit ? <span className="ml-1 text-base font-semibold">{unit}</span> : null}
      </span>
    </div>
  );
}

/**
 * Money on a slider (UI-016), in **rupiah** on the track and **sen** to the server — the one place the conversion
 * happens, whole rupiah either way. The value reads compact, *Rp 500 jt*; an exact amount is typed past the track's end
 * if it must be.
 */
function RupiahSlider({ label, track, value, onChange, info }: {
  label: string;
  track: { min: number; max: number; step: number };
  value: number;
  onChange: (minor: number) => void;
  info?: ReactNode;
}) {
  const figures = useFigureLanguage();
  return (
    <SliderWithValue
      label={label}
      value={toMajor(value)}
      onChange={(major) => onChange(toMinor(Math.round(major)))}
      min={track.min}
      max={track.max}
      step={track.step}
      exactMin={0}
      exactMax={Number.MAX_SAFE_INTEGER}
      format={(major) => formatRupiahCompact(toMinor(major), {}, figures)}
      info={info}
    />
  );
}

/** The pill a prefilled figure stands in (UI-020): white, 48px, a 1.5px line, the figure 16px/700 in normal ink. */
const PILL = cn(
  'inline-flex h-12 items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-card px-3.5 text-lg font-bold text-ink',
  'focus-within:border-amber focus-within:ring-2 focus-within:ring-amber focus-within:ring-offset-1',
);

/** Where a pill's label goes: on its left in a 56px row below 1024px, above it from 1024px (UI-020). */
function PillLine({ layout, label, children }: { layout: 'row' | 'stacked'; label: ReactNode; children: ReactNode }) {
  return layout === 'row' ? (
    <div className="flex min-h-14 items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1 text-md font-medium leading-snug text-ink">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  ) : (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1 text-base font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * **The months left** (UI-020): *2,1 bulan* as a real figure, not a pale placeholder, and a field the moment it is
 * tapped — a comma or a point (ADR-0167 §1), a numeric keyboard, 16px. Emptied, it goes back to the office's calendar
 * (`null`).
 */
function PillDecimal({ id, label, marker, value, unit, onValueChange, layout }: {
  id: string; label: string; marker: ReactNode; value: number; unit: string;
  onValueChange: (value: number | null) => void; layout: 'row' | 'stacked';
}) {
  const figures = useFigureLanguage();
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <PillLine layout={layout} label={<><label htmlFor={id}>{label}</label>{marker}</>}>
      <span className={cn(PILL, layout === 'row' ? 'w-36' : 'w-full')}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={typing ?? formatNumber(value, { maxDecimals: 1 }, figures)}
          onFocus={() => setTyping(formatDecimalInput(value, figures))}
          onBlur={() => setTyping(null)}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.,]/g, '');
            setTyping(next);
            if (next.trim() === '') return onValueChange(null);
            const read = parseDecimal(next);
            if (Number.isFinite(read)) onValueChange(read);
          }}
          className="w-full min-w-0 bg-transparent text-right font-bold text-ink outline-none [font-size:16px]"
        />
        <span className="shrink-0 font-bold">{unit}</span>
        <LineIcon name="pencil" className="h-4 w-4 shrink-0 text-signal-grey" />
      </span>
    </PillLine>
  );
}

/**
 * **The APE already produced, the member's own** (UI-020): short — *Rp 290 jt* — until tapped, then every digit,
 * grouped as it is typed (*290.000.000*), the currency mark beside it. Digits only, in either language's grouping.
 */
function PillMoney({ id, label, marker, value, onChange, layout }: {
  id: string; label: string; marker: ReactNode; value: number; onChange: (minor: number) => void;
  layout: 'row' | 'stacked';
}) {
  const figures = useFigureLanguage();
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <PillLine layout={layout} label={<><label htmlFor={id}>{label}</label>{marker}</>}>
      <span className={cn(PILL, layout === 'row' ? 'w-40' : 'w-full')}>
        {typing !== null && <span aria-hidden="true" className="shrink-0 font-bold text-muted">{moneyPrefix(figures)}</span>}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={typing ?? formatRupiahCompact(value, {}, figures)}
          onFocus={() => setTyping(groupDigits(toMajor(value), figures))}
          onBlur={() => setTyping(null)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            const major = parseDigits(digits);
            setTyping(digits === '' ? '' : groupDigits(major, figures));
            onChange(toMinor(major));
          }}
          className="w-full min-w-0 bg-transparent text-right font-bold text-ink outline-none [font-size:16px]"
        />
        <LineIcon name="pencil" className="h-4 w-4 shrink-0 text-signal-grey" />
      </span>
    </PillLine>
  );
}

/**
 * **The office's figure** (P9-T6): the same pill, the same ink, no ✎ — nothing typed here would be read. A `<dl>`, so
 * the label names the figure.
 */
function PillReadOnly({ label, marker, value, layout }: {
  label: string; marker: ReactNode; value: string; layout: 'row' | 'stacked';
}) {
  return (
    <dl className={layout === 'row' ? 'flex min-h-14 items-center justify-between gap-2' : 'flex min-w-0 flex-col gap-1.5'}>
      <dt
        className={cn(
          'flex min-w-0 items-center gap-1 font-medium leading-snug',
          layout === 'row' ? 'text-md text-ink' : 'text-base text-muted',
        )}
      >
        {label}
        {marker}
      </dt>
      <dd className={cn(PILL, 'shrink-0', layout === 'row' ? 'w-40 justify-end' : 'w-full justify-end')}>{value}</dd>
    </dl>
  );
}

/**
 * **The numbers the log screen shows beside each cascade stage's types** (P10.1-T6 AC-11): their display order in the
 * office's published configuration, found by the codes the office's activity binding names for the stage
 * (`goal.cascadeBinding`, ADR-0163; invariant §4). `null` until the configuration arrives, and for a stage it holds no
 * live type for: an archived type, still counted for its history, is not numbered.
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

/**
 * The plan's three stages, in the client's words (ADR-0160 §4): each tile's name, and the commitment's (UI-017) — one
 * constant, so the two cannot drift. Kept English in both languages (§A.6; UI-006).
 */
const LABEL = {
  leads: kept('Set appointment'), appointments: kept('Sales meeting'), closings: kept('Submission polis'),
} as const;

/**
 * **The names of the activities each stage counts** (P18.95-T5 AC-5): the office's own label for every code its
 * activity binding names for the stage, as Log Activity prints it — read from the published configuration by code
 * (invariant §4), so a renamed activity renames its ⓘ. A code with no active type behind it is not named; `null`
 * until the configuration arrives.
 */
function activityNames(config: TenantConfig | null, binding: Goal['cascadeBinding']) {
  const types = (config?.activity ?? [])
    .filter((category) => category.status === 'active')
    .flatMap((category) => category.types)
    .filter((type) => type.status === 'active');
  const namesOf = (codes: readonly string[] | undefined) => {
    const found = (codes ?? [])
      .map((code) => types.find((type) => type.code === code)?.label.trim())
      .filter((label): label is string => Boolean(label));
    return found.length ? found : null;
  };
  return {
    leads: namesOf(binding?.leads),
    appointments: namesOf(binding?.appointments),
    closings: namesOf(binding?.closings),
  };
}

/**
 * What a tile's ⓘ says (UI-021): the activities its stage counts, *A + B* for a stage that counts two — **none when it
 * would only repeat the tile's name** (the seed's *Submission polis* under *Submission polis*), and none while the names
 * are unknown. On the seed only *Sales meeting* has one: *Melakukan presentasi penjualan untuk calon atau existing
 * nasabah*, the description pill the report removed.
 */
function countsOf(names: readonly string[] | null, label: string): string | undefined {
  if (names === null) return undefined;
  const said = names.join(' + ');
  return said.toLocaleLowerCase() === label.toLocaleLowerCase() ? undefined : said;
}

/**
 * One of the four steps: a filled navy ordinal (the mockups' `.num`), a question 16px/700, and what answers it. The
 * badge is `aria-hidden` (`NumberBadge`): the heading beside it is the name. `term` is a term the title uses, whose ⓘ
 * follows it (P18.95-T9 AC-3) — beside the heading, so its name stays the title.
 */
function Step({ n, title, term, children }: { n: number; title: string; term?: TermKey; children: ReactNode }) {
  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
      <NumberBadge n={n} size="md" className="border-navy bg-navy text-card" />
      {title}
    </h2>
  );
  return (
    <Card density="compact" className="px-4 py-3.5">
      {term ? (
        <div className="flex items-center gap-1">
          {heading}
          <TermTip term={term} />
        </div>
      ) : heading}
      <div className="mt-2.5">{children}</div>
    </Card>
  );
}
