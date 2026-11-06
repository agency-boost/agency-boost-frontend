import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { accountMessages } from '@/i18n/messages/account';

/*
 * **A device's name, apart from the list of sessions** (P4-T13; the bundle, 2026-11-06; `performance-and-scale.md`):
 * *Profil saya* names the reader's own device on its first paint and opens the list only on a tap, so the list loads
 * then. `components/session-list.tsx` re-exports this.
 */

/**
 * A device name a person would recognise, out of a user agent string.
 *
 * Deliberately coarse. The goal is *"is that my phone?"*, not an inventory — and a full
 * UA string on screen is the kind of thing that makes somebody close the page rather than
 * act on it. Unknown stays unknown: a wrong guess is worse than none when the question is
 * whether to sign a device out.
 *
 * In the reader's words' language, its last parameter (English when none is passed); a browser's and a system's names
 * are their own in both.
 */
export function describeDevice(userAgent: string | null, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(accountMessages, language).sessions;
  if (!userAgent) return t.unknownDevice;
  const platform = /Android/i.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent) ? t.iPhoneOrIPad
      : /Macintosh/i.test(userAgent) ? 'Mac'
        : /Windows/i.test(userAgent) ? 'Windows'
          : /Linux/i.test(userAgent) ? 'Linux'
            : null;
  const browser = /Edg\//i.test(userAgent) ? 'Edge'
    : /Chrome\//i.test(userAgent) ? 'Chrome'
      : /Firefox\//i.test(userAgent) ? 'Firefox'
        : /Safari\//i.test(userAgent) ? 'Safari'
          : null;
  if (!platform && !browser) return t.unknownDevice;
  return browser && platform ? t.browserOn({ browser, platform }) : (browser ?? platform)!;
}
