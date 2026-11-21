'use client';

import { Page } from '@/components/page';
import { RosterImport } from '@/components/roster-import';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { useSession } from '@/lib/session';
import { enteredKpmId } from '@/lib/super-admin-kpm';

/**
 * **Import people** (P19.20-T5; ADR-0273 §6): the KPM the reader is in — their membership's, or the one a Super Admin has
 * entered (ADR-0268 §3) — never named on the screen. The API refuses any other as a **404**.
 */
export default function PeopleImportPage() {
  const t = useMessages(rosterImportMessages);
  const { me } = useSession();
  const kpmId = me?.membership?.kpmId ?? enteredKpmId();

  return (
    <Page title={kept('Import people')} permission="kpm:import_roster">
      {kpmId ? <RosterImport kpmId={kpmId} /> : <p className="text-md text-muted">{t.notInOffice}</p>}
    </Page>
  );
}
