'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import type { PublishAllOutcome } from '@/lib/admin';
import { sectionOfKind, type TemplateSection } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **Terbitkan semua, asked first** (ADR-0185 §3; P18.99-T20 AC-2): the sections that will be published, by name, and
 * the one sentence that matters — *KPM yang sudah ada tidak berubah; hanya KPM baru yang memakai versi ini.* A titled
 * `Modal`, not the product's `Dialog`, because a list is more than its one message.
 */
export function PublishAllDialog({
  open,
  sections,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  sections: TemplateSection[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.publishAll;
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
      <ul className="mt-2 list-disc pl-5 text-md text-navy">
        {sections.map((section) => <li key={section.slug}>{words.sections[section.slug]}</li>)}
      </ul>
      <p className="mt-3 text-md font-semibold text-navy">{t.note}</p>
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
