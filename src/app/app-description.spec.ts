import { describe, expect, it } from 'vitest';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_LIVE, LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { appMessages } from '@/i18n/messages/app';
import { metadata } from './layout';

/**
 * **The app's description, in the language the pages are prerendered in** (P18.98-T4, public and account): written into
 * every page's `<head>` before any reader's language is known, so in `LANGUAGE_UNCHOSEN`, as `<html lang>` starts —
 * English until the switch is live, Bahasa Indonesia from then. The title is the product's name, kept.
 */
describe('P18.98-T4 the app’s title and description', () => {
  it('writes them in LANGUAGE_UNCHOSEN: English, word for word as before, while the switch is not live', () => {
    expect(metadata.title).toBe('AgencyBoost');
    expect(metadata.description).toBe(messagesIn(appMessages, LANGUAGE_UNCHOSEN).description);
    if (!LANGUAGE_LIVE) expect(metadata.description).toBe('Activity, leads and coaching for insurance agency offices');
  });

  it('has the Indonesian a reader who chose nothing reads once it is live, the terms kept', () => {
    expect(messagesIn(appMessages, 'id').description).toBe('Aktivitas, leads, dan coaching untuk KPM asuransi');
    expect(messagesIn(appMessages, 'id').title).toBe('AgencyBoost');
  });
});
