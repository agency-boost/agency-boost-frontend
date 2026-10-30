import type { MetadataRoute } from 'next';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { appMessages } from '@/i18n/messages/app';
import { APP_NAME, PWA_BACKGROUND, PWA_ICONS } from '@/lib/pwa';

/**
 * **`/manifest.webmanifest`** (UI V1, UI-103; D-02): AgencyBoost as an installed app — standalone, opening at `/`
 * within `/`, on the page's own colour, with Boost's icon (`lib/pwa.ts`). Built once, with the pages, in the language
 * the pages are prerendered in (`LANGUAGE_UNCHOSEN`), as `layout.tsx`'s title and description are.
 */
export default function manifest(): MetadataRoute.Manifest {
  const words = messagesIn(appMessages, LANGUAGE_UNCHOSEN);
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: words.description,
    lang: LANGUAGE_UNCHOSEN,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: PWA_BACKGROUND,
    background_color: PWA_BACKGROUND,
    icons: PWA_ICONS.map((icon) => ({ ...icon })),
  };
}
