import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { SRC } from '@test/copy-scan';
import { atWidth, makeMe, renderWithSession, wears } from '@test/harness';
import type { Me } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { Page } from './page';
import { Shell, tabTitle } from './shell';

/**
 * **P19.13-T1 and T2 — the desktop page frame and the floating sidebar, the jsdom half** (UI-192, UI-193, UI-194, UI-196;
 * ADR-0252). jsdom lays nothing out, so what is pinned here is what each element asks for at a width (`wears`): the frame
 * on `main`, the title row's spacing, the panel's float, the pill, the field, the account card and the rail. What a
 * browser draws from it — the edges, the gutter, the panel's height — is `page-frame.browser.spec.ts`'s.
 */
const route = vi.hoisted(() => ({ path: '/goals' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(),
}));

const office = { code: '0417', branch: 'BSD City Branch' };
const AB: Me = makeMe({
  user: { ...makeMe().user, fullName: 'Wilson Tanoto', preferredName: 'Wilson', initials: 'WT' },
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4, office,
  },
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const AGENT: Me = makeMe({
  membership: {
    membershipId: 'mem-2', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0, office,
  },
});
const SUPER: Me = makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] });

function field(me: Me = AB, px = 1280) {
  window.localStorage.clear();
  atWidth(px);
  return renderWithSession(
    <AgentShell>
      <Page title="Goal Setting"><p>content</p></Page>
    </AgentShell>,
    { me },
  );
}

const main = () => document.querySelector('main')!;
const aside = () => document.querySelector('aside')!;

afterEach(() => {
  vi.unstubAllGlobals();
  route.path = '/goals';
  document.title = 'AgencyBoost';
});

describe('P19.13-T1 one page frame, one spacing scale (UI-192, UI-193, UI-194)', () => {
  it.each([1024, 1280, 1440, 1920])('P19.13-T1 AC-1 at %ipx main is the frame: at most 1320px, centred, 32px each side', (px) => {
    field(AB, px);
    const worn = wears(main(), px).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['mx-auto', 'max-w-frame', 'px-frame']));
    expect(worn).not.toContain('px-10');
  });

  it.each([375, 768])('P19.13-T1 AC-6 at %ipx main wears what it wore: no frame below 1024px', (px) => {
    field(AB, px);
    expect(wears(main(), px)).toBe(
      'min-w-0 flex-1 print:p-0 px-4 pb-[calc(var(--tab-bar-space)+1.5rem)] pt-[calc(1rem+env(safe-area-inset-top))]'
        + (px >= 768 ? ' px-6' : ''),
    );
  });

  it('P19.13-T1 AC-1 the tokens: a 1320px frame with 32px sides, 16px between cards, 24px between sections, 720px forms', () => {
    const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(/--page-frame-max: 1320px;/);
    expect(css).toMatch(/--page-frame-gutter: 2rem;/);
    expect(css).toMatch(/--space-cards: 1rem;/);
    expect(css).toMatch(/--space-section: 1\.5rem;/);
    expect(css).toMatch(/--form-max: 720px;/);
    expect(css).toMatch(/--list-pane: 360px;/);
  });

  it('P19.13-T1 AC-3 the document keeps its scrollbar’s room from 1024px, and only there (UI-193)', () => {
    const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*:root:has\(\[data-surface='v1'\]\) \{\s*scrollbar-gutter: stable;/);
    expect(css.match(/scrollbar-gutter/g)).toHaveLength(1);
  });

  it('P19.13-T1 AC-4 the title row is 44px tall at least and 24px above the content from 1024px; the phone’s as it was', () => {
    field(AB, 1280);
    const row = screen.getByRole('heading', { level: 1, name: 'Goal Setting' }).closest('[data-title-row]')!;
    expect(wears(row, 1280).split(' ')).toEqual(expect.arrayContaining(['mb-section', 'min-h-11']));
    expect(wears(row, 375).split(' ')).not.toContain('mb-section');
    expect(wears(row, 375)).toBe('mb-5 flex items-start gap-4 mb-3 min-h-11 items-center gap-2');
  });
});

