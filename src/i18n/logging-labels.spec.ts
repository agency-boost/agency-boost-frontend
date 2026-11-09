import { describe, expect, it } from 'vitest';
import { messagesIn } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';

/**
 * **P19.3-T1 AC-2 (ADR-0200 §3, the data sources' D1):** a figure counted from app logging is *Pengguna aktif* (English
 * *App users*), and no label on a logging count says *active* or *aktif* — the word belongs to D1, production in the
 * office's file. The one place it may sit on a logging count is inside the name *Pengguna aktif*.
 *
 * This walks every word the Overview's catalogue gives its logging figures — the month's and the week's cards, the
 * not-logged reveal and its rows — in both languages. The registry's own names for the compliance family are pinned
 * by `backend/src/domain/metrics/registry.spec.ts` (`P19.3-T1 AC-2 …`).
 */
const LOGGING_KEYS = [
  // *Changed 2026-11-05 (P19.3-T2; ADR-0200 §3):* the month's logging tile and the week's card are gone; logging is the
  // first tile's pill, *Pengguna aktif* over 7 days, and *Belum mencatat · 7 hari*.
  'weekPill', 'weekPillLabel', 'notLoggedTitle', 'notLoggedOf', 'neverLogged', 'everybodyLogged', 'loadingList',
] as const;

/** A message as a reader sees it: a function given a figure, a string as it is. */
const text = (value: unknown): string => (typeof value === 'function'
  ? String((value as (a: object) => string)({ notLogged: 6, n: 6, of: 28 }))
  : String(value));

/** The word *active* or *aktif*, anywhere but inside the name *Pengguna aktif*. */
const saysActive = (label: string) => /\b(active|aktif)\b/i.test(label.replace(/Pengguna aktif/gi, ''));

describe('P19.3-T1 AC-2 — no logging label says active (ADR-0200 §3)', () => {
  it.each(['en', 'id'] as Language[])('P19.3-T1 AC-2 every logging label of the Overview, in %s, says neither active nor aktif', (language) => {
    const words = messagesIn(kpmOverviewMessages, language) as unknown as Record<string, unknown>;
    for (const key of LOGGING_KEYS) {
      expect(key in words).toBe(true);
      expect([key, saysActive(text(words[key]))]).toEqual([key, false]);
    }
  });

  it('P19.3-T2 AC-1 the first tile is Aktif bulan ini — D1, production — and the pill under it names Pengguna aktif', () => {
    const id = messagesIn(kpmOverviewMessages, 'id');
    expect(id.activeMonth).toBe('Aktif bulan ini');
    expect(id.weekPill({ n: 8 })).toBe('7 hari: 8 belum ›');
    expect(id.weekPillLabel({ n: 8, of: 28 })).toMatch(/^Pengguna aktif, 7 hari: 8 dari 28 belum mencatat/);
    expect(id.notLoggedTitle).toBe('Belum mencatat · 7 hari');
  });

  it('P19.3-T1 AC-2 the rule lets Pengguna aktif through, and nothing else with the word', () => {
    expect(saysActive('Pengguna aktif · 7 hari')).toBe(false);
    expect(saysActive('App users')).toBe(false);
    expect(saysActive('Aktif bulan ini')).toBe(true);
    expect(saysActive('Monthly active agents')).toBe(true);
    // *Activity* is not *active*.
    expect(saysActive('Activity logging — this week')).toBe(false);
  });
});
