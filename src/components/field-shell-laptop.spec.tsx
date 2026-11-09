import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, resetLanguage, wears } from '@test/harness';
import type { Me } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { Page } from './page';
import { Shell } from './shell';

/**
 * **The shared tablet and laptop system: the shell's half** (P19.1-T1, ADR-0196; the full report's UI-112, UI-113,
 * UI-114, the *Conflicts* rows 145, 150 and 154; `shared-2026-11-02.css` / `.js`). The pages' halves are pinned beside
 * each page; the columns in `ui/columns.spec.tsx`; the 20px tablet title and the 64px rail in `ui/theme.spec.ts`.
 */

const route = vi.hoisted(() => ({ path: '/goals' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(),
}));

const AB: Me = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4, office: { code: '0417', branch: 'Cempaka Putih' },
  },
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});

const LAPTOP_KEY = 'ab.sidebar.rail.laptop';
const DESK_KEY = 'ab.sidebar.rail';

function field(props: Partial<React.ComponentProps<typeof Page>> = {}) {
  return (
    <AgentShell>
      <Page title="Goal Setting" subtitle="Turn your annual target into this month’s activity." {...props}>
        <p>content</p>
      </Page>
    </AgentShell>
  );
}

/** The field shell at a width, with whatever the reader's browser already remembers. */
function at(px: number, stored: Record<string, string> = {}) {
  window.localStorage.clear();
  for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value);
  const width = atWidth(px);
  return { ...renderWithSession(field(), { me: AB }), width };
}

const aside = () => document.querySelector('aside')!;
const toggle = () => screen.getByRole('button', { name: /^(Expand|Collapse) the sidebar$/ });
const drawn = () => (toggle().getAttribute('aria-label') === 'Expand the sidebar' ? 'rail' : 'full');
const stored = () => ({ laptop: window.localStorage.getItem(LAPTOP_KEY), desk: window.localStorage.getItem(DESK_KEY) });
const tip = () => document.querySelector<HTMLElement>('[data-rail-tip]');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  route.path = '/goals';
  resetLanguage();
});

describe('P19.1-T1 AC-1 one title row at every size (UI-112)', () => {
  it.each([375, 768, 1024, 1280])('P19.1-T1 AC-1 at %ipx: the title 800, the page’s control on its row, the avatar at its right end', (px) => {
    atWidth(px);
    renderWithSession(field({ actions: <button type="button">Simpan goal</button> }), { me: AB });
    const title = screen.getByRole('heading', { level: 1, name: 'Goal Setting' });
    // 20px on a phone and a tablet, 24px on a laptop (`text-title`, `globals.css`), 800 at every size: no 700 from 1024px.
    expect(title).toHaveClass('text-title', 'font-extrabold');
    expect(title.className).not.toMatch(/lg:font-bold/);
    const row = title.closest('[data-title-row]') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Simpan goal' })).toBeInTheDocument();
    const avatar = within(row).getByRole('link', { name: 'Your profile' });
    expect(row.lastElementChild).toBe(avatar);
    expect(wears(avatar, px).split(' ')).not.toContain('hidden');
  });

  it('P19.2-T1 AC-1 the office’s pages take the same title row since P19.2-T1: the avatar, 24px from 1024px (UI-146)', () => {
    atWidth(1280);
    route.path = '/people/members';
    renderWithSession(<Shell family="tenant" title="All Members">x</Shell>, {
      me: makeMe({
        membership: { ...AB.membership!, isKpmOwner: true },
        permissions: ['member:read_profile'],
      }),
    });
    const title = screen.getByRole('heading', { level: 1, name: 'All Members' });
    // The consoles' 28px (`text-3xl`) went with them (ADR-0197 §2): one `text-title`, 24px on a laptop.
    expect(title).toHaveClass('text-title');
    expect(title).not.toHaveClass('text-3xl');
    expect(title.closest('[data-title-row]')!.querySelector('[data-title-avatar]')).not.toBeNull();
  });
});

describe('P19.1-T1 AC-2 the tab bar on a tablet (UI-113)', () => {
  it('P19.1-T1 AC-2 is at most 470px wide and centred at 768px; a phone’s spans the screen as before', () => {
    atWidth(768);
    renderWithSession(field(), { me: AB });
    const bar = document.querySelector('[data-tab-bar]')!;
    expect(wears(bar, 768).split(' ')).toEqual(expect.arrayContaining(['max-w-[470px]', 'mx-auto', 'inset-x-3']));
    expect(wears(bar, 375).split(' ')).not.toContain('max-w-[470px]');
    expect(wears(bar, 375).split(' ')).not.toContain('mx-auto');
    expect(wears(bar, 375).split(' ')).toContain('inset-x-3');
  });
});

