'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { BriefCard, ChoiceGroup } from '@/components/plan/brief-card';
import { BriefSummary } from '@/components/plan/brief-summary';
import { MultiChoiceGroup } from '@/components/plan/multi/multi-choice-group';
import { OpeningLines } from '@/components/plan/multi/opening-lines';
import { PushBackStack } from '@/components/plan/multi/push-back-stack';
import { ResultHead } from '@/components/plan/result-head';
import { BulletList, NextAction, ScriptBlock, ScriptText } from '@/components/plan/script-blocks';
import { StepPills } from '@/components/plan/step-pills';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ACTION_BAR_PHONE, ACTION_BAR_ROOM_PHONE, TAP_HEIGHT, TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { planMessages } from '@/i18n/messages/plan';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import { cn } from '@/lib/cn';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import {
  ATTACK_PLAN_HREF, briefQuery, codesOf, completeBrief, labels, PITCH_MATERIALS_HREF, planHref, readRecruitmentPlan,
  type BriefCodes, type Choice, type RecruitmentAttackPlanView, type RecruitmentPlan, type RecruitmentVocabulary,
} from '@/lib/recruitment';

/** What the address asks the page to show (D-urls). */
export type RecruitmentAddress =
  /** Step 1: no brief, or one missing a question — nothing chosen. */
  | { kind: 'brief' }
  /** Step 2: the plan for a brief, as codes. */
  | { kind: 'plan'; brief: BriefCodes };

/** What the server has said that outlives one read: the chips, and whether the company has a playbook. */
interface Known {
  vocabulary: RecruitmentVocabulary;
  hasPlaybook: boolean;
}

const options = (choices: readonly Choice[]) => choices.map((c) => ({ value: c.code, label: c.label }));

/**
 * **The Recruitment Attack Plan** (`/recruitment/attack-plan`; `AgencyBoost_Recruitment_Section.html:288-353`,
 * logic `:512-621`; P17-T3): three questions about a candidate, then the plan — the profile, an opening line
 * for each motivation, the benefits to lead with, an answer to each hesitation, and the next action.
 *
 * **Two steps, as drawn**, behind two step pills. Step 1's pill is not a control (`:290-294`); *← Back* is,
 * and it is a button where the prototype's is a `span` (`:342`, contradiction 10).
 *
 * **The chips and the plan are the server's** (D-vocabulary, D-plan): the chips are drawn from the read's
 * `vocabulary`, and the plan prints what it is answered — the summary's *Type* is the profile's label, so
 * *Fresh grad* reads *Fresh graduate* there (`:557`), as drawn. Several answers are in the chips' order, not
 * the order clicked (`:521`). **Every authored word is rendered as text** — the prototype pours the plan
 * through `innerHTML` (`:620`, contradiction 3); here it is React text, and a `<b>` prints as itself.
 *
 * **The brief is in the address** (D-urls): *Build recruitment plan* opens `?type=…&motivation=…&hesitation=…`,
 * a refresh keeps the plan, and *← Back* returns to the brief as it was — going back when this screen pushed
 * the plan, replacing the address when the plan was opened by a link or a refresh, as the Sales Attack Plan
 * does. An address missing a question opens step 1 with nothing chosen, and so does one the server refuses
 * (an unknown or repeated code): never an error page (AC-5).
 *
 * **Nothing is kept** (D-store): a plan is a read, so a read-only support session builds one like anybody.
 * The states the prototype lacks are Fills (AC-7): a skeleton while a read is out, an error with a retry
 * that keeps the brief, and the playbook-empty state of a company with no playbook, which points to *Pitch
 * Materials* — that tab does not depend on the playbook.
 *
 * **On a phone** (ADR-0167; P18.95-T6 AC-1, UI-015) the chips are two to a row and *Build recruitment plan* sits
 * in a bar fixed to the bottom of the screen, with room left under the brief for it; 768px and wider, as drawn.
 * The chips' words are the server's, the client's shorter ones since 2026-10-26 (AC-2).
 *
 * **Our words are the catalogue's** (P18.98-T4; ADR-0179 §4): `messages/recruitment-plan.ts` and the two plans'
 * `messages/plan.ts`, in the reader's language. **The playbook's are the company's**, shown as typed in both (ADR-0179
 * §5): the chips, the profile, the openings, the push-backs, the next action.
 */
