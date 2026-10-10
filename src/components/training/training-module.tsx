'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import {
  CatalogSkeleton, NotFoundCard, ReadFailed, TrainingSubtabs, useTrainingCatalog,
} from '@/components/training/training-catalog';
import { FormatIcon, SkillTag, TrainingStatusPill } from '@/components/training/training-parts';
import { Card, ErrorBanner } from '@/components/ui/field';
import { Toast, useToast } from '@/components/ui/toast';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import {
  OWN_COPY, PROTOTYPE_COPY, STATUS_LABEL, TILE, TRAINING_STATUSES, openTrainingItem, readTrainingModule,
  setTrainingStatus, trainingCategoryHref, trainingModuleHref,
  type TrainingItemView, type TrainingModulePage, type TrainingStatus,
} from '@/lib/training';

/**
 * **A module's page** (`/training/[categoryCode]/[moduleCode]`; `Overall.html:3733-3766`, logic
 * `:7812-7856`, `:7899-7914`; P18.5-T1 AC-5 to AC-7).
 *
 * - **The head**: the module's title over *"Structured training module."*, the subtabs with its category
 *   current, *Back to {category title}*, and the card with the title and *"Skill: {label}"*.
 * - **One tile per content item** (contradiction 5, ADR-0032), files then videos then links, each with
 *   the item's own label (contradiction 6), *Uploaded by admin* or *External resource*, and *Open File*,
 *   *Play Video* or *Open Link*. **The *Opened* ✓ is the record's** (D-opened): it survives a reload and
 *   a second device, where the prototype's lived for one page view (`:7817`). A module holding nothing:
 *   *"Nothing to open in this module yet."* (a Fill).
 * - **Opening never meets a popup blocker** (AC-6): a link opens as the click lands and is recorded after;
 *   a file's tab is opened as the click lands, before its signed address is asked for.
 * - **The status**: three buttons, the chosen one navy with `aria-pressed` (ADR-0137 §2; contradiction
 *   10), each **setting** the status, never toggling it, and the prototype's toast. **Not drawn** where
 *   the server says the reader may not set it (`can.update`): in any support session (D-support, F-123).
 * - **No footer** (OD-150): the prototype's promised the reader's *Skill Tracker*, which no agent has.
 */
export function TrainingModule({ categoryCode, moduleCode }: { categoryCode: string; moduleCode: string }) {
  const catalog = useTrainingCatalog();
  const router = useRouter();
  const { me, reload: reloadSession } = useSession();
  const { toast, show } = useToast();
  const [page, setPage] = useState<TrainingModulePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setPage(null);
    setMissing(false);
    setError(null);
    readTrainingModule(moduleCode)
      .then((next) => { if (live) setPage(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [moduleCode, attempt]);

  // The address names the module's own category, so the subtab and the way back agree with it.
  const canonical = page ? trainingModuleHref(page.category.code, page.code) : null;
  const named = trainingModuleHref(categoryCode, moduleCode);
  useEffect(() => {
    if (canonical && canonical !== named) router.replace(canonical);
  }, [canonical, named, router]);

  if (missing) return <ModuleNotFound />;
  if (error) return <ReadFailed error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!page) return <CatalogSkeleton label={OWN_COPY.loadingModule} />;

  const categoryTitle = PROTOTYPE_COPY.categoryTitle(page.category.label);
  const offered = catalog.view?.categories.filter((c) => c.offered) ?? [];

  const choose = async (status: TrainingStatus) => {
    // Ignored while one is out, rather than disabled: a disabled button drops the focus.
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await setTrainingStatus(page.code, status);
      setPage(next);
      show(PROTOTYPE_COPY.marked(next.title, next.status));
      catalog.reload();
      // A module bound to the reader's open activation completes its item (T3): the nav's check follows.
      if (status === 'done' && me?.activation?.open) void reloadSession();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
      else setSaveError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  const opened = (openedItemIds: string[], itemId: string) => {
    setPage((p) => (p ? { ...p, openedItemIds } : p));
    // The prototype's toast says the open is kept: only for a reader whose opens are recorded (`can.update`; never a
    // support session, which records nothing), and only once the record holds it.
    if (page.can.update && openedItemIds.includes(itemId)) show(PROTOTYPE_COPY.markedOpened);
  };

  return (
    <Page title={page.title} subtitle={PROTOTYPE_COPY.moduleSubtitle}>
      {offered.length > 0 && <TrainingSubtabs categories={offered} current={page.category.code} currentAs="location" />}
      <div className="mx-auto max-w-[820px]">
        <BackLink href={trainingCategoryHref(page.category.code)} title={categoryTitle} />
        <Card density="compact">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="font-display text-md font-bold text-navy">{page.title}</h2>
            <SkillTag>{PROTOTYPE_COPY.skillTag(page.skill.label)}</SkillTag>
          </div>

          {page.items.length === 0 ? (
            <p className="mt-4 text-md text-muted">{OWN_COPY.nothingToOpen}</p>
          ) : (
            <ul className="flex flex-col">
              {page.items.map((item) => (
                <ResourceTile
                  key={item.id}
                  moduleCode={page.code}
                  item={item}
                  isOpened={page.openedItemIds.includes(item.id)}
                  onOpened={opened}
                />
              ))}
            </ul>
          )}

          {page.can.update ? (
            <StatusToggle status={page.status} title={page.title} onChoose={(s) => void choose(s)} />
          ) : (
            // Any support session (D-support, F-123): no control, the status as its pill in the toggle's place.
            <p className="mt-[18px]"><TrainingStatusPill status={page.status} /></p>
          )}
          {saveError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-alert">{OWN_COPY.notSaved(saveError.message)}</p>
          )}
        </Card>
      </div>
      <Toast toast={toast} />
    </Page>
  );
}

/** *Back to {category title}* (`:3734-3737`, `.training-back-btn` `:1811-1816`): the chevron and the words, as the link it is. */
function BackLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="mb-3.5 inline-flex items-center gap-1.5 py-1.5 text-base font-semibold text-navy-soft hover:text-navy"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {PROTOTYPE_COPY.back(title)}
    </Link>
  );
}

