'use client';

import type { ReactNode } from 'react';
import { ButtonLink, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import type { ApiError } from '@/lib/api-client';
import type { PeerStatus } from '@/lib/advanced-analytics-page';

/**
 * **The page's shared pieces** (P19.5-T3; the AA flow report's rule *"three shared pieces, one component each"*): the
 * peer-status chip and the template-version notice here, and the *Belum lengkap* year-to-date cell in
 * `components/ytd-cell.tsx` (P19.5-T2). Each is drawn the same wherever it appears.
 */

const STATUS_TONE: Record<PeerStatus, PillTone> = { above: 'green', in_line: 'grey', below: 'red' };

/**
 * **The peer-status chip** (P19.5-T3 AC-8; ADR-0215 §5, §6): *above*, *in line* or *below* the median of the company's
 * other KPMs, coloured by the template's band now, so a colour-only change re-colours a frozen run (R6). The words are
 * the catalogue's until the KPM-side mockup is shared (OD-268). `null` draws no chip — too few peers, or this KPM's value
 * incomplete (AT-6, AT-7). The words are always on it: colour is never the only cue.
 */
export function PeerStatusChip({ status }: { status: PeerStatus | null }) {
  const t = useMessages(advancedAnalyticsPageMessages).quant;
  if (status === null) return null;
  return <TonePill tone={STATUS_TONE[status]} className="ml-0">{t.status[status]}</TonePill>;
}

/**
 * **The template-version notice** (P19.5-T1 AC-17, AA UI-019; the flow report's shared piece): which published template
 * the page follows, read live — a Super Admin's publish changes the sections at once. An ⓘ line, the smallest footprint.
 */
export function TemplateVersionNotice({ children }: { children: ReactNode }) {
  return (
    <p data-template-notice="" className="mb-3 flex items-start gap-2 rounded-md border border-card-edge bg-card px-3 py-2 text-sm text-navy">
      <span aria-hidden="true">ⓘ</span>
      <span className="font-semibold">{children}</span>
    </p>
  );
}

/** A section waiting on its read: a skeleton shaped like a card of rows. */
export function SectionLoading() {
  const t = useMessages(advancedAnalyticsPageMessages);
  return (
    <Skeleton label={t.loading}>
      <div className="space-y-3"><SkeletonBar className="h-16" /><SkeletonBar className="h-40" /></div>
    </Skeleton>
  );
}

/** A section's read refused or lost: the shared banner, its words the server's. */
export function SectionError({ error }: { error: ApiError }) {
  return <ErrorBanner {...error} />;
}

/**
 * ***Belum ada data*** **with one next step** (P19.5-T3 AC-1; D-37): the layout stays, with *0* or *–*, and this line
 * under it. The Owner and the Admins are sent to Data upload; a Core Leader and the Super Admin, who upload nothing,
 * get no step.
 */
export function NoData({ canUpload }: { canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  return (
    <div data-no-data="" className="flex flex-wrap items-center justify-center gap-3 px-4 py-4 text-center text-md text-muted">
      <span>{t.noData}</span>
      {canUpload && <ButtonLink href="/kpm/data-upload" variant="secondary">{t.upload}</ButtonLink>}
    </div>
  );
}
