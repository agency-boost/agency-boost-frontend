'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language-switch';
import { Page } from '@/components/page';
import { SkillCards } from '@/components/training/training-parts';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { TEXT_TAP } from '@/components/ui/phone';
import { BELOW_DESKTOP_ROW } from '@/components/ui/tablet';
import { useTabRow } from '@/components/ui/use-tab-row';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { trainingMessages } from '@/i18n/messages/training';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  readTrainingProgress, trainingCategoryHref,
  type TrainingCategoryProgress, type TrainingProgressView,
} from '@/lib/training';

/**
 * **The learner's training** (`/training`, `/training/[categoryCode]`; `Overall.html:3708-3732`, logic
 * `:7768-7810`, `:7857-7897`; P18.5-T1 AC-4; redrawn by Phase 18.99 T10 after the UI V1 report, UI-063 to UI-066,
 * UI-071).
 *
 * **One read for every address under `/training`**: the offered catalog with the reader's statuses,
 * `GET /training/progress`, held by the layout so the category row, the list and the module page draw from the
 * same answer, and read again after the reader sets a status, so going back to the list shows it.
 */

interface CatalogRead {
  view: TrainingProgressView | null;
  error: ApiError | null;
  /** Read again: after a status write, or when the reader asks after a failure. */
  reload: () => void;
  /**
   * The window is a phone's or a tablet's (UI-065, UI-066: both draw the one-card list), asked once by the layout,
   * which outlives every page under it, so a category's list opened from another already knows and never draws the
   * desktop's cards first.
   */
  compact: boolean;
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
  // Not before paint: a layout effect's update at the layout's level held the field shell's first frame on a phone.
  // The list draws after the read answers, by when the width is known; the skeleton is shaped for both by CSS.
  const compact = useMediaQuery(['phone', 'tablet']);
  return <CatalogContext.Provider value={{ view, error, reload, compact }}>{children}</CatalogContext.Provider>;
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
    <Page title={t.title} control={<TitleLanguage />}>
      <EmptyCard title={t.noTraining} sub={t.noTrainingSub} />
    </Page>
  );
}

/**
 * *ID | EN* on the title row below 1024px (ADR-0180 §3: **Training keeps its title-row pill**, as its mockup draws).
 * From 1024px the page header carries the switch, as every page's does.
 */
function TitleLanguage() {
  return <LanguageSwitch tone="page" />;
}

/**
 * `/training/[categoryCode]` (AC-4; UI-063 to UI-066): *Training Modules*, the category's own description under it
 * **on a desktop only** (UI-063), the category row **directly under the title when the office offers two or more**,
 * and the skills — no *Skills List* heading (UI-063). A category offering nothing keeps the prototype's empty card
 * (`:3771-3776`) and *coming soon*. **No footer** (OD-150).
 */
export function TrainingCategory({ code }: { code: string }) {
  const { view, error, reload, compact } = useTrainingCatalog();
  const t = useMessages(trainingMessages);
  if (error && !view) return <ReadFailed error={error} onRetry={reload} />;
  if (!view) return <CatalogSkeleton />;

  // The API upper-cases a code before it looks it up, so a lower-case address still names the category.
  const offered = view.categories.filter((c) => c.offered);
  const category = offered.find((c) => c.code === code.toUpperCase());
  if (!category) return <CategoryNotFound />;

  const hasModules = category.total > 0;
  const title = t.categoryTitle({ label: category.label });
  return (
    <Page
      title={t.title}
      subtitle={hasModules ? (category.description ?? undefined) : t.comingSoon}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      control={<TitleLanguage />}
    >
      {offered.length >= 2 && <TrainingSubtabs categories={offered} current={category.code} />}
      <div className="flex flex-col gap-3">
        {hasModules
          ? <SkillCards skills={category.skills} categoryCode={category.code} compact={compact} />
          : <EmptyCard title={title} sub={t.comingSoon} />}
      </div>
    </Page>
  );
}

