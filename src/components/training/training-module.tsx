'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { PageLanguageSwitch } from '@/components/app-shell';
import { Page } from '@/components/page';
import { NotFoundCard, ReadFailed, useTrainingCatalog } from '@/components/training/training-catalog';
import { FormatIcon, SkillTag, TrainingStatusPill } from '@/components/training/training-parts';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { trainingMessages } from '@/i18n/messages/training';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import {
  TRAINING_STATUSES, linkDomain, openTrainingItem, readTrainingModule,
  setTrainingStatus, trainingCategoryHref, trainingModuleHref, trainingModulePosition,
  type TrainingItemView, type TrainingModulePage, type TrainingStatus,
} from '@/lib/training';

/**
 * **A module's page** (`/training/[categoryCode]/[moduleCode]`; `Overall.html:3733-3766`, logic `:7812-7856`,
 * `:7899-7914`; P18.5-T1 AC-5 to AC-7; redrawn by Phase 18.99 T10 after the UI V1 report, UI-067 to UI-069, UI-071).
 *
 * - **No subtitle, no category row, no repeated title, no *Diunggah oleh admin*** (UI-067). Below 1024px a 48px back
 *   row, *‹ Training Modules*, then the **navy lesson card**: *Skill: {label}* and the module's place in its skill
 *   (*1/3*), the module's title — **the page's one heading** — and its content, one block per item in today's order
 *   (files, videos, links): a file's row and a full-width *Buka file ↗*; a link's row with its site and *Buka tautan ↗*;
 *   a video's player, which plays **in place**. Under it the status card. From 1024px, *‹ Kembali ke Training Modules*
 *   with *ID | EN* on the right, then two columns — the lesson card, and the status card beside it.
 * - **"✓ Sudah dibuka"** as words under an opened item's name, readable without hover (UI-069). **The record's**
 *   (D-opened): it survives a reload and a second device.
 * - **Opening never meets a popup blocker** (AC-6): a link opens as the click lands and is recorded after; a file's tab
 *   is opened as the click lands, before its signed address is asked for. A video asks for its address and plays it
 *   here.
 * - **The status: three big buttons the reader sets by hand** (UI-068; OD-149), one row of three below 1024px and a
 *   stack on a desktop, the chosen one in the accent (`aria-pressed`) — at once, and put back if the server refuses.
 *   Each **sets** the status, never toggles it, and says so in the toast. **Not drawn** where the server says the reader
 *   may not set it (`can.update`): in any support session the status is its pill, in the card (D-support, F-123).
 */
