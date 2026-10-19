'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlternativesRow } from '@/components/plan/alternatives-row';
import { BriefCard, ChoiceGroup } from '@/components/plan/brief-card';
import { BriefSummary } from '@/components/plan/brief-summary';
import { ResultHead, type PillTone } from '@/components/plan/result-head';
import { StepPills } from '@/components/plan/step-pills';
import { EmptyShelf } from '@/components/product-catalog';
import { ProductScript } from '@/components/product-script';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import {
  AGE_CHOICES, ageLabel, BUDGET_CHOICES, budgetLabel, fitNote, moreLine, NEED_CHOICES, needLabel, OWN_COPY,
  planHref, PROTOTYPE_COPY, readAttackPlan, readCatalog, readCatalogProduct, resultTag,
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
 */
export function AttackPlanScreen({ address }: { address: PlanAddress }) {
  const router = useRouter();
  const briefInAddress = address.kind === 'plan' ? address.brief : null;

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
    if (!complete) return;
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

  const steps = [PROTOTYPE_COPY.stepBrief, PROTOTYPE_COPY.stepPlan];

  if (address.kind === 'brief') {
    return (
      <div className="mx-auto max-w-[980px]">
        <StepPills label={OWN_COPY.steps} steps={steps} current={0} />
        {shelfEmpty ? <EmptyShelf /> : (
          <>
            <BriefCard title={PROTOTYPE_COPY.briefTitle} hint={PROTOTYPE_COPY.briefHint}>
              <ChoiceGroup label={PROTOTYPE_COPY.primaryNeed} options={NEED_CHOICES} value={need} onChange={setNeed} />
              <ChoiceGroup label={PROTOTYPE_COPY.ageBand} options={AGE_CHOICES} value={age} onChange={setAge} />
              <ChoiceGroup label={PROTOTYPE_COPY.budget} options={BUDGET_CHOICES} value={budget} onChange={setBudget} />
            </BriefCard>
            <div className="flex flex-wrap items-center justify-end gap-3.5">
              {/* Emptied once the brief is complete (`:9557-9561`), and read out as it changes. */}
              <p className="m-0 mr-auto text-sm text-muted" aria-live="polite">{complete ? '' : PROTOTYPE_COPY.pickAll}</p>
              <Button disabled={!complete} onClick={build} className="h-auto px-[22px] py-[11px]">{PROTOTYPE_COPY.build}</Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <StepPills label={OWN_COPY.steps} steps={steps} current={1} onStep={backToBrief} />
      <button
        type="button"
        onClick={backToBrief}
        className="mb-3.5 inline-flex items-center gap-1.5 rounded-sm py-1.5 text-base font-semibold text-navy-soft hover:text-navy"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {PROTOTYPE_COPY.back}
      </button>
      <PlanResult
        address={address}
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

function PlanResult({ address, focusResult, onShelf, onSwitch, onAddProfile }: {
  address: Exclude<PlanAddress, { kind: 'brief' }>;
  focusResult: React.MutableRefObject<boolean>;
  /** What a plan says about the shelf, so the brief need not read the catalog to know it. */
  onShelf: (empty: boolean) => void;
  onSwitch: (code: string) => void;
  onAddProfile: () => void;
}) {
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
          <span>
            {PROTOTYPE_COPY.bannerLead}<strong className="font-bold">{PROTOTYPE_COPY.bannerStrong}</strong>{PROTOTYPE_COPY.bannerTail}
          </span>
          {/* Navy and underlined on the wash, where amber-dark — and even amber-ink — miss 4.5:1 (`product-catalog.spec.ts`). */}
          <button type="button" onClick={onAddProfile} className="whitespace-nowrap rounded-sm font-semibold text-navy underline">
            {PROTOTYPE_COPY.addProfile}
          </button>
        </div>
      )}
      {address.kind === 'plan' && (
        <BriefSummary
          label={PROTOTYPE_COPY.stepBrief}
          items={[
            { label: PROTOTYPE_COPY.needIs, value: needLabel(address.brief.need) ?? '—' },
            { label: PROTOTYPE_COPY.ageIs, value: ageLabel(address.brief.age) ?? '—' },
            { label: PROTOTYPE_COPY.budgetIs, value: budgetLabel(address.brief.budget) ?? '—' },
          ]}
        />
      )}

      {!shown && !missing && !error && <PlanSkeleton />}
      {error && (
        <div ref={landing} tabIndex={-1}>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {missing && (
        <div ref={landing} tabIndex={-1} className="rounded-lg border border-hairline bg-card px-6 py-[22px]" data-state="not-found">
          <p className="m-0 text-md font-semibold text-navy">{OWN_COPY.notFound}</p>
          <p className="m-0 mt-1 text-base text-muted">{OWN_COPY.notFoundHint}</p>
          <Link href="/product-catalog" className="mt-2 inline-block rounded-sm text-base font-semibold text-amber-ink hover:underline">
            {OWN_COPY.backToCatalog}
          </Link>
        </div>
      )}
      {/* Nothing serves the need: the prototype's line (`:9652`) — or, with nothing on the shelf, the empty shelf. */}
      {shown && !product && (shelfEmpty ? <div ref={landing} tabIndex={-1}><EmptyShelf /></div> : (
        <div ref={landing} tabIndex={-1} className="mb-5 rounded-lg border border-hairline bg-card px-6 py-[22px]" data-state="no-match">
          <p className="m-0 text-base text-muted">{PROTOTYPE_COPY.noMatch}</p>
        </div>
      ))}
      {shown && product && (
        <>
          <article className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
            <ResultHeadFor shown={shown} product={product} headingRef={heading} />
            {shown.kind === 'plan' && shown.plan.verdict === 'check_fit' && (
              <p className="m-0 border-b border-hairline bg-alert/5 px-5 py-3 text-base text-alert sm:px-6">{fitNote(shown.plan.outside)}</p>
            )}
            {product.lifecycle === 'closed_to_new_business' && (
              <p className="m-0 border-b border-hairline bg-alert/5 px-5 py-3 text-base text-alert sm:px-6">{PROTOTYPE_COPY.planRunOff}</p>
            )}
            <div className="px-5 pb-[22px] pt-1.5 sm:px-6">
              <ProductScript script={product.script} place="page" />
            </div>
          </article>
          {shown.kind === 'plan' && (
            <AlternativesRow
              label={PROTOTYPE_COPY.alsoMatches}
              items={shown.plan.alternatives.map((a) => ({ key: a.code, label: a.name }))}
              onPick={onSwitch}
              more={shown.plan.moreCount > 0 ? moreLine(shown.plan.moreCount) : undefined}
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
  let pill: { label: string; tone: PillTone };
  if (product.lifecycle === 'closed_to_new_business') pill = { label: PROTOTYPE_COPY.runOff, tone: 'neutral' };
  else if (shown.kind === 'plan') {
    pill = shown.plan.verdict === 'good_fit'
      ? { label: PROTOTYPE_COPY.goodFit, tone: 'success' }
      : { label: PROTOTYPE_COPY.checkFit, tone: 'alert' };
  } else pill = { label: PROTOTYPE_COPY.fromCatalog, tone: 'neutral' };

  return <ResultHead tag={resultTag(product)} title={product.name} tagline={product.tagline} pill={pill} headingRef={headingRef} />;
}

function PlanSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loadingPlan}>
      <div className="mb-4 rounded-lg border border-hairline bg-card px-6 py-5">
        <SkeletonBar className="w-32" />
        <SkeletonBar className="mt-3 h-6 w-1/2" />
        <SkeletonBar className="mt-2 w-2/3" />
        <SkeletonText lines={4} className="mt-6" />
      </div>
    </Skeleton>
  );
}