describe('P19.13-T2 the floating sidebar (UI-196)', () => {
  it('P19.13-T2 AC-1 from 1280px a navy panel 240px wide, 12px off the window’s top, bottom and left, 20px corners', () => {
    field(AB, 1280);
    const worn = wears(aside(), 1280).split(' ');
    expect(worn).toEqual(expect.arrayContaining([
      'bg-secondary', 'w-sidebar', 'rounded-sidebar', 'sticky', 'self-start',
      'ml-[var(--sidebar-inset)]',
      'mt-[max(var(--sidebar-inset),env(safe-area-inset-top))]',
      'top-[max(var(--sidebar-inset),env(safe-area-inset-top))]',
      'h-[calc(100vh_-_var(--sidebar-inset)_-_max(var(--sidebar-inset),env(safe-area-inset-top)))]',
    ]));
    const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(/--sidebar-width: 240px;/);
    expect(css).toMatch(/--sidebar-inset: 0\.75rem;/);
    expect(css).toMatch(/--radius-sidebar: 20px;/);
  });

  it('P19.13-T2 AC-2 the logo row: the app icon, AgencyBoost and the branch’s name', () => {
    field(AB, 1280);
    const icon = aside().querySelector('img[data-app-icon]');
    expect(icon).toHaveAttribute('src', '/icons/icon-192.png');
    expect(icon).toHaveAttribute('width', '36');
    expect(within(aside()).getByText('BSD City Branch')).toBeInTheDocument();
  });

  it('P19.13-T2 AC-3 a 40px Search agent field under the logo opens the agent picker; an Agent and the Super Admin have none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ members: [], items: [], unread: 0, total: 0, page: 1, pageSize: 1 }),
    } as Response)));
    const leader = field(AB, 1280);
    await userEvent.click(screen.getByRole('button', { name: 'Search agent' }));
    expect(await screen.findByRole('dialog', { name: 'Search agent' })).toBeInTheDocument();
    leader.unmount();

    field(AGENT, 1280);
    expect(screen.queryByRole('button', { name: 'Search agent' })).toBeNull();
  });

  it('P19.13-T2 AC-4 the current page is a white pill, its words navy and bold, its glyph orange', () => {
    route.path = '/home';
    field(AB, 1280);
    const home = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home).toHaveClass('bg-card', 'font-bold', 'text-secondary-ink', 'h-10', 'rounded-xl');
    expect(home.querySelector('svg')!.parentElement).toHaveClass('text-primary');
    const calendar = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Calendar' });
    expect(calendar).not.toHaveClass('bg-card');
  });

  it('P19.13-T2 AC-4 a group’s current page is the same pill, its words alone, indented under the heading', () => {
    field(AB, 1280);
    const goals = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Goal Setting' });
    expect(goals).toHaveClass('bg-card', 'font-bold', 'text-secondary-ink', 'h-9', 'pl-[2.6875rem]');
    expect(goals.querySelector('svg')).toBeNull();
  });

  it('P19.13-T2 AC-6 Panduan, then the account card — avatar, name, role · KPM code, bell — at the bottom', () => {
    field(AB, 1280);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const guide = aside().querySelector('[data-panduan]')!;
    const card = aside().querySelector<HTMLElement>('[data-account-card]')!;
    expect(nav.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(guide.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card).toHaveClass('rounded-[14px]', 'bg-secondary-contrast/[0.06]');
    expect(within(card).getByText('WT')).toBeInTheDocument();
    expect(within(card).getByText(/^AB · 0417/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
  });

  it('P19.13-T2 AC-8 at 1024px the 64px rail in the same floating style: app icon, search glyph, page glyphs, avatar', () => {
    field(AB, 1024);
    const worn = wears(aside(), 1024).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['w-[var(--sidebar-rail-width)]', 'rounded-sidebar', 'ml-[var(--sidebar-inset)]']));
    expect(aside().querySelector('img[data-app-icon]')).not.toBeNull();
    const search = screen.getByRole('button', { name: 'Search agent' });
    expect(search).toHaveClass('w-11');
    expect(search.textContent).toBe('');
    for (const link of Array.from(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a'))) {
      expect(link).toHaveClass('h-11', 'w-11');
    }
    expect(aside().querySelector('[data-account-card]')).not.toHaveClass('bg-secondary-contrast/[0.06]');
  });

  it('P19.13-T2 AC-1 the Super Admin keeps the labelled panel from 1024px, floating as everybody’s', () => {
    route.path = '/admin';
    window.localStorage.clear();
    atWidth(1024);
    renderWithSession(<Shell family="admin" title="Overview">x</Shell>, { me: SUPER });
    expect(wears(aside(), 1024).split(' ')).toEqual(expect.arrayContaining(['w-sidebar', 'rounded-sidebar']));
    expect(screen.queryByRole('button', { name: 'Search agent' })).toBeNull();
  });

  it('P19.13-T2 the floating sidebar has no axe violation, a group open and a heading closed', async () => {
    field(AB, 1280);
    // jsdom computes no colour: contrast is the token specs' (`theme.spec.ts`), as every shell spec says.
    expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});

describe('P19.13-T4 AC-1 the browser’s tab says the menu name (UI-197)', () => {
  it('P19.13-T4 AC-1 /goals is “Goal Setting · AgencyBoost”; a page no menu item holds is the app’s name', () => {
    route.path = '/goals';
    const one = field(AB, 1280);
    expect(document.title).toBe('Goal Setting · AgencyBoost');
    one.unmount();
    route.path = '/coaching/mem-9';
    field(AB, 1280);
    expect(document.title).toBe('Coaching · AgencyBoost');
    expect(tabTitle(undefined)).toBe('AgencyBoost');
  });
});
