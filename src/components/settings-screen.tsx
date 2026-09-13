'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { PublishBar } from '@/components/publish-bar';
import { SettingsTabs } from '@/components/settings-tabs';
import { StagedChangesBar } from '@/components/staged-changes-bar';
import { ErrorBanner } from '@/components/ui/field';
import type { ApiError } from '@/lib/api-client';

/**
 * The block order every settings screen shares.
 *
 * **This exists because five screens each invented their own.** Activity types led with
 * its tabs; Ratio benchmarks put twenty-six lines of checkboxes between its two bars;
 * Lead statuses rendered *Publish* above its Sales/Recruitment row, so the client read
 * the subtabs as belonging to the bar above them rather than to the screen; Branch info
 * had none of the chrome at all and no way back to its siblings. Each was defensible
 * alone and they were four different screens together.
 *
 * The order is the prototype's (`AgencyBoost_KPM_Owner.html`), and it is the order the
 * client asked for in as many words — tab, then subtab, then save:
 *
 * ```
 * header → tabs → subtabs → error → bars → toolbar → content
 * ```
 *
 * Owning it here rather than documenting it is the point. A screen cannot put its subtabs
 * below its publish bar, because a screen no longer says where either one goes.
 */
export function SettingsScreen({
  title,
  subtitle,
  permission,
  actions,
  tabs,
  activeHref,
  onSelectTab,
  tabsLabel,
  subtabs,
  activeSubtab,
  onSelectSubtab,
  subtabsLabel,
  error,
  bars,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  permission?: string;
  actions?: ReactNode;
  /** The settings group. Every screen in the group passes the same list. */
  tabs?: { label: string; href: string }[];
  activeHref?: string;
  onSelectTab?: (href: string) => void;
  tabsLabel?: string;
  /** The halves of *this* screen — Sales/Recruitment, and the template's kinds. */
  subtabs?: { label: string; href: string }[];
  activeSubtab?: string;
  onSelectSubtab?: (href: string) => void;
  subtabsLabel?: string;
  error?: ApiError | null;
  /**
   * What is unsaved, and what is unpublished.
   *
   * A slot rather than fixed props: the Owner screens stage against their office and pass
   * {@link TenantConfigBars}, while the Super Admin's template screen saves a draft and
   * publishes a version — a different pair of questions that happens to sit in the same
   * place. What the shell guarantees is the *place*, which is what was wrong.
   */
  bars?: ReactNode;
  /** The prototype's `config-toolbar`: a count sentence left, the controls right. */
  toolbar?: { hint?: ReactNode; actions?: ReactNode };
  children: ReactNode;
}) {
  return (
    <Page title={title} subtitle={subtitle} permission={permission} actions={actions}>
      {tabs && (
        <SettingsTabs
          tabs={tabs}
          activeHref={activeHref}
          onSelect={onSelectTab}
          label={tabsLabel}
        />
      )}

      {/*
        * Two tab rows are two landmarks, and two landmarks with one name cannot be told
        * apart by anyone navigating by landmark. The default names the row for what it
        * selects rather than leaving both announced as "Activity settings".
        */}
      {subtabs && (
        <SettingsTabs
          tabs={subtabs}
          activeHref={activeSubtab}
          onSelect={onSelectSubtab}
          label={subtabsLabel ?? `${title} sections`}
          variant="subtabs"
        />
      )}

      {error && <ErrorBanner {...error} />}
      {bars}

      {toolbar && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* Always rendered, even empty: `justify-between` with one child pushes it
              left, and a toolbar whose only control jumps sides when the count is still
              loading is the same defect as the section headings. */}
          <div className="text-sm text-muted">{toolbar.hint ?? ' '}</div>
          <div className="flex flex-wrap items-center gap-3">{toolbar.actions}</div>
        </div>
      )}

      {children}
    </Page>
  );
}

/**
 * The Owner's two bars, adjacent and in that order.
 *
 * **Held in this browser → saved to the office → published to agents.** The bars read in
 * that order or they contradict their own copy: {@link StagedChangesBar} ends by saying
 * publishing is "a separate step after that", which is a forward reference to the bar
 * below it. Ratio benchmarks had them the other way round with a hint and two checkboxes
 * in between, so the staged count sat off-screen for every row below the first — an Owner
 * edited a benchmark, saw nothing change, and reported that editing was broken.
 */
export function TenantConfigBars({
  staged,
  publishRefreshKey,
}: {
  staged: { count: number; busy: boolean; onSave: () => void; onDiscard: () => void };
  publishRefreshKey?: number;
}) {
  return (
    <>
      <StagedChangesBar {...staged} />
      <PublishBar refreshKey={publishRefreshKey} />
    </>
  );
}
