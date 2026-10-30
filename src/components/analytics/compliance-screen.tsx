'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { FeedbackSummarySection } from '@/components/events/feedback-summary';
import { useFieldChrome } from '@/components/field-nav';
import { Button, ErrorBanner } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  campaignOf, complianceQuery, firstModuleOf, readCompliance, searchTree, trainingPathOf, treeKindOf,
  type ComplianceCategory, type ComplianceSelection, type ComplianceTrainingCategory, type ComplianceView,
  type SortDirection,
} from '@/lib/kpm-compliance';
import { CampaignPicker, EventPicker, TooltipNote, TrainingTabs } from './compliance-pickers';
import { ComplianceSummary } from './compliance-summary';
import { ComplianceTree, TreeSkeleton } from './compliance-tree';
import { V1Compliance } from './v1-compliance';
import { usePhone } from '@/lib/use-phone';

/**
 * **Compliance, Events, and Campaigns** (`KPM_Owner.html:1262-1286`, `:3449-4118`; P18.6-T1, P18.6-T2): the
 * heading and its counted sub-line, the six chips, the chosen category's tabs or picker, Activity's note, a past
 * event's *Feedback Summary*, search and sort, and the tree — over one read of the server's
 * (`GET /kpm/analytics/compliance`).
 *
 * **The selection is the address's** (`?category=&item=`, as `?period=` is on the Overview), so a refresh keeps
 * it: choosing a chip, a tab or an item re-reads the tree for it, and a retry after a failure keeps it too.
 * While a new selection is read, the chips and tabs stay and the tree is drawn in outline: the old item's
 * statuses under the new item's tab would lie. **Search and sort are the screen's**, as the prototype's are:
 * neither is sent, and neither survives a refresh.
 *
 * A training category holding no module is chosen on the screen alone: nothing is read for it, and it shows
 * *"Modules for {name} are coming soon."* until another tab is pressed.
 *
 * The states the prototype lacks are Fills (L-01): the outline while reading, an error with a retry that keeps
 * the selection, a team with no AB, and a year with no training, event or campaign to show.
 *
 * **Its words are the reader's** (P18.98-T4; `kpmComplianceMessages`): the heading and the six chips kept English, the
 * rest the approved glossary's; a category's, an event's and a campaign's names are the office's, shown as typed.
 */
