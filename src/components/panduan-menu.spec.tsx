import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, resetLanguage } from '@test/harness';
import type { Me } from '@/lib/session';
import { resetViewsForTest } from '@/lib/views';
import { Page } from './page';
import { Shell } from './shell';

/**
 * **P19.6-T5 AC-1, AC-6, AC-7 — *📘 Panduan* in the sidebar and the account menu, for each of the six demo accounts**
 * (ADR-0219 §5; the guide spec's *Where the menu goes* 1 to 3 and acceptance 1, 2 and 5): on a desktop the sidebar's last
 * item, below the last group and above the account block, and the account menu's item between *Your account* and *Sign
 * out*; on a 375px phone, where there is no sidebar, the *Lainnya* sheet's line above *Sign out*. Each opens the reader's
 * own guide at its role, in a new tab; the app's language changes the item's name and never its address.
 */
const nav = vi.hoisted(() => ({ path: '/home', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));

function member(over: Partial<NonNullable<Me['membership']>> = {}, me: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, office: { code: '0417', branch: 'Cempaka Putih' }, ...over,
    },
    ...me,
  });
}

/** The six demo accounts (the guide spec's acceptance 1), each on the page their session lands on. */
const OWNER = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 3 }, {
  permissions: ['member:read_profile', 'kpm_overview:read'],
});
const ADMIN = member({ isKpmAdmin: true }, { permissions: ['member:read_profile', 'kpm_overview:read'] });
const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', initials: 'PO', platformRole: 'super_admin' },
  membership: null,
  permissions: ['kpm:list_all', 'platform_guide:read'],
});
const DEMO = [
  ['the Agent', member(), '/home', '/panduan/agent-leader.html#agent'],
  ['the AB', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }), '/home', '/panduan/agent-leader.html#leader'],
  ['the AAB, who leads nobody', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab' }), '/home', '/panduan/agent-leader.html#leader'],
  ['the KPM Owner, in the Owner’s view', OWNER, '/kpm/overview', '/panduan/kpm-owner-admin.html#owner'],
  ['the KPM Admin, in the Admin’s view', ADMIN, '/kpm/overview', '/panduan/kpm-owner-admin.html#admin'],
  ['the Super Admin', SUPER_ADMIN, '/admin', '/admin/panduan'],
] as const;

const NAME = 'Guide (opens in a new tab)';
/** jsdom paints nothing, so contrast is the tokens' own spec's (`brand-tokens.spec.tsx`), as in the shell's specs. */
const RULES = { rules: { 'color-contrast': { enabled: false } } };

function page(title = 'Overview') {
  return (
    <Shell>
      <Page title={title}><p>content</p></Page>
    </Shell>
  );
}

/**
 * A link opens the guide the way the spec asks: its address, in a new tab, with no hold on the app's window. **The new
 * tab is said in its name and never written in its text**: a sentence in the text is a word on the page, which an
 * Indonesian page's check reads as English left when the shell around it is English (`events-in-indonesian.spec.tsx`).
 */
function expectGuideLink(link: HTMLElement, href: string) {
  expect(link).toHaveAttribute('href', href);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener');
  expect(link.textContent).toMatch(/^📘(Guide|Panduan)?$/);
}

beforeEach(() => {
  window.localStorage.clear();
  resetViewsForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  nav.path = '/home';
  resetLanguage();
});