/**
 * **The category row** (UI-063): the office's offered categories in its order, each an address, in a `nav` with the
 * current one marked — directly under the title, **drawn only when there are two or more**. One line at every size,
 * never wrapping (the coaching tab row's allowed exception, UI-030):
 *
 * - **a phone** — a swipeable row of 36px pills inside 44px targets, 8px apart, the current one navy with white words,
 *   the rest white with dark grey words; no scrollbar, a fade at the side with more, the current one scrolled into view;
 * - **a tablet and a desktop** — underline tabs, the current one navy over a 2px accent rule; a tablet's scrolls with
 *   the same fade when it must.
 */
export function TrainingSubtabs({
  categories, current, currentAs = 'page',
}: {
  categories: readonly Pick<TrainingCategoryProgress, 'code' | 'label'>[];
  current: string;
  /** `page` on the category's own list; `location` where the reader is inside it. */
  currentAs?: 'page' | 'location';
}) {
  const row = useTabRow<HTMLElement>(current);
  const t = useMessages(trainingMessages);
  return (
    <nav
      ref={row.ref}
      aria-label={t.tab}
      data-fade={row.fade}
      {...BELOW_DESKTOP_ROW}
      className={cn(
        'flex flex-nowrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'mb-3.5 gap-2 max-md:-mx-4 max-md:px-4',
        'md:mb-5 md:gap-7 md:shadow-[inset_0_-1px_0_var(--color-line)]',
      )}
    >
      {categories.map((c) => {
        const on = c.code === current;
        return (
          <Link
            key={c.code}
            href={trainingCategoryHref(c.code)}
            aria-current={on ? currentAs : undefined}
            className={cn(
              'shrink-0 whitespace-nowrap text-md font-semibold focus-visible:[outline-offset:-2px]',
              // A phone: a 36px pill centred in a 44px target.
              'max-md:flex max-md:min-h-11 max-md:items-center',
              // A tablet and a desktop: an underline tab.
              'md:border-b-2 md:px-0.5 md:pb-3 md:pt-1',
              on ? 'md:border-amber md:text-navy' : 'md:border-transparent md:text-muted md:hover:text-navy',
            )}
          >
            <span
              className={cn(
                'max-md:flex max-md:h-9 max-md:items-center max-md:rounded-pill max-md:px-3.5',
                on ? 'max-md:bg-navy max-md:text-white' : 'max-md:bg-card max-md:text-pill-grey-ink',
              )}
            >
              {c.label}
            </span>
          </Link>
        );
      })}
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

/**
 * **The list on its way, shaped like the list** (UI-071: the old one drew four tabs and two cards over a page of one
 * tab and six cards, and the page jumped). The title, then — below 1024px — one card of skill headers and rows, and —
 * from 1024px — two columns of skill cards. **No category row**: before the read nobody knows whether there will be
 * two, and one category, the common case, draws none. Both shapes are drawn and the stylesheet keeps one, so the first
 * frame is already the right one at any width.
 */
export function CatalogSkeleton({ label }: { label?: string }) {
  const t = useMessages(trainingMessages);
  return (
    <Skeleton label={label ?? t.loadingCatalog}>
      <div className="mb-3 flex min-h-11 items-center lg:mb-5 lg:block lg:min-h-0">
        <SkeletonBar className="h-6 w-48 lg:h-7 lg:w-56" />
        <SkeletonBar className="mt-2 w-80 max-w-full max-lg:hidden" />
      </div>
      <div className="overflow-hidden rounded-lg border border-card-edge bg-card lg:hidden">
        {[3, 2, 2].map((rows, i) => (
          <div key={i}>
            <div className="flex h-10 items-center gap-2.5 bg-hover-row px-4"><SkeletonBar className="h-4 w-32" /></div>
            {Array.from({ length: rows }, (_, j) => (
              <div key={j} className="flex min-h-11 items-center gap-2 border-t border-divider pl-4 pr-3">
                <SkeletonBar className="h-4 flex-1" />
                <SkeletonBar className="h-6 w-20 rounded-pill" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 items-start gap-4 max-lg:hidden">
        {[3, 2, 2, 1].map((rows, i) => (
          <div key={i} className="rounded-lg border border-card-edge bg-card px-5 py-4">
            <SkeletonBar className="h-5 w-40" />
            {Array.from({ length: rows }, (_, j) => <SkeletonBar key={j} className="mt-5 h-4 w-full" />)}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
