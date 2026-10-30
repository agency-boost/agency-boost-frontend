import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderLive, renderWithSession, resetLanguage, wears } from '@test/harness';
import type { Me } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { Page } from './page';
import { TenantShell } from './tenant-shell';

const route = vi.hoisted(() => ({ path: '/goals' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(),
}));

function member(over: Partial<NonNullable<Me['membership']>> = {}, me: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
    ...me,
  });
}

const AB = member({ directCount: 4, office: { code: '0417', branch: 'Cempaka Putih' } }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const CORE_LEADER = member({ directCount: 4, isCoreLeader: true }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const AGENT = member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 });

/** A page in the field shell, as a group layout and a page render it. */
function screenWith(props: Partial<React.ComponentProps<typeof Page>> = {}) {
  return (
    <AgentShell>
      <Page title="Goal Setting" subtitle="Turn your annual target into this month’s activity." {...props}>
        <p>content</p>
      </Page>
    </AgentShell>
  );
}

const tabBar = () => document.querySelector<HTMLElement>('[data-tab-bar]');
const tabWords = () => Array.from(tabBar()!.querySelectorAll('[data-tab]')).map((tab) => (tab.textContent ?? '').trim());

afterEach(() => {
  vi.unstubAllGlobals();
  route.path = '/goals';
  resetLanguage();
});

