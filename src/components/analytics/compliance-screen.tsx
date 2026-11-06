'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { FeedbackSummarySection } from '@/components/events/feedback-summary';
import { Button, ErrorBanner } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  campaignOf, complianceQuery, firstModuleOf, readCompliance, searchTree, trainingPathOf, treeKindOf,
  type ComplianceCategory, type ComplianceSelection, type ComplianceTrainingCategory, type ComplianceView,
  type SortDirection,
} from '@/lib/kpm-compliance';
import { keepTab, readComplianceAsPlatform } from '@/lib/platform-reads';
import { useSession } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';
import { CampaignPicker, EventPicker, TooltipNote } from './compliance-pickers';
import { ComplianceSummary } from './compliance-summary';
import { ComplianceTree, TreeSkeleton } from './compliance-tree';
import { GroupFilter } from './group-filter';
import { ModulePicker, V1Compliance } from './v1-compliance';

/**
 * **Compliance, Events, and Campaigns** (`KPM_Owner.html:1262-1286`, `:3449-4118`; P18.3-T1, P18.3-T2): the
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
 * **Its words are the reader's** (P18.10-T4; `kpmComplianceMessages`): the heading and the six chips kept English, the
 * rest the approved glossary's; a category's, an event's and a campaign's names are the office's, shown as typed.
 */
