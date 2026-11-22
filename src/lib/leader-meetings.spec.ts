import { describe, expect, it } from 'vitest';
import { meetingView } from '@/app/leader-meetings/forum-fixtures';
import {
  daysToGo, forumWhen, personOf, pickablePeople, sharedAddress, shareText, whatsAppShareHref,
} from './leader-meetings';

describe('the forum’s client rules (P19.22-T8; ADR-0276)', () => {
  it('P19.22-T8 AC-1 when a forum is: the weekday, the day, the time in the app’s format; the date alone without a time', () => {
    expect(forumWhen({ date: '2026-11-27', time: '14:00' }, 'id')).toBe('Jum, 27 Nov 2026 · 14.00');
    expect(forumWhen({ date: '2026-11-27', time: null }, 'id')).toBe('Jum, 27 Nov 2026');
  });

  it('P19.22-T8 AC-1 Hari ini · Besok · n hari lagi (DATA-DEFINITIONS)', () => {
    expect([daysToGo(0, 'id'), daysToGo(1, 'id'), daysToGo(8, 'id')]).toEqual(['Hari ini', 'Besok', '8 hari lagi']);
    expect([daysToGo(0, 'en'), daysToGo(1, 'en'), daysToGo(8, 'en')]).toEqual(['Today', 'Tomorrow', '8 days to go']);
  });

  it('P19.22-T8 AC-3, OD-418 a PIC: the person a read draws; only the editors are offered', () => {
    const forum = meetingView();
    expect(personOf(forum, 'mem-sari')?.firstName).toBe('Sari');
    expect(personOf(forum, null)).toBeNull();
    expect(personOf(forum, 'mem-gone')).toBeNull();
    expect(pickablePeople(forum).map((p) => p.firstName)).toEqual(['Wilson', 'Maya', 'Agus', 'Sari', 'Yosef']);
  });

  it('P19.22-T8 AC-2, OD-359 Bagikan’s message: the forum and when, the agenda ticked, the items with PIC, tenggat, state, the link', () => {
    const text = shareText(meetingView(), sharedAddress('https://app.test', 'tok'), 'id', 'id');
    expect(text.split('\n')).toEqual([
      'Strategic Leader Forum · Forum #14 · Min, 15 Nov 2026 · 14.00',
      '',
      'Agenda:',
      '✓ Review angka MAPA driver dan informal group (Wilson)',
      '✓ Update action items forum #13 (Semua)',
      '✓ Strategi rekrut Q4: tiap AB 1 presentasi rekrut per minggu (Agus)',
      '• Rencana Closing Clinic Desember (Sari)',
      '• Kesepakatan dan action items baru',
      '',
      'Action items:',
      '• Aktifkan 3 agent yang belum aktif di Tanpa group — Yosef · 27 Nov · Proses',
      '• 1 presentasi rekrut per AB per minggu — Agus · 30 Nov · Proses',
      '• Coaching 1-on-1 tiap minggu untuk agent baru — Sari · 20 Nov · Selesai',
      '• Siapkan Closing Clinic Desember — Sari · 2 Des · Belum',
      '• Naikkan pemakaian AgencyBoost Tanpa group ke 80% — Hendra · Belum',
      '',
      'Buka (hanya baca): https://app.test/leader-meetings/shared/tok',
    ]);
    expect(shareText(meetingView({ agenda: [], actionItems: [] }), 'L', 'id', 'id')).toContain('Agenda:\n—');
    expect(whatsAppShareHref('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
  });
});
