import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { LIBRARY, PRUDENTIAL, SUPER_ADMIN } from '@test/kpm-template-fixtures';
import CompanyLadderPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1',
}));

const rung = (code: string, label: string, displayOrder: number, leaderTier: string | null, status = 'active') => ({
  orgLevelId: code, companyId: 'c1', code, label, displayOrder, leaderTier, status, archivedAt: null, version: 0,
});
const RUNGS = [rung('AB', 'AB', 3, 'senior'), rung('AGENT', 'Agent', 1, null), rung('AAB', 'AAB', 2, 'associate'), rung('OLD', 'Old', 4, null, 'archived')];

function render(companies = [PRUDENTIAL, LIBRARY], rungs: unknown = RUNGS) {
  stubFetch({ '/admin/companies': { body: companies }, '/admin/org-levels': { body: rungs } } as never);
  renderInIndonesian(<CompanyLadderPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
}

/** **P19.23-T4 AC-2 — a company's page, tab *Jenjang*** (ADR-0278 §1; frame 29). */
describe('P19.23-T4 AC-2 Jenjang and the company’s tabs', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it.each([390, 1024])('P19.23-T4 AC-2 at %ipx draws the four tabs, Jenjang current, and the active rungs junior first', async (px) => {
    atWidth(px);
    render();
    const tabs = within(await screen.findByRole('navigation', { name: 'Perusahaan' }));
    expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Jenjang', 'Produk & proposal', 'Pengaturan template', 'Terbitkan ke KPM']);
    expect(tabs.getByRole('link', { name: 'Jenjang' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Perusahaan & template' })).toHaveAttribute('href', '/admin/companies');
    const list = within(await screen.findByRole('list', { name: 'Jenjang' }));
    expect(list.getAllByRole('listitem').map((li) => li.dataset.rung)).toEqual(['AGENT', 'AAB', 'AB']);
    expect(list.getByText('1. Agent')).toBeInTheDocument();
    expect(list.getByText('Bukan leader')).toBeInTheDocument();
    expect(list.getByText('Leader · Associate')).toBeInTheDocument();
    expect(list.getByText('Leader · Senior')).toBeInTheDocument();
    expect(screen.getByText('Urutan dari yang paling junior · dipakai semua KPM Prudential')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tambah jenjang' })).toHaveAttribute('href', '/admin/org-levels?company=c1');
  });

  it('P19.23-T4 AC-2 ⋯ Ubah opens the ladder editor with this company chosen', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: /AAB: lainnya/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Ubah/ }));
    expect(push).toHaveBeenCalledWith('/admin/org-levels?company=c1');
  });

  it('P19.23-T4 AC-2 the Default template has two tabs: no products and no KPM', async () => {
    render([{ ...PRUDENTIAL, kind: 'template' }]);
    const tabs = within(await screen.findByRole('navigation', { name: 'Perusahaan' }));
    await vi.waitFor(() => expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Jenjang', 'Pengaturan template']));
    expect(screen.getByRole('heading', { level: 1, name: 'Default template' })).toBeInTheDocument();
  });

  it('P19.23-T4 AC-2 says a company with no rung, and passes axe populated', async () => {
    render([PRUDENTIAL], []);
    expect(await screen.findByText('Perusahaan ini belum punya jenjang.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    atWidth(1280);
    render();
    await screen.findByText('1. Agent');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });
});
