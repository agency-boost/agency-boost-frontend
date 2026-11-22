'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';
import { CampaignRules } from '@/components/kpm-template/campaign-rules';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { isTemplateLibrary } from '@/lib/admin';
import { publishHref } from '@/lib/template-sections';

/**
 * ***Campaigns*** (`/admin/companies/[companyId]/settings/campaigns`; P19.23-T4 AC-4; ADR-0278 §5): the company's carrier
 * rules, under *Pengaturan template*'s *Event & campaign*. Read live by every KPM of the company (ADR-0026), so its
 * draft is published from *Terbitkan ke KPM* and reaches all of them at once. The Default template publishes it here.
 */
export default function CompanyCampaignsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const router = useRouter();
  const company = useCompany(companyId);
  const insurer = company ? !isTemplateLibrary(company) : false;
  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read" active="settings">
      <CampaignRules companyId={companyId} onPublish={insurer ? () => router.push(publishHref(companyId)) : undefined} />
    </CompanyFrame>
  );
}
