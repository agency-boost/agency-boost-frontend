'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import type { PublishAllOutcome } from '@/lib/admin';
import { sectionOfKind, type TemplateSection } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';

/**
 * **Terbitkan semua, asked first** (ADR-0185 §3; P18.11-T20 AC-2): the sections that will be published, by name, and
 * the one sentence that matters — *KPM yang sudah ada tidak berubah; hanya KPM baru yang memakai versi ini.* A titled
 * `Modal`, not the product's `Dialog`, because a list is more than its one message.
 *
 * ***Advanced analytics* stands apart** (P19.5-T1 AC-16; AA UI-020): it reaches every KPM that already exists, so when it
 * is in the batch it has its own line — *"Advanced analytics berlaku untuk semua KPM yang sudah ada (N KPM)"* — after
 * the others, whose note is what publishing does to existing KPMs since ADR-0208 (the push is offered afterwards).
 */
export function PublishAllDialog({
  open,
  sections,
  busy,
  onConfirm,
  onClose,
  analyticsKpms = 0,
}: {
  open: boolean;
  sections: TemplateSection[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** How many KPMs read the template's *Advanced analytics* now. */
  analyticsKpms?: number;
}) {
  const words = useMessages(adminTemplateMessages);
  const analytics = useMessages(adminTemplateAnalyticsMessages).publishAll;
  const t = words.publishAll;
  const others = sections.filter((section) => section.slug !== 'analytics');
  const live = sections.some((section) => section.slug === 'analytics');
  return (
    <Modal
      open={open}
      title={t.title}
      onClose={onClose}
      className="max-w-[30rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button onClick={onConfirm} disabled={busy}>{busy ? words.checklist.publishing : t.confirm}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{words.cancel}</Button>
        </div>
      )}
    >
      <p className="text-md text-navy">{t.lead}</p>
      {others.length > 0 && (
        <>
          <ul className="mt-2 list-disc pl-5 text-md text-navy">
            {others.map((section) => <li key={section.slug}>{words.sections[section.slug]}</li>)}
          </ul>
          <p className="mt-3 text-md font-semibold text-navy">{t.note}</p>
        </>
      )}
      {live && (
        <p className="mt-3 text-md font-semibold text-navy">{analytics.everyKpm({ n: analyticsKpms })}</p>
      )}
    </Modal>
  );
}

/**
 * **What *Terbitkan semua* did**, by section (ADR-0185 §3): the sections published, in one sentence, then each refusal
 * with the API's own words — a refused kind is still a draft, and its row still says *Draf*.
 */
export function PublishAllReport({ results }: { results: PublishAllOutcome[] }) {
  const words = useMessages(adminTemplateMessages);
  const nameOf = (kind: PublishAllOutcome['kind']) => {
    const section = sectionOfKind(kind);
    return section ? words.sections[section.slug] : kind;
  };
  const published = [...new Set(results.filter((r) => r.outcome === 'published').map((r) => nameOf(r.kind)))];
  const refused = results.filter((r): r is Extract<PublishAllOutcome, { outcome: 'refused' }> => r.outcome === 'refused');
  return (
    <div className="mb-4 flex flex-col gap-2">
      {published.length > 0 && (
        <p role="status" className="rounded-md border border-card-edge bg-card px-4 py-3 text-md text-navy">
          {words.publishAll.published({ sections: published.join(', ') })}
        </p>
      )}
      {refused.map((r) => (
        <p key={r.kind} role="alert" className="rounded-md border border-alert/40 bg-card px-4 py-3 text-md text-alert">
          {words.publishAll.refused({ section: nameOf(r.kind), message: r.error.message })}
        </p>
      ))}
    </div>
  );
}
