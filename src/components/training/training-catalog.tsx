'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { SkillCards } from '@/components/training/training-parts';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { TAB_PHONE, TAB_ROW_PHONE, TEXT_TAP, UNDERLINED_ROW_PHONE } from '@/components/ui/phone';
import { useTabRow } from '@/components/ui/use-tab-row';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { trainingMessages } from '@/i18n/messages/training';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { usePhone } from '@/lib/use-phone';
import {
  readTrainingProgress, trainingCategoryHref,
  type TrainingCategoryProgress, type TrainingProgressView,
} from '@/lib/training';

/**
 * **The learner's training** (`/training`, `/training/[categoryCode]`; `Overall.html:3708-3732`, logic
 * `:7768-7810`, `:7857-7897`; P18.5-T1 AC-4).
 *
 * **One read for every address under `/training`**: the offered catalog with the reader's statuses,
 * `GET /training/progress`, held by the layout so the subtabs, the list and the module page draw from the
 * same answer, and read again after the reader sets a status, so going back to the list shows it.
 */

interface CatalogRead {
  view: TrainingProgressView | null;
  error: ApiError | null;
  /** Read again: after a status write, or when the reader asks after a failure. */
  reload: () => void;
  /**
   * The window is a phone's (P18.95-T3 AC-5), asked once by the layout, which outlives every page under it, so a
   * category's list opened from another already knows and never draws its table first.
   */
  phone: boolean;
}

const CatalogContext = createContext<CatalogRead | null>(null);

/** The catalog the layout read. Only beneath `/training`'s layout. */
export function useTrainingCatalog(): CatalogRead {
  const read = useContext(CatalogContext);
  if (!read) throw new Error('useTrainingCatalog() is only available beneath the training layout.');
  return read;
}

export function TrainingCatalogProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<TrainingProgressView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readTrainingProgress()
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [attempt]);

  // A reload keeps what is on screen until the answer replaces it: the list does not blank under a toast.
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const phone = usePhone();
  return <CatalogContext.Provider value={{ view, error, reload, phone }}>{children}</CatalogContext.Provider>;
}

/**
 * `/training`: **replaced by the first active category** (AC-4), as the prototype opens on Sales
 * (`:7872`) — the office's first, by its order, rather than a code we assume. An office with none
 * (0701 *Empty*) gets the empty state, a Fill (L-01).
 */
export function TrainingLanding() {
  const { view, error, reload } = useTrainingCatalog();
  const t = useMessages(trainingMessages);
  const router = useRouter();
  const first = view?.categories.find((c) => c.offered) ?? null;

  useEffect(() => {
    if (first) router.replace(trainingCategoryHref(first.code));
  }, [first, router]);

  if (error && !view) return <ReadFailed error={error} onRetry={reload} />;
  if (!view || first) return <CatalogSkeleton />;
  return (
    <Page title={t.title}>
      <EmptyCard title={t.noTraining} sub={t.noTrainingSub} />
    </Page>
  );
}

/**
 * `/training/[categoryCode]` (AC-4): the subtabs in the office's words, *"{label} Training"* over the
 * category's own description — or the prototype's *"Modules for this category are coming soon."* when it
 * offers nothing — *Skills List*, and a numbered card per skill. With nothing offered, the prototype's
 * own empty card (`:3771-3776`) and no heading. **No footer** (OD-150): the prototype's promised the
 * reader's *Skill Tracker*, which no agent has.
 */
export function TrainingCategory({ code }: { code: string }) {
  const { view, error, reload, phone } = useTrainingCatalog();
  const t = useMessages(trainingMessages);
  if (error && !view) return <ReadFailed error={error} onRetry={reload} />;
  if (!view) return <CatalogSkeleton />;

  // The API upper-cases a code before it looks it up, so a lower-case address still names the category.
  const offered = view.categories.filter((c) => c.offered);
  const category = offered.find((c) => c.code === code.toUpperCase());
  if (!category) return <CategoryNotFound />;

  const hasModules = category.total > 0;
  const title = t.categoryTitle({ label: category.label });
  // The nav item's words over every category (P18.95-T9 AC-2): the tab names the category, the empty card its title.
  return (
    <Page title={t.title} subtitle={hasModules ? (category.description ?? undefined) : t.comingSoon}>
      <TrainingSubtabs categories={offered} current={category.code} />
      <div className="mx-auto flex max-w-[820px] flex-col gap-3">
        {hasModules ? (
          <>
            <h2 className="font-display text-xl font-bold text-navy">{t.skillsList}</h2>
            <SkillCards skills={category.skills} categoryCode={category.code} phone={phone} />
          </>
        ) : (
          <EmptyCard title={title} sub={t.comingSoon} />
        )}
      </div>
    </Page>
  );
}

