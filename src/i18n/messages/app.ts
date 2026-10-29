import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The app's own description** — `app/layout.tsx`'s `metadata.description`, the line a search result or a shared
 * link's preview shows (P18.98-T4, public and account). It is written into every prerendered page's `<head>`, before
 * any reader's language is known, so it is written **in the language the pages are prerendered in,
 * `LANGUAGE_UNCHOSEN`** — the language `<html lang>` starts in, and the one a reader who has chosen nothing reads:
 * English until the switch is live, Bahasa Indonesia from then (ADR-0179 §1). No route reads the cookie on the server
 * for it (P18.98-T1 AC-3). The product's name, the page's title, is kept (§A.5).
 *
 * **English is the source**, as the layout wrote it. *Office* is *KPM* (§B.9); *leads* and *coaching* are kept (§A.6).
 *
 * @moved app/layout.tsx
 */
const en = {
  title: kept('AgencyBoost'),
  description: 'Activity, leads and coaching for insurance agency offices',
};

const id: MessagesOf<typeof en> = {
  title: kept('AgencyBoost'),
  description: `Aktivitas, ${kept('leads')}, dan ${kept('coaching')} untuk ${kept('KPM')} asuransi`,
};

export const appMessages = defineMessages({ en, id });
