'use client';

import Link from 'next/link';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import type { OfficeTemplateKind, TemplateOffice } from '@/lib/admin';
import { TEMPLATE_SECTIONS } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **The offices on an older version** (ADR-0185 §4): each office the template answers for that it has published
 * something newer than, by code and branch, linked to the office's page, with the sections it is behind on. **Information
 * only** — a copy is never a link (ADR-0115 §6), so there is nothing to apply; an office takes a newer version through
 * its own settings. The offices whose record is older than the record itself are counted, not listed.
 */
export function OfficesBehindDialog({
  open,
  offices,
  onClose,
}: {
  open: boolean;
  offices: TemplateOffice[];
  onClose: () => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.offices;
  const behind = offices.filter((o) => o.behind.length > 0);
  const unrecordedOnly = offices.filter((o) => o.behind.length === 0 && o.unrecorded.length > 0).length;
  /** The sections an office is behind on, by name, in the checklist's order. */
  const sectionsOf = (kinds: OfficeTemplateKind[]) => TEMPLATE_SECTIONS
    .filter((section) => section.kinds.some((kind) => kinds.includes(kind)))
    .map((section) => words.sections[section.slug])
    .join(', ');

  return (
    <Modal
      open={open}
      title={t.title}
      description={t.lead}
      onClose={onClose}
      className="max-w-[34rem]"
      footer={<Button variant="secondary" onClick={onClose}>{t.close}</Button>}
    >
      <ul className="divide-y divide-divider">
        {behind.map((office) => (
          <li key={office.id} className="py-2">
            <Link href={`/admin/tenants/${office.id}`} className="text-md font-semibold text-navy underline">
              {t.office({ code: office.code, branch: office.branchName })}
            </Link>
            <span className="block text-sm text-muted">{t.behindOn({ sections: sectionsOf(office.behind) })}</span>
          </li>
        ))}
      </ul>
      {unrecordedOnly > 0 && <p className="mt-3 text-sm text-muted">{t.unrecorded({ n: unrecordedOnly })}</p>}
    </Modal>
  );
}
