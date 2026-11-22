import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession } from '@test/harness';
import PlatformLayout from './layout';

const nav = vi.hoisted(() => ({ path: '/admin/platform/team', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));

const ME = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.id', fullName: 'PLATFORM OPERATOR', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all'],
});

/** **P19.23-T6 (frames f52–f55; spec §12): *Platform*'s title and its four sections** — a tab row, a phone's dropdown. */
describe('Platform layout', () => {
  afterEach(() => nav.push.mockReset());

  it('P19.23-T6 from 768px: the four sections as links, the current one marked', () => {
    atWidth(1024);
    renderWithSession(<PlatformLayout><p>section</p></PlatformLayout>, { me: ME });
    const tabs = screen.getByRole('navigation', { name: 'Platform sections' });
    const links = [...tabs.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Audit log', 'Super Admin team', 'Platform settings', 'Announcements']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/platform/audit', '/admin/platform/team', '/admin/platform/settings', '/admin/platform/announcements',
    ]);
    expect(screen.getByRole('link', { name: 'Super Admin team' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('section')).toBeInTheDocument();
  });

  it('P19.23-T7 AC-1 on a phone: the sections in a dropdown, a choice going there', async () => {
    atWidth(390);
    renderWithSession(<PlatformLayout><p>section</p></PlatformLayout>, { me: ME });
    expect(screen.queryByRole('navigation', { name: 'Platform sections' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Platform sections/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Announcements' }));
    expect(nav.push).toHaveBeenCalledWith('/admin/platform/announcements');
  });
});
