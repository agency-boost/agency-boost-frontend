'use client';

import { use } from 'react';
import { Page } from '@/components/page';
import { RosterImport } from '@/components/roster-import';

/** A Super Admin naming the office. `/people/import` is the same screen for an Owner. */
export default function TenantRosterImportPage({
  params,
}: {
  params: Promise<{ kpmId: string }>;
}) {
  const { kpmId } = use(params);
  return (
    <Page
      title="Import a roster"
      subtitle="Create everybody in this office from a spreadsheet."
      permission="kpm:import_roster"
    >
      <RosterImport kpmId={kpmId} backHref={`/admin/tenants/${kpmId}`} />
    </Page>
  );
}
