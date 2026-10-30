import type { Metadata, Viewport } from 'next';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SessionProvider } from '@/components/session-provider';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { LanguageProvider } from '@/i18n/language-provider';
import { appMessages } from '@/i18n/messages/app';
import { PRE_PAINT_SCRIPT } from '@/i18n/pre-paint';
import { APP_NAME, APPLE_TOUCH_ICON, PWA_BACKGROUND } from '@/lib/pwa';
import '@/styles/globals.css';

/**
 * **The app's title and description, in the language the pages are prerendered in** (`LANGUAGE_UNCHOSEN`, as
 * `<html lang>` starts): read into every page's `<head>` before any reader's language is known (`messages/app.ts`).
 */
const META = messagesIn(appMessages, LANGUAGE_UNCHOSEN);

/** Inter, self-hosted (UI V1, UI-008): the file `globals.css`'s `@font-face` reads, preloaded below. */
const INTER_FONT ='/fonts/inter-latin-wght-normal.woff2';

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  /*
   * **An installed app, not a bookmark** (UI V1, UI-103; D-02, D-15): the manifest (`app/manifest.ts`), and the metas
   * a Home Screen reads before it — both *capable* flags, written out because Next writes only one of them for
   * `appleWebApp.capable`, the default status bar, and the 180px icon iOS takes (`lib/pwa.ts`).
   */
  manifest: '/manifest.webmanifest',
  applicationName: APP_NAME,
  appleWebApp: { title: APP_NAME, statusBarStyle: 'default' },
  icons: { apple: [{ url: APPLE_TOUCH_ICON, sizes: '180x180', type: 'image/png' }] },
  other: { 'mobile-web-app-capable': 'yes', 'apple-mobile-web-app-capable': 'yes' },
};

/**
 * **The browser's bars in the page's colour, and the page under the home indicator** (UI-103): `theme-color` is the V1
 * page background, and `viewport-fit=cover` is what lets `env(safe-area-inset-bottom)` read the home indicator's room —
 * the floating tab bar, a sheet's pinned foot (D-01) and the save pill all stand on it.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: PWA_BACKGROUND,
};

/**
 * **`<html lang>` is the reader's language, never a fixed one** (P18.98-T1 AC-4; WCAG 3.1.1; parity F-258). It was
 * `id` over screens that are mostly English, so a screen reader read English in Indonesian.
 *
 * - The prerender writes the language its pages are built in, `LANGUAGE_UNCHOSEN`.
 * - **Before the body is parsed**, the inline script moves it to the reader's, read from the language cookie
 *   (`i18n/pre-paint.ts`) — no route reads the cookie on the server, so every prerendered route stays static (AC-3).
 * - `LanguageProvider` keeps it in step with the language the screen is written in from then on.
 *
 * React leaves the attribute to those two (`suppressHydrationWarning`, on this element only).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={LANGUAGE_UNCHOSEN} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
        {/* The one font file every screen needs, fetched with the page rather than after its CSS (UI-008; `globals.css`). */}
        <link rel="preload" href={INTER_FONT} as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <LanguageProvider>
          <SessionProvider>
            <ImpersonationBanner />
            {children}
          </SessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
