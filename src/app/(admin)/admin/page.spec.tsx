import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { CEMPAKA, CONSOLE_SUPER_ADMIN, DASHBOARD, GADING, HOLD, MAGNI } from '@test/console-fixtures';
import { enteredKpmId, enterKpm, leaveKpm } from '@/lib/super-admin-kpm';
import ConsoleDashboardPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

const RULES = { rules: { 'color-contrast': { enabled: false } } };

/**
 * ***Dashboard*** (P19.23-T1 AC-2 to AC-4; ADR-0277 §1, §2): the navy summary and its funnel against last month, *Perlu
 * tindakan* one row per issue with the KPM's name and company and one button, and *Adopsi per KPM* by company, its numbers
 * changing with *Semua · Leader · Agent* and coloured on the server's scale.
 */
describe('/admin — the console’s Dashboard (P19.23-T1)', () => {
  beforeEach(() => {
    atWidth(1024);
    stubFetch({ '/admin/dashboard': { body: DASHBOARD } });
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T1 AC-2 Keseluruhan: KPM (+n bulan ini), Perusahaan, KPM aktif dari n, Anggota leader · agent', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const summary = within(await screen.findByRole('region', { name: 'Keseluruhan' }));
    expect(summary.getByText('+1 bulan ini')).toBeInTheDocument();
    expect(summary.getByText('dari 5 KPM')).toBeInTheDocument();
    expect(summary.getByText('11 leader · 22 agent')).toBeInTheDocument();
    // The insurers with the most KPMs first.
    expect(summary.getByText('Prudential · Sejahtera · Allianz')).toBeInTheDocument();
  });

  it('P19.23-T1 AC-2 the funnel: count, share, and the change on last month — points for Pakai 14 hari terakhir', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    expect(await screen.findByText('Pemakaian AgencyBoost · dari 33 anggota')).toBeInTheDocument();
    const funnel = document.querySelector('[data-console-funnel]')!;
    const rows = Array.from(funnel.querySelectorAll('li')).map((li) => li.textContent);
    expect(rows[1]).toContain('Pernah pakai');
    expect(rows[1]).toContain('82%');
    expect(rows[1]).toContain('▲ 3');
    expect(rows[2]).toContain('▲ 7 poin');
    // A step that held says no change at all.
    expect(rows[3]).not.toMatch(/[▲▼]/);
    // Said in words to a screen reader, after the figure.
    expect(within(funnel as HTMLElement).getAllByText('▲ 3 dari bulan lalu').length).toBeGreaterThan(0);
  });

  it('P19.23-T1 AC-3 P19.26-T1 AC-3 Perlu tindakan: counts KPMs, one row per issue, the KPM’s name and company, never a suspended KPM', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    // Three KPMs (the server's `needsAction`), the KPM list's tile's number — not the five rows (ADR-0284 §2).
    expect(await screen.findByRole('heading', { name: 'Perlu tindakan · 3' })).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll('[data-attention-row]')).map((r) => r.textContent ?? '');
    expect(rows).toEqual([
      expect.stringContaining('Kelapa Gading Branch · Prudential: langganan berakhir'),
      expect.stringContaining('Magni · Prudential: belum punya anggota'),
      expect.stringContaining('Cempaka Putih Branch · Sejahtera Baru Life: owner belum diundang'),
      expect.stringContaining('Data Okt belum diunggah: Cempaka Putih Branch · Sejahtera Baru Life'),
      expect.stringContaining('3 persetujuan menunggu'),
    ]);
    expect(rows.join(' ')).not.toContain('Suspended Branch');
  });

  it('P19.23-T1 AC-3 each row’s one button goes straight to the right page — inside the KPM for an owner page', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByRole('heading', { name: 'Perlu tindakan · 3' });
    const row = (key: string) => within(document.querySelector(`[data-attention-row="${key}"]`) as HTMLElement);
    expect(row(`${MAGNI}-no_members`).getByRole('link', { name: 'Buka People' })).toHaveAttribute('href', '/people/import');
    expect(row(`${CEMPAKA}-data_missing`).getByRole('link', { name: 'Buka' })).toHaveAttribute('href', '/kpm/data-upload');
    expect(row('approvals').getByRole('link', { name: 'Buka' })).toHaveAttribute('href', '/admin/approvals');
    expect(row(`${CEMPAKA}-owner_not_invited`).getByRole('button', { name: /Kirim undangan/ })).toBeInTheDocument();
    // *Perpanjang* opens *Langganan*'s calculator for that KPM over the Dashboard (ADR-0279's dialog).
    expect(row(`${GADING}-subscription_ended`).getByRole('button', { name: 'Perpanjang' })).toBeInTheDocument();
    // Going inside enters the KPM: every request from then on names it.
    await userEvent.click(row(`${MAGNI}-no_members`).getByRole('link', { name: 'Buka People' }));
    expect(enteredKpmId()).toBe(MAGNI);
  });

  it('P19.23-T1 AC-4 P19.26-T1 AC-4 Adopsi per KPM: companies with their totals, every KPM beneath with the code small', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const table = await screen.findByRole('table');
    const prudential = table.querySelector('[data-adoption-company="Prudential"]') as HTMLElement;
    // Every KPM of the company (UI-205): the ended subscription's and the suspended one's too; 31 members.
    expect(within(prudential).getByText('4 KPM')).toBeInTheDocument();
    expect(within(prudential).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'BSD City BranchKPM 0417', 'Kelapa Gading BranchKPM 0555', 'MagniKPM 1234', 'Suspended BranchKPM 0999',
    ]);
    expect(prudential.textContent).toContain('27 dari 31');
    // A suspended KPM says *Ditangguhkan* in place of its shares.
    const held = table.querySelector(`[data-adoption-kpm="${HOLD}"]`) as HTMLElement;
    expect(within(held).getByText('Ditangguhkan')).toBeInTheDocument();
    expect(held.querySelectorAll('[data-pct]')).toHaveLength(0);
    // The Allianz row says it holds none.
    expect(within(table.querySelector('[data-adoption-company="Allianz Life"]') as HTMLElement).getByText('Belum ada KPM')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Masuk ke BSD City Branch' })).toHaveAttribute('href', expect.stringContaining('/admin/tenants/'));
  });

  it('P19.23-T1 AC-4 Semua · Leader · Agent changes every number, and the pills follow the scale', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const table = await screen.findByRole('table');
    const bsd = () => table.querySelector('[data-adoption-kpm]') as HTMLElement;
    expect(Array.from(bsd().querySelectorAll('[data-pct]')).map((p) => p.getAttribute('data-pct'))).toEqual(['87', '57', '20']);
    expect(bsd().querySelector('[data-pct="87"] span')).toHaveClass('bg-pill-green');
    expect(bsd().querySelector('[data-pct="57"] span')).toHaveClass('bg-pill-amber');
    expect(bsd().querySelector('[data-pct="20"] span')).toHaveClass('bg-pill-red');
    await userEvent.click(screen.getByRole('tab', { name: 'Leader' }));
    await waitFor(() => expect(Array.from(bsd().querySelectorAll('[data-pct]')).map((p) => p.getAttribute('data-pct'))).toEqual(['100', '90', '40']));
    await userEvent.click(screen.getByRole('tab', { name: 'Agent' }));
    await waitFor(() => expect(bsd().textContent).toContain('16 dari 20'));
  });

  it('P19.23-T1 AC-4 ⓘ beside a total says Leader x · Agent y', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: 'BSD City Branch: leader dan agent' }));
    expect(within(table).getByRole('status')).toHaveTextContent('Leader 10 · Agent 20');
  });

  it('P19.23-T1 the Dashboard is outside every KPM: arriving leaves the one the tab had entered', async () => {
    enterKpm(MAGNI);
    renderWithSession(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByRole('table');
    expect(enteredKpmId()).toBeNull();
  });

  it('P19.23-T1 the error state: the server’s refusal in its own words', async () => {
    stubFetch({ '/admin/dashboard': { status: 403, body: { error: { code: 'PERM_DENIED', message: 'Anda tidak punya izin.', requestId: 'r-1' } } } });
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    expect(await screen.findByText('Anda tidak punya izin.')).toBeInTheDocument();
  });

  it('P19.23-T7 AC-1 on a phone the tree is cards, each figure under its column’s name — no table', async () => {
    atWidth(375);
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByRole('table');
    const cards = document.querySelector('[data-console-adoption-cards]') as HTMLElement;
    expect(within(cards).getAllByText('Pakai 14 hari terakhir').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-console-adoption]')!.closest('.max-md\\:hidden')).not.toBeNull();
  });

  /*
   * **P19.26-T2 (UI-206 (21 Nov)): a tiny bit simpler on a phone, nothing else.** jsdom applies no media query, so the
   * phone's two removals and the light orange are asserted as the `max-md:` classes that draw them; from 768px the page is
   * as before (the tests above, at 1024px).
   */
  it('P19.26-T2 AC-1 on a phone: no Keseluruhan heading (a screen reader still names the card) and no Anggota 100% row', async () => {
    atWidth(375);
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const summary = await screen.findByRole('region', { name: 'Keseluruhan' });
    expect(within(summary).getByRole('heading', { name: 'Keseluruhan' })).toHaveClass('max-md:sr-only');
    const rows = document.querySelectorAll('[data-console-funnel] li');
    expect(rows[0]).toHaveAttribute('data-funnel-row', 'members');
    expect(rows[0]).toHaveClass('max-md:hidden');
    // The other three stay, and nothing else on the card is hidden.
    expect(Array.from(rows).slice(1).some((li) => li.classList.contains('max-md:hidden'))).toBe(false);
  });

  it('P19.26-T2 AC-2 on a phone the navy card’s big numbers and its % are the light orange', async () => {
    atWidth(375);
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const summary = await screen.findByRole('region', { name: 'Keseluruhan' });
    const figures = Array.from(summary.querySelectorAll('dd > b'));
    expect(figures.map((b) => b.textContent)).toEqual(['5', '3', '3', '33']);
    for (const b of figures) expect(b).toHaveClass('max-md:text-on-navy-orange', 'max-md:text-figure', 'text-primary');
    const pct = within(document.querySelector('[data-console-funnel]') as HTMLElement).getByText('82%');
    expect(pct).toHaveClass('max-md:text-on-navy-orange', 'text-primary');
  });

  it('P19.26-T1 AC-2 Anggota is the counted members: the tile, the funnel and the sum of every KPM agree', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    const summary = await screen.findByRole('region', { name: 'Keseluruhan' });
    const sum = DASHBOARD.kpms.reduce((n, k) => n + k.usage.leader.members + k.usage.agent.members, 0);
    expect(Array.from(summary.querySelectorAll('dd > b')).map((b) => b.textContent)).toContain(String(sum));
    expect(screen.getByText(`Pemakaian AgencyBoost · dari ${sum} anggota`)).toBeInTheDocument();
  });

  it('P19.23-T1 axe on the populated Dashboard', async () => {
    const { container } = renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByRole('table');
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the console’s own is left', async () => {
    renderInIndonesian(<ConsoleDashboardPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByRole('table');
    expect(englishShown(document.body, englishOnly(adminConsoleMessages))).toEqual([]);
  });
});
