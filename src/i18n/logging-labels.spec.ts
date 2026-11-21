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
  // *Changed 2026-11-20 (P19.19; ADR-0272 §2):* the Overview's second version counts logging as *Pakai* — section 1's
  // *Sudah pakai AgencyBoost* over 30 days, section 2's three tiles and a person's *Pakai n hari lalu*.
  'usageTitle', 'usedHeadline', 'usedOf', 'usedName', 'usageNever', 'usageLapsed', 'usageRecent', 'usedDaysAgo', 'usedToday',
] as const;

/** A message as a reader sees it: a function given a figure, a string as it is. */
const text = (value: unknown): string => (typeof value === 'function'
  ? String((value as (a: object) => string)({ notLogged: 6, n: '6', of: '28', used: '6', pct: '21%', system: 'AgencyBoost' }))
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

  it('P19.19-T1 AC-2 section 1 says Sudah pakai, the brief’s word: production’s Active Agent is section 5’s alone', () => {
    const id = messagesIn(kpmOverviewMessages, 'id');
    expect(id.usedHeadline({ system: 'AgencyBoost' })).toBe('Sudah pakai AgencyBoost');
    expect(id.usageTitle({ system: 'AgencyBoost' })).toBe('1 · Pemakaian AgencyBoost');
    expect(id.usedDaysAgo({ n: '18' })).toBe('Pakai 18 hari lalu');
    expect(id.activeAgent).toBe('Active Agent');
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