describe('UI-004 the field shell below 1024px: no app bar, the title row, the floating tab bar', () => {
  it.each([360, 375, 768])('UI-004 at %ipx draws no dark bar and no sidebar, and the five labelled tabs in the owner’s order', (px) => {
    atWidth(px);
    renderWithSession(screenWith(), { me: AB });
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    const bar = tabBar()!;
    expect(bar).toHaveAccessibleName('Main');
    expect(tabWords()).toEqual(['Activity', 'Calendar', 'Home', 'Unit', 'More']);
    // Labels never wrap at 360px: one line each, 12px — and never icon-only.
    for (const face of bar.querySelectorAll('[data-tab-face]')) {
      expect(face).toHaveClass('whitespace-nowrap', 'text-xs');
      expect(face.querySelector('svg')).not.toBeNull();
      expect((face.textContent ?? '').trim()).not.toBe('');
    }
    // A white pill 64px tall, 12px from the sides and the bottom, above the home indicator; gone from 1024px.
    expect(bar).toHaveClass('fixed', 'inset-x-3', 'h-16', 'bg-card', 'lg:hidden');
    expect(bar.className).toContain('bottom-[calc(0.75rem+env(safe-area-inset-bottom))]');
  });

  it('UI-004 links each tab to its page — Home to /home — with the current one a navy pill', () => {
    atWidth(375);
    route.path = '/calendar';
    renderWithSession(screenWith(), { me: AB });
    const bar = within(tabBar()!);
    expect(bar.getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '/activity/log');
    expect(bar.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(bar.getByRole('link', { name: 'Unit' })).toHaveAttribute('href', '/unit/dashboard');
    const calendar = bar.getByRole('link', { name: 'Calendar' });
    expect(calendar).toHaveAttribute('aria-current', 'page');
    expect(calendar.querySelector('[data-tab-face]')).toHaveClass('bg-navy', 'text-white');
    expect(bar.getByRole('link', { name: 'Home' }).querySelector('[data-tab-face]')).not.toHaveClass('bg-navy');
  });

  it('O-10 gives an Agent Summary in the fourth slot, to their Personal Summary', () => {
    atWidth(360);
    renderWithSession(screenWith(), { me: AGENT });
    expect(tabWords()).toEqual(['Activity', 'Calendar', 'Home', 'Summary', 'More']);
    expect(within(tabBar()!).getByRole('link', { name: 'Summary' })).toHaveAttribute('href', '/summary');
  });

  it('UI-004 the title row: the title at 20px/800 (22px tablet), the page’s control, the 36px avatar to Profil saya', () => {
    atWidth(375);
    renderWithSession(
      screenWith({ actions: <button type="button">Wide desktop action</button>, control: <button type="button">Bulan ini</button> }),
      { me: AB },
    );
    const title = screen.getByRole('heading', { level: 1, name: 'Goal Setting' });
    expect(title).toHaveClass('text-title', 'font-extrabold', 'text-navy');
    const row = title.closest('[data-title-row]')!;
    expect(wears(row, 375)).toContain('min-h-11');
    expect(wears(row, 375)).toContain('mb-3');
    // The control below 1024px, the actions from 1024px.
    expect(screen.getByRole('button', { name: 'Bulan ini' }).parentElement).toHaveClass('lg:hidden');
    expect(screen.getByRole('button', { name: 'Wide desktop action' }).parentElement).toHaveClass('max-lg:hidden');
    const avatar = within(row as HTMLElement).getByRole('link', { name: 'Your profile' });
    expect(avatar).toHaveAttribute('href', '/profile');
    expect(avatar.querySelector('span')).toHaveClass('h-9', 'w-9');
    // No bell but on Home.
    expect(row.querySelector('[data-title-bell]')).toBeNull();
  });

  it('UI-004 draws the bell, with its count, left of the avatar — on Home alone', async () => {
    atWidth(375);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ items: [], unread: 12, total: 12, page: 1, pageSize: 1 }),
    } as Response)));
    renderWithSession(screenWith({ title: 'Home', bell: true }), {
      me: member({ directCount: 4 }, { permissions: ['notification:read_inbox'] }),
    });
    const bell = await screen.findByRole('link', { name: 'Notifications, 12 unread' });
    expect(bell).toHaveAttribute('href', '/notifications');
    expect(within(bell).getByText('9+')).toBeInTheDocument();
    const avatar = screen.getByRole('link', { name: 'Your profile' });
    expect(bell.compareDocumentPosition(avatar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('UI-004 hides a page’s sub-line on a phone and a tablet when the page says so, and keeps it from 1024px', () => {
    atWidth(768);
    renderWithSession(screenWith({ subtitleOnPhone: false, subtitleOnTablet: false }), { me: AB });
    const line = screen.getByText('Turn your annual target into this month’s activity.');
    expect(wears(line, 375).split(' ')).toContain('hidden');
    expect(wears(line, 768).split(' ')).toContain('hidden');
    expect(wears(line, 1024).split(' ')).not.toContain('hidden');
  });

  it('UI-004 leaves room under the content for the bar, the home indicator included (no content behind it)', () => {
    atWidth(375);
    renderWithSession(screenWith(), { me: AB });
    const main = screen.getByRole('main');
    expect(wears(main, 375)).toContain('pb-[calc(var(--tab-bar-space)+1.5rem)]');
    expect(wears(main, 375)).toContain('px-4');
    expect(wears(main, 1280)).toContain('lg:pb-14'.replace('lg:', ''));
  });

  it('UI-008 marks the field shell a V1 surface at every width; the office console is not', () => {
    atWidth(1280);
    const field = renderWithSession(screenWith(), { me: AB });
    expect(document.querySelector('[data-surface="v1"]')).not.toBeNull();
    field.unmount();
    route.path = '/people/members';
    renderWithSession(<TenantShell title="All Members">x</TenantShell>, {
      me: member({ isKpmOwner: true }, { permissions: ['member:read_profile'] }),
    });
    expect(document.querySelector('[data-surface]')).toBeNull();
  });
});

