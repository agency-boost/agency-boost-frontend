'use client';

import Link from 'next/link';
import { TonePill } from '@/components/ui/tone-pill';
import { LineIcon } from '@/components/ui/line-icon';
import type { NamedTemplate } from '@/lib/admin';
import { templateHref, templateProgress } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **One template, as a card on its company's page** (ADR-0185 §2): its name, *★ Default* and *Diarsipkan* on tinted
 * pills (words, never a dot — D-27), the offices it answers for and its sections published, the changes waiting, and
 * *Buka ›*. The whole card is the link, as every tappable row is whole with a ›.
 */
export function TemplateCard({ companyId, template }: { companyId: string; template: NamedTemplate }) {
  const t = useMessages(adminTemplateMessages).card;
  const progress = templateProgress(template);
  return (
    <Link
      href={templateHref(companyId, template.id)}
      // At least 56px below 1024px, said where the audit reads it (P19.2-T2 AC-5; UI-135): two lines and 16px above and below.
      className="group flex items-center gap-4 rounded-lg border border-card-edge bg-card px-5 py-4 hover:border-secondary/30 max-lg:min-h-14"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold text-navy">{template.name}</span>
          {template.isDefault && (
            <TonePill tone="blue"><span aria-hidden="true">★ </span>{t.default}</TonePill>
          )}
          {template.status === 'archived' && <TonePill tone="grey">{t.archived}</TonePill>}
        </span>
        <span className="mt-1 block text-md text-muted">
          {t.usedBy({ n: template.officeCount })}
          {' · '}
          {t.published({ n: progress.published, of: progress.total })}
        </span>
        {progress.waiting > 0 && (
          <span className="mt-1 block text-md font-semibold text-pill-amber-ink">{t.waiting({ n: progress.waiting })}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-md font-semibold text-navy">
        <span className="hidden sm:inline">{t.open}</span>
        <LineIcon name="chevronRight" className="h-5 w-5" />
      </span>
    </Link>
  );
}
