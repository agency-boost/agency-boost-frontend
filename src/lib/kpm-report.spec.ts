import { describe, expect, it } from 'vitest';
import { kpmReportMessage, reportFileName, reportLinkMonth, reportMonths } from './kpm-report';

/** **P19.24-T2 — the report's words and months** (ADR-0280): what the dialog offers and what WhatsApp opens with. */
describe('P19.24-T2 lib/kpm-report', () => {
  it('P19.24-T2 AC-1 offers the office’s month and the twelve before it, newest first, the last whole month chosen', () => {
    // 20 Nov 2026, 01:00 in Jakarta (the evening before in UTC): the office's month is November.
    const { months, initial } = reportMonths(new Date('2026-11-19T18:00:00Z'));
    expect(months[0]).toBe('2026-11');
    expect(months).toHaveLength(13);
    expect(months[12]).toBe('2025-11');
    expect(initial).toBe('2026-10');
    expect(reportMonths(new Date('2026-01-15T03:00:00Z')).initial).toBe('2025-12');
  });

  it('P19.24-T2 AC-1 names the file as the API does', () => {
    expect(reportFileName('BSD City Branch', '2026-10')).toBe('Laporan-KPM-BSD-City-Branch-2026-10.pdf');
    expect(reportFileName('Café Ünit', '2026-10')).toBe('Laporan-KPM-Cafe-Unit-2026-10.pdf');
  });

  it('P19.24-T2 AC-1 writes the Owner’s message in the Owner’s language: name, KPM, company, month, until when, the link', () => {
    const text = kpmReportMessage({
      link: 'https://agencyboost.id/laporan-kpm/a.b', month: '2026-10', expiresAt: '2026-11-27T03:00:00.000Z',
      kpmName: 'BSD City Branch', kpmCode: '0417', companyName: 'Prudential', ownerName: 'Wilson Tanoto', ownerPhone: null,
    });
    expect(text).toBe('Halo Wilson Tanoto, laporan KPM BSD City Branch · Prudential bulan Oktober 2026 sudah siap. Buka tautan ini '
      + 'untuk mengunduh PDF-nya (masuk sebagai owner atau admin KPM; berlaku sampai 27 Nov 2026): https://agencyboost.id/laporan-kpm/a.b');
  });

  it('P19.24-T2 AC-1 reads the month a link names, and nothing from a token that is not one', () => {
    const half = btoa(JSON.stringify({ v: 1, m: '2026-10' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(reportLinkMonth(`${half}.sig`)).toBe('2026-10');
    expect(reportLinkMonth('nonsense')).toBeNull();
    expect(reportLinkMonth(`${btoa(JSON.stringify({ m: '2026-13' }))}.sig`)).toBeNull();
  });
});
