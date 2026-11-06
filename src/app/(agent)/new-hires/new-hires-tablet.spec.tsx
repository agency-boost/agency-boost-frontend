import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, digestAt, renderInLayout, stubFetch, wears } from '@test/harness';
import { ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, requestedTransfer, TODAY } from '@test/joining-fixtures';
import NewHiresPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

/**
 * **`/new-hires` on a tablet** (P19.1-T5 AC-2; UI-115, D-24; the `coaching-newhires-tablet` mockup's screen 2). At 768px
 * the 240px *Aktivasi 3M* column put *DIMAS / PRATAMA* on two lines and wrapped the *Teraktivasi, lewat 3M* pill; a
 * tablet now draws the phone's page: *Aktivasi 3M* and *Menunggu bergabung* as two tiles above the list, the filter, the
 * leaders' groups with the phone's rows. A phone and a desktop draw what they drew, to the byte.
 */

/** Agus, the AB the roster is his (`page.spec.tsx`'s): who coaches, adds agents and decides requests. */
const AGUS = {
  ...SARI_ME,
  user: { ...SARI_ME.user, id: 'u-agus', fullName: 'Agus Prasetyo', preferredName: 'Agus', initials: 'AP' },
  membership: { ...SARI_ME.membership!, membershipId: 'mem-agus', hierarchyRole: 'ab' as const, orgLevelCode: 'AB' },
  permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS],
};

const ROUTES = {
  ...SHELL_STUBS,
  '/new-hires': { body: ROSTER },
  '/new-hires/invites': {
    body: {
      today: TODAY,
      invites: [
        invite({ inviteId: 'inv-stefan', fullName: 'Stefan Wijaya', agentCode: '80111' }),
        invite({ inviteId: 'inv-yusuf', fullName: 'Yusuf Hidayat' }),
      ],
    },
  },
  '/new-hires/transfers': { body: [requestedTransfer({ requestedName: 'Raka Aditama' })] },
  '/join/requests': { body: [] },
  '/join/requests/routing': { body: [] },
  '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
};

/** The page's markup on the build before P19.1-T5, from this fixture, 2026-11-05 (`digestAt`). */
const BEFORE_T5: Record<375 | 1024 | 1280, string> = {
  375: '453b51161c8460bce71b9c799a8794a6631ebe2af221cfb6dcbdf070e8986001',
  1024: '03f2b41cc286ea1a602605c93fc9d54b15b863c83495564edd9f7ac622a1e2b7',
  1280: '03f2b41cc286ea1a602605c93fc9d54b15b863c83495564edd9f7ac622a1e2b7',
};

const EVERYONE = [
  'Fikri Ramadhan', 'Dimas Saputra', 'Indah Permata', 'Lukman Hakim', 'Kemal Pratama', 'Tari Wulandari', 'Novi Lestari',
  'Rina Wijaya', 'Budi Hartono',
];

async function open(px: number) {
  atWidth(px);
  stubFetch(ROUTES);
  renderInLayout(AgentLayout, <NewHiresPage />, { me: AGUS });
  if (px >= 1024) await screen.findByRole('button', { name: 'Actions for Yusuf Hidayat' });
  else await screen.findByRole('button', { name: 'Waiting to join: 3. Show them' });
  return document.querySelector('[data-testid^="new-hires-"]')!.parentElement as HTMLElement;
}

afterEach(() => vi.unstubAllGlobals());

describe('P19.1-T5 AC-2 /new-hires on a tablet: the phone’s page, the tiles on top (UI-115, D-24)', () => {
  it.each([768, 1023])('P19.1-T5 AC-2 at %ipx: Aktivasi 3M and Menunggu bergabung are two tiles above the list, not a side column', async (px) => {
    await open(px);
    expect(screen.getByTestId('new-hires-tablet')).toBeInTheDocument();
    expect(screen.queryByTestId('new-hires-wide')).not.toBeInTheDocument();
    const tile = screen.getByRole('region', { name: '3M activation rate' });
    const waiting = screen.getByRole('button', { name: 'Waiting to join: 3. Show them' });
    // Side by side in one row of two, and before the filter and the first group in reading order.
    expect(tile.parentElement).toBe(waiting.parentElement);
    expect(tile.parentElement).toHaveClass('grid', 'grid-cols-2');
    const filter = screen.getByRole('group', { name: 'Show' });
    expect(tile.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The side column and its list are gone; no table at all.
    expect(screen.queryByRole('region', { name: 'Waiting to join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(tile).toHaveTextContent(/^3M activation rate80%$/);
  });

  it('P19.1-T5 AC-2 at 768px: every leader’s group open, as the table it replaces had them, each person on the phone’s row', async () => {
    await open(768);
    for (const name of ['Agus Prasetyo', 'Arief Hidayat', 'Sari Puspita']) {
      const group = screen.getByRole('group', { name });
      expect(within(group).getAllByRole('button', { name: /team$/ })[0]).toHaveAttribute('aria-expanded', 'true');
    }
    const people = screen.getAllByRole('link').filter((a) => a.hasAttribute('data-row-main')).map((a) => a.textContent);
    expect(people).toEqual(EVERYONE);
    // The ⌄ still closes a group.
    const arief = screen.getByRole('group', { name: 'Arief Hidayat' });
    await userEvent.click(within(arief).getAllByRole('button', { name: /team$/ })[0]);
    expect(within(screen.getByRole('group', { name: 'Arief Hidayat' })).queryAllByRole('link')).toEqual([]);
  });

  it('P19.1-T5 AC-2 at 768px: no name on two lines, and no status pill to wrap — the phone’s circle says it', async () => {
    await open(768);
    for (const name of EVERYONE) {
      const link = screen.getByRole('link', { name });
      // `truncate`: one line, `nowrap`; a full row's width at 768px leaves every name whole.
      expect(link).toHaveClass('truncate');
    }
    const lukman = screen.getByRole('link', { name: 'Lukman Hakim' }).closest('[data-person-row]') as HTMLElement;
    expect(lukman.querySelector('[data-status]')).toHaveAttribute('data-status', 'activated_late');
    // *Teraktivasi, lewat 3M* is the circle's name for a screen reader, never a pill drawn beside the name.
    expect(within(lukman).getByText('Activated after 3M')).toHaveClass('sr-only');
    expect(lukman.querySelector('[data-tone]')).toBeNull();
  });

  it('P19.1-T5 AC-2 at 768px: Menunggu bergabung opens its sheet, as on a phone', async () => {
    await open(768);
    await userEvent.click(screen.getByRole('button', { name: 'Waiting to join: 3. Show them' }));
    const sheet = await screen.findByRole('dialog', { name: 'Waiting to join' });
    expect(within(sheet).getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent)).toEqual([
      'Stefan Wijaya', 'Yusuf Hidayat', 'Raka Aditama',
    ]);
  });

  it('P19.1-T5 AC-2 at 768px: the filter is on the page’s grey, each choice 44px', async () => {
    await open(768);
    const filter = screen.getByRole('group', { name: 'Show' });
    expect(wears(filter, 768).split(' ')).toContain('bg-card');
    expect(wears(filter, 768).split(' ')).not.toContain('bg-base');
    for (const button of within(filter).getAllByRole('button')) expect(wears(button, 768).split(' ')).toContain('min-h-11');
  });

  it.each([375, 1024, 1280] as const)('P19.1-T5 AC-2 at %ipx the page is drawn as before, to the byte', async (px) => {
    const root = await open(px);
    expect(digestAt(root, px)).toBe(BEFORE_T5[px]);
  });

  it('P19.1-T5 AC-2 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
