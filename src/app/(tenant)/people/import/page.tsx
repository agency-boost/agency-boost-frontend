'use client';

import { Page } from '@/components/page';
import { RosterImport } from '@/components/roster-import';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { useSession } from '@/lib/session';

/**
 * The same import, for the office you are in.
 *
 * An Owner or Admin does not name an office: their session already says which one, and
 * the API refuses any other as a **404** — the same answer as an office that does not
 * exist, because a 403 would confirm the id is real.
 */
export default function PeopleImportPage() {
  const t = useMessages(rosterImportMessages);
  const { me } = useSession();
  const kpmId = me?.membership?.kpmId;

  return (
    <Page
      title={kept('Import people')}
      subtitle={t.importSubtitle}
      permission="kpm:import_roster"
    >
      {kpmId ? (
        <RosterImport kpmId={kpmId} backHref="/people/members" />
      ) : (
        <p className="text-md text-muted">{t.notInOffice}</p>
      )}
    </Page>
  );
}