/**
 * `.resource-tile` (`:3743-3755`, `:1817-1837`): the kind's glyph, the item's label and caption, the ✓
 * once opened, and the button. A link is an anchor to its own address, so the browser opens it as the
 * click lands; a file or a video is a button that opens the tab first and points it at the signed
 * address once the server answers (AC-6, as the product drawer's documents do).
 */
function ResourceTile({
  moduleCode, item, isOpened, onOpened,
}: {
  moduleCode: string;
  item: TrainingItemView;
  isOpened: boolean;
  onOpened: (openedItemIds: string[], itemId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const words = TILE[item.kind];
  const BUTTON = 'shrink-0 rounded-md border border-hairline bg-card px-3.5 py-2 text-sm font-semibold text-navy hover:border-navy-soft hover:text-navy-soft aria-disabled:opacity-60';

  // A link the browser opened from its own anchor, before the server was asked anything.
  const opensItself = item.kind === 'link' && !!item.url;

  const record = async (tab: Window | null) => {
    setBusy(true);
    setError(null);
    try {
      const answer = await openTrainingItem(moduleCode, item.id);
      if (tab) tab.location.href = answer.url;
      else if (!opensItself) window.open(answer.url, '_blank', 'noopener');
      onOpened(answer.openedItemIds, item.id);
    } catch (err) {
      tab?.close();
      // The link is open already; only its record failed, so nothing claims it did not open, and no ✓ is drawn.
      if (!opensItself) setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const openFile = () => {
    if (busy) return;
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    void record(tab);
  };

  return (
    <li className="mt-4" data-item={item.id}>
      <div className="flex items-center gap-3.5 rounded-lg border border-hairline bg-base px-[18px] py-4">
        <span aria-hidden="true" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-hairline bg-card text-navy-soft">
          <FormatIcon kind={item.kind} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-navy" title={item.label}>{item.label}</p>
          <p className="mt-0.5 text-xs text-muted">{words.caption}</p>
        </div>
        {isOpened && (
          <span
            role="img"
            aria-label={PROTOTYPE_COPY.opened}
            title={PROTOTYPE_COPY.opened}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/[0.12] text-success"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {item.kind === 'link' && item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={OWN_COPY.openName(words.button, item.label)}
            onClick={() => { void record(null); }}
            className={BUTTON}
          >
            {words.button}
          </a>
        ) : (
          <button
            type="button"
            onClick={openFile}
            aria-disabled={busy || undefined}
            aria-label={OWN_COPY.openName(words.button, item.label)}
            className={BUTTON}
          >
            {words.button}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <p className="mb-1.5 text-base text-alert">{OWN_COPY.openFailed(item.label)}</p>
          <ErrorBanner {...error} />
        </div>
      )}
    </li>
  );
}

/**
 * `.status-toggle-group` (`:3757-3761`, `:1838-1846`): *Not started · In progress · Done*. **The chosen
 * one is navy** (ADR-0137 §2: a toggle's chosen option is a selection), where the prototype tinted it
 * red, amber or green and said which by colour alone; `aria-pressed` says it to a screen reader.
 */
function StatusToggle({
  status, title, onChoose,
}: {
  status: TrainingStatus;
  title: string;
  onChoose: (status: TrainingStatus) => void;
}) {
  return (
    <div role="group" aria-label={OWN_COPY.statusGroup(title)} className="mt-[18px] flex flex-wrap gap-2">
      {TRAINING_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={status === s}
          onClick={() => onChoose(s)}
          className={cn(
            'min-w-[120px] flex-1 rounded-md border px-3.5 py-[9px] text-base font-semibold',
            status === s ? 'border-navy bg-navy text-white' : 'border-hairline bg-card text-muted hover:border-navy hover:text-navy',
          )}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/** Not offered, or never was (AC-3): the not-found card, under the page's own title. */
function ModuleNotFound() {
  return (
    <Page title={PROTOTYPE_COPY.tab}>
      <div className="mx-auto max-w-[820px]">
        <NotFoundCard title={OWN_COPY.moduleNotFound} />
      </div>
    </Page>
  );
}