export function ComplianceScreen({ selection, group = null, platformKpmId }: {
  selection: ComplianceSelection;
  group?: string | null;
  /** ***Lihat sebagai KPM*** (P19.4-T3 AC-4): the KPM's tree, read by the Super Admin through the platform read, read-only. */
  platformKpmId?: string;
}) {
  const t = useMessages(kpmComplianceMessages);
  const { me } = useSession();
  const office = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);
  const router = useRouter();
  const pathname = usePathname();
  const headingId = useId();

  /** The selection on screen: the address's, and the one just chosen until the address catches up. */
  const [shown, setShown] = useState<ComplianceSelection>(selection);
  useEffect(() => setShown({ category: selection.category, item: selection.item }), [selection.category, selection.item]);
  /** The custom group on screen (P19.3-T3 AC-15): the address's, and the one just chosen until it catches up. */
  const [inGroup, setInGroup] = useState<string | null>(group);
  useEffect(() => setInGroup(group), [group]);
  const { category, item } = shown;
  const key = `${category}|${item ?? ''}|${inGroup ?? ''}`;
  /** The AB rows open (UI-098: collapsed until opened), kept across reads and *Back* from a name (UI-095). */
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => savedOpen());
  const toggleSection = (id: string) => setOpenSections((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    keepOpen(next);
    return next;
  });

  const [held, setHeld] = useState<{ key: string; view: ComplianceView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<SortDirection>('worst');
  /** A training category with no module, pressed: shown on the screen, read from nowhere. */
  const [emptyCategory, setEmptyCategory] = useState<string | null>(null);
  /*
   * **UI-109's Compliance below 1024px, for every reader** (P19.3-T3; the one shell hosts the Owner's pages since Phase
   * 19.2): the six tiles three across, the one module picker, the AB rows. From 1024px the tree with UI-098's changes.
   */
  const desktop = useMediaQuery('desktop', { beforePaint: true });

  useEffect(() => {
    let live = true;
    const asked = `${category}|${item ?? ''}|${inGroup ?? ''}`;
    setError(null);
    (platformKpmId === undefined
      ? readCompliance({ category, item }, inGroup)
      : readComplianceAsPlatform(platformKpmId, { category, item }, inGroup))
      .then((next) => { if (live) setHeld({ key: asked, view: next }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [category, item, inGroup, attempt, platformKpmId]);

  // Back from a name (UI-095): the page where it was left.
  useEffect(() => {
    if (held === null) return;
    const y = takeScroll(pathname);
    if (y !== null) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [held, pathname]);

  const view = held?.view ?? null;
  const fresh = held?.key === key;

  const choose = (next: ComplianceSelection) => {
    setEmptyCategory(null);
    setShown(next);
    router.replace(`${pathname}${keepTab(complianceQuery(next, inGroup), platformKpmId, 'compliance')}`, { scroll: false });
  };

  /** *Lihat untuk* (AC-15): the same selection over the group chosen, or the whole KPM. */
  const chooseGroup = (next: string | null) => {
    setInGroup(next);
    router.replace(`${pathname}${keepTab(complianceQuery(shown, next), platformKpmId, 'compliance')}`, { scroll: false });
  };
  const groupPill = view && (office || view.groups.length > 0) ? (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <GroupFilter groups={view.groups} group={view.group} officePeople={view.people} manages={office} onChoose={chooseGroup} />
    </div>
  ) : null;
  // A name followed keeps the page's place for *Back* (UI-095).
  const onLeave = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('a[href]')) saveScroll(pathname);
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

  if (!desktop) {
    return (
      <div className="min-w-0" data-part="compliance" onClickCapture={onLeave}>
        {groupPill}
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
              onChanged={() => setAttempt((n) => n + 1)}
            />
            {category === 'activity' && fresh && <div className="mt-2"><TooltipNote>{t.activityTooltip}</TooltipNote></div>}
            {fresh && <div className="mt-3"><PastEventCard view={view} /></div>}
            {!fresh && !error && <TreeSkeleton />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0" data-part="compliance" onClickCapture={onLeave}>
      {groupPill}
      {/*
        * **No repeated heading** (UI-098, D-35): the tab is *Compliance*, and the panel's heading is its counted line —
        * *"28 orang · 5 unit AB"* — where it repeated *Compliance, Events, and Campaigns* (`.section-head`, `:1265-1268`).
        */}
      <h2 id={headingId} className="mb-3.5 text-md font-bold text-navy">
        {view && view.units > 0 ? t.v1.head({ people: view.people, units: view.units }) : <span className="sr-only">{t.title}</span>}
      </h2>

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
              open={openSections}
              onToggleSection={toggleSection}
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
      // UI-098 (UI-109's at every size): one module picker — category › skill › module inside — for the three chip rows.
      return (
        <div className="mb-3.5 lg:max-w-[480px]">
          <ModulePicker catalog={catalog.training} selected={selected} emptyCategory={emptyCategory} onTraining={onTraining} onItem={onItem} />
        </div>
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
 * `#eventCampaignSummary` (`:1271`, `:3801`): a **past** event's *Feedback Summary* above its tree — P18.2-T6's
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
        className="min-w-[160px] flex-1 basis-full rounded-md border border-hairline bg-card px-2.5 py-2 text-sm text-navy focus:border-primary sm:max-w-[240px] sm:basis-0"
      />
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto rounded-pill border border-hairline bg-card px-3 py-1.5 text-sm font-semibold text-muted hover:border-secondary/30 hover:text-navy"
      >
        <span aria-hidden="true">{arrow}</span> {t.sort[kind][direction]}
      </button>
    </div>
  );
}

/** The body under the filters: the tree, or why there is none. */
function Body({
  view, emptyCategory, search, direction, onChanged, open, onToggleSection,
}: {
  view: ComplianceView;
  emptyCategory: string | null;
  search: string;
  direction: SortDirection;
  onChanged: () => void;
  open: ReadonlySet<string>;
  onToggleSection: (id: string) => void;
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
      // A search opens every row it keeps: what was searched for is shown, not folded away.
      open={search.trim() ? new Set(sections.map((s) => s.head.membershipId)) : open}
      onToggle={onToggleSection}
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

/*
 * ── Where the page was left (UI-095, UI-098; P19.3-T3 AC-11) ────────────────────────────────────
 */

/** The AB rows open, and the scroll a name was followed from: this tab's session only, and it may be unavailable. */
const OPEN_KEY = 'kpm-compliance:open';
const SCROLL_KEY = 'kpm-compliance:return';

function savedOpen(): ReadonlySet<string> {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function keepOpen(ids: ReadonlySet<string>) {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify([...ids]));
  } catch {
    // No storage: the rows start folded next time.
  }
}

function saveScroll(at: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ at, y: window.scrollY }));
  } catch {
    // No storage: Back comes to the top.
  }
}

function takeScroll(at: string): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: string; y?: number };
    if (saved.at !== at || typeof saved.y !== 'number') return null;
    sessionStorage.removeItem(SCROLL_KEY);
    return saved.y;
  } catch {
    return null;
  }
}
