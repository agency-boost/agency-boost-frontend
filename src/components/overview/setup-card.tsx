'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { Boost } from '@/components/boost';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatMonth } from '@/lib/format';
import {
  SETTINGS_PAGE_COUNT, SETTINGS_PAGES, SETUP_STEPS, STEP_HREF, uploadHref, type OverviewSetup, type ReviewedPage,
  type SetupStep,
} from '@/lib/kpm-overview';
import { useSession } from '@/lib/session';

/**
 * ***Siapkan KPM*** (P19.3-T2 AC-4, AC-5; UI-149, Overview R2; `kpm-overview-mobile` 1, `kpm-overview-desktop` 1 and 3) —
 * **the navy card at the top of a new KPM's Overview**, while any of its seven steps is open: Boost pointing (D-11), the
 * title, *"n dari 7 selesai"* and a bar, then **seven 48px steps with ›** — the four settings pages first, *"the owner
 * must set up the KPM, not only watch it"*, then *Impor anggota*, *Unggah produksi <Bulan YYYY>* and *Atur target
 * rekrutmen* — and *Semua pengaturan ›*. **From 1024px the steps sit in two rows of four**, the eighth cell *Semua
 * pengaturan ›* (at 1280 and at 1024 alike).
 *
 * - Each step opens the page where it is done: a settings page, *Import people*, Data upload **on the open month**
 *   (`?month=`), and the recruitment target's sheet (`onTarget`).
 * - **A step done is ticked**, its number a ✓, its words kept so the card still says what was done.
 * - **The server decides every tick** (`GET /kpm/overview`'s `setup`); the page ticks step 7 itself once the target
 *   it saved comes back, so a finished step ticks without a reload. When all seven are done the server answers `null`
 *   and the card is gone for good.
 */
export function SetupCard({
  setup, onTarget, onAllSettings,
}: {
  setup: OverviewSetup;
  /** Step 7: the recruitment target's sheet, on this page. */
  onTarget: () => void;
  /** *Semua pengaturan ›*: the settings list. */
  onAllSettings: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const { me } = useSession();
  const headingId = useId();
  const done = (key: SetupStep) => setup.steps.find((s) => s.key === key)?.done ?? false;
  const pct = Math.round((setup.done / SETUP_STEPS.length) * 100);
  const openMonth = setup.openMonth;
  // *"Baru 1 anggota: Anda"*: the reader is the one member.
  const onlyYou = setup.members === 1 && !!me?.membership?.isKpmOwner;

  // Steps 1–4 are named as the menu names their pages (UI-149: *"settings steps use the menu names"*), kept English.
  const named = (page: ReviewedPage) => SETTINGS_PAGES.find((p) => p.key === page)!.name;
  const steps: { key: SetupStep; title: string; meta?: string; href?: string; onClick?: () => void }[] = [
    { key: 'branch-info', title: named('branch-info'), meta: setup.branchFilled ? undefined : t.branchEmpty, href: STEP_HREF['branch-info'] },
    { key: 'activity-types', title: named('activity-types'), meta: t.activityMeta, href: STEP_HREF['activity-types'] },
    { key: 'activation-checklist', title: named('activation-checklist'), meta: t.checklistMeta, href: STEP_HREF['activation-checklist'] },
    { key: 'products', title: named('products'), meta: t.productsMeta, href: STEP_HREF.products },
    { key: 'import', title: t.importStep, meta: onlyYou ? t.onlyYou : t.members({ n: setup.members }), href: '/people/import' },
    {
      key: 'upload',
      title: t.uploadStep({ month: openMonth ? formatMonth(openMonth.month, figures) : null }),
      meta: openMonth ? t.openUntil({ day: formatCalendarDay(openMonth.closesOn, figures) }) : undefined,
      href: openMonth ? uploadHref(openMonth.month) : '/kpm/data-upload',
    },
    {
      key: 'recruit-target',
      title: t.targetStep,
      meta: setup.target === null ? t.noTarget : t.targetIs({ n: setup.target }),
      onClick: onTarget,
    },
  ];

  return (
    <section aria-labelledby={headingId} data-setup-card="" className="mb-3 rounded-lg bg-secondary px-4 pb-3 pt-3.5 text-secondary-contrast lg:px-5">
      <div className="flex items-center gap-3">
        <Boost pose="pointing" size={56} className="max-md:h-auto max-md:w-12" />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-display text-lg font-bold">{t.setupTitle}</h2>
          <p className="text-sm text-secondary-muted">{t.setupDone({ n: setup.done })}</p>
          <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-pill bg-secondary-contrast/20">
            <span className="block h-full rounded-pill bg-primary" style={{ width: `${pct}%` }} />
          </span>
        </div>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-1 lg:grid-cols-4 lg:gap-2">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Step
              number={i + 1}
              done={done(step.key)}
              title={step.title}
              meta={step.meta}
              href={step.href}
              onClick={step.onClick}
              haspopup={step.onClick !== undefined}
            />
          </li>
        ))}
        <li>
          <Step title={t.allSettings} meta={t.allSettingsMeta({ n: SETTINGS_PAGE_COUNT })} onClick={onAllSettings} haspopup />
        </li>
      </ol>
    </section>
  );
}

/** One step: its number or ✓, its words and meta line, and a ›; 48px tall, the whole of it the target. */
function Step({
  number, done = false, title, meta, href, onClick, haspopup = false,
}: {
  /** Absent on *Semua pengaturan*, which is not a step. */
  number?: number;
  done?: boolean;
  title: string;
  meta?: string;
  href?: string;
  onClick?: () => void;
  haspopup?: boolean;
}) {
  const t = useMessages(kpmOverviewMessages);
  const box = cn(
    'flex min-h-12 w-full items-center gap-2.5 rounded-row px-2 py-1.5 text-left',
    'hover:bg-secondary-contrast/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring',
    // From 1024px each step is a cell of the grid, on a faint tile of its own.
    'lg:h-full lg:bg-secondary-contrast/[0.06]',
  );
  const body: ReactNode = (
    <>
      {number !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            done ? 'bg-success text-white' : 'border border-white/40 text-white',
          )}
        >
          {done ? '✓' : number}
        </span>
      ) : <span aria-hidden="true" className="w-6 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-md font-semibold', done && 'text-secondary-muted')}>
          {title}
          {number !== undefined && <span className="sr-only">{` — ${done ? t.stepDone : t.stepOpen}`}</span>}
        </span>
        {meta && <span className="block truncate text-sm text-secondary-muted">{meta}</span>}
      </span>
      <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-secondary-muted" />
    </>
  );
  return href !== undefined
    ? <Link href={href} data-step={number ?? 'all'} className={box}>{body}</Link>
    : (
      <button type="button" data-step={number ?? 'all'} aria-haspopup={haspopup ? 'dialog' : undefined} onClick={onClick} className={box}>
        {body}
      </button>
    );
}