export function TrainingModule({ categoryCode, moduleCode }: { categoryCode: string; moduleCode: string }) {
  const catalog = useTrainingCatalog();
  const t = useMessages(trainingMessages);
  const router = useRouter();
  const { me, reload: reloadSession } = useSession();
  const { toast, show } = useToast();
  const [page, setPage] = useState<TrainingModulePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  /** The status the reader just chose, shown at once while it is saved (UI-068: selected within ~0.2s). */
  const [chosen, setChosen] = useState<TrainingStatus | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const titleId = useId();

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

  // The address names the module's own category, so the way back agrees with it.
  const canonical = page ? trainingModuleHref(page.category.code, page.code) : null;
  const named = trainingModuleHref(categoryCode, moduleCode);
  useEffect(() => {
    if (canonical && canonical !== named) router.replace(canonical);
  }, [canonical, named, router]);

  if (missing) return <ModuleNotFound />;
  if (error) return <ReadFailed error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!page) return <ModuleSkeleton />;

  const position = trainingModulePosition(catalog.view, page.skill.code, page.code);

  const choose = async (status: TrainingStatus) => {
    // Ignored while one is out, rather than disabled: a disabled button drops the focus.
    if (saving) return;
    setSaving(true);
    setChosen(status);
    setSaveError(null);
    try {
      const next = await setTrainingStatus(page.code, status);
      setPage(next);
      show(t.marked({ title: next.title, status: next.status }));
      catalog.reload();
      // A module bound to the reader's open activation completes its item (T3): the nav's check follows.
      if (status === 'done' && me?.activation?.open) void reloadSession();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
      else setSaveError(toDisplayError(err));
    } finally {
      setChosen(null);
      setSaving(false);
    }
  };

  const opened = (openedItemIds: string[], itemId: string) => {
    setPage((p) => (p ? { ...p, openedItemIds } : p));
    // The prototype's toast says the open is kept: only for a reader whose opens are recorded (`can.update`; never a
    // support session, which records nothing), and only once the record holds it.
    if (page.can.update && openedItemIds.includes(itemId)) show(t.markedOpened);
  };

  const status = chosen ?? page.status;

  return (
    <Page>
      <div className="max-w-[1000px]" data-module-page="">
        <div className="flex items-center">
          <BackLink href={trainingCategoryHref(page.category.code)} />
          <PageLanguageSwitch className="ml-auto" />
        </div>
        <div className="mt-2 flex flex-col gap-3 lg:mt-[18px] lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-5">
          <section aria-labelledby={titleId} className="min-w-0 rounded-[20px] bg-navy p-[18px] text-white lg:px-7 lg:py-[26px]" data-lesson-card="">
            <div className="flex items-center gap-2">
              <SkillTag>{t.skillTag({ label: page.skill.label })}</SkillTag>
              {position && (
                <span className="ml-auto shrink-0 text-xs text-on-navy-muted lg:text-base">
                  <span aria-hidden="true">{position.n}/{position.of}</span>
                  <span className="sr-only">{t.position(position)}</span>
                </span>
              )}
            </div>
            <h1 id={titleId} className="mt-3 break-words text-[22px] font-bold leading-tight lg:mt-3.5 lg:text-[30px]">{page.title}</h1>
            {page.items.length === 0 ? (
              <p className="mt-4 text-md text-on-navy-muted">{t.nothingToOpen}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4 lg:mt-[22px]">
                {page.items.map((item) => (
                  <Resource
                    key={item.id}
                    moduleCode={page.code}
                    item={item}
                    isOpened={page.openedItemIds.includes(item.id)}
                    onOpened={opened}
                  />
                ))}
              </ul>
            )}
          </section>

          <StatusCard
            title={page.title}
            status={status}
            canUpdate={page.can.update}
            onChoose={(s) => void choose(s)}
            error={saveError}
          />
        </div>
      </div>
      <Toast toast={toast} />
    </Page>
  );
}

/**
 * The way back to the list (P18.95-T9 AC-2; UI-067): *‹ Training Modules* in a 48px row below 1024px, *‹ Kembali ke
 * Training Modules* from 1024px. Named the long way at every width, which holds the short words (WCAG 2.5.3).
 */
function BackLink({ href }: { href: string }) {
  const t = useMessages(trainingMessages);
  return (
    <Link
      href={href}
      aria-label={t.back({ title: t.title })}
      className="-ml-1 inline-flex min-h-12 items-center gap-1 pr-2 text-md font-semibold text-navy hover:text-navy-soft lg:min-h-11"
    >
      <LineIcon name="chevronLeft" className="h-[22px] w-[22px] lg:h-[18px] lg:w-[18px]" />
      <span className="lg:hidden">{t.title}</span>
      <span className="max-lg:hidden">{t.back({ title: t.title })}</span>
    </Link>
  );
}

/** ↗ after *Buka file* and *Buka tautan*: it leaves the page. */
function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

/** *✓ Sudah dibuka* under an opened item's name (UI-069): words, in the on-navy green, never a lone tick. */
function OpenedLine() {
  const t = useMessages(trainingMessages);
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-on-navy-green" data-opened="">
      <LineIcon name="check" className="h-3.5 w-3.5" />
      {t.opened}
    </p>
  );
}

/**
 * **One item of the module, as its kind is drawn** (UI-067). A file and a link: a row on the card's lighter navy — the
 * kind's icon on a white tile, the item's own label (contradiction 6), a link's site under it, *Sudah dibuka* once
 * opened — and the accent's button: full width under the row below 1024px, at the row's end from 1024px. A link is an
 * anchor to its own address, so the browser opens it as the click lands; a file is a button that opens the tab first
 * and points it at the signed address once the server answers (AC-6). A video is `VideoItem`.
 */
