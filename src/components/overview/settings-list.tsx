'use client';

import Link from 'next/link';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill } from '@/components/ui/tone-pill';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import {
  RATIO_BENCHMARKS_HREF, SETTINGS_PAGES, settingsLine, type SettingsWaiting,
} from '@/lib/kpm-overview';

/**
 * ***"Pengaturan KPM ›"*** (P19.3-T2 AC-3; UI-148, Overview R1b; `kpm-overview-mobile` 2, `kpm-overview-desktop` 2) —
 * **on every Overview**, a running KPM's and a new one's alike: the Owner sets the KPM up, not only watches it. One row,
 * *"11 pengaturan · 2 produk menunggu Anda · checklist draf versi 2"*, that opens the settings list.
 */
export function SettingsCard({ settings, onOpen }: { settings: SettingsWaiting; onOpen: () => void }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  return (
    <div data-settings-card="">
      <ListCard label={t.settingsTitle} className="border border-card-edge">
        <ListRow
          title={t.settingsTitle}
          meta={<span className="truncate">{settingsLine(settings, language)}</span>}
          onSelect={onOpen}
          haspopup
          data-row="settings"
        />
      </ListCard>
    </div>
  );
}

/**
 * **The settings list** (P19.3-T2 AC-3; UI-148; `kpm-overview-mobile` 4) — opened by *Pengaturan KPM ›* and by the setup
 * card's *Semua pengaturan ›*: a sheet below 1024px, the same list centred from 1024px. **The ten pages in the menu's
 * order**, *Activity types* first — *Ratio benchmarks* under it, its own link — and *Branch info* last, each row opening
 * the page where the Owner edits it, so **every settings page is two taps from the Overview**. **Amber pills say what
 * waits for the Owner**: *"2 menunggu"* on Products, *"Draf versi 2"* on Activation checklist.
 */
export function SettingsSheet({
  open, onClose, settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: SettingsWaiting;
}) {
  const t = useMessages(kpmOverviewMessages);
  const pill = (key: (typeof SETTINGS_PAGES)[number]['key']) => {
    if (key === 'products' && settings.productsAwaiting > 0) {
      return <TonePill tone="amber">{t.waitingPill({ n: settings.productsAwaiting })}</TonePill>;
    }
    if (key === 'activation-checklist' && settings.checklistDraftVersion !== null) {
      return <TonePill tone="amber">{t.draftPill({ version: settings.checklistDraftVersion })}</TonePill>;
    }
    return undefined;
  };
  return (
    <ResponsiveSheet open={open} title={t.settingsTitle} onClose={onClose}>
      <ListCard label={t.settingsTitle}>
        {SETTINGS_PAGES.map((page) => (
          <ListRow
            key={page.key}
            data-row={page.key}
            title={page.name}
            href={page.href}
            trailing={pill(page.key)}
            meta={page.key === 'activity-types' ? (
              // Its own target, above the row's: *Ratio benchmarks* is a page of its own, two taps from the Overview.
              <Link href={RATIO_BENCHMARKS_HREF} className="relative z-[1] underline-offset-2 hover:underline">{t.andRatios}</Link>
            ) : undefined}
          />
        ))}
      </ListCard>
    </ResponsiveSheet>
  );
}