describe('P19.1-T1 AC-4 the 64px icon rail from 1024 to 1279px (UI-114)', () => {
  it.each([1024, 1152, 1279])('P19.1-T1 AC-4 at %ipx the field shell opens on the rail: a glyph per item, each named', (px) => {
    at(px);
    expect(drawn()).toBe('rail');
    expect(wears(aside(), px).split(' ')).toContain('w-[var(--sidebar-rail-width)]');
    expect(wears(aside(), px).split(' ')).not.toContain('w-sidebar');
    // The same items, icons only, each named: the words are not drawn, and no `title` doubles the drawn name.
    const item = screen.getByRole('link', { name: 'Leads' });
    expect(item).toHaveAttribute('href', '/leads');
    expect(item).not.toHaveAttribute('title');
    expect(within(item).queryByText('Leads')).toBeNull();
    expect(screen.getByRole('button', { name: 'Search agent' })).toBeInTheDocument();
    // The groups flatten: no heading to open, so nothing behind one.
    expect(screen.queryByRole('button', { name: 'My team' })).toBeNull();
    // Nothing is written by arriving.
    expect(stored()).toEqual({ laptop: null, desk: null });
  });

  it('P19.1-T1 AC-4 at 1280px the full sidebar, as before', () => {
    at(1280);
    expect(drawn()).toBe('full');
    expect(wears(aside(), 1280).split(' ')).toContain('w-sidebar');
    expect(screen.getByRole('button', { name: 'My team' })).toBeInTheDocument();
  });

  it('P19.1-T1 AC-4 opening it full at 1024px is remembered for 1024–1279px on its own, and 1280px keeps its own', async () => {
    const { width, unmount } = at(1024);
    await userEvent.click(toggle());
    expect(drawn()).toBe('full');
    expect(stored()).toEqual({ laptop: '0', desk: null });

    width.resize(1280);
    expect(drawn()).toBe('full');
    await userEvent.click(toggle());
    expect(drawn()).toBe('rail');
    expect(stored()).toEqual({ laptop: '0', desk: '1' });

    // Each width shows its own as it crosses 1280px.
    width.resize(1152);
    expect(drawn()).toBe('full');
    width.resize(1440);
    expect(drawn()).toBe('rail');
    unmount();

    // And after a reload.
    at(1100, { [LAPTOP_KEY]: '0' });
    expect(drawn()).toBe('full');
  });

  it('P19.1-T1 AC-4 collapsing it again at 1024–1279px is remembered too', async () => {
    const { unmount } = at(1200, { [LAPTOP_KEY]: '0' });
    expect(drawn()).toBe('full');
    await userEvent.click(toggle());
    expect(drawn()).toBe('rail');
    expect(stored()).toEqual({ laptop: '1', desk: null });
    unmount();
    at(1200, { [LAPTOP_KEY]: '1' });
    expect(drawn()).toBe('rail');
  });

  it('P19.1-T1 AC-4 a desktop that remembered its rail does not open 1024–1279px full, nor the reverse', () => {
    const { width } = at(1280, { [DESK_KEY]: '1', [LAPTOP_KEY]: '0' });
    expect(drawn()).toBe('rail');
    width.resize(1024);
    expect(drawn()).toBe('full');
    expect(stored()).toEqual({ laptop: '0', desk: '1' });
  });

  it('P19.1-T1 AC-4 with storage refused, 1024–1279px is the rail and the toggle still works for the visit', async () => {
    const refuse = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    atWidth(1024);
    renderWithSession(field(), { me: AB });
    expect(drawn()).toBe('rail');
    await userEvent.click(toggle());
    expect(drawn()).toBe('full');
  });

  it('P19.2-T1 AC-10 the Owner’s pages take the rail at 1024px too (ADR-0197 §4); only /admin keeps the full sidebar', () => {
    window.localStorage.clear();
    atWidth(1024);
    route.path = '/people/members';
    const owner = renderWithSession(<Shell family="tenant" title="All Members">x</Shell>, {
      me: makeMe({ membership: { ...AB.membership!, isKpmOwner: true }, permissions: ['member:read_profile'] }),
    });
    expect(drawn()).toBe('rail');
    owner.unmount();
    route.path = '/admin';
    renderWithSession(<Shell family="admin" title="Overview">x</Shell>, {
      me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }),
    });
    expect(drawn()).toBe('full');
  });

  it('P19.1-T1 AC-4 shows an item’s name beside it on hover and on focus, and Escape puts it away (WCAG 1.4.13)', async () => {
    at(1024);
    const item = screen.getByRole('link', { name: 'Leads' });
    fireEvent.mouseEnter(item);
    expect(tip()).toHaveTextContent('Leads');
    // Decoration to a screen reader, which has the item's name already; fixed beside the item, so the nav cannot clip it.
    expect(tip()).toHaveAttribute('aria-hidden', 'true');
    expect(tip()).toHaveClass('fixed');
    // Hoverable: the words are inside the item, so moving onto them is still hovering it.
    expect(item.contains(tip())).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip()).toBeNull();

    act(() => item.focus());
    expect(tip()).toHaveTextContent('Leads');
    act(() => item.blur());
    expect(tip()).toBeNull();
  });

  it('P19.1-T1 AC-4 a long press on touch shows the name and does not follow the link', async () => {
    at(1152);
    const item = screen.getByRole('link', { name: 'Leads' });
    // iOS's link preview and Android's menu stay away from a long press.
    expect(item.className).toContain('[-webkit-touch-callout:none]');
    fireEvent.touchStart(item, { touches: [{ clientX: 10, clientY: 10 }] });
    await waitFor(() => expect(tip()).toHaveTextContent('Leads'));
    // `fireEvent` answers false when the handler prevented the default: the tap that follows is not a navigation.
    expect(fireEvent.touchEnd(item)).toBe(false);
    expect(fireEvent.contextMenu(item)).toBe(true);
    // A short tap is a tap: nothing prevented, no name drawn.
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.touchStart(item, { touches: [{ clientX: 10, clientY: 10 }] });
    expect(fireEvent.touchEnd(item)).toBe(true);
    expect(tip()).toBeNull();
  });

  it('P19.1-T1 AC-4 a right click with a mouse keeps the browser’s own menu', () => {
    at(1024);
    expect(fireEvent.contextMenu(screen.getByRole('link', { name: 'Leads' }))).toBe(true);
  });

  it('P19.1-T1 AC-4 passes axe on the rail at 1152px, with a name drawn', async () => {
    at(1152);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Calendar' }));
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
