'use client';

import { use } from 'react';
import { Page } from '@/components/page';
import { RosterImport } from '@/components/roster-import';
import { useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';

/** A Super Admin naming the office. `/people/import` is the same screen for an Owner. */
export default function TenantRosterImportPage({
  params,
}: {
  params: Promise<{ kpmId: string }>;
}) {
  const { kpmId } = use(params);
  const t = useMessages(adminOfficesMessages).roster;
  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      permission="kpm:import_roster"
    >
      <RosterImport kpmId={kpmId} backHref={`/admin/tenants/${kpmId}`} />
    </Page>
  );
}
