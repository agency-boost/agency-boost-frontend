import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderInIndonesian, stubFetch } from '@test/harness';
import { BSD, CONSOLE_SUPER_ADMIN } from '@test/console-fixtures';
import { Shell } from '@/components/shell';
import { enteredKpmId, enterKpm, leaveKpm } from '@/lib/super-admin-kpm';

const nav = vi.hoisted(() => ({ path: '/kpm/overview' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));

const SA_INSIDE = { ...CONSOLE_SUPER_ADMIN, permissions: [...CONSOLE_SUPER_ADMIN.permissions, 'member:read_profile', 'kpm_overview:read'] };

/**
 * **The owner pages, for a Super Admin inside a KPM** (P19.23-T2 AC-5; ADR-0277 §3): the Owner's own menu — KPM · People
 * · Pengaturan — and only one thing more, the floating Super Admin bar: the KPM's name, its page and *Semua KPM*.
 */
describe('P19.23-T2 AC-5 the owner pages inside a KPM: the Owner’s menu and the floating bar', () => {
  beforeEach(() => {
    stubFetch({
      [`/admin/tenants/${BSD}`]: { body: { _id: BSD, branchName: 'BSD City Branch', companyName: 'Prudential' } },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    enterKpm(BSD);
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T2 AC-5 at 1280px: the Owner’s groups, no field groups, and the floating bar with the KPM’s name', async () => {
    atWidth(1280);
    nav.path = '/kpm/overview';
    renderInIndonesian(<Shell family="tenant" title="Overview">page</Shell>, { me: SA_INSIDE });
    const bar = await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    await waitFor(() => expect(bar).toHaveTextContent('BSD City Branch'));
    expect(within(bar).getByRole('link', { name: /Halaman KPM/ })).toHaveAttribute('href', `/admin/tenants/${BSD}`);
    const links = Array.from(screen.getByRole('navigation', { name: 'Utama' }).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/kpm/overview', '/people/members', '/people/admins', '/kpm/settings']));
    expect(links).not.toContain('/home');
    expect(links).not.toContain('/admin');
    // The console's tag is not on the Owner's pages.
    expect(screen.queryByText('SUPERADMIN')).not.toBeInTheDocument();
  });

  it('P19.23-T2 AC-5 Semua KPM leaves the KPM', async () => {
    atWidth(1280);
    nav.path = '/people/members';
    renderInIndonesian(<Shell family="tenant" title="All members">page</Shell>, { me: SA_INSIDE });
    const bar = await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    await userEvent.click(within(bar).getByRole('link', { name: /Semua KPM/ }));
    expect(enteredKpmId()).toBeNull();
  });

  it('P19.23-T2 AC-5 on a phone: the Owner’s bar, Overview · All members · Data upload · Pengaturan · Lainnya', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    renderInIndonesian(<Shell family="tenant" title="Overview">page</Shell>, { me: SA_INSIDE });
    await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    const tabs = Array.from(document.querySelectorAll('[data-tab-bar] [data-tab]')).map((t) => t.textContent);
    expect(tabs).toEqual(['Overview', 'All members', 'Data upload', 'Pengaturan', 'Lainnya']);
  });

  it('P19.23-T2 AC-5 the console’s own pages keep the console menu and draw no floating bar', async () => {
    atWidth(1280);
    nav.path = `/admin/tenants/${BSD}`;
    renderInIndonesian(<Shell family="admin" title="BSD City Branch">page</Shell>, { me: SA_INSIDE });
    await screen.findByText('SUPERADMIN');
    expect(screen.queryByRole('complementary', { name: 'Super Admin di dalam KPM' })).not.toBeInTheDocument();
  });
});
