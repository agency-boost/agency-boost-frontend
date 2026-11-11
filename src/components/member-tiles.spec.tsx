import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { MemberTiles } from './member-tiles';

const M = 1_000_000 * 100;

/** What `GET /members/:membershipId/performance` answers (ADR-0205 §1), Agus's as the mockup draws his tiles. */
const view = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-agus', today: '2026-11-05',
  activity: { from: '2026-10-30', to: '2026-11-05', count: 14 },
  production: { year: '2026', actualMinor: 3_100 * M, targetMinor: 5_000 * M, attainmentPct: 62, goalSet: true },
  lastOneOnOne: null,
  leads: { month: '2026-11', open: 9, closing: 2 },
  ...over,
});

const AGUS = { membershipId: 'mem-agus', isLeader: true };

/**
 * **P19.3-T4 the member page's four tiles** (OWN UI-020, OWN R4; ADR-0205 §1, §3; `kpm-owner-mobile` screen 5,
 * `kpm-owner-desktop` screen 3): *Aktivitas 7 hari*, *Produksi tahun ini* with *n% dari goal*, *1:1 terakhir* and *Leads*
 * with *n closing*, then *Lihat dashboard ›* — since P19.12-T5 one compact row of four at every width (ADR-0248 §1), the
 * pill after it below 1024px, and the link on the page's title row from 1024px.
 */
describe('P19.3-T4 the member’s four tiles', () => {
  afterEach(() => vi.unstubAllGlobals());

  const tile = (label: string) => screen.getByText(label).closest('[data-stat-tile]') as HTMLElement;

  it('P19.3-T4 AC-1 reads the person’s tiles and writes each figure as the mockup does (Indonesian)', async () => {
    const { calls } = stubFetch({ '/members/mem-agus/performance': { body: view() } });
    renderInIndonesian(<MemberTiles member={AGUS} />);

    expect(await screen.findByText('Aktivitas 7 hari')).toBeInTheDocument();
    expect(calls.map((c) => c.url)).toEqual([expect.stringMatching(/\/members\/mem-agus\/performance$/)]);
    expect(within(tile('Aktivitas 7 hari')).getByText('14')).toBeInTheDocument();
    // *Rp 3,1 M* with its unit small beside it, and *62% dari goal* under it.
    expect(within(tile('Produksi tahun ini')).getByText('Rp 3,1')).toBeInTheDocument();
    expect(within(tile('Produksi tahun ini')).getByText('M')).toBeInTheDocument();
    expect(within(tile('Produksi tahun ini')).getByText('62% dari goal')).toBeInTheDocument();
    expect(within(tile('1:1 terakhir')).getByText('Belum pernah')).toBeInTheDocument();
    expect(within(tile('Leads')).getByText('9')).toBeInTheDocument();
    expect(within(tile('Leads')).getByText('2 closing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lihat dashboard' })).toHaveAttribute('href', '/unit/dashboard/mem-agus');
  });

  it('P19.3-T4 AC-1 in English: the same four, the last 1:1 a date', async () => {
    stubFetch({ '/members/mem-agus/performance': { body: view({ lastOneOnOne: { date: '2026-10-21' } }) } });
    renderWithSession(<MemberTiles member={AGUS} />);
    expect(await screen.findByText('Activity, last 7 days')).toBeInTheDocument();
    expect(within(tile('Production this year')).getByText('62% of goal')).toBeInTheDocument();
    expect(within(tile('Last 1:1')).getByText('21 Oct 2026')).toBeInTheDocument();
    expect(within(tile('Leads')).getByText('2 closing')).toBeInTheDocument();
  });

  it('P19.3-T4 AC-1 production is the office’s figure: Belum diunggah while none is held, with no share', async () => {
    stubFetch({
      '/members/mem-agus/performance': {
        body: view({ production: { year: '2026', actualMinor: null, targetMinor: 5_000 * M, attainmentPct: null, goalSet: true } }),
      },
    });
    renderInIndonesian(<MemberTiles member={AGUS} />);
    await screen.findByText('Produksi tahun ini');
    expect(within(tile('Produksi tahun ini')).getByText('Belum diunggah')).toBeInTheDocument();
    expect(within(tile('Produksi tahun ini')).queryByText(/dari goal/)).not.toBeInTheDocument();
  });

  it('P19.3-T4 AC-1 with no goal saved: the figure, and Goal belum diatur in place of the share (ADR-0080)', async () => {
    stubFetch({
      '/members/mem-agus/performance': {
        body: view({ production: { year: '2026', actualMinor: 470 * M, targetMinor: null, attainmentPct: null, goalSet: false } }),
      },
    });
    renderInIndonesian(<MemberTiles member={AGUS} />);
    await screen.findByText('Produksi tahun ini');
    expect(within(tile('Produksi tahun ini')).getByText('Rp 470')).toBeInTheDocument();
    expect(within(tile('Produksi tahun ini')).getByText('Goal belum diatur')).toBeInTheDocument();
  });

  it('P19.3-T4 AC-4 somebody who leads nobody: Lihat dashboard opens their Personal Summary', async () => {
    stubFetch({ '/members/mem-indah/performance': { body: view({ membershipId: 'mem-indah' }) } });
    renderInIndonesian(<MemberTiles member={{ membershipId: 'mem-indah', isLeader: false }} />);
    expect(await screen.findByRole('link', { name: 'Lihat dashboard' })).toHaveAttribute('href', '/coaching/mem-indah/summary');
  });

  /*
   * P19.12-T5 AC-1 (ADR-0248 §1; the client's message of 11 November 2026, item 9, *"Stat dikecilin jadi 1 baris"*): one
   * compact row of four at every width, no production bar; the 44px pill after it below 1024px.
   */
  it('P19.12-T5 AC-1 one row of four at every width, no bar, and the 44px pill after it below 1024px', async () => {
    stubFetch({ '/members/mem-agus/performance': { body: view() } });
    renderInIndonesian(<MemberTiles member={AGUS} />);
    await screen.findByText('Aktivitas 7 hari');
    const row = tile('Aktivitas 7 hari').parentElement!;
    expect(row.className).toContain('grid-cols-4');
    expect(row.className).not.toMatch(/grid-cols-2/);
    expect(row.querySelectorAll('[data-stat-tile]')).toHaveLength(4);
    // No bar under the production figure, at any width.
    expect(tile('Produksi tahun ini').querySelector('[aria-hidden="true"]')).toBeNull();
    const pill = screen.getByRole('link', { name: 'Lihat dashboard' });
    // Below 1024px only (the page's title row carries it from 1024px), and a 44px target.
    expect(pill.className).toContain('lg:hidden');
    expect(pill.className).toContain('min-h-11');
  });

  it('P19.3-T4 AC-1 waits with a skeleton, and a refused read says so in place', async () => {
    stubFetch({ '/members/mem-agus/performance': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    renderInIndonesian(<MemberTiles member={AGUS} />);
    expect(screen.getByText('Memuat kinerjanya…')).toBeInTheDocument();
    expect(await screen.findByText('Kinerjanya tidak dapat ditampilkan saat ini. Bagian di bawah tidak terpengaruh.')).toBeInTheDocument();
  });
});
