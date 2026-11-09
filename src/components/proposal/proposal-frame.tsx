'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { StepPills } from '@/components/plan/step-pills';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import type { ProductCategoryCode, ProposalStatus } from '@/lib/proposals';
import { TonePill } from '@/components/ui/tone-pill';
import { Button } from '@/components/ui/field';
import type { ProposalSaveState } from './use-proposal';

/**
 * **The progress bar and *Kembali*** (AC-2; Acc. 18): *1 Klien · 2 Produk · 3 PDF* over every step — the plan's own
 * step pills (`StepPills`, the Sales Attack Plan's), the current one in the accent, the ones behind it ticked — and
 * *Kembali*, which always works: step 1 back to *Riwayat*, every later step to the one before it. The steps carry these
 * instead of the Sales tools strip (ADR-0221 §8).
 */
export function ProposalSteps({ current, backHref }: { current: 1 | 2 | 3; backHref: string }) {
  const t = useMessages(proposalMessages);
  return (
    <div data-proposal-steps="" className="mb-2 flex flex-col gap-1">
      <Link
        href={backHref}
        className="-ml-1 inline-flex min-h-12 w-fit items-center gap-1 rounded-pill px-1 text-md font-semibold text-muted hover:text-navy"
      >
        <LineIcon name="chevronLeft" className="h-4 w-4" />
        {t.back}
      </Link>
      <StepPills label={t.steps.label} steps={[t.steps.client, t.steps.products, t.steps.pdf]} current={current - 1} />
    </div>
  );
}

/**
 * **Where the saves stand** (`functional/proposal.md`, *States*): nothing while all is saved; *Menyimpan…* while one is on
 * its way; *"Belum tersimpan. Coba lagi."* with *Coba lagi* when one failed — what was typed stays in its field; and
 * *"Proposal ini diubah di perangkat lain."* after a conflict, the proposal read again.
 */
export function SaveLine({ save, conflict, onRetry }: { save: ProposalSaveState; conflict: boolean; onRetry: () => void }) {
  const t = useMessages(proposalMessages).save;
  return (
    <div aria-live="polite" data-proposal-save="" className="min-h-6 text-sm">
      {save === 'saving' && <p className="text-muted">{t.saving}</p>}
      {save === 'failed' && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-alert">
          {t.failed}
          <Button variant="secondary" className="min-h-11 rounded-pill px-4" onClick={onRetry}>{t.retry}</Button>
        </p>
      )}
      {save === 'idle' && conflict && <p role="status" className="text-navy">{t.conflict}</p>}
    </div>
  );
}

/** *Draf* grey, *Selesai* green — **fixed status colours**, whatever the KPM's branding (the spec's *KPM style*, rule 2). */
export function ProposalStatusPill({ status }: { status: ProposalStatus }) {
  const t = useMessages(proposalMessages).status;
  return <TonePill tone={status === 'done' ? 'green' : 'grey'}>{t[status]}</TonePill>;
}

/** A card's icon by the product's category (OD-273's default: there is no icon field; ADR-0225 §1). */
const CATEGORY_ICON: Readonly<Record<ProductCategoryCode, LineIconName>> = {
  life: 'shield',
  health: 'activity',
  ci: 'bolt',
  education: 'graduation',
  investment: 'chartUp',
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const name = CATEGORY_ICON[category as ProductCategoryCode] ?? 'box';
  return (
    <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/[0.06] text-navy', className)}>
      <LineIcon name={name} className="h-5 w-5" />
    </span>
  );
}

/** A step's heading, 18px/700, under the progress bar. */
export function StepHeading({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 font-display text-lg font-bold text-navy">{children}</h2>;
}