describe('UI-004 the field shell from 1024px: the sidebar, regrouped as the sheet', () => {
  it.each([1024, 1280])('UI-004 at %ipx draws the sidebar and no tab bar, and no avatar on the title row', (px) => {
    atWidth(px);
    renderWithSession(screenWith(), { me: CORE_LEADER });
    expect(tabBar()).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your profile' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const order = Array.from(nav.querySelectorAll('[aria-controls^="nav-group"], li > a, li > button'))
      .map((el) => (el.textContent ?? '').trim());
    expect(order).toEqual([
      'Home', 'Activity', 'Calendar', 'Unit Dashboard', 'Search agent',
      'Me', 'Leads', 'Goal Setting', 'Personal Summary', 'Training',
      'Activities', 'Sales', 'Recruitment',
      'My team', 'Coaching', 'New Hires', 'Group Tree', 'User Management',
      'Programs', 'Campaign', 'Event',
      'KPM', 'Strategic Leader Forum', 'KPM Analytics', 'Advanced analyticsSoon',
    ]);
  });

  it('UI-004 writes the group headings 12px grey in sentence case — no UNIT TOOLS', () => {
    atWidth(1280);
    renderWithSession(screenWith(), { me: AB });
    const heading = screen.getByRole('button', { name: 'My team' });
    expect(heading).toHaveClass('text-xs', 'text-white/65');
    expect(heading).not.toHaveClass('uppercase');
    expect(screen.queryByText(/unit tools/i)).not.toBeInTheDocument();
  });

  it('UI-004, UI-012 Search agent opens the agent search picker over the page, focused, and Escape closes it', async () => {
    atWidth(1280);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ members: [], items: [], unread: 0, total: 0, page: 1, pageSize: 1 }),
    } as Response)));
    renderWithSession(screenWith(), { me: AB });
    const trigger = screen.getByRole('button', { name: 'Search agent' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Search agent' });
    await waitFor(() => expect(within(dialog).getByRole('combobox')).toHaveFocus());
    await userEvent.keyboard('{Escape}{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search agent' })).not.toBeInTheDocument());
  });

  it('UI-004 Search agent sits after Unit Dashboard, for a leader only', () => {
    atWidth(1280);
    const leader = renderWithSession(screenWith(), { me: AB });
    expect(screen.getByText('Search agent')).toBeInTheDocument();
    leader.unmount();
    renderWithSession(screenWith(), { me: AGENT });
    expect(screen.queryByText('Search agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Unit Dashboard')).not.toBeInTheDocument();
  });
});