/**
 * `.subtabs` (`:81-89`, `:3709-3716`): the office's active categories in its order, each an address, so
 * links in a `nav` with the current one marked — on a category's list and on each of its modules' pages,
 * as the prototype keeps the strip above the module it opens (`:3709`, `:3733`).
 *
 * On a phone, one row that scrolls sideways, as `RouteTabs` is (ADR-0167; UI-013: the categories took
 * three lines). Below 768px only.
 */
export function TrainingSubtabs({
  categories, current, currentAs = 'page',
}: {
  categories: readonly Pick<TrainingCategoryProgress, 'code' | 'label'>[];
  current: string;
  /** `page` on the category's own list; `location` on one of its modules' pages, which the tab is not. */
  currentAs?: 'page' | 'location';
}) {
  const TAB = cn('-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold', TAB_PHONE);
  const row = useTabRow<HTMLElement>(current);
  const t = useMessages(trainingMessages);
  return (
    <nav
      ref={row.ref}
      aria-label={t.tab}
      data-fade={row.fade}
      className={cn('mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline', TAB_ROW_PHONE, UNDERLINED_ROW_PHONE)}
    >
      {categories.map((c) => (
        <Link
          key={c.code}
          href={trainingCategoryHref(c.code)}
          aria-current={c.code === current ? currentAs : undefined}
          className={cn(TAB, c.code === current ? 'border-amber text-navy' : 'border-transparent text-muted hover:text-navy')}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

/** `.goal-card.empty-state` (`:536-538`, `:3771-3776`): the title and a line under it, centred and quiet. */
export function EmptyCard({ title, sub }: { title: string; sub?: string }) {
  return (
    <Card className="px-5 py-10 text-center">
      <p className="text-md font-semibold text-muted">{title}</p>
      {sub && <p className="mt-1 text-md text-muted">{sub}</p>}
    </Card>
  );
}

function CategoryNotFound() {
  const t = useMessages(trainingMessages);
  return (
    <Page title={t.title}>
      <NotFoundCard title={t.categoryNotFound} />
    </Page>
  );
}

/**
 * Not offered, or never was (T1 AC-3): one sentence for every reason, so it says nothing about what exists,
 * and the way to the reader's training — the nav item's own words.
 */
export function NotFoundCard({ title }: { title: string }) {
  const t = useMessages(trainingMessages);
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      <p className="mt-1 text-md text-muted">{t.notFoundSub}</p>
      <Link href="/training" className={cn('mt-3 inline-block text-md font-semibold text-navy-soft hover:underline', TEXT_TAP)}>
        {t.trainingModules}
      </Link>
    </Card>
  );
}

/** The read failed (`toDisplayError`): why, and the way to ask again. */
export function ReadFailed({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useMessages(trainingMessages);
  return (
    <Page title={t.title}>
      <ErrorBanner {...error} />
      <Button variant="secondary" className="mt-3" onClick={onRetry}>{t.tryAgain}</Button>
    </Page>
  );
}

/** The list on its way: the title, the subtabs and two skill cards, shaped like what is coming. */
export function CatalogSkeleton({ label }: { label?: string }) {
  const t = useMessages(trainingMessages);
  return (
    <Skeleton label={label ?? t.loadingCatalog}>
      <SkeletonBar className="h-7 w-56" />
      <SkeletonBar className="mt-2 w-80 max-w-full" />
      <div className="mb-6 mt-6 flex gap-6 border-b border-hairline pb-3">
        {[0, 1, 2, 3].map((i) => <SkeletonBar key={i} className="w-16" />)}
      </div>
      <div className="mx-auto flex max-w-[820px] flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-card p-6">
            <SkeletonBar className="h-5 w-40" />
            <SkeletonText lines={3} className="mt-4" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
