'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { RouteTabs } from '@/components/ui/route-tabs';
import { LineIcon } from '@/components/ui/line-icon';
import { isTemplateLibrary, listCompanies, type Company } from '@/lib/admin';
import { companyHref, settingsHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **One company, as the console names it** (ADR-0185 §2): read from the companies list, the one route that has it — a
 * company has no read of its own. `undefined` while it is read, `null` where it is not among them (the page's own read
 * then says *not found*).
 */
export function useCompany(companyId: string): Company | null | undefined {
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void listCompanies()
      .then((rows) => { if (live) setCompany(rows.find((c) => c._id === companyId) ?? null); })
      // The name is the header's; the page's own read says what went wrong.
      .catch(() => { if (live) setCompany(null); });
    return () => { live = false; };
  }, [companyId]);
  return company;
}

/** What a company is called on its own pages: the library by the name ADR-0185 §1 gives it, an insurer by its own. */
export function useCompanyName(company: Company | null | undefined): string {
  const t = useMessages(adminTemplateMessages).companyPage;
  if (!company) return t.unknown;
  return isTemplateLibrary(company) ? t.library : company.name;
}

/** The way back, as a link with its chevron: to the companies, a company, or a template. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-md font-semibold text-navy underline">
      <LineIcon name="chevronLeft" className="h-4 w-4" />
      {children}
    </Link>
  );
}

/**
 * **A company's page** (ADR-0185 §2): its name, the way back to the companies, and its two tabs — *Template KPM*, the
 * company's templates, and *Pengaturan perusahaan*, the products, carrier rules and playbook every office of it reads
 * live. The library's page also links its ladder, edited on `/admin/org-levels` (ADR-0168 §3).
 *
 * No prototype draws it (`Superadmin.html:179` has *KPM template* as a *Soon* item): the console's own idiom — the
 * `Page` header, `RouteTabs` — and an addition the client asked for (parity row, ADR-0185).
 */
export function CompanyFrame({
  companyId,
  company,
  permission,
  children,
}: {
  companyId: string;
  company: Company | null | undefined;
  permission: string;
  children: ReactNode;
}) {
  const t = useMessages(adminTemplateMessages).companyPage;
  const name = useCompanyName(company);
  return (
    <Page
      title={name}
      subtitle={company && isTemplateLibrary(company) ? t.libraryLead : undefined}
      permission={permission}
      actions={(
        <div className="flex flex-wrap items-center gap-4">
          {company && isTemplateLibrary(company) && (
            <Link href="/admin/org-levels" className="text-md font-semibold text-navy underline">{t.ladder}</Link>
          )}
          <BackLink href="/admin/companies">{t.back}</BackLink>
        </div>
      )}
    >
      <RouteTabs
        label={t.tabs}
        tabs={[
          { href: companyHref(companyId), label: t.templates },
          { href: settingsHref(companyId), label: t.settings },
        ]}
      />
      {children}
    </Page>
  );
}
