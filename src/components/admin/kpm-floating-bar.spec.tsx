import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch, wears } from '@test/harness';
import { BSD, CONSOLE_SUPER_ADMIN } from '@test/console-fixtures';
import { EVEN_TAB_PHONE } from '@/components/field-nav';
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

/**
 * **The strip on a phone, and the bar beneath it** (P19.29-T2, T3; UI-201, UI-202 (21 Nov); ADR-0287 §2, §4): below
 * 768px the Super Admin's bar is a normal 40px strip above the title row, in the page's flow; the owner bar's five tabs are
 * their columns' width with 11px labels. From 768px both are as they were, and nobody else's bar changes.
 */
describe('P19.29 the owner pages inside a KPM on a phone: the strip and the bar', () => {
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

  it.each([375, 360])('P19.29-T2 AC-1 at %ipx a 40px strip above the title row, in the flow, covering nothing', async (px) => {
    atWidth(px);
    nav.path = '/people/members';
    renderInIndonesian(<Shell family="tenant" title="All members">page</Shell>, { me: SA_INSIDE });
    const strip = await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    await waitFor(() => expect(strip).toHaveTextContent('BSD City Branch'));
    expect(strip).toHaveAttribute('data-kpm-strip');
    // In the page's flow, never fixed over it — and before the title row, so the title and its button are below it.
    expect(strip).not.toHaveClass('fixed');
    expect(strip).toHaveClass('h-10', '-mx-4', 'mb-3');
    const title = screen.getByRole('heading', { level: 1, name: 'All members' });
    expect(strip.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.closest('main')).not.toBeNull();
    // The name takes the room the two links leave; the links keep their words and a 44px tap.
    expect(strip.querySelector('[data-kpm-strip-name]')).toHaveClass('min-w-0', 'flex-1', 'truncate');
    const kpmPage = within(strip).getByRole('link', { name: 'Halaman KPM' });
    expect(kpmPage).toHaveAttribute('href', `/admin/tenants/${BSD}`);
    expect(kpmPage).toHaveClass('shrink-0', 'h-10', 'text-base', 'font-semibold', 'relative');
    expect(kpmPage.className).toContain('max-md:after:h-[max(100%,2.75rem)]');
    await userEvent.click(within(strip).getByRole('link', { name: 'Semua KPM' }));
    expect(enteredKpmId()).toBeNull();
    // One bar, never two.
    expect(screen.getAllByRole('complementary', { name: 'Super Admin di dalam KPM' })).toHaveLength(1);
  });

  it('P19.29-T2 from 768px the bar floats at the foot as before, and no strip is drawn', async () => {
    atWidth(800);
    nav.path = '/people/members';
    renderInIndonesian(<Shell family="tenant" title="All members">page</Shell>, { me: SA_INSIDE });
    const bar = await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    expect(bar).toHaveClass('fixed', 'md:bottom-6');
    expect(bar).not.toHaveAttribute('data-kpm-strip');
    expect(document.querySelector('[data-kpm-strip]')).toBeNull();
  });

  it('P19.29-T3 AC-1 the owner bar: five equal columns, each tab its column’s width, 11/400 labels on one line', async () => {
    atWidth(360);
    nav.path = '/people/members';
    renderInIndonesian(<Shell family="tenant" title="All members">page</Shell>, { me: SA_INSIDE });
    await screen.findByRole('complementary', { name: 'Super Admin di dalam KPM' });
    const bar = document.querySelector('[data-tab-bar]') as HTMLElement;
    expect(bar.querySelector('.grid')).toHaveClass('grid-cols-5');
    const faces = Array.from(bar.querySelectorAll('[data-tab-face]'));
    expect(faces).toHaveLength(5);
    for (const face of faces) {
      expect(face).toHaveClass('whitespace-nowrap', ...EVEN_TAB_PHONE.split(' '));
      // At 360px the face is its column's width, no side padding, 11px and regular; at 768px as before.
      expect(wears(face, 360).split(' ')).toEqual(expect.arrayContaining(['w-full', 'px-0', 'text-[0.6875rem]', 'font-normal']));
      expect(wears(face, 768).split(' ')).not.toContain('text-[0.6875rem]');
    }
    // The current pill is All members' own face — its column — so it covers no other label.
    const current = bar.querySelector('[aria-current="page"] [data-tab-face]') as HTMLElement;
    expect(current).toHaveTextContent('All members');
    expect(current).toHaveClass('bg-secondary', 'max-md:w-full');
  });

  it('P19.29-T3 nobody else’s bar changes: a field member’s tabs keep their 12px faces on a phone', async () => {
    atWidth(360);
    nav.path = '/home';
    const ab = makeMe({
      membership: {
        membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 3,
      },
    });
    renderInIndonesian(<Shell family="agent" title="Home">page</Shell>, { me: ab });
    const bar = await waitFor(() => document.querySelector('[data-tab-bar]') as HTMLElement);
    for (const face of bar.querySelectorAll('[data-tab-face]')) {
      expect(face).toHaveClass('text-xs', 'px-2');
      expect(face).not.toHaveClass('max-md:text-[0.6875rem]');
    }
    expect(document.querySelector('[data-kpm-strip]')).toBeNull();
  });
});
