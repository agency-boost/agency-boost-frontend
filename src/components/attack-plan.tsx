'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlternativesRow } from '@/components/plan/alternatives-row';
import { BriefCard, ChoiceGroup } from '@/components/plan/brief-card';
import { BriefSummary } from '@/components/plan/brief-summary';
import { PhoneAnswers } from '@/components/plan/phone-plan';
import { PlanButton, firstOpenQuestion } from '@/components/plan/plan-button';
import { ResultHead, type PillTone } from '@/components/plan/result-head';
import { StepPills } from '@/components/plan/step-pills';
import { EmptyShelf } from '@/components/product-catalog';
import { ProductScript } from '@/components/product-script';
import { PhoneSalesPlan } from '@/components/sales-plan-phone';
import { Button, ErrorBanner } from '@/components/ui/field';
import { REMOVED_ON_PHONE, TAP_HEIGHT, TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import { cn } from '@/lib/cn';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { usePhone } from '@/lib/use-phone';
import {
  AGE_CHOICES, ageLabel, budgetChoices, budgetLabel, fitNote, LUMP_SUM_BUDGET, moreLine, needChoices, needLabel,
  planHref, readAttackPlan, readCatalog, readCatalogProduct, resultTag,
  type AttackPlan, type AttackPlanBrief, type CatalogProduct,
} from '@/lib/product-catalog';

/** What the address asks the page to show (D-urls). */
export type PlanAddress =
  /** Step 1: no brief, or a band out of range — nothing chosen. */
  | { kind: 'brief' }
  /** Step 2 for a brief, or one of its alternatives switched to. */
  | { kind: 'plan'; brief: AttackPlanBrief; product?: string }
  /** Step 2 from the catalog: one product, no brief, so no fit (`Overall.html:9858-9866`). */
  | { kind: 'product'; code: string };

type Shown =
  | { kind: 'plan'; plan: AttackPlan }
  | { kind: 'product'; product: CatalogProduct };

/**
 * **The Sales Attack Plan** (`/attack-plan`; `Overall.html:3786-3866`, logic `:9280-9869`; P14-T8): three
 * questions about the customer, then the product to offer, whether it fits, and the words to sell it with.
 *
 * **Two steps, as drawn**, behind two step pills: the brief, and the plan with *Back* and the brief's
 * summary above it. **The recommendation is the server's** (D-scoring): this page asks for the plan for
 * the brief and prints what it is answered — the product, the verdict in words, the note, the words, the
 * alternatives in order and how many more — and works nothing out itself.
 *
 * **The brief is in the address** (D-urls): *Build attack plan* opens `?need=…&age=…&budget=…`, a refresh
 * keeps the plan, Back returns to the brief as it was, and a chip opens `&product=…` — the alternative
 * re-fitted against the same brief, the list the same every time (D-alternatives). The catalog's deep link
 * is `?product=…` alone: its banner, *From catalog* or *In run-off*, and no summary or alternatives. A switch
 * replaces the address rather than adding to the history, so Back from any plan returns to the brief. The
 * in-page *Back* and the first step's pill add no entry of their own: they go **back** when this screen
 * pushed the plan, and **replace** the address with the brief's when the plan was opened by a link or a
 * refresh — as the catalog's drawer closes.
 *
 * **Nothing is kept** (OD-133): a plan is a read, so a read-only support session builds one like anybody.
 * The states the prototype lacks are Fills (P14-T8 AC-10): a skeleton while the plan is built, an error
 * with a retry that keeps the brief, the empty shelf in the catalog's words, and the not-found state.
 *
 * **The client's review of 2026-10-26** (ADR-0167; P18.95-T6): below 768px the chips are two to a row and
 * *Build attack plan* sits in a bar fixed to the bottom of the screen, with room left under the brief so its
 * last chips are never behind it (AC-1, UI-015); at every size *Lump-sum* is an option of its own after
 * *Monthly premium budget*, not that question's seventh chip — one answer between the two groups, band 7 as
 * before (AC-3, UI-030).
 *
 * **UI V1 on a phone** (UI-107; `attack-plan-mobile` 1, 3; Mobile only): the question in a white card with
 * sentence-case labels and wrapping pill chips, no grey line, the step line on one line, and *Susun Attack Plan* right
 * under the last question — **not pinned** (P18.95-T6's bar is gone below 768px: nothing floats over the question card)
 * and **always active**: tapped with a question open, it brings that question into view and gives it the focus
 * (`PlanButton`). The plan is the phone's own layout (`PhoneSalesPlan`): the answers as chips with *Ubah*, the product
 * in a navy card, five numbered sections. From 768px every part is as before, the button disabled until the brief is
 * whole.
 *
 * **Its words are the catalogue's** (P18.98-T4; ADR-0179 §4): `messages/sales-attack-plan.tsx`, the two plans'
 * `messages/plan.ts` and the catalog's `messages/product-catalog.ts`, in the reader's language. A budget band's sums are
 * the reader's figures (`useFigureLanguage()`, P18.98-T3); the product, its script and an alternative's name are the
 * company's or the office's, shown as typed (ADR-0179 §5).
 */
export function AttackPlanScreen({ address }: { address: PlanAddress }) {
  const t = useMessages(salesAttackPlanMessages);
  const p = useMessages(planMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const router = useRouter();
  const phone = usePhone();
  const briefInAddress = address.kind === 'plan' ? address.brief : null;
  /** The brief's card: on a phone, *Susun Attack Plan* with a question open finds it there (UI-107). */
  const briefCard = useRef<HTMLDivElement>(null);

  // The brief as chosen on step 1: what the address holds, kept as the reader leaves step 2.
  const [need, setNeed] = useState<string | null>(briefInAddress?.need ?? null);
  const [age, setAge] = useState<number | null>(briefInAddress?.age ?? null);
  const [budget, setBudget] = useState<number | null>(briefInAddress?.budget ?? null);
  useEffect(() => {
    if (!briefInAddress) return;
    setNeed(briefInAddress.need);
    setAge(briefInAddress.age);
    setBudget(briefInAddress.budget);
  }, [briefInAddress?.need, briefInAddress?.age, briefInAddress?.budget]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = need !== null && age !== null && budget !== null;
  /** Set by *Build attack plan* and a switch: the result's heading takes the focus once it is drawn. */
  const focusResult = useRef(false);
  /** Whether this screen pushed the plan's address — so *Back* can go back rather than forward. */
  const openedHere = useRef(false);

  /*
   * **Whether there is a shelf at all**: an office whose company has no catalog, or which keeps nothing
   * on, meets the empty shelf in the brief's place rather than three questions nothing can answer
   * (P14-T8 AC-10). **A plan says so with its answer** (`shelfEmpty`), so a plan's address reads no
   * catalog; the brief, which has no plan to ask, reads the shelf once — and only when no plan has
   * answered already. `null` until it is known; a failed read draws the brief.
   */
  const [shelfEmpty, setShelfEmpty] = useState<boolean | null>(null);
  const onBrief = address.kind === 'brief';
  useEffect(() => {
    if (!onBrief || shelfEmpty !== null) return undefined;
    let live = true;
    readCatalog()
      .then((list) => { if (live) setShelfEmpty(list.products.length === 0); })
      .catch(() => { if (live) setShelfEmpty(false); });
    return () => { live = false; };
  }, [onBrief, shelfEmpty]);

  const build = () => {
    if (!complete) {
      // On a phone the button is always active (UI-107): it shows the first question still open, and focuses it.
      firstOpenQuestion(briefCard.current);
      return;
    }
    focusResult.current = true;
    openedHere.current = true;
    router.push(planHref({ need, age, budget }), { scroll: false });
  };
  const backToBrief = () => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace('/attack-plan', { scroll: false });
    }
  };
  /** *Add age & budget*, from the catalog's deep link: on to the brief, a step forward rather than back. */
  const addProfile = () => router.push('/attack-plan', { scroll: false });

  const steps = [t.stepBrief, t.stepPlan];

  if (address.kind === 'brief') {
    const lumpSum = budget === LUMP_SUM_BUDGET;
    // The bands in the reader's figures and words: six monthly, then *Lump-sum*, an option of its own.
    const bands = budgetChoices(figures, language);
    return (
      <div className="mx-auto max-w-[980px]">
        <StepPills label={p.steps} steps={steps} current={0} />
        {shelfEmpty ? <EmptyShelf /> : (
          <>
            <div ref={briefCard}>
            <BriefCard title={p.briefTitle} hint={p.briefHint}>
              <ChoiceGroup label={t.primaryNeed} options={needChoices(language)} value={need} onChange={setNeed} />
              <ChoiceGroup label={t.ageBand} options={AGE_CHOICES} value={age} onChange={setAge} />
              {/* One answer across the two: choosing *Lump-sum* releases a monthly band, and a band releases it. */}
              <ChoiceGroup
                label={t.budget}
                options={bands.filter((c) => c.value !== LUMP_SUM_BUDGET)}
                value={lumpSum ? null : budget}
                onChange={setBudget}
              />
              <ChoiceGroup
                label={t.lumpSumGroup}
                options={bands.filter((c) => c.value === LUMP_SUM_BUDGET)}
                value={lumpSum ? budget : null}
                onChange={setBudget}
              />
            </BriefCard>
            </div>
            {/* On a phone, right under the last question, in the flow, the note not drawn (UI-107, D-08). */}
            <div className="flex flex-wrap items-center justify-end gap-3.5 max-md:mt-3 max-md:block">
              {/* Emptied once the brief is complete (`:9557-9561`), and read out as it changes. */}
              <p className={cn('m-0 mr-auto text-sm text-muted', REMOVED_ON_PHONE)} aria-live="polite">{complete ? '' : t.pickAll}</p>
              <PlanButton phone={phone} complete={complete} onClick={build} className="h-auto px-[22px] py-[11px]">{t.build}</PlanButton>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <StepPills label={p.steps} steps={steps} current={1} onStep={backToBrief} />
      {/* Not on a phone: *Ubah*, beside the answers, goes back there (UI-107). */}
      {!phone && (
        <button
          type="button"
          onClick={backToBrief}
          className={cn('mb-3.5 inline-flex items-center gap-1.5 rounded-sm py-1.5 text-base font-semibold text-navy-soft hover:text-navy', TAP_HEIGHT)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {p.back}
        </button>
      )}
      <PlanResult
        address={address}
        phone={phone}
        onBack={backToBrief}
        focusResult={focusResult}
        onShelf={setShelfEmpty}
        onSwitch={(code) => {
          if (address.kind !== 'plan') return;
          focusResult.current = true;
          // Replaced, not pushed: Back from any switch returns to the brief, as *Back* does.
          router.replace(planHref(address.brief, code), { scroll: false });
        }}
        onAddProfile={addProfile}
      />
    </div>
  );
}

function PlanResult({ address, phone, onBack, focusResult, onShelf, onSwitch, onAddProfile }: {
  address: Exclude<PlanAddress, { kind: 'brief' }>;
  /** Below 768px: the phone's plan (UI-107). */
  phone: boolean;
  /** Back to the brief: *Ubah* on a phone. */
  onBack: () => void;
  focusResult: React.MutableRefObject<boolean>;
  /** What a plan says about the shelf, so the brief need not read the catalog to know it. */
  onShelf: (empty: boolean) => void;
  onSwitch: (code: string) => void;
  onAddProfile: () => void;
}) {
  const t = useMessages(salesAttackPlanMessages);
  const c = useMessages(productCatalogMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const [shown, setShown] = useState<Shown | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  /** The state drawn in the result's place when there is no heading: no match, the empty shelf, not found, an error. */
  const landing = useRef<HTMLDivElement>(null);
  const key = address.kind === 'plan'
    ? `${address.brief.need}|${address.brief.age}|${address.brief.budget}|${address.product ?? ''}`
    : `product|${address.code}`;

  useEffect(() => {
    let live = true;
    setShown(null);
    setMissing(false);
    setError(null);
    const read: Promise<Shown> = address.kind === 'plan'
      ? readAttackPlan(address.brief, address.product).then((plan) => ({ kind: 'plan', plan }))
      : readCatalogProduct(address.code).then((product) => ({ kind: 'product', product }));
    read
      .then((next) => {
        if (!live) return;
        setShown(next);
        if (next.kind === 'plan') onShelf(next.plan.shelfEmpty);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * After *Build attack plan*, and after a switch, the result's heading takes the focus (P14-T8 AC-11) —
   * or, where no heading is drawn, the state in its place, so the focus is never dropped to the page.
   */
  useEffect(() => {
    if (!focusResult.current || (!shown && !missing && !error)) return;
    focusResult.current = false;
    (heading.current ?? landing.current)?.focus();
  }, [shown, missing, error, focusResult]);

  const fromCatalog = address.kind === 'product';
  const product = shown?.kind === 'plan' ? shown.plan.product : shown?.product ?? null;
  const shelfEmpty = shown?.kind === 'plan' && shown.plan.shelfEmpty;

  return (
    <>
      {fromCatalog && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5 rounded-lg border border-amber/30 bg-amber/10 px-[18px] py-[13px] text-base text-navy">
          <span>{t.banner({ strong: (words) => <strong className="font-bold">{words}</strong> })}</span>
          {/* Navy and underlined on the wash, where amber-dark — and even amber-ink — miss 4.5:1 (`product-catalog.spec.ts`). */}
          <button type="button" onClick={onAddProfile} className={cn('whitespace-nowrap rounded-sm font-semibold text-navy underline', TEXT_TAP)}>
            {t.addProfile}
          </button>
        </div>
      )}
      {address.kind === 'plan' && phone && (
        <PhoneAnswers
          label={t.stepBrief}
          answers={[
            needLabel(address.brief.need, language) ?? '—',
            ageLabel(address.brief.age) ?? '—',
            budgetLabel(address.brief.budget, figures, language) ?? '—',
          ]}
          onChange={onBack}
        />
      )}
      {address.kind === 'plan' && !phone && (
        <BriefSummary
          label={t.stepBrief}
          items={[
            { label: t.needIs, value: needLabel(address.brief.need, language) ?? '—' },
            { label: t.ageIs, value: ageLabel(address.brief.age) ?? '—' },
            { label: t.budgetIs, value: budgetLabel(address.brief.budget, figures, language) ?? '—' },
          ]}
        />
      )}

      {!shown && !missing && !error && <PlanSkeleton />}
      {error && (
        <div ref={landing} tabIndex={-1}>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{c.tryAgain}</Button>
        </div>
      )}
      {missing && (
        <div ref={landing} tabIndex={-1} className="rounded-lg border border-card-edge bg-card px-6 py-[22px]" data-state="not-found">
          <p className="m-0 text-md font-semibold text-navy">{c.drawer.notFound}</p>
          <p className="m-0 mt-1 text-base text-muted">{c.drawer.notFoundHint}</p>
          <Link href="/product-catalog" className={cn('mt-2 inline-block rounded-sm text-base font-semibold text-amber-ink hover:underline', TEXT_TAP)}>
            {c.drawer.backToCatalog}
          </Link>
        </div>
      )}
      {/* Nothing serves the need: the prototype's line (`:9652`) — or, with nothing on the shelf, the empty shelf. */}
      {shown && !product && (shelfEmpty ? <div ref={landing} tabIndex={-1}><EmptyShelf /></div> : (
        <div ref={landing} tabIndex={-1} className="mb-5 rounded-lg border border-card-edge bg-card px-6 py-[22px]" data-state="no-match">
          <p className="m-0 text-base text-muted">{t.noMatch}</p>
        </div>
      ))}
      {shown && product && phone && (
        <PhoneSalesPlan
          product={product}
          plan={shown.kind === 'plan' ? shown.plan : null}
          headingRef={heading}
          onSwitch={onSwitch}
        />
      )}
      {shown && product && !phone && (
        <>
          <article className="mb-4 overflow-hidden rounded-lg border border-card-edge bg-card">
            <ResultHeadFor shown={shown} product={product} headingRef={heading} />
            {shown.kind === 'plan' && shown.plan.verdict === 'check_fit' && (
              <p className="m-0 border-b border-hairline bg-alert/5 px-5 py-3 text-base text-alert sm:px-6">{fitNote(shown.plan.outside, language)}</p>
            )}
            {product.lifecycle === 'closed_to_new_business' && (
              <p className="m-0 border-b border-hairline bg-alert/5 px-5 py-3 text-base text-alert sm:px-6">{t.runOff}</p>
            )}
            <div className="px-5 pb-[22px] pt-1.5 sm:px-6">
              <ProductScript script={product.script} place="page" />
            </div>
          </article>
          {shown.kind === 'plan' && (
            <AlternativesRow
              label={t.alsoMatches}
              items={shown.plan.alternatives.map((a) => ({ key: a.code, label: a.name }))}
              onPick={onSwitch}
              more={shown.plan.moreCount > 0 ? moreLine(shown.plan.moreCount, language) : undefined}
            />
          )}
        </>
      )}
    </>
  );
}

/**
 * The pill's precedence, as drawn (`Overall.html:9660-9667`): a product in run-off first, then the fit
 * when there is a brief, else *From catalog*.
 */
function ResultHeadFor({ shown, product, headingRef }: {
  shown: Shown;
  product: CatalogProduct;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const t = useMessages(salesAttackPlanMessages);
  const c = useMessages(productCatalogMessages);
  const language = useLanguage();
  let pill: { label: string; tone: PillTone };
  if (product.lifecycle === 'closed_to_new_business') pill = { label: c.runOff, tone: 'neutral' };
  else if (shown.kind === 'plan') {
    pill = shown.plan.verdict === 'good_fit'
      ? { label: t.goodFit, tone: 'success' }
      : { label: t.checkFit, tone: 'alert' };
  } else pill = { label: t.fromCatalog, tone: 'neutral' };

  return (
    <ResultHead tag={resultTag(product, language)} title={product.name} tagline={product.tagline} pill={pill} headingRef={headingRef} />
  );
}

function PlanSkeleton() {
  const t = useMessages(salesAttackPlanMessages);
  return (
    <Skeleton label={t.loading}>
      <div className="mb-4 rounded-lg border border-card-edge bg-card px-6 py-5">
        <SkeletonBar className="w-32" />
        <SkeletonBar className="mt-3 h-6 w-1/2" />
        <SkeletonBar className="mt-2 w-2/3" />
        <SkeletonText lines={4} className="mt-6" />
      </div>
    </Skeleton>
  );
}
