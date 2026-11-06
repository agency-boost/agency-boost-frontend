import type { MetadataRoute } from 'next';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { appMessages } from '@/i18n/messages/app';
import { apiUrl } from '@/lib/api';
import { APP_NAME, PWA_BACKGROUND, PWA_ICONS } from '@/lib/pwa';

/**
 * **The web app manifest** (UI V1, UI-103; D-02; P19.6-T1 AC-16, ADR-0218 §10): AgencyBoost as an installed app —
 * standalone, opening at `/` within `/`, on the page's own colour, in the language the pages are prerendered in.
 *
 * - **Without a KPM** it is the manifest it always was, Boost's icons (`lib/pwa.ts`).
 * - **With `?kpm=<id>&v=<version>`** — the link the shell points at once a KPM shows its own logo — its icons are the
 *   KPM's, made from its square logo and served by version (`GET /kpm-branding/:kpmId/files/:file`).
 * - **`name` and `short_name` are *AgencyBoost* for every KPM** (the owner, 3 November): only the icon changes.
 *
 * A `kpm` that is not an id, or a `v` that is not a version, is ignored: the manifest is AgencyBoost's.
 */
export function manifestFor(kpm?: string | null, version?: string | null): MetadataRoute.Manifest {
  const words = messagesIn(appMessages, LANGUAGE_UNCHOSEN);
  const kpmId = kpm && /^[0-9a-f]{24}$/i.test(kpm) ? kpm.toLowerCase() : null;
  const v = version && /^[0-9a-f]{1,40}$/i.test(version) ? version.toLowerCase() : null;
  const icons = kpmId && v
    ? PWA_ICONS.map((icon) => {
      const file = icon.src.split('/').pop() ?? '';
      const src = apiUrl(`/kpm-branding/${kpmId}/files/${file}`);
      return { ...icon, src: `${src}?v=${v}` };
    })
    : PWA_ICONS.map((icon) => ({ ...icon }));
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
    icons,
  };
}