describe('P19.6-T5 AC-1, AC-6 on a desktop: the sidebar’s last item and the account menu', () => {
  it.each(DEMO)('Panduan-AC1 Panduan-AC2 P19.6-T5 AC-6 %s sees it in the sidebar, opening %s', (_who, me, path, href) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    const aside = document.querySelector('aside')!;
    const link = within(aside).getByRole('link', { name: NAME });
    expectGuideLink(link, href);
    expect(link).toHaveTextContent('📘Guide');
    // Below the last group: after the nav, outside it, and before the account block.
    const navigation = within(aside).getByRole('navigation', { name: 'Main' });
    const chip = aside.querySelector('[aria-controls="sidebar-user-actions"]')!;
    expect(navigation.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(navigation.contains(link)).toBe(false);
    expect(link.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(DEMO)('Panduan-AC1 Panduan-AC2 P19.6-T5 AC-6 %s sees it in the account menu, between Your account and Sign out', async (_who, me, path, href) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    const panel = document.getElementById('sidebar-user-actions')!;
    const rows = [...panel.querySelectorAll('a[href], button')].map((el) => el.textContent?.trim());
    const at = rows.indexOf('📘Guide');
    expect(rows.slice(at - 1, at + 2)).toEqual(['Your account', '📘Guide', 'Sign out']);
    expectGuideLink(within(panel).getByRole('link', { name: NAME }), href);
  });

  it('P19.6-T5 AC-1 following it from the account menu closes the menu, as any link there does', async () => {
    atWidth(1280);
    renderWithSession(page(), { me: member() });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    const link = within(document.getElementById('sidebar-user-actions')!).getByRole('link', { name: NAME });
    link.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(link);
    expect(document.getElementById('sidebar-user-actions')).toBeNull();
  });

  it('P19.6-T5 AC-1 on the 64px rail it is the 📘 alone, named in full, its name drawn on hover as every rail item’s', async () => {
    atWidth(1024);
    renderWithSession(page(), { me: member() });
    const link = within(document.querySelector('aside')!).getByRole('link', { name: NAME });
    expect(link).toHaveTextContent(/^📘$/);
    await userEvent.hover(link);
    expect(document.querySelector('[data-rail-tip]')).toHaveTextContent('Guide');
  });

  it('P19.6-T5 AC-1 the sidebar with the item passes axe', async () => {
    atWidth(1280);
    const { container } = renderWithSession(page(), { me: member() });
    expect((await axe(container, RULES)).violations).toEqual([]);
  });
});

describe('P19.6-T5 AC-1, AC-6 on a 375px phone: the Lainnya sheet', () => {
  it.each(DEMO)('Panduan-AC1 Panduan-AC2 P19.6-T5 AC-6 %s finds it above Sign out, opening %s', async (_who, me, path, href) => {
    atWidth(375);
    nav.path = path;
    renderWithSession(page(), { me });
    expect(document.querySelector('aside')).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    const link = within(sheet).getByRole('link', { name: NAME });
    expectGuideLink(link, href);
    const signOut = within(sheet).getByRole('button', { name: 'Sign out' });
    expect(link.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The last link of the sheet: nothing between it and Sign out.
    const links = within(sheet).getAllByRole('link');
    expect(links[links.length - 1]).toBe(link);
  });

  it('P19.6-T5 AC-1 the sheet with the item passes axe', async () => {
    atWidth(375);
    renderWithSession(page(), { me: member() });
    await userEvent.click(await screen.findByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    expect((await axe(sheet, RULES)).violations).toEqual([]);
  });
});

describe('P19.6-T5 AC-2 a view-as session opens the viewed role’s guide', () => {
  const viewing = (who: Me) => ({ ...who, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' }) as Me;

  it.each([
    ['an Agent', viewing(member()), '/home', '/panduan/agent-leader.html#agent'],
    ['an AB', viewing(member({ orgLevelCode: 'AB', hierarchyRole: 'ab' })), '/home', '/panduan/agent-leader.html#leader'],
    ['the Owner, on an office page', viewing(OWNER), '/kpm/overview', '/panduan/kpm-owner-admin.html#owner'],
  ] as const)('Panduan-AC2 P19.6-T5 AC-2 viewing %s opens %s, never the Super Admin’s guide', (_who, me, path, href) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    expectGuideLink(within(document.querySelector('aside')!).getByRole('link', { name: NAME }), href);
    expect(document.querySelector('a[href="/admin/panduan"]')).toBeNull();
  });

  it('Panduan-AC2 P19.6-T5 AC-2 the Owner switching to Akun saya opens their field rung’s guide', () => {
    atWidth(1280);
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    expectGuideLink(within(document.querySelector('aside')!).getByRole('link', { name: NAME }), '/panduan/agent-leader.html#leader');
  });
});

describe('P19.6-T5 AC-7 the app’s ID | EN does not change the guide', () => {
  it.each(DEMO)('Panduan-AC5 P19.6-T5 AC-7 %s in Indonesian: Panduan, the same address', async (_who, me, path, href) => {
    atWidth(1280);
    nav.path = path;
    renderInIndonesian(page(), { me });
    const link = within(document.querySelector('aside')!).getByRole('link', { name: 'Panduan (membuka tab baru)' });
    expectGuideLink(link, href);
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    expectGuideLink(within(document.getElementById('sidebar-user-actions')!).getByRole('link', { name: 'Panduan (membuka tab baru)' }), href);
  });
});
