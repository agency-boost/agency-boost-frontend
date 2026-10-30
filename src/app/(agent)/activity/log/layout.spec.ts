import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messagesIn } from '@/i18n/catalogue';
import { homeMessages } from '@/i18n/messages/home';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { metadata } from './layout';

/** UI-101: the WhatsApp reminder's link opens `/activity/log`, and the chat draws its preview from these. */
describe('UI-101 the Log Activity link’s preview', () => {
  it('UI-101 names the page in og:title, in the language the pages are prerendered in', () => {
    expect(metadata.openGraph?.title).toBe(messagesIn(homeMessages, LANGUAGE_UNCHOSEN).linkPreview);
    expect(messagesIn(homeMessages, 'id').linkPreview).toBe('Lapor aktivitas hari ini · AgencyBoost');
  });

  it('UI-101, UI-102 shows Boost holding the phone on orange as og:image — the app icon, a file that is there', () => {
    const images = metadata.openGraph?.images as { url: string; width: number; height: number }[];
    expect(images).toEqual([{ url: '/icons/icon-512.png', width: 512, height: 512 }]);
    expect(existsSync(join(__dirname, '..', '..', '..', '..', '..', 'public', 'icons', 'icon-512.png'))).toBe(true);
  });
});
