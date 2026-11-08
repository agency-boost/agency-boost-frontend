import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, digestAt, renderInLayout, stubFetch, wears } from '@test/harness';
import { ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, requestedTransfer, TODAY } from '@test/joining-fixtures';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import NewHiresPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
  // The page reads its year from the address (P19.9-T3 AC-2): none here, so *Tahun berjalan*.
  useSearchParams: () => new URLSearchParams(),
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

/**
 * **The page with P19.8-T1's two changes put back** (AC-1, AC-4, AC-5): the filter's buttons as they were written, and the
 * phone's three new classes on a person's name taken off. A copy; the page is not touched.
 */
function asBeforeP198(root: HTMLElement): HTMLElement {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const button of copy.querySelectorAll('[role="group"][aria-label="Show"] > button')) {
    const on = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('class', `min-h-10 flex-1 whitespace-nowrap rounded-pill px-2 text-sm font-semibold max-lg:min-h-11 ${
      on ? 'bg-ink text-white' : 'text-ink hover:bg-hover-row'}`);
  }
  const added = new Set(['max-md:text-base', 'max-md:whitespace-normal', 'max-md:break-words']);
  for (const name of copy.querySelectorAll('[data-person-row] [data-row-main], [data-person-row] span.uppercase')) {
    name.setAttribute('class', (name.getAttribute('class') ?? '').split(' ').filter((c) => !added.has(c)).join(' '));
  }
  return copy;
}

/**
 * **The page with P19.9-T3's two changes put back** (AC-2, AC-4): the year control above the page taken off, and each
 * row's address back to the person's coaching page, which a leader who coaches opened before. A copy, as above.
 */
function asBeforeP199(root: HTMLElement): HTMLElement {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelector('[role="group"][aria-label="Year"]')?.remove();
  for (const link of copy.querySelectorAll('a[href^="/new-hires/mem-"]')) {
    const id = link.getAttribute('href')!.slice('/new-hires/'.length);
    link.setAttribute('href', `/coaching/${id}/session?from=%2Fnew-hires`);
  }
  return copy;
}

/**
 * **The page with the Phase 19.9 exit review's L4 put back**: a new hire who left is a row that opens nothing — on the
 * table, their name a plain span where it was a link with its ›. Each is drawn again as its neighbours' link is, to
 * their own `/new-hires/{id}`, before `asBeforeP199` turns every such address back. A copy, as above.
 */
function asBeforeExitL4(root: HTMLElement): HTMLElement {
  const copy = root.cloneNode(true) as HTMLElement;
  const ids = new Map(Object.values(ROSTER.sections).flat().map((r) => [r.hire.name, r.hire.membershipId]));
  const model = copy.querySelector('th[scope="row"] > a');
  for (const name of copy.querySelectorAll('th[scope="row"] > span')) {
    const link = model!.cloneNode(true) as HTMLElement;
    link.setAttribute('href', `/new-hires/${ids.get(name.textContent!)}`);
    link.firstChild!.textContent = name.textContent;
    name.replaceWith(link);
  }
  return copy;
}

const EVERYONE = [
  'Fikri Ramadhan', 'Dimas Saputra', 'Indah Permata', 'Lukman Hakim', 'Kemal Pratama', 'Tari Wulandari', 'Novi Lestari',
  'Rina Wijaya', 'Budi Hartono',
];
/** Who a row opens: everybody but Tari, marked left (the Phase 19.9 exit review, L4). */
const OPENED = EVERYONE.filter((name) => name !== 'Tari Wulandari');

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
    expect(people).toEqual(OPENED);
    // Tari, marked left, on her row as anybody, opening nothing.
    expect(within(screen.getByRole('group', { name: 'Arief Hidayat' })).getByText('Tari Wulandari').closest('a')).toBeNull();
    // The ⌄ still closes a group.
    const arief = screen.getByRole('group', { name: 'Arief Hidayat' });
    await userEvent.click(within(arief).getAllByRole('button', { name: /team$/ })[0]);
    expect(within(screen.getByRole('group', { name: 'Arief Hidayat' })).queryAllByRole('link')).toEqual([]);
  });

  it('P19.1-T5 AC-2 at 768px: no name on two lines, and no status pill to wrap — the phone’s circle says it', async () => {
    await open(768);
    for (const name of EVERYONE) {
      const link = screen.getByText(name);
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

  /*
   * *Amended 2026-11-07 (P19.8-T1 AC-1, AC-4, AC-5; R6, MOB UI-171, MOB UI-168):* two things move, on purpose. The
   * filter *Semua · Teraktivasi · Belum* is a header control at every size — 13px, 600, 44px, where it was 12px and 40px
   * on a desktop — and on a phone a person's name is 13px and wraps rather than being cut. The digest is taken with those
   * two put back as they were (`asBeforeP198`), and still matches the baseline: nothing else moved.
   */
  it.each([375, 1024, 1280] as const)('P19.1-T5 AC-2 at %ipx the page is drawn as before, to the byte', async (px) => {
    const root = await open(px);
    expect(digestAt(asBeforeP198(asBeforeP199(asBeforeExitL4(root))), px)).toBe(BEFORE_T5[px]);
  });

  it.each([375, 768, 1024, 1280])('P19.8-T1 AC-1 MOB UI-171 at %ipx the filter is three header controls — 13px, 600, 44px', async (px) => {
    await open(px);
    for (const button of within(screen.getByRole('group', { name: 'Show' })).getAllByRole('button')) {
      expect(wears(button, px).split(' ')).toEqual(expect.arrayContaining(HEADER_CONTROL.split(' ')));
      expect(wears(button, px).split(' ')).not.toContain('text-sm');
    }
  });

  it('P19.1-T5 AC-2 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
