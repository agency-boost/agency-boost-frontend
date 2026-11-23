import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  kpmReportHref, kpmReportMessage, kpmReportRecipients, reportFileName, reportLinkMonth, reportMonths, sendKpmReportToOwner,
} from './kpm-report';

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
      owners: [{ userId: 'u-wilson', name: 'Wilson Tanoto', phone: null }],
    });
    expect(text).toBe('Halo Wilson Tanoto, laporan KPM BSD City Branch · Prudential bulan Oktober 2026 sudah siap. Buka tautan ini '
      + 'untuk mengunduh PDF-nya (masuk sebagai owner atau admin KPM; berlaku sampai 27 Nov 2026): https://agencyboost.id/laporan-kpm/a.b');
  });

  it('P19.27-T5 AC-1 writes each owner’s own message and link: their name, their number', () => {
    const view = {
      link: 'https://agencyboost.id/laporan-kpm/a.b', month: '2026-10', expiresAt: '2026-11-27T03:00:00.000Z',
      kpmName: 'Bekasi Barat Branch', kpmCode: '0602', companyName: 'Prudential', ownerName: 'Yohanes Saputra', ownerPhone: null,
      owners: [{ userId: 'u-yohanes', name: 'Yohanes Saputra', phone: null }, { userId: 'u-sinta', name: 'Sinta Maharani', phone: '+6281299990000' }],
    };
    expect(kpmReportMessage(view, view.owners[1])).toMatch(/^Halo Sinta Maharani, laporan KPM Bekasi Barat Branch/);
    expect(kpmReportHref(view, view.owners[1])).toMatch(/^https:\/\/wa\.me\/6281299990000\?text=Halo%20Sinta%20Maharani/);
    // No number on file: WhatsApp asks whom to send it to.
    expect(kpmReportHref(view, view.owners[0])).toMatch(/^https:\/\/wa\.me\/\?text=Halo%20Yohanes%20Saputra/);
  });

  it('P19.24-T2 AC-1 reads the month a link names, and nothing from a token that is not one', () => {
    const half = btoa(JSON.stringify({ v: 1, m: '2026-10' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(reportLinkMonth(`${half}.sig`)).toBe('2026-10');
    expect(reportLinkMonth('nonsense')).toBeNull();
    expect(reportLinkMonth(`${btoa(JSON.stringify({ m: '2026-13' }))}.sig`)).toBeNull();
  });
});

/**
 * ***Kirim ke owner*'s window, only where one link will open in it** (the integration round's walk, 2026-11-22; OD-455):
 * with several owners — or not known — nothing opens in the press, and the dialog lists a link per owner.
 */
describe('lib/kpm-report — the window Kirim ke owner opens', () => {
  const VIEW = {
    link: 'https://agencyboost.id/laporan-kpm/a.b', month: '2026-10', expiresAt: '2026-11-27T03:00:00.000Z',
    kpmName: 'Bekasi Barat Branch', kpmCode: '0602', companyName: 'Prudential', ownerName: 'Yohanes Saputra', ownerPhone: null,
    owners: [{ userId: 'u-yohanes', name: 'Yohanes Saputra', phone: null }, { userId: 'u-sinta', name: 'Sinta Maharani', phone: '+6281299990000' }],
  };
  afterEach(() => vi.unstubAllGlobals());

  it('not opened in the press when the caller does not know of one owner: the link asked for, no window', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const { calls } = stubFetch({ 'POST /admin/tenants/k-1/report/link': { body: VIEW } });
    expect(await sendKpmReportToOwner('k-1', '2026-10', false)).toEqual(VIEW);
    expect(open).not.toHaveBeenCalled();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ month: '2026-10' });
  });

  it('every owner a recipient; a KPM with none yet, its waiting Owner — never an empty list', () => {
    expect(kpmReportRecipients(VIEW).map((r) => r.name)).toEqual(['Yohanes Saputra', 'Sinta Maharani']);
    expect(kpmReportRecipients({ ...VIEW, owners: [], ownerName: 'Rina Kurniawati', ownerPhone: '+6281200001111' }))
      .toEqual([{ userId: null, name: 'Rina Kurniawati', phone: '+6281200001111' }]);
  });
});
