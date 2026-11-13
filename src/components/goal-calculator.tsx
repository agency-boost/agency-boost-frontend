'use client';

import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode,
} from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
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
import { goalWordMessages, voiceOf } from '@/i18n/messages/goal-words';
import { goalsMessages } from '@/i18n/messages/goals';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import {
  formatDay, formatDayLong, formatDecimalInput, formatMonth, formatNumber, formatRupiahCompact, moneyPrefix,
  parseDecimal,
} from '@/lib/format';
import {
  automaticOf, caretAfterDigits, goalBodyOf, goalInputsOf, groupDigits, parseDigits, previewGoal, producedFrom, readGoal,
  saveGoal, toMajor, toMinor, type Goal, type GoalInputs, type GoalMode, type GoalPreview,
} from '@/lib/goals';
import { useMediaQuery } from '@/lib/use-media-query';
import { useSession } from '@/lib/session';
import { useTenantConfig, type TenantConfig } from '@/lib/tenant-config-cache';

/**
 * The goal calculator (P8-T3) — `/goals`, and the same tool inside a coachee's *Goal Setting* tab (P11-T7 AC-5).
 *
 * **Since UI V1 (P18.11-T5, 2026-10-30) the revision is its design** (ADR-0180 §1; the report's UI-014 to UI-022 and
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
 * - **Step 2's two prefilled figures are one field, drawn alike** (UI-020 + UI-122, *Conflicts* row 146): a white 48px
 *   pill in normal ink, the same width, **no ✎** — the whole pill is the input — each with its line under its name.
 *   The months read *2,1 bulan*; **the APE produced reads compact, *Rp 400 Jt*, and is typed in full, *400.000.000*,
 *   grouped as it is typed** (P19.11-T4, UX-7 and UXQ7's default, reversing ADR-0230 §2's full figure at rest). On a
 *   laptop the two side by side, then the two tiles (UI-114).
 * - **The member types over the automatic APE** (P19.8-T5; D-36, MOB UI-190, ADR-0230): prefilled with the office's
 *   figure, *⚡ Otomatis · per Okt 2026* — also when the office uploaded it — and, typed over, *Diubah oleh Anda* with
 *   *↶ Pakai otomatis (Rp 67 Jt)*, which puts the office's figure back. On a phone the label takes the free width and
 *   the pill is 150px (MOB UI-191).
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
 * the office uploaded is not a coach's to type over** (ADR-0183, kept by ADR-0230 §7): on a coachee's tab it is plain
 * figures, no pill frame and no ✎, so it does not look like a field; its line says whose it is.
 *
 * **Step 2's two pills, since the staging review of 2026-10-31** (the product owner tapped *2 bulan ✎* on a phone and
 * typed *3*, and got *23*): the whole pill — the figure and the unit; the ✎ went with UI-122 (P19.1-T4) — is the field's
 * target, and a tap selects the whole figure, so what is typed replaces it. **The APE produced is the member's to type,
 * always** (ADR-0230), and a leader's on the coachee's tab while the office holds no figure (ADR-0183; the server stores
 * it on the same rule, `typedApeOf`). **It is the member's estimate** (UI-157, ADR-0195): one value with the Summary's
 * *Isi produksi sementara* — *Diubah oleh Anda* here, *perkiraan Anda* there — and **the newer of it and the office's
 * figure is the one in force** (ADR-0230 §6): an upload written after it replaces it.
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
  const words = useMessages(goalWordMessages);
  const confirmed = useMessages(confirmationMessages);
  const autoWords = useMessages(uiV1Messages);
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
  /** *Goal saved ✓* once *Save goal* lands (P18.7-T1 AC-6; the shared toast, UI-070). */
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
      previewGoal(period, goalBodyOf(draft, goalInputsOf(goal)), forId).then(
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
      // The APE produced only when this edit changed it (S1): a figure the member typed since the read is kept.
      const result = await saveGoal(period, goalBodyOf(draft, saved), forId);
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
   * **Step ②'s APE produced** (P19.8-T5; D-36, MOB UI-190, ADR-0230). The pill holds **the typed figure in force**, or
   * **the automatic one** — the office's year to date, `null` while it holds none — and is prefilled with it, marked
   * *⚡ Otomatis · per {month}*, also when the office uploaded it. **The member types over it, always**; a leader on the
   * coachee's tab only while the office holds none (ADR-0183, kept by §7), and otherwise reads plain figures.
   */
  const automatic = automaticOf(goal);
  const producedTypable = mine || automatic === null;
  const typedShown = draft.apeAchievedMinor !== null;
  const producedValue = draft.apeAchievedMinor ?? automatic?.minor ?? 0;
  /** Whether this edit changed the figure — the reader's own typing, whoever they are. */
  const producedChanged = saved !== null && draft.apeAchievedMinor !== saved.apeAchievedMinor;
  const typedBy = goal.achieved.provenance === 'self_reported' ? goal.achieved.typedBy : undefined;
  /*
   * **The line under its name** (ADR-0230 §1, §4; MOB UI-191): *Diubah oleh Anda* with a person for a figure the reader
   * typed — on Goal Settings it replaces *perkiraan Anda* — ADR-0183's *Diisi oleh {name}* for a coach's, the member's
   * own estimate on a coachee's tab (*the coach's view labels it as the member's*), and *⚡ Otomatis · per {month}* for
   * the office's, whose ⓘ says who corrected it where somebody did. Nothing with neither: no figure is claimed.
   */
  const producedLine = typedShown ? (
    producedChanged || (mine && !typedBy) ? <FigureLine kind="edited">{t.edited}</FigureLine>
      : typedBy ? <FigureLine kind="typed-by">{words.produced.typedBy({ name: typedBy.name })}</FigureLine>
        : <FigureLine kind="estimate">{words.produced.own({ who: voice })}</FigureLine>
  ) : automatic ? (
    <FigureLine
      kind="auto"
      info={automatic.provenance === 'corrected' ? {
        name: autoWords.auto.why({ name: t.produced }),
        tip: producedFrom(automatic, 'year', subject?.pronoun, figures, language),
      } : undefined}
    >
      {t.automatic({ month: formatMonth(automatic.month, figures) })}
    </FigureLine>
  ) : null;
  /** *↶ Pakai otomatis (Rp 67 Jt)* (ADR-0230 §4): back to the office's figure; none without one. */
  const useAutomatic = producedTypable && typedShown && automatic ? (
    <button
      type="button"
      data-use-automatic=""
      onClick={() => set({ apeAchievedMinor: null })}
      className="inline-flex min-h-8 items-center gap-1 rounded-row px-1 text-base font-semibold text-secondary-ink hover:underline"
    >
      <LineIcon name="undo" className="h-4 w-4" />
      {t.useAutomatic({ amount: money(automatic.minor) })}
    </button>
  ) : null;

  const monthsField = (
    <PillDecimal
      id="goal-months"
      label={t.monthsLeftThisYear}
      // The ⚡ while the figure is the office's calendar (UI-020, D-25); gone once it is typed over.
      line={draft.monthsLeft === null ? <FigureLine kind="auto">{t.automatic({ month: null })}</FigureLine> : null}
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
      line={producedLine}
      after={useAutomatic}
      edited={typedShown}
      value={producedValue}
      onChange={(apeAchievedMinor) => set({ apeAchievedMinor })}
      layout={below ? 'row' : 'stacked'}
    />
  ) : (
    <PillReadOnly
      label={t.produced}
      line={producedLine}
      value={formatRupiahCompact(producedValue, {}, figures)}
      layout={below ? 'row' : 'stacked'}
    />
  );

  const stepOne = (
    <Step n={1} title={mine ? t.target.mine : t.target.theirs} term="APE">
      {/*
        * **Two segments, both visible** (`:2865-2868`), sharing the track on a phone (P18.7-T5 AC-7). Switching and
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
        /*
         * **A laptop** (`goals-desktop-2026-11-02`; UI-114, *Conflicts* row 152): the two fields side by side, then the two
         * result tiles side by side — not four across, which wrapped every label at 1024.
         */
        <>
          <div data-step-two="fields" className="grid grid-cols-2 items-start gap-2.5">
            {monthsField}
            {producedField}
          </div>
          {projected && (
            <div data-step-two="tiles" className="mt-2.5 grid grid-cols-2 gap-2.5">
              <GoalTile label={t.remaining} value={money(projected.remainingApeMinor)} />
              <GoalTile variant="insight" label={t.monthlyTarget} value={money(projected.monthlyApeTargetMinor)} />
            </div>
          )}
        </>
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
        // A laptop (UI-114): the slider across, then its two tiles side by side, so no label wraps more than once.
        <>
          {caseSizeSlider}
          {policyTiles && <div data-step-three="tiles" className="mt-3 grid grid-cols-2 gap-2.5">{policyTiles}</div>}
        </>
      )}
    </Step>
  );

  /*
   * **The two rates, 5 points a press** (UI-016): *Appointment to meeting* (the owner's name, as the ratio *Set
   * appointment to meeting*) and *Closing rate*. Unsaved, each opens on the office's benchmark (ADR-0160 §3). **One under
   * the other at every size** since `goals-desktop-2026-11-02` (UI-114: side by side, *Appointment to meeting* was cut at
   * 1280).
   */
  const stepFour = (
    <Step n={4} title={t.assumptions}>
      <div data-step-four="" className="grid gap-2">
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
    <div className="rounded-lg bg-secondary px-4 py-3.5 text-sidebar-text">
      <div className="flex items-center gap-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-primary-on-secondary">
          {t.commitment({ mine, date: goal.savedAt ? formatDay(goal.savedAt, figures) : null })}
        </h2>
        {below && (
          <TippedGlyph
            glyph="ⓘ"
            name={t.disclaimer}
            tip={t.disclaimer}
            align="fit"
            className="-my-2 max-md:hidden"
            face="text-secondary-muted"
          />
        )}
      </div>
      {projected && !projected.targetMet && (
        <p className="mt-1.5 text-[0.9375rem] font-medium leading-relaxed text-secondary-contrast">
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
        <Card density="compact" className="border-primary/40 bg-primary/5">
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
          {/* The shared floating bar (`ui/floating-bar.tsx`): its own `data-floating-bar` lifts the shell's toast above it. */}
          <FloatingSavePill state={state} label={t.save} onSave={() => void commit()} />
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
  return <strong className="font-extrabold text-primary-on-secondary">{children}</strong>;
}

/**
 * **The orange result card** (UI-014): its heading, this month's APE in a navy pill, and what it holds. **Words on the
 * accent are navy** (parity I-542: white on it is 2.38:1).
 */
function ResultCard({ title, pill, children }: { title: string; pill: string | null; children: ReactNode }) {
  return (
    <section aria-labelledby="goal-result-title" data-goal-result="" className="rounded-lg bg-primary p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="goal-result-title" className="text-[0.9375rem] font-bold text-primary-contrast">{title}</h2>
        {pill && <span className="whitespace-nowrap rounded-pill bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-contrast">{pill}</span>}
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
      className={cn('flex min-w-0 flex-col rounded-row px-2.5 py-2', hero ? 'bg-secondary text-secondary-contrast' : 'bg-card text-ink')}
    >
      <span className={cn('text-[1.875rem] font-extrabold leading-tight tabular-nums', hero && 'text-primary-on-secondary')}>{n}</span>
      <span className="flex items-start gap-0.5 text-xs font-bold leading-snug">
        <span className="min-w-0">{label}</span>
        {counts && (
          <TippedGlyph
            glyph="ⓘ"
            name={counts}
            tip={counts}
            align="fit"
            className="-my-1.5 max-md:hidden"
            face={hero ? 'text-secondary-muted' : undefined}
          />
        )}
      </span>
      <span className={cn('mt-auto pt-0.5 text-xs font-medium', hero ? 'text-secondary-muted' : 'text-muted')}>{week}</span>
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
      className={cn('min-w-0 rounded-row px-3 py-2.5', variant === 'plain' ? 'bg-base' : 'bg-primary/[0.14]', className)}
    >
      <span className="block text-base font-medium text-muted">{label}</span>
      <span className={cn('text-[1.375rem] font-extrabold leading-tight', variant === 'plain' ? 'text-ink' : 'text-primary-deep')}>
        {value}
        {unit ? <span className="ml-1 text-base font-semibold">{unit}</span> : null}
      </span>
    </div>
  );
}

/**
 * Money on a slider (UI-016), in **rupiah** on the track and **sen** to the server — the one place the conversion
 * happens, whole rupiah either way. The value reads compact, *Rp 500 Jt*; an exact amount is typed past the track's end
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

/**
 * The pill a prefilled figure stands in (UI-020): white, 48px, a 1.5px line, the figure 16px/700 in normal ink — 16px
 * so a phone does not zoom on it. A phone's is 12px in from each end (the draft mockup, P19.8-T5).
 */
const PILL = cn(
  'inline-flex h-12 items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-card px-3.5 text-lg font-bold text-ink max-md:px-3',
  'focus-within:border-primary focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-1',
);

/**
 * **The line under a figure's name** (P19.8-T5; MOB UI-190, MOB UI-191; ADR-0230 §1, §4): 12px/600, an icon and its
 * words — ⚡ *Otomatis · per Okt 2026* in the accent's ink for the office's figure, a person and *Diubah oleh Anda* in
 * the second colour's for a figure somebody typed. `info` is an ⓘ after the words where they leave something out: who
 * corrected the office's figure.
 */
function FigureLine({ kind, info, children }: {
  kind: 'auto' | 'edited' | 'typed-by' | 'estimate';
  info?: { name: string; tip: string };
  children: ReactNode;
}) {
  const auto = kind === 'auto';
  return (
    <span
      data-figure-line={kind}
      className={cn(
        'mt-0.5 flex min-w-0 items-center gap-1 text-xs font-semibold leading-snug',
        auto ? 'text-primary-ink' : 'text-secondary-ink',
      )}
    >
      <LineIcon name={auto ? 'bolt' : 'user'} className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
      {info && <TippedGlyph glyph="ⓘ" name={info.name} tip={info.tip} align="fit" className="-my-2" face="text-signal-grey" />}
    </span>
  );
}

/**
 * Where a pill's label goes: on its left in a 56px row below 1024px, above it from 1024px (UI-020). `line` is the line
 * under the label (`FigureLine`), `after` what follows the pill — *↶ Pakai otomatis*, under it on the right.
 *
 * **On a phone the label takes the free width, 15px** (P19.8-T5 AC-6; MOB UI-191: *"label column takes the free width
 * (pill 150px on the right), 15px, max 2 lines + the small ⚡ line"*), so *APE yang sudah dicapai tahun ini* reads in two
 * lines where it was squeezed into four. A tablet's row keeps its size.
 */
function PillLine({ layout, label, line, after, children }: {
  layout: 'row' | 'stacked'; label: ReactNode; line?: ReactNode; after?: ReactNode; children: ReactNode;
}) {
  return layout === 'row' ? (
    <div data-pill-line="">
      <div className="flex min-h-14 items-center justify-between gap-2.5">
        <span className="flex min-w-0 flex-col max-md:flex-1">
          <span className="flex min-w-0 items-center gap-1 text-md font-medium leading-snug text-ink max-md:text-[0.9375rem] max-md:font-normal">
            {label}
          </span>
          {line}
        </span>
        <span className="shrink-0">{children}</span>
      </div>
      {after && <div className="-mt-1 flex justify-end">{after}</div>}
    </div>
  ) : (
    <div data-pill-line="" className="flex min-w-0 flex-col gap-1.5">
      <span className="flex flex-col">
        <span className="flex items-center gap-1 text-base font-medium text-muted">{label}</span>
        {line}
      </span>
      {children}
      {after && <div className="flex justify-end">{after}</div>}
    </div>
  );
}

/**
 * **A tap on a pill selects its whole figure** (the staging review of 2026-10-31), so what is typed replaces it — the
 * owner tapped *2 bulan*, typed *3* and got *23*. After the focus has drawn the raw figure (`typing`), on the next tick:
 * a value written moves the caret to its end, and iOS ignores a selection made inside the focus event. The mouse-up
 * that ends the tap would put the caret back where the finger was, so that one is held.
 */
function useSelectAll() {
  const fresh = useRef(false);
  return {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      fresh.current = true;
      window.setTimeout(() => {
        if (document.activeElement === input) input.setSelectionRange(0, input.value.length);
      }, 0);
    },
    onMouseUp: (e: { preventDefault: () => void }) => {
      if (!fresh.current) return;
      fresh.current = false;
      e.preventDefault();
    },
    onKeyDown: () => { fresh.current = false; },
    onBlur: () => { fresh.current = false; },
  };
}

/**
 * **The whole pill is the field's target** (the staging review of 2026-10-31; UI-122): a `<label>` around the figure and
 * the unit, 48px high, so a tap anywhere on it focuses the field — not only on the figure's own ~48px. **No ✎** (UI-122,
 * *Conflicts* row 146), and **one width for both** (`PILL_WIDTH` in a row — 150px on a phone, MOB UI-191; the column's
 * from 1024px). The field is named by the line's label alone (`aria-labelledby`), never by the unit or the figure the
 * pill also holds. `edited`: a figure the reader typed over the automatic one, its edge in the second colour (the draft
 * mockup's).
 */
const PILL_WIDTH = 'w-40 max-md:w-[9.375rem]';
/**
 * **A row's pill while a long figure is typed in it** (P19.11-T4, UX-7: *nothing is ever clipped*): at least the row's
 * width, and as wide as the figure needs past it — `400.000.000` and `1.200.000.000` whole beside their *Rp*, the label
 * beside it taking what is left — then `PILL_WIDTH` again once it is left.
 */
const PILL_MIN_WIDTH = 'min-w-40 max-md:min-w-[9.375rem] justify-end';

function PillField({ id, layout, edited = false, grow = false, children }: {
  id: string; layout: 'row' | 'stacked'; edited?: boolean; grow?: boolean; children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      data-pill=""
      data-edited={edited ? 'true' : undefined}
      className={cn(
        PILL, 'cursor-text', edited && 'border-secondary', layout === 'row' ? (grow ? PILL_MIN_WIDTH : PILL_WIDTH) : 'w-full',
      )}
    >
      {children}
    </label>
  );
}

/**
 * **The months left** (UI-020): *2,1 bulan* as a real figure, not a pale placeholder, and a field the moment it is
 * tapped — a comma or a point (ADR-0167 §1), a numeric keyboard, 16px. Emptied, it goes back to the office's calendar
 * (`null`).
 */
function PillDecimal({ id, label, line, value, unit, onValueChange, layout }: {
  id: string; label: string; line: ReactNode; value: number; unit: string;
  onValueChange: (value: number | null) => void; layout: 'row' | 'stacked';
}) {
  const figures = useFigureLanguage();
  const [typing, setTyping] = useState<string | null>(null);
  const selectAll = useSelectAll();
  const nameId = useId();
  const lineId = useId();
  return (
    <PillLine layout={layout} label={<label id={nameId} htmlFor={id}>{label}</label>} line={line && <span id={lineId}>{line}</span>}>
      <PillField id={id} layout={layout}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-labelledby={nameId}
          aria-describedby={line ? lineId : undefined}
          value={typing ?? formatNumber(value, { maxDecimals: 1 }, figures)}
          {...selectAll}
          onFocus={(e) => {
            setTyping(formatDecimalInput(value, figures));
            selectAll.onFocus(e);
          }}
          onBlur={() => {
            setTyping(null);
            selectAll.onBlur();
          }}
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
      </PillField>
    </PillLine>
  );
}

/**
 * **The APE produced, typed** (UI-020; P19.8-T5 AC-2, MOB UI-190; P19.11-T4, UX-7 and UXQ7's default): **compact at
 * rest** — *Rp 400 Jt*, *Rp 1,2 M* above the *Jt* range (`formatRupiahCompact`, the one formatter), so it never clips
 * (the screenshot's *Rp 400.000.00…*) — and **the full figure while it is focused**, *400.000.000* beside the currency
 * mark, **grouped while it is typed**, the caret kept after the digit it followed (`caretAfterDigits`); in a row the
 * pill grows while it is, so a long figure is whole (`PILL_MIN_WIDTH`). The stored value is the exact sum typed. Digits
 * only, in either language's grouping; the number keypad. Emptied, or 0, it is no typed figure (`null`): the automatic
 * one again once the field is left.
 */
function PillMoney({ id, label, line, after, edited, value, onChange, layout }: {
  id: string; label: string; line: ReactNode; after?: ReactNode; edited: boolean; value: number;
  onChange: (minor: number | null) => void; layout: 'row' | 'stacked';
}) {
  const figures = useFigureLanguage();
  const [typing, setTyping] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  /** Where the caret goes once the grouped figure is drawn. */
  const caret = useRef<number | null>(null);
  const selectAll = useSelectAll();
  const nameId = useId();
  const lineId = useId();
  const grouped = (minor: number) => groupDigits(toMajor(minor), figures);
  /** Focused: the full figure being typed. Left: the compact one, with its own currency mark. */
  const focused = typing !== null;
  const shown = typing ?? formatRupiahCompact(value, {}, figures);
  /** In a row, the field is as wide as the figure while it is typed, so the pill around it grows to fit (UX-7). */
  const fitted = focused && layout === 'row';

  useLayoutEffect(() => {
    const at = caret.current;
    const field = input.current;
    if (at === null || !field || document.activeElement !== field) return;
    caret.current = null;
    field.setSelectionRange(at, at);
  });

  return (
    <PillLine
      layout={layout}
      label={<label id={nameId} htmlFor={id}>{label}</label>}
      line={line && <span id={lineId}>{line}</span>}
      after={after}
    >
      <PillField id={id} layout={layout} edited={edited} grow={focused}>
        {focused && <span aria-hidden="true" className="shrink-0 font-bold text-ink">{moneyPrefix(figures)}</span>}
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-labelledby={nameId}
          aria-describedby={line ? lineId : undefined}
          value={shown}
          style={fitted ? { width: `${Math.max(shown.length, 1) + 1}ch` } : undefined}
          {...selectAll}
          onFocus={(e) => {
            setTyping(grouped(value));
            selectAll.onFocus(e);
          }}
          onBlur={() => {
            setTyping(null);
            selectAll.onBlur();
          }}
          onChange={(e) => {
            const typed = e.target.value;
            const digits = typed.replace(/\D/g, '');
            const major = parseDigits(digits);
            if (major === 0) {
              // Nothing, or only zeros: no typed figure; what is in the box stays as typed, the caret at its end.
              const kept = digits === '' ? '' : '0';
              caret.current = kept.length;
              setTyping(kept);
              onChange(null);
              return;
            }
            // The digits left of the caret, less the leading zeros the grouping drops, say where it goes back.
            const at = e.target.selectionStart ?? typed.length;
            const leading = digits.length - digits.replace(/^0+/, '').length;
            const before = Math.max(0, typed.slice(0, at).replace(/\D/g, '').length - leading);
            const next = groupDigits(major, figures);
            caret.current = caretAfterDigits(next, before);
            setTyping(next);
            onChange(toMinor(major));
          }}
          className={cn('min-w-0 bg-transparent text-right font-bold text-ink outline-none [font-size:16px]', fitted ? 'flex-none' : 'w-full')}
        />
      </PillField>
    </PillLine>
  );
}

/**
 * **The office's figure, on a coachee's tab** (P9-T6; ADR-0183, kept by ADR-0230 §7): nothing a coach types over it would
 * be read, so it is **plain figures, not a pill** — no frame, no fill, no ✎ — and does not look tappable; the line under
 * its name says whose it is. Compact, *Rp 400 Jt*, as the member's own pill shows it at rest (P19.11-T4, UX-7). A
 * `<dl>`, so the label names the figure.
 */
function PillReadOnly({ label, line, value, layout }: {
  label: string; line: ReactNode; value: string; layout: 'row' | 'stacked';
}) {
  return (
    <dl className={layout === 'row' ? 'flex min-h-14 items-center justify-between gap-2.5' : 'flex min-w-0 flex-col gap-1.5'}>
      <dt className={cn('flex min-w-0 flex-col', layout === 'row' && 'max-md:flex-1')}>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1 font-medium leading-snug',
            layout === 'row' ? 'text-md text-ink max-md:text-[0.9375rem] max-md:font-normal' : 'text-base text-muted',
          )}
        >
          {label}
        </span>
        {line}
      </dt>
      <dd
        data-read-only=""
        className={cn(
          'inline-flex h-12 shrink-0 items-center justify-end px-3.5 text-lg font-bold text-ink max-md:px-3',
          layout === 'row' ? PILL_WIDTH : 'w-full',
        )}
      >
        {value}
      </dd>
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
 * **The names of the activities each stage counts** (P18.7-T5 AC-5): the office's own label for every code its
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
 * follows it (P18.7-T9 AC-3) — beside the heading, so its name stays the title.
 */
function Step({ n, title, term, children }: { n: number; title: string; term?: TermKey; children: ReactNode }) {
  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
      <NumberBadge n={n} size="md" className="border-secondary bg-secondary text-secondary-contrast" />
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
