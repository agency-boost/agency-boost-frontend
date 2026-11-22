'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { LineIcon } from '@/components/ui/line-icon';
import { isTemplateLibrary, listCompanies, type Company } from '@/lib/admin';
import { cn } from '@/lib/cn';
import { companyHref, productsHref, publishHref, settingsHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

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

/** What a company is called on its own pages: the Template library *Default template* (ADR-0278 §2), an insurer its own. */
export function useCompanyName(company: Company | null | undefined): string {
  const t = useMessages(adminCompaniesConsoleMessages).frame;
  if (!company) return t.unknown;
  return isTemplateLibrary(company) ? t.library : company.name;
}

/**
 * The way back, as a link with its chevron: to the companies, a company, or a catalogue. **44px tall below 1024px**
 * (P19.2-T2 AC-5; UI-135), 32px from it.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-md font-semibold text-navy max-lg:min-h-11">
      <LineIcon name="chevronLeft" className="h-4 w-4" />
      {children}
    </Link>
  );
}

/** A company page's tab, by its key. */
export type CompanyTab = 'ladder' | 'products' | 'settings' | 'publish';

/**
 * **A company's page** (P19.23-T4 AC-2; ADR-0278 §1; frames 29–40): its name, *‹ Perusahaan & template*, and its four
 * tabs — ***Jenjang · Produk & proposal · Pengaturan template · Terbitkan ke KPM***. The Default template (the Template
 * library) has two: it has no products of its own and no KPM to publish to (ADR-0278 §2).
 *
 * **The tabs are the mockup's pills**: a white rounded group, the current one navy; on a phone one row of equal widths,
 * two by two since four do not fit at 390px (§12). They change the address, so they are links in a `nav`, the current
 * one `aria-current` — not a `tablist`.
 *
 * Super Admin only: `company_template:read` to see it, and the API refuses every tenant role whatever this renders.
 */
export function CompanyFrame({
  companyId,
  company,
  permission,
  active,
  children,
}: {
  companyId: string;
  company: Company | null | undefined;
  permission: string;
  active: CompanyTab;
  children: ReactNode;
}) {
  const t = useMessages(adminCompaniesConsoleMessages).frame;
  const name = useCompanyName(company);
  const library = company ? isTemplateLibrary(company) : false;
  const tabs: { key: CompanyTab; href: string; label: string }[] = [
    { key: 'ladder', href: companyHref(companyId), label: t.ladder },
    ...(library ? [] : [{ key: 'products' as const, href: productsHref(companyId), label: t.products }]),
    { key: 'settings', href: settingsHref(companyId), label: t.settings },
    ...(library ? [] : [{ key: 'publish' as const, href: publishHref(companyId), label: t.publish }]),
  ];
  return (
    <Page title={name} permission={permission}>
      <div className="mb-3">
        <BackLink href="/admin/companies">{t.back}</BackLink>
      </div>
      <nav aria-label={t.tabs} className="mb-4">
        <ul
          role="list"
          className="grid grid-cols-2 gap-1 rounded-lg border border-card-edge bg-card p-1 md:inline-flex md:flex-wrap md:rounded-pill"
        >
          {tabs.map((tab) => (
            <li key={tab.key} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={tab.key === active ? 'page' : undefined}
                data-company-tab={tab.key}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-md px-4 text-center text-md font-semibold md:rounded-pill',
                  tab.key === active ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </Page>
  );
}
