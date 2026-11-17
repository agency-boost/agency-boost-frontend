'use client';

import { use } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { ProposalDataScreen } from '@/components/proposal-data/proposal-data-screen';
import { useCan } from '@/lib/session';

/**
 * ***Proposal*** (`/admin/companies/[companyId]/proposal`; P19.15-T1, T4 AC-1; ADR-0258 §8; the P1b spec's *Where it
 * lives*): Super Admin → *Perusahaan* → {company} → *Proposal*, a tab beside *Template KPM* and *Pengaturan perusahaan* —
 * the company's proposal data, product by product (`ProposalDataScreen`, the same screen *Data produk* mounts for a
 * holder of *Kelola data produk*, ADR-0260 §5). The API decides who may change anything; the screen asks it.
 */
export default function CompanyProposalPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const company = useCompany(companyId);
  const canManage = useCan('product_data:manage');
  return (
    <CompanyFrame companyId={companyId} company={company} permission="product_data:read">
      <ProposalDataScreen companyId={companyId} canManage={canManage} />
    </CompanyFrame>
  );
}
