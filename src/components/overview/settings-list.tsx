'use client';

import { ListCard, ListRow } from '@/components/ui/list-rows';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { SETTINGS_HUB_HREF, settingsLine, type SettingsWaiting } from '@/lib/kpm-overview';

/** Something on the settings pages waits for the Owner: a product's script, a checklist draft. */
export const settingsWait = (settings: SettingsWaiting) => settings.productsAwaiting > 0 || settings.checklistDraftVersion !== null;

/**
 * ***"Pengaturan KPM ›"*** (P19.3-T2 AC-3; UI-148, Overview R1b) — *since P19.19 (ADR-0272 §4)* **only while something on
 * the settings pages waits for the Owner** (the 19 November rule: *"show a status only when the user has to act"*), and
 * **it opens the Pengaturan hub** (`/kpm/settings`, ADR-0269 §4), where the settings list it opened lives now. One row:
 * *"11 pengaturan · 2 produk menunggu Anda · checklist draf versi 2"*.
 */
export function SettingsCard({ settings }: { settings: SettingsWaiting }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  return (
    <div data-settings-card="">
      <ListCard label={t.settingsTitle} className="border border-card-edge">
        <ListRow
          title={t.settingsTitle}
          meta={<span className="truncate">{settingsLine(settings, language)}</span>}
          href={SETTINGS_HUB_HREF}
          data-row="settings"
        />
      </ListCard>
    </div>
  );
}