export function ComplianceScreen({ selection }: { selection: ComplianceSelection }) {
  const t = useMessages(kpmComplianceMessages);
  const router = useRouter();
  const pathname = usePathname();
  const headingId = useId();

  /** The selection on screen: the address's, and the one just chosen until the address catches up. */
  const [shown, setShown] = useState<ComplianceSelection>(selection);
  useEffect(() => setShown({ category: selection.category, item: selection.item }), [selection.category, selection.item]);
  const { category, item } = shown;
  const key = `${category}|${item ?? ''}`;

  const [held, setHeld] = useState<{ key: string; view: ComplianceView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<SortDirection>('worst');
  /** A training category with no module, pressed: shown on the screen, read from nowhere. */
  const [emptyCategory, setEmptyCategory] = useState<string | null>(null);
  // UI V1 (UI-109): a phone in the field shell reads the compact Compliance; the console and wider screens as before.
  const phone = usePhone();
  const field = useFieldChrome() !== null;

  useEffect(() => {
    let live = true;
    const asked = `${category}|${item ?? ''}`;
    setError(null);
    readCompliance({ category, item })
      .then((next) => { if (live) setHeld({ key: asked, view: next }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [category, item, attempt]);

  const view = held?.view ?? null;
  const fresh = held?.key === key;

  const choose = (next: ComplianceSelection) => {
    setEmptyCategory(null);
    setShown(next);
    router.replace(`${pathname}${complianceQuery(next)}`, { scroll: false });
  };

  /** A chip: its category, its default item, and worst-first again (`jumpToCategory`, `:3480-3484`). */
  const chooseCategory = (next: ComplianceCategory) => {
    setDirection('worst');
    choose({ category: next, item: null });
  };

  const chooseTraining = (next: ComplianceTrainingCategory) => {
    const first = firstModuleOf(next);
    if (first) choose({ category: 'training', item: first });
    else setEmptyCategory(next.code);
  };

  const selected = fresh && view ? view.selected.item : item;
  const kind = treeKindOf(category);

  /**
   * *Try again*, the same selection read again — except for an item in the address that no retry will ever read:
   * one the team does not list (another team's, archived, outside the year: `404`) or one the read refuses as
   * written (too long: `400`). Then the way back is the category's own default.
   */
  const missing = (error?.code === 'NOT_FOUND' || error?.code === 'VALIDATION_FAILED') && item !== null;
  const retry = missing
    ? { label: t.backTo({ category: t.chips[category] }), run: () => choose({ category, item: null }) }
    : { label: t.tryAgain, run: () => setAttempt((n) => n + 1) };

  if (phone && field) {
    return (
      <div className="min-w-0" data-part="compliance">
        {!view && !error && <TreeSkeleton withChips />}
        {error && <Failed error={error} onRetry={retry} />}
        {view && (
          <>
            <V1Compliance
              view={view}
              fresh={fresh}
              category={category}
              selected={selected}
              emptyCategory={emptyCategory}
              direction={direction}
              onCategory={chooseCategory}
              onTraining={chooseTraining}
              onItem={(next) => choose({ category, item: next })}
              onToggle={() => setDirection((d) => (d === 'worst' ? 'best' : 'worst'))}
            />
            {fresh && <div className="mt-3"><PastEventCard view={view} /></div>}
            {!fresh && !error && <TreeSkeleton />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0" data-part="compliance">
      {/* `.section-head` (`:1265-1268`): the title and its sub-line, both counts the read's (contradiction 1). */}
      <div className="mb-3.5 flex flex-col items-start gap-[3px] md:flex-row md:items-baseline md:justify-between">
        <h2 id={headingId} className="font-display text-lg font-bold text-navy">{t.title}</h2>
        {view && view.units > 0 && <p className="text-sm text-muted">{t.sub({ people: view.people, units: view.units })}</p>}
      </div>

      {!view && !error && <TreeSkeleton withChips />}
      {!view && error && <Failed error={error} onRetry={retry} />}

      {view && (
        <>
          <ComplianceSummary chips={view.summary} active={category} onChoose={chooseCategory} />
          <Selector
            view={view}
            category={category}
            selected={selected}
            emptyCategory={emptyCategory}
            onTraining={chooseTraining}
            onItem={(next) => choose({ category, item: next })}
          />
          {category === 'activity' && <TooltipNote>{t.activityTooltip}</TooltipNote>}
          {fresh && <PastEventCard view={view} />}

          {view.tree.length > 0 && (
            <Filters search={search} onSearch={setSearch} kind={kind} direction={direction} onToggle={() => setDirection((d) => (d === 'worst' ? 'best' : 'worst'))} />
          )}

          {/*
            A failed re-read of the selection on screen (after an override, or a retry) keeps the tree under the
            error: unmounting it would take every *Achieved* cell with it — an open dialog, its typed reason, the
            toast, the focus. A failed read of a new selection has no tree of its own to keep, so the error stands alone.
          */}
          {error && <Failed error={error} onRetry={retry} />}
          {fresh ? (
            <Body
              view={view}
              emptyCategory={emptyCategory}
              search={search}
              direction={direction}
              onChanged={() => setAttempt((n) => n + 1)}
            />
          ) : !error && <TreeSkeleton />}
        </>
      )}
    </div>
  );
}

/** The error, as `toDisplayError` puts it, and the way on: a retry of the same selection, or back to its default. */
function Failed({ error, onRetry }: { error: ApiError; onRetry: { label: string; run: () => void } }) {
  return (
    <div className="mb-4">
      <ErrorBanner {...error} />
      <Button variant="secondary" className="mt-3" onClick={onRetry.run}>{onRetry.label}</Button>
    </div>
  );
}

/** The chosen category's tabs or its picker (`renderItemTabs`, `:3540-3627`); nothing for a single-item one. */
function Selector({
  view, category, selected, emptyCategory, onTraining, onItem,
}: {
  view: ComplianceView;
  category: ComplianceCategory;
  selected: string | null;
  emptyCategory: string | null;
  onTraining: (category: ComplianceTrainingCategory) => void;
  onItem: (item: string) => void;
}) {
  const { catalog, today } = view;
  switch (category) {
    case 'training': {
      if (catalog.training.length === 0) return null;
      const path = trainingPathOf(catalog.training, selected);
      const active = catalog.training.find((c) => c.code === emptyCategory) ?? path?.category ?? catalog.training[0];
      const showing = active.code === path?.category.code;
      return (
        <TrainingTabs
          catalog={catalog.training}
          category={active}
          skill={showing ? path!.skill : null}
          module={showing ? selected : null}
          onCategory={onTraining}
          onSkill={(skill) => onItem(skill.modules[0].code)}
          onModule={(module) => onItem(module.code)}
        />
      );
    }
    // One item each: the prototype draws no item tab for them (`renderItemTabs`, `:3609-3611`), and nor does this.
    case 'goals':
    case 'activity':
    case 'activation':
      return null;
    case 'events':
      return catalog.events.length > 0
        ? <EventPicker events={catalog.events} selected={selected} today={today} onChoose={onItem} />
        : null;
    case 'campaigns':
      return catalog.campaigns.length > 0
        ? <CampaignPicker campaigns={catalog.campaigns} selected={selected} today={today} onChoose={onItem} />
        : null;
  }
}

/**
 * `#eventCampaignSummary` (`:1271`, `:3801`): a **past** event's *Feedback Summary* above its tree — P18.5-T6's
 * card with its own read (`GET /kpm/settings/events/:id/feedback`), names shown (ADR-0141). None for an upcoming
 * or a running one, which nobody has rated yet.
 */
function PastEventCard({ view }: { view: ComplianceView }) {
  if (view.selected.category !== 'events' || !view.selected.item) return null;
  const event = view.catalog.events.find((e) => e.id === view.selected.item);
  if (event?.phase !== 'past') return null;
  return (
    <div className="mb-[18px]">
      <FeedbackSummarySection key={event.id} eventId={event.id} version={0} />
    </div>
  );
}

/**
 * `.compliance-filters` (`:1277-1280`, CSS `:104-110`, `:140-141`): the search, as drawn and named, and the sort
 * toggle, its label the order it will show (`updateSortButton`, `:3672-3684`), the arrow kept from a screen reader.
 */
function Filters({
  search, onSearch, kind, direction, onToggle,
}: {
  search: string;
  onSearch: (value: string) => void;
  kind: ReturnType<typeof treeKindOf>;
  direction: SortDirection;
  onToggle: () => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const arrow = direction === 'worst' ? '↓' : '↑';
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchName}
        // A row of its own below `sm`, the sort under it: beside the sort at 360px it cut its own placeholder.
        className="min-w-[160px] flex-1 basis-full rounded-md border border-hairline bg-card px-2.5 py-2 text-sm text-navy focus:border-amber sm:max-w-[240px] sm:basis-0"
      />
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto rounded-pill border border-hairline bg-card px-3 py-1.5 text-sm font-semibold text-muted hover:border-navy/30 hover:text-navy"
      >
        <span aria-hidden="true">{arrow}</span> {t.sort[kind][direction]}
      </button>
    </div>
  );
}

/** The body under the filters: the tree, or why there is none. */
function Body({
  view, emptyCategory, search, direction, onChanged,
}: {
  view: ComplianceView;
  emptyCategory: string | null;
  search: string;
  direction: SortDirection;
  onChanged: () => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const { catalog, selected } = view;
  const category = selected.category;

  if (view.tree.length === 0) {
    return <Empty title={t.noAbTitle}><p>{t.noAbLine}</p></Empty>;
  }
  if (category === 'training') {
    if (catalog.training.length === 0) return <Empty title={t.noTraining} />;
    const path = trainingPathOf(catalog.training, selected.item);
    const active = catalog.training.find((c) => c.code === emptyCategory) ?? path?.category ?? catalog.training[0];
    if (!firstModuleOf(active)) return <Empty title={t.comingSoon({ name: active.label })} />;
  }
  if (category === 'events' && catalog.events.length === 0) return <Empty title={t.noEvents} />;
  if (category === 'campaigns' && catalog.campaigns.length === 0) return <Empty title={t.noCampaigns} />;

  const sections = searchTree(view.tree, search);
  if (sections.length === 0) return <Empty title={t.noMatch} filtered />;

  const campaign = category === 'campaigns' ? campaignOf(catalog.campaigns, selected.item) : null;
  return (
    <ComplianceTree
      sections={sections}
      direction={direction}
      context={{
        category,
        kind: treeKindOf(category),
        today: view.today,
        campaign: campaign && { code: campaign.code, title: campaign.title },
        canOverride: view.can.override,
        onChanged,
      }}
    />
  );
}

/** `.compliance-empty` (`:111`): the line in a card where the tree would be. */
function Empty({ title, filtered = false, children }: { title: string; filtered?: boolean; children?: ReactNode }) {
  // `.compliance-empty`: 26px, 13px muted words centred, on the card, no top rule, the bottom corners rounded.
  return (
    <div
      className="rounded-b-lg border border-t-0 border-hairline bg-card p-[26px] text-center text-base text-muted"
      data-variant={filtered ? 'filtered' : 'empty'}
      data-part="empty"
    >
      <p>{title}</p>
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}