describe('UI-004 the Lainnya sheet', () => {
  async function openSheet(me: Me = AB, px = 375) {
    atWidth(px);
    renderWithSession(screenWith(), { me });
    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'More' }));
    return screen.findByRole('dialog', { name: 'More' });
  }
  const groupsOf = (sheet: HTMLElement) => within(sheet).getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  const tilesOf = (sheet: HTMLElement, group: string) => within(
    within(sheet).getByRole('heading', { level: 2, name: group }).closest('section')!,
  ).getAllByRole('listitem').map((li) => (li.textContent ?? '').trim());

  it('UI-004 opens from More: the account row on top, then the groups as 4-column tiles, then Sign out last', async () => {
    const sheet = await openSheet();
    expect(within(tabBar()!).getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
    const change = within(sheet).getByRole('link', { name: /Change photo/ });
    expect(change).toHaveAttribute('href', '/profile');
    expect(within(sheet).getByText('Rina')).toBeInTheDocument();
    expect(within(sheet).getByText('AB · 0417 · Cempaka Putih')).toBeInTheDocument();
    expect(groupsOf(sheet)).toEqual(['Me', 'Activities', 'My team', 'Programs']);
    expect(tilesOf(sheet, 'Me')).toEqual(['Leads', 'Goal Setting', 'Personal Summary', 'Training']);
    expect(tilesOf(sheet, 'My team')).toEqual(['Coaching', 'New Hires', 'Group Tree', 'User Mgmt']);
    for (const grid of sheet.querySelectorAll('ul')) expect(grid).toHaveClass('grid-cols-4');
    const buttons = within(sheet).getAllByRole('button');
    expect(buttons[buttons.length - 1]).toHaveAccessibleName('Sign out');
    expect(buttons[buttons.length - 1]).toHaveClass('text-pill-red-ink');
  });

  it('UI-004 gives a Core Leader the KPM group, Advanced analytics greyed, Coming soon, and no link', async () => {
    const sheet = await openSheet(CORE_LEADER);
    expect(groupsOf(sheet)).toEqual(['Me', 'Activities', 'My team', 'Programs', 'KPM']);
    expect(tilesOf(sheet, 'KPM')).toEqual(['Leader Forum', 'KPM Analytics', 'Advanced analyticsSoon']);
    const soon = sheet.querySelector('[data-tile="advancedAnalytics"]')!;
    expect(soon.tagName).toBe('SPAN');
    expect(soon).toHaveAttribute('aria-disabled', 'true');
    expect(within(sheet).getByRole('link', { name: 'Leader Forum' })).toHaveAttribute('href', '/leader-meetings');
  });

  it('UI-004 hides from an Agent what they may not open: no KPM group, and Tim saya holds User Mgmt alone', async () => {
    const sheet = await openSheet(AGENT, 360);
    expect(groupsOf(sheet)).toEqual(['Me', 'Activities', 'My team', 'Programs']);
    expect(tilesOf(sheet, 'My team')).toEqual(['User Mgmt']);
    expect(within(sheet).getByRole('link', { name: 'User Mgmt' })).toHaveAttribute('href', '/user-management/kpm');
    for (const name of ['Coaching', 'Group Tree', 'New Hires', 'Leader Forum']) {
      expect(within(sheet).queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('the lead’s intake: a new hire’s 90-day activation is the first tile of Saya', async () => {
    const sheet = await openSheet(member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' }, { activation: { open: true, complete: false } }));
    expect(tilesOf(sheet, 'Me')[0]).toBe('90-day activation');
    expect(within(sheet).getByRole('link', { name: '90-day activation' })).toHaveAttribute('href', '/activation');
  });

  it('UI-004 makes every sidebar page reachable from the bar or the sheet', async () => {
    atWidth(1280);
    const desk = renderWithSession(screenWith(), { me: CORE_LEADER });
    const sidebar = Array.from(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'));
    desk.unmount();
    const sheet = await openSheet(CORE_LEADER);
    const reachable = new Set([
      ...Array.from(tabBar()!.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
      ...Array.from(sheet.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
    ]);
    expect(sidebar.filter((href) => !reachable.has(href))).toEqual([]);
  });

  it('UI-004 closes on Escape and gives the focus back to More; on ✕ and on the backdrop as well', async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();
    expect(within(tabBar()!).getByRole('button', { name: 'More' })).toHaveFocus();

    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'More' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();

    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'More' }));
    await screen.findByRole('dialog', { name: 'More' });
    await userEvent.click(document.querySelector('[data-scrim]')!);
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();
  });

  it('UI-004 closes when its head is swiped down, and not on a small drag', async () => {
    const sheet = await openSheet();
    const head = sheet.querySelector('[data-sheet-head]')!;
    fireEvent.touchStart(head, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(head, { changedTouches: [{ clientY: 130 }] });
    expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
    fireEvent.touchStart(head, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(head, { changedTouches: [{ clientY: 220 }] });
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();
  });

  it('UI-004 keeps Tab inside the sheet: from the last it goes round to the first, and back', async () => {
    const sheet = await openSheet();
    const first = within(sheet).getByRole('link', { name: /Change photo/ });
    const buttons = within(sheet).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    act(() => last.focus());
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('UI-004 signs out from Sign out', async () => {
    const signOut = vi.fn(async () => undefined);
    atWidth(375);
    renderWithSession(screenWith(), { me: AB, signOut });
    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'More' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('UI-004 makes More the current tab on a page the sheet holds, and marks its tile', async () => {
    route.path = '/leads';
    const sheet = await openSheet();
    expect(within(tabBar()!).getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
    expect(within(sheet).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
  });

  it('UI-004, ADR-0180 in Indonesian: Lainnya, Saya · Aktivitas · Tim saya · Program, Ubah foto, Keluar — and the ID | EN switch here, not on the page', async () => {
    atWidth(375);
    renderLive(screenWith(), { me: CORE_LEADER });
    // No switch in the page's header on a phone (ADR-0180 reverses I-533's placement there).
    expect(screen.getByRole('main').querySelector('[data-language-switch]')).toBeNull();
    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'Lainnya' }));
    const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
    expect(groupsOf(sheet)).toEqual(['Saya', 'Aktivitas', 'Tim saya', 'Program', 'KPM']);
    expect(within(sheet).getByRole('link', { name: /Ubah foto/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('group', { name: 'Bahasa' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    expect(within(sheet).getByText('Segera hadir')).toBeInTheDocument();
    // The destinations stay as the report writes them, in both languages.
    expect(within(sheet).getByRole('link', { name: 'Goal Setting' })).toBeInTheDocument();
  });

  it('ADR-0180 keeps the page header’s ID | EN switch on a desktop', () => {
    atWidth(1280);
    renderLive(screenWith(), { me: AB });
    expect(screen.getByRole('main').querySelector('[data-language-switch]')).toHaveClass('max-lg:hidden');
  });

  it('UI-004 passes axe with the sheet open, and with the tab bar alone', async () => {
    atWidth(375);
    renderWithSession(screenWith(), { me: CORE_LEADER });
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
    await userEvent.click(within(tabBar()!).getByRole('button', { name: 'More' }));
    await screen.findByRole('dialog', { name: 'More' });
    await waitFor(async () => expect((await axe(document.body, rules)).violations).toEqual([]));
  });
});