export function RecruitmentPlanScreen({ address }: { address: RecruitmentAddress }) {
  const t = useMessages(recruitmentPlanMessages);
  const p = useMessages(planMessages);
  const router = useRouter();
  const planKey = address.kind === 'plan' ? briefQuery(address.brief) : null;
  const fromAddress = address.kind === 'plan' ? address.brief : null;

  const [known, setKnown] = useState<Known | null>(null);
  /** A brief address the server refused: step 1, with nothing chosen. Kept so Back to it does not ask again. */
  const [refusedKey, setRefusedKey] = useState<string | null>(null);
  const onPlan = planKey !== null && planKey !== refusedKey;

  // The brief as chosen on step 1: what the address holds, then what the server read, kept as the reader
  // leaves step 2.
  const [type, setType] = useState<string | null>(fromAddress?.type ?? null);
  const [motivations, setMotivations] = useState<string[]>(fromAddress?.motivations ?? []);
  const [hesitations, setHesitations] = useState<string[]>(fromAddress?.hesitations ?? []);
  const choose = useCallback((brief: BriefCodes | null) => {
    setType(brief?.type ?? null);
    setMotivations(brief?.motivations ?? []);
    setHesitations(brief?.hesitations ?? []);
  }, []);

  /** Set by *Build recruitment plan*: the plan's heading takes the focus once it is drawn (AC-8). */
  const focusResult = useRef(false);
  /** Whether this screen pushed the plan's address — so *← Back* can go back rather than forward. */
  const openedHere = useRef(false);
  /**
   * Set by *← Back*: the brief takes the focus once step 1 is drawn again, since the button that had it is
   * gone and the focus would otherwise fall to the page (AC-8).
   */
  const focusBrief = useRef(false);
  const briefRegion = useRef<HTMLDivElement>(null);

  /*
   * **Step 1 reads the chips once** — and not at all when a plan has already answered them, since every
   * answer carries the vocabulary. `null` until known.
   */
  const [briefError, setBriefError] = useState<ApiError | null>(null);
  const [briefAttempt, setBriefAttempt] = useState(0);
  useEffect(() => {
    if (onPlan || known) return undefined;
    let live = true;
    setBriefError(null);
    readRecruitmentPlan(null)
      .then((view) => { if (live) setKnown({ vocabulary: view.vocabulary, hasPlaybook: view.hasPlaybook }); })
      .catch((err) => { if (live) setBriefError(toDisplayError(err)); });
    return () => { live = false; };
  }, [onPlan, known, briefAttempt]);

  const onView = useCallback((view: RecruitmentAttackPlanView) => {
    setKnown({ vocabulary: view.vocabulary, hasPlaybook: view.hasPlaybook });
    if (view.plan) choose(codesOf(view.plan.brief));
  }, [choose]);
  const onRefused = useCallback(() => {
    focusResult.current = false;
    setRefusedKey(planKey);
    choose(null);
  }, [planKey, choose]);

  const brief = completeBrief(known?.vocabulary ?? null, type, motivations, hesitations);
  const build = () => {
    if (!brief) return;
    focusResult.current = true;
    openedHere.current = true;
    router.push(planHref(brief), { scroll: false });
  };
  const backToBrief = () => {
    focusBrief.current = true;
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace(ATTACK_PLAN_HREF, { scroll: false });
    }
  };

  useEffect(() => {
    if (onPlan || !known?.hasPlaybook || !focusBrief.current) return;
    focusBrief.current = false;
    briefRegion.current?.focus();
  }, [onPlan, known]);

  const steps = [t.stepBrief, t.stepPlan];

  // `onPlan` holds only for a plan's address; the second test says so to the compiler.
  if (!onPlan || address.kind !== 'plan') {
    return (
      <div>
        <StepPills label={p.steps} steps={steps} current={0} />
        {!known && !briefError && <BriefSkeleton />}
        {briefError && <Retry error={briefError} onRetry={() => setBriefAttempt((n) => n + 1)} />}
        {known && !known.hasPlaybook && <NoPlaybook />}
        {known?.hasPlaybook && (
          <div className={ACTION_BAR_ROOM_PHONE}>
            <div ref={briefRegion} tabIndex={-1}>
            <BriefCard title={p.briefTitle} hint={p.briefHint}>
              <ChoiceGroup label={t.candidateType} options={options(known.vocabulary.types)} value={type} onChange={setType} />
              <MultiChoiceGroup
                label={t.motivation}
                options={options(known.vocabulary.motivations)}
                value={motivations}
                onChange={setMotivations}
              />
              <MultiChoiceGroup
                label={t.hesitation}
                options={options(known.vocabulary.hesitations)}
                value={hesitations}
                onChange={setHesitations}
              />
            </BriefCard>
            </div>
            {/* The primary, amber with navy text (an action, ADR-0137), full width (`.btn-block`, `:104`), disabled until the brief is complete. */}
            {/* On a phone, in a bar fixed to the bottom of the screen, still the bar's full width. */}
            <div className={ACTION_BAR_PHONE}>
              <Button disabled={!brief} onClick={build} className="h-auto w-full px-[22px] py-3.5 text-lg">
                {t.build}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <StepPills label={p.steps} steps={steps} current={1} />
      <button
        type="button"
        onClick={backToBrief}
        className={cn('mb-4 inline-flex items-center gap-1 rounded-sm text-base font-semibold text-amber-ink hover:underline', TAP_HEIGHT)}
      >
        <span aria-hidden="true">←</span>
        {p.back}
      </button>
      <PlanResult
        brief={address.brief}
        planKey={planKey}
        focusResult={focusResult}
        onView={onView}
        onRefused={onRefused}
      />
    </div>
  );
}

function PlanResult({ brief, planKey, focusResult, onView, onRefused }: {
  brief: BriefCodes;
  /** The brief as the address spells it: a new one is a new read. */
  planKey: string | null;
  focusResult: MutableRefObject<boolean>;
  onView: (view: RecruitmentAttackPlanView) => void;
  onRefused: () => void;
}) {
  const [view, setView] = useState<RecruitmentAttackPlanView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  /** The state drawn in the plan's place when there is no heading: the playbook-empty state, an error. */
  const landing = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    setError(null);
    readRecruitmentPlan(brief)
      .then((next) => {
        if (!live) return;
        // A playbook answers every brief it can read, so a plan missing beside one is a brief it could not.
        if (next.hasPlaybook && !next.plan) {
          onRefused();
          return;
        }
        setView(next);
        onView(next);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 400 && err.error.code === 'VALIDATION_FAILED') onRefused();
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [planKey, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * After *Build recruitment plan* the plan's heading takes the focus (AC-8), where the prototype scrolls the
   * window (`:562`) — or, where no heading is drawn, the state in its place, so the focus is never dropped.
   */
  useEffect(() => {
    if (!focusResult.current || (!view && !error)) return;
    focusResult.current = false;
    (heading.current ?? landing.current)?.focus();
  }, [view, error, focusResult]);

  const plan = view?.plan ?? null;
  return (
    <>
      {!view && !error && <PlanSkeleton />}
      {error && (
        <div ref={landing} tabIndex={-1}>
          <Retry error={error} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}
      {view && !view.hasPlaybook && <div ref={landing} tabIndex={-1}><NoPlaybook /></div>}
      {plan && <Plan plan={plan} headingRef={heading} />}
    </>
  );
}

/** The summary and the plan's card (`:342-350`, `:586-619`), every word as the read answered it. */
function Plan({ plan, headingRef }: { plan: RecruitmentPlan; headingRef: React.Ref<HTMLHeadingElement> }) {
  const t = useMessages(recruitmentPlanMessages);
  const p = useMessages(planMessages);
  return (
    <>
      <BriefSummary
        label={t.stepBrief}
        items={[
          { label: t.typeIs, value: plan.profile.label },
          { label: t.motivationIs, value: labels(plan.brief.motivations) },
          { label: t.hesitationIs, value: labels(plan.brief.hesitations) },
        ]}
      />
      <article className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
        <ResultHead
          tag={t.profileTag}
          title={plan.profile.label}
          tagline={plan.profile.tagline}
          pill={{ label: t.planReady, tone: 'success' }}
          headingRef={headingRef}
        />
        <div className="px-5 pb-[22px] pt-1.5 sm:px-6">
          <ScriptBlock n={0} label={p.goodFitFor} lead>
            <ScriptText>{plan.profile.goodFitFor}</ScriptText>
          </ScriptBlock>
          <ScriptBlock n={1} label={plan.openings.length > 1 ? p.openingLines : p.openingLine}>
            <OpeningLines lines={plan.openings.map((o) => ({ key: o.motivation.code, tag: o.motivation.label, text: o.text }))} />
          </ScriptBlock>
          <ScriptBlock n={2} label={p.leadWithBenefits}>
            <BulletList items={plan.profile.benefits} />
          </ScriptBlock>
          <ScriptBlock n={3} label={p.pushBack}>
            <PushBackStack
              theySayLabel={p.theySay}
              youSayLabel={p.youSay}
              items={plan.objections.map((o) => ({ key: o.hesitation.code, theySay: o.theySay, youSay: o.youSay }))}
            />
          </ScriptBlock>
          <ScriptBlock n={4} label={p.nextAction}>
            <NextAction>{plan.nextAction}</NextAction>
          </ScriptBlock>
        </div>
      </article>
    </>
  );
}

/**
 * **The playbook-empty state** (AC-7, a Fill): the company has no playbook, so there are no words to build a
 * plan from. Said plainly, and pointing to *Pitch Materials*, which does not depend on the playbook.
 */
function NoPlaybook() {
  const t = useMessages(recruitmentPlanMessages);
  return (
    <div className="rounded-lg border border-hairline bg-card px-6 py-[22px]" data-state="no-playbook">
      <p className="m-0 text-md font-semibold text-navy">{t.noPlaybook}</p>
      <p className="m-0 mt-1 text-base text-muted">{t.noPlaybookHint}</p>
      <Link href={PITCH_MATERIALS_HREF} className={cn('mt-2 inline-block rounded-sm text-base font-semibold text-amber-ink hover:underline', TEXT_TAP)}>
        {t.toPitchMaterials}
      </Link>
    </div>
  );
}

function Retry({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useMessages(recruitmentPlanMessages);
  return (
    <>
      <ErrorBanner {...error} />
      <Button variant="secondary" className="mt-3" onClick={onRetry}>{t.tryAgain}</Button>
    </>
  );
}

/** The brief's card, shaped like the three questions that are coming. */
function BriefSkeleton() {
  const t = useMessages(recruitmentPlanMessages);
  return (
    <Skeleton label={t.loadingBrief}>
      <div className="mb-5 rounded-lg border border-hairline bg-card px-6 py-[22px]">
        <SkeletonBar className="h-5 w-56" />
        <SkeletonBar className="mt-2 w-2/3" />
        {[0, 1, 2].map((q) => (
          <div key={q} className="mt-5">
            <SkeletonBar className="w-32" />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((c) => <SkeletonBar key={c} className="h-9 w-28" />)}
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** The summary's strip and the plan's card, while the plan is read. */
function PlanSkeleton() {
  const t = useMessages(recruitmentPlanMessages);
  return (
    <Skeleton label={t.loadingPlan}>
      <div className="mb-5 rounded-lg border border-hairline bg-card px-5 py-3.5">
        <SkeletonBar className="w-2/3" />
      </div>
      <div className="mb-4 rounded-lg border border-hairline bg-card px-6 py-5">
        <SkeletonBar className="w-32" />
        <SkeletonBar className="mt-3 h-6 w-1/2" />
        <SkeletonBar className="mt-2 w-2/3" />
        <SkeletonText lines={4} className="mt-6" />
      </div>
    </Skeleton>
  );
}
