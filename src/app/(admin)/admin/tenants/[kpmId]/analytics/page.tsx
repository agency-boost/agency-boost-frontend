'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import {
  SectionBody, SectionTabs, ShellState, useAdvancedAnalyticsShell,
} from '@/components/advanced-analytics/advanced-analytics-screen';
import { ComplianceScreen } from '@/components/analytics/compliance-screen';
import { KpmAnalytics } from '@/components/analytics/kpm-analytics';
import { Page } from '@/components/page';
import { RouteTabs } from '@/components/ui/route-tabs';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { readTenant, type TenantRow } from '@/lib/admin';
import { analyticsGroupFrom, analyticsPeriodFrom } from '@/lib/kpm-analytics';
import { complianceSelectionFrom } from '@/lib/kpm-compliance';
import { isSectionSlug } from '@/lib/advanced-analytics-page';
import { useQuery } from '@/lib/use-query';

/**
 * ***Lihat sebagai KPM*** (`/admin/tenants/[kpmId]/analytics?tab=overview|compliance`; P19.4-T3 AC-4, P19.4-T2 AC-6; SA
 * R4, the setup spec's A2, A-R8; ADR-0207 §3): the KPM's two analytics tabs **as its Owner reads them**, under A2's navy
 * banner — *Hanya lihat*, the visit recorded in the Audit log — with *Keluar* back to the KPM's page.
 *
 * **It is not a support session**: it acts as nobody and asks no reason. The server serves the Owner's own reads through
 * the platform read, refuses any write (every route is a `GET`), and records each visit in the platform's log and the
 * KPM's. No control that writes is drawn: the group filter only chooses, `can.override` is always `false`, and no
 * leader's page opens. ***Advanced analytics*** is the third tab since P19.5-T3 (AC-12; ADR-0215 §9;
 * `?tab=advanced&section=`): the KPM's sections as its Owner sees them, the survey sections as summaries, nothing that
 * writes drawn.
 */
export default function LookAsKpmPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const t = useMessages(adminPlatformReadsMessages).lookAs;
  const [kpm, setKpm] = useState<TenantRow | null>(null);
  useEffect(() => {
    let live = true;
    // The KPM's name for the banner; the reads below answer 404 on their own for a KPM that is not there.
    void readTenant(kpmId).then((row) => { if (live) setKpm(row); }).catch(() => undefined);
    return () => { live = false; };
  }, [kpmId]);

  return (
    <Page title={kpm ? `${t.title} · ${kpm.code} ${kpm.branchName}` : t.title} permission="platform_kpm_figures:read">
      <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-secondary px-4 py-3 text-md text-secondary-contrast">
        <strong className="font-semibold">{t.readOnly}</strong>
        <span className="min-w-0 flex-1">{t.banner({ code: kpm?.code ?? '' })}</span>
        <Link
          href={`/admin/tenants/${kpmId}`}
          className="inline-flex min-h-9 items-center rounded-md border border-secondary-contrast/40 px-3 text-sm font-semibold text-secondary-contrast"
        >
          {t.exit}
        </Link>
      </div>
      <Suspense fallback={null}>
        <Tabs kpmId={kpmId} />
      </Suspense>
    </Page>
  );
}

/** *Overview | Compliance | Advanced analytics*, in the query (`?tab=`), and the tab's own screen over the platform read. */
function Tabs({ kpmId }: { kpmId: string }) {
  const t = useMessages(adminPlatformReadsMessages).lookAs;
  const a = useMessages(kpmAnalyticsMessages);
  const query = useQuery();
  const tab = query.tab === 'compliance' ? 'compliance' : query.tab === 'advanced' ? 'advanced' : 'overview';
  const base = `/admin/tenants/${kpmId}/analytics`;
  const overviewHref = `${base}?tab=overview`;
  const complianceHref = `${base}?tab=compliance`;
  const advancedHref = `${base}?tab=advanced`;
  const active = { overview: overviewHref, compliance: complianceHref, advanced: advancedHref }[tab];
  return (
    <>
      <RouteTabs
        label={t.tabs}
        activeHref={active}
        tabs={[
          { href: overviewHref, label: a.tabOverview },
          { href: complianceHref, label: a.tabCompliance },
          { href: advancedHref, label: t.tabAdvanced },
        ]}
      />
      {tab === 'advanced' ? (
        <AdvancedTab kpmId={kpmId} section={typeof query.section === 'string' ? query.section : undefined} />
      ) : tab === 'compliance' ? (
        <ComplianceScreen
          platformKpmId={kpmId}
          selection={complianceSelectionFrom(query)}
          group={analyticsGroupFrom(query.group)}
        />
      ) : (
        <KpmAnalytics
          platformKpmId={kpmId}
          period={analyticsPeriodFrom(query.period)}
          group={analyticsGroupFrom(query.group)}
        />
      )}
    </>
  );
}

/**
 * ***Advanced analytics*** **as the KPM's Owner sees it** (P19.5-T3 AC-12; ADR-0215 §9): its tabs from the KPM's
 * template (`?section=`, the first that is on by default), each section's own screen over the platform read — no
 * target field, no *Mulai survei*, no *Unggah data* — and the survey sections as summaries (A-R9).
 */
function AdvancedTab({ kpmId, section }: { kpmId: string; section: string | undefined }) {
  const { shell, error } = useAdvancedAnalyticsShell(kpmId);
  const base = `/admin/tenants/${kpmId}/analytics?tab=advanced&section=`;
  return (
    <ShellState error={error}>
      {shell && (() => {
        const on = shell.sections.find((s) => s.slug === section) ?? shell.sections[0];
        if (!on || !isSectionSlug(on.slug)) return null;
        return (
          <>
            <SectionTabs shell={shell} hrefOf={(slug) => `${base}${slug}`} activeHref={`${base}${on.slug}`} />
            <SectionBody key={on.slug} slug={on.slug} shell={shell} platformKpmId={kpmId} />
          </>
        );
      })()}
    </ShellState>
  );
}