function Resource({
  moduleCode, item, isOpened, onOpened,
}: {
  moduleCode: string;
  item: TrainingItemView;
  isOpened: boolean;
  onOpened: (openedItemIds: string[], itemId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const t = useMessages(trainingMessages);
  const words = t.tile[item.kind];

  if (item.kind === 'video') {
    return <VideoItem moduleCode={moduleCode} item={item} isOpened={isOpened} onOpened={onOpened} />;
  }

  // A link the browser opened from its own anchor, before the server was asked anything.
  const opensItself = item.kind === 'link' && !!item.url;
  const domain = item.kind === 'link' ? linkDomain(item.url) : null;
  // Navy words on the accent (parity I-542): white on `#E8954A` is 2.38:1.
  const BUTTON = cn(
    'mt-3.5 flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-pill bg-amber px-6 text-lg font-bold text-navy',
    'hover:bg-amber-dark aria-disabled:opacity-60 lg:mt-0 lg:h-12 lg:w-auto lg:px-[26px] lg:text-[15px]',
  );

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
      // The link is open already; only its record failed, so nothing claims it did not open, and nothing is marked.
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
    <li data-item={item.id}>
      <div className="lg:flex lg:items-center lg:gap-3.5 lg:rounded-row lg:bg-white/[0.08] lg:px-4 lg:py-3.5">
        <div className="flex min-w-0 items-center gap-3 rounded-row bg-white/[0.08] p-3 lg:flex-1 lg:gap-3.5 lg:bg-transparent lg:p-0">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-navy lg:h-12 lg:w-12">
            <FormatIcon kind={item.kind} size={22} />
          </span>
          <div className="min-w-0">
            <p className="break-words text-md font-semibold leading-snug lg:text-[15px]">{item.label}</p>
            {domain && <p className="mt-0.5 text-xs text-on-navy-muted">{domain}</p>}
            {isOpened && <OpenedLine />}
          </div>
        </div>
        {opensItself ? (
          <a
            href={item.url!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.openName({ button: words.button, label: item.label })}
            onClick={() => { void record(null); }}
            className={BUTTON}
          >
            {words.button}
            <ExternalIcon />
          </a>
        ) : (
          <button
            type="button"
            onClick={openFile}
            aria-disabled={busy || undefined}
            aria-label={t.openName({ button: words.button, label: item.label })}
            className={BUTTON}
          >
            {words.button}
            <ExternalIcon />
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <p className="mb-1.5 text-base text-on-navy-red">{t.openFailed({ label: item.label })}</p>
          <ErrorBanner {...error} />
        </div>
      )}
    </li>
  );
}

/**
 * **A video, played in place** (UI-067): a 150px player card on a phone and a tablet, 16:9 from 1024px, with the
 * accent's 56px play button — *Putar video*, the app's own words (O-7). Pressing it asks for the signed address (which
 * records the open, AC-6) and plays the video here, with the browser's own controls; nothing leaves the page.
 */
function VideoItem({
  moduleCode, item, isOpened, onOpened,
}: {
  moduleCode: string;
  item: TrainingItemView;
  isOpened: boolean;
  onOpened: (openedItemIds: string[], itemId: string) => void;
}) {
  const t = useMessages(trainingMessages);
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const BOX = 'h-[150px] w-full rounded-row lg:aspect-video lg:h-auto';

  const play = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await openTrainingItem(moduleCode, item.id);
      setSrc(answer.url);
      onOpened(answer.openedItemIds, item.id);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li data-item={item.id}>
      {src ? (
        // The item's own label names the player; the browser's controls are its own.
        <video src={src} controls autoPlay playsInline aria-label={item.label} className={cn(BOX, 'bg-ink object-contain')} />
      ) : (
        <button
          type="button"
          onClick={() => void play()}
          aria-disabled={busy || undefined}
          aria-label={t.playName({ label: item.label })}
          className={cn(BOX, 'relative flex items-center justify-center bg-navy-soft aria-disabled:opacity-60')}
        >
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-amber text-navy">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
          </span>
          <span aria-hidden="true" className="absolute bottom-2 right-2.5 rounded-pill bg-ink/40 px-2 py-0.5 text-xs text-white">
            {t.format.video}
          </span>
        </button>
      )}
      <p className="mt-2 break-words text-md font-semibold leading-snug">{item.label}</p>
      {isOpened && <OpenedLine />}
      {error && (
        <div className="mt-2">
          <p className="mb-1.5 text-base text-on-navy-red">{t.openFailed({ label: item.label })}</p>
          <ErrorBanner {...error} />
        </div>
      )}
    </li>
  );
}

