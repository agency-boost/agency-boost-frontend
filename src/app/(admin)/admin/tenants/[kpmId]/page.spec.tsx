import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { BSD, CONSOLE_SUPER_ADMIN, PEOPLE } from '@test/console-fixtures';
import { enteredKpmId, leaveKpm } from '@/lib/super-admin-kpm';
import KpmPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/admin/tenants/${BSD}`,
  useSearchParams: () => new URLSearchParams(),
}));

const viewAs = vi.hoisted(() => ({ open: vi.fn(async () => undefined) }));
vi.mock('@/lib/view-as', () => ({
  openViewAsWindow: viewAs.open,
  ViewAsBlocked: class ViewAsBlocked extends Error {},
}));

const RULES = { rules: { 'color-contrast': { enabled: false } } };

/** The Overview's *Performa vs target* for the month, as the Owner reads it (`GET /kpm/overview/performance`). */
const PERFORMANCE = {
  month: '2026-10', currentMonth: '2026-11', earliestMonth: '2026-01', latestMonth: '2026-11', max: 99, currency: 'IDR',
  held: true, group: null, canWrite: true, groups: [],
  total: {
    activeAgentTarget: 14, rekrutTarget: 8, rekrutYtdTarget: 40, apeTargetMinor: 68_600_000_000, unset: 0, abGroups: 4, people: 27,
    actual: { apeMinor: 59_700_000_000, apePct: 87, activeAgents: 8, rekrut: 4 },
  },
};

/** The element once it is drawn: `waitFor` asks again until it is. */
const drawn = (selector: string) => waitFor(() => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`${selector} is not drawn yet`);
  return el;
});

const render = () => renderInIndonesian(<KpmPage params={routeParams({ kpmId: BSD })} />, { me: CONSOLE_SUPER_ADMIN });

/**
 * **Inside a KPM** (P19.23-T2 AC-4 to AC-7; ADR-0277 §3): opening the page enters the KPM; the header, the switcher and the
 * thin bar; the navy tiles from the Owner's own Overview; *Owner & admin*, *Anggota*, the eight owner pages and *Lihat
 * sebagai*, whose button opens the new window for the person chosen.
 */
describe('/admin/tenants/[kpmId] — inside a KPM (P19.23-T2)', () => {
  beforeEach(() => {
    atWidth(1280);
    viewAs.open.mockClear();
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { body: PERFORMANCE },
    });
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T2 AC-4 opening it enters the KPM: the Owner’s own read below carries X-Kpm-Id', async () => {
    const { calls } = stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { body: PERFORMANCE },
    });
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    expect(enteredKpmId()).toBe(BSD);
    await waitFor(() => expect(calls.find((c) => c.url.includes('/kpm/overview/performance'))).toBeDefined());
    const headers = new Headers(calls.find((c) => c.url.includes('/kpm/overview/performance'))!.init.headers);
    expect(headers.get('X-Kpm-Id')).toBe(BSD);
    // The console's own route is never sent the header.
    expect(new Headers(calls.find((c) => c.url.includes('/people'))!.init.headers).get('X-Kpm-Id')).toBeNull();
  });

  it('P19.23-T2 AC-4 the switcher chip and the bar: Anda di dalam KPM ini sebagai Super Admin', async () => {
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    expect(screen.getAllByRole('button', { name: 'Ganti KPM: BSD City Branch · Prudential' }).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-inside-kpm-bar]')).toHaveTextContent(
      'Anda di dalam KPM ini sebagai Super Admin · semua akses owner · tercatat di audit log',
    );
  });

  it('P19.23-T2 AC-4 the navy tiles: Anggota, Active Agent, Rekrut and APE against their targets', async () => {
    render();
    const tiles = await waitFor(() => {
      const el = document.querySelector('[data-kpm-tiles]') as HTMLElement | null;
      if (!el || !el.textContent?.includes('Oktober')) throw new Error('not yet');
      return el;
    });
    expect(tiles).toHaveTextContent('BSD City Branch · Prudential · Oktober 2026');
    expect(tiles).toHaveTextContent('9 leader · 18 agent');
    expect(tiles).toHaveTextContent('dari target 14');
    expect(tiles).toHaveTextContent('dari target 8');
    expect(tiles).toHaveTextContent('87% dari target');
  });

  it('P19.23-T2 AC-4 Owner & admin: KPM Owner, Admin, Core leader, Ganti / Atur and + Tambah admin', async () => {
    render();
    const card = within(await drawn('[data-owners-card]'));
    // Names in capitals by the style (`uppercase`), their words as written.
    expect(card.getByText('Wilson Tanoto')).toHaveClass('uppercase');
    expect(card.getByText('Linda Kusuma')).toBeInTheDocument();
    expect(card.getByText('Satria Nugraha')).toBeInTheDocument();
    expect(card.getAllByRole('link', { name: 'Ganti' })[0]).toHaveAttribute('href', `/admin/tenants/${BSD}/owner`);
    expect(card.getByRole('link', { name: 'Atur' })).toHaveAttribute('href', '/people/admins');
    expect(card.getByRole('link', { name: 'Tambah admin' })).toHaveAttribute('href', '/people/admins');
  });

  it('P19.23-T2 AC-4 Anggota · n: the first five, their group and when they last used it, Import people, Lihat semua', async () => {
    render();
    const card = within(await drawn('[data-members-card]'));
    expect(card.getByRole('heading', { name: 'Anggota · 27' })).toBeInTheDocument();
    expect(card.getAllByRole('listitem')).toHaveLength(5);
    expect(card.getAllByText('Hari ini')[0]).toHaveClass('bg-pill-green');
    expect(card.getByText('22 hari lalu')).toHaveClass('bg-pill-red');
    expect(card.getByText('Belum pernah')).toHaveClass('bg-pill-red');
    expect(card.getByText('Tanpa group')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Import people' })).toHaveAttribute('href', '/people/import');
    expect(card.getByRole('link', { name: 'Lihat semua' })).toHaveAttribute('href', '/people/members');
  });

  it('P19.23-T2 AC-4 the eight owner pages, each the Owner’s own address', async () => {
    render();
    const pages = await drawn('[data-owner-pages]');
    expect(Array.from(pages.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Overview', '/kpm/overview'], ['Advanced analytics', '/kpm/advanced-analytics'],
      ['Strategic Leader Forum', '/leader-meetings'], ['Data upload', '/kpm/data-upload'],
      ['All members', '/people/members'], ['Org tree', '/people/org-tree'], ['KPM admins', '/people/admins'],
      ['Pengaturan', '/kpm/settings'],
    ]);
  });

  it('P19.23-T2 AC-7 Lihat sebagai: four roles, a real person each, Buka jendela baru with the card’s reason', async () => {
    render();
    const section = await drawn('[data-view-as]');
    expect(Array.from(section.querySelectorAll('[data-view-as-role] b')).map((b) => b.textContent))
      .toEqual(['KPM Owner', 'KPM Admin', 'AB', 'Agent']);
    // A role with nobody in it says so and offers no button.
    const agent = within(section.querySelector('[data-view-as-role="agent"]') as HTMLElement);
    expect(agent.getByText('Belum ada')).toBeInTheDocument();
    expect(agent.queryByRole('button', { name: /Buka jendela baru/ })).not.toBeInTheDocument();
    const ab = within(section.querySelector('[data-view-as-role="ab"]') as HTMLElement);
    await userEvent.click(ab.getByRole('button', { name: /Buka jendela baru/ }));
    expect(viewAs.open).toHaveBeenCalledWith(
      { userId: 'u-agus', fullName: 'Agus Prasetyo' }, 'Lihat sebagai AB dari halaman KPM BSD City Branch',
    );
  });

  it('P19.23-T2 AC-4 a KPM that is not there: the server’s 404 in its words', async () => {
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM tidak ditemukan.', requestId: 'r-2' } } },
    });
    render();
    expect(await screen.findByText('KPM tidak ditemukan.')).toBeInTheDocument();
  });

  it('P19.23-T2 AC-4 tiles a KPM cannot answer read “–”, never the page’s error', async () => {
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { status: 409, body: { error: { code: 'TENANT_SUSPENDED', message: 'x', requestId: 'r' } } },
    });
    render();
    await waitFor(() => expect(document.querySelector('[data-kpm-tiles]')?.textContent).toContain('–'));
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });

  it('P19.23-T7 AC-1 on a phone the switcher sits full width under the title', async () => {
    atWidth(375);
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    const inBody = Array.from(document.querySelectorAll('[data-kpm-switcher]')).filter((b) => b.closest('.lg\\:hidden'));
    expect(inBody).toHaveLength(1);
  });

  it('P19.23-T2 axe on the populated page', async () => {
    const { container } = render();
    await waitFor(() => expect(document.querySelector('[data-view-as]')).not.toBeNull());
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the console’s own is left', async () => {
    render();
    await waitFor(() => expect(document.querySelector('[data-view-as]')).not.toBeNull());
    expect(englishShown(document.body, englishOnly(adminConsoleMessages))).toEqual([]);
  });
});
