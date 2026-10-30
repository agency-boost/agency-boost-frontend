/**
 * **The installed app** (UI V1, UI-103; D-02, D-15): what the web app manifest (`app/manifest.ts`) and the root
 * layout's `<head>` (`app/layout.tsx`) both say, said once.
 *
 * - **Standalone, from `/`**: added to a phone's Home Screen, AgencyBoost opens with no browser bars — the field
 *   shell's floating tab bar sits at the bottom safe area rather than above Safari's toolbar.
 * - **The page's own colour** behind it and in the status bar: `#EDEDEA`, the V1 page background (`--color-base` on a V1
 *   surface, `globals.css`). A manifest and a `theme-color` meta are read before any stylesheet, so they take the value
 *   itself; `pwa.spec.ts` holds it to the stylesheet's token.
 * - **The icon** (D-15): Boost holding the phone on the brand's orange, filling most of the tile, his head near the
 *   top and his body cropped by the bottom edge, no words; the maskable pair keeps him inside the central 80%.
 *   Generated from `revisions/2026-10-30-ui-v1/brand/boost-phone.png`, its peach circle taken out.
 */
export const APP_NAME = 'AgencyBoost';

/**
 * The V1 page background, `--color-base` on a V1 surface. **A value, not a style**: a manifest and a `theme-color` meta
 * take a colour string and cannot be handed a CSS variable, so it is the token written out — `pwa.spec.ts` holds the two
 * together — and the token lint cannot tell the uses apart (as `field.tsx`'s colour input).
 */
// eslint-disable-next-line no-restricted-syntax
export const PWA_BACKGROUND = '#ededea';

/** The icons, in `public/icons/`. */
export const PWA_ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const;

/** The Home Screen icon iOS reads (`apple-touch-icon`), 180 × 180. */
export const APPLE_TOUCH_ICON = '/icons/apple-touch-icon.png';

/**
 * **The link preview's picture** (UI-101, UI-102): Boost holding the phone on the brand's orange — the app icon at its
 * largest, square, as WhatsApp draws a preview beside a link. `og:image` on `/activity/log`.
 */
export const LOG_LINK_PREVIEW_IMAGE = { url: '/icons/icon-512.png', size: 512 } as const;
