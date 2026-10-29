import type { Metadata } from 'next';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SessionProvider } from '@/components/session-provider';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { LanguageProvider } from '@/i18n/language-provider';
import { appMessages } from '@/i18n/messages/app';
import { PRE_PAINT_SCRIPT } from '@/i18n/pre-paint';
import '@/styles/globals.css';

/**
 * **The app's title and description, in the language the pages are prerendered in** (`LANGUAGE_UNCHOSEN`, as
 * `<html lang>` starts): read into every page's `<head>` before any reader's language is known (`messages/app.ts`).
 */
const META = messagesIn(appMessages, LANGUAGE_UNCHOSEN);

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
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
