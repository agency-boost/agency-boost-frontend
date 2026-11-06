'use client';

import {
  SectionBody, SectionTabs, ShellState, useAdvancedAnalyticsShell,
} from '@/components/advanced-analytics/advanced-analytics-screen';
import { isSectionSlug } from '@/lib/advanced-analytics-page';

/**
 * ***Advanced analytics*** **as the KPM's Owner sees it** (P19.5-T3 AC-12; ADR-0215 §9): its tabs from the KPM's
 * template (`?section=`, the first that is on by default), each section's own screen over the platform read — no
 * target field, no *Mulai survei*, no *Unggah data* — and the survey sections as summaries (A-R9).
 *
 * *Lihat sebagai KPM*'s third tab (`/admin/tenants/[kpmId]/analytics?tab=advanced`), in a module of its own so the page
 * loads it only when the tab is chosen (the bundle, 2026-11-06; `performance-and-scale.md`).
 */
export function LookAsAdvancedTab({ kpmId, section }: { kpmId: string; section: string | undefined }) {
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