/** The three statuses' line icons (UI-068): a dashed circle, a play mark, a circle with a check. */
function StatusIcon({ status, className }: { status: TrainingStatus; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cn('shrink-0', className)}>
      {status === 'not_started' && <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />}
      {status === 'in_progress' && <path d="M8 5.5v13l10.5-6.5z" />}
      {status === 'done' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
        </>
      )}
    </svg>
  );
}

/**
 * **The status card** (UI-068): *Status*, then the three buttons — one row of three, 64px, icon above the word, below
 * 1024px; stacked, 60px, icon before the word, from 1024px. **The chosen one in the accent with navy words** (the
 * report's orange; navy, not white, on it — I-542), `aria-pressed` saying it to a screen reader. In a support session
 * the status is its pill here and nothing can be pressed.
 */
function StatusCard({
  title, status, canUpdate, onChoose, error,
}: {
  title: string;
  status: TrainingStatus;
  canUpdate: boolean;
  onChoose: (status: TrainingStatus) => void;
  error: ApiError | null;
}) {
  const t = useMessages(trainingMessages);
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className="rounded-[20px] bg-card px-3 py-3.5 lg:p-5" data-status-card="">
      <h2 id={labelId} className="px-1 pb-2.5 text-xs font-semibold text-signal-grey lg:px-0 lg:pb-0 lg:text-base">{t.columns.status}</h2>
      {canUpdate ? (
        <div role="group" aria-label={t.statusGroup({ title })} className="flex gap-2 lg:mt-2.5 lg:flex-col lg:gap-2.5">
          {TRAINING_STATUSES.map((s) => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => onChoose(s)}
                className={cn(
                  'flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-row border-[1.5px] px-1 text-xs font-semibold',
                  'lg:h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-md',
                  on ? 'border-amber bg-amber text-navy' : 'border-line bg-card text-pill-grey-ink hover:border-muted',
                )}
              >
                <StatusIcon status={s} className={cn('h-5 w-5 lg:h-[22px] lg:w-[22px]', on ? 'text-navy' : 'text-signal-grey')} />
                {t.status[s]}
              </button>
            );
          })}
        </div>
      ) : (
        // Any support session (D-support, F-123): no control, the status as its pill.
        <p className="px-1 lg:mt-2.5 lg:px-0"><TrainingStatusPill status={status} /></p>
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-sm font-semibold text-alert lg:px-0">{t.notSaved({ why: error.message })}</p>
      )}
    </section>
  );
}

/**
 * **The module on its way, shaped like it** (UI-071: *Memuat…* for two seconds before): the back row, the navy lesson
 * card with its pill, title and an item, and the status card — one column below 1024px, two from 1024px.
 */
function ModuleSkeleton() {
  const t = useMessages(trainingMessages);
  return (
    <Skeleton label={t.loadingModule} className="max-w-[1000px]">
      <div className="flex min-h-12 items-center lg:min-h-11"><SkeletonBar className="h-4 w-40" /></div>
      <div className="mt-2 flex flex-col gap-3 lg:mt-[18px] lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-5">
        <div className="rounded-[20px] bg-navy p-[18px] lg:px-7 lg:py-[26px]">
          <SkeletonBar className="h-6 w-36 rounded-pill bg-white/15" />
          <SkeletonBar className="mt-4 h-6 w-3/4 bg-white/15" />
          <div className="mt-4 h-[68px] rounded-row bg-white/[0.08] lg:h-[76px]" />
          <SkeletonBar className="mt-3.5 h-[52px] w-full rounded-pill bg-white/15 lg:hidden" />
        </div>
        <div className="rounded-[20px] bg-card px-3 py-3.5 lg:p-5">
          <SkeletonBar className="h-3 w-12" />
          <div className="mt-2.5 flex gap-2 lg:flex-col lg:gap-2.5">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-16 flex-1 rounded-row lg:h-[60px] lg:flex-none" />)}
          </div>
        </div>
      </div>
    </Skeleton>
  );
}

/** Not offered, or never was (AC-3): the not-found card, under the page's own title. */
function ModuleNotFound() {
  const t = useMessages(trainingMessages);
  return (
    <Page title={t.title}>
      <div className="max-w-[820px]">
        <NotFoundCard title={t.moduleNotFound} />
      </div>
    </Page>
  );
}
