'use client';

import { Page } from '@/components/page';
import { RosterImport } from '@/components/roster-import';
import { useSession } from '@/lib/session';

/**
 * The same import, for the office you are in.
 *
 * An Owner or Admin does not name an office: their session already says which one, and
 * the API refuses any other as a **404** — the same answer as an office that does not
 * exist, because a 403 would confirm the id is real.
 */
export default function PeopleImportPage() {
  const { me } = useSession();
  const kpmId = me?.membership?.kpmId;

  return (
    <Page
      title="Import people"
      subtitle="Create several people at once from a spreadsheet."
      permission="kpm:import_roster"
    >
      {kpmId ? (
        <RosterImport kpmId={kpmId} backHref="/people/members" />
      ) : (
        <p className="text-md text-muted">You are not in an office.</p>
      )}
    </Page>
  );
}
