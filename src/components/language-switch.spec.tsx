import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  atWidth, languageCookie, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch, wears,
} from '@test/harness';
import { getRequestLanguage } from '@/lib/api-client';
import type { Me } from '@/lib/session';
import { AdminShell } from './admin-shell';
import { AgentShell } from './agent-shell';
import { AppShell, PageHeader, type NavSection } from './app-shell';
import { LanguageSwitch } from './language-switch';
import { TenantShell } from './tenant-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activity/log',
}));

const SECTIONS: readonly NavSection[] = [
  { label: 'Personal tools', items: [{ label: 'Activity management', href: '/activity/log', icon: 'activity', active: true }] },
];

/** A form a reader is half-way through: what a language switch must not lose (AC-3). */
function HalfTypedForm() {
  const [note, setNote] = useState('');
  return (
    <form>
      <label htmlFor="note">Note</label>
      <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
    </form>
  );
}

/** A shell as a page meets it: the bar, the sidebar, a page header with an action, and a form under it. */
function shell() {
  return (
    <AppShell
      sections={SECTIONS}
      user={{ name: 'Rina', fullName: 'Rina Wijaya', role: 'Agent', initials: 'RW', email: 'rina@kpm0417.test' }}
      account={{ href: '/profile', onSignOut: vi.fn() }}
      notifications={{ href: '/notifications', unread: 0 }}
      title="Log Activity"
      actions={<button type="button">Log today</button>}
    >
      <HalfTypedForm />
    </AppShell>
  );
}

const bar = () => document.querySelector('aside')!;
const main = () => document.querySelector('main')!;
/** The switches in a part of the page: the bar's or the page header's. */
const switchesIn = (el: HTMLElement) => within(el).queryAllByRole('group', { name: /^(Language|Bahasa)$/ });
const option = (el: HTMLElement, code: 'ID' | 'EN') => within(switchesIn(el)[0]).getByRole('button', { name: code });
/** Whether an element is hidden at a width, by a class that holds there (`print:hidden` is the printer's, not a size's). */
const hiddenAt = (el: Element, px: number) => wears(el, px).split(' ').includes('hidden');

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
  window.localStorage.clear();
});

/**
 * **P18.98-T2 AC-3: the *ID | EN* switch** (ADR-0179 §2; UI-041). Built whole and held back: nothing is drawn until
 * `LANGUAGE_LIVE` turns on at P18.98-T4's exit. These cases render it live through the harness (`renderLive`), as it
 * will be then.
 */
describe('P18.98-T2 the switch, while it is not live', () => {
  it.each([375, 768, 1024, 1280])('AC-3 draws nothing at %ipx: no switch in the bar or the page header', (px) => {
    atWidth(px);
    renderWithSession(shell());

    expect(screen.queryByRole('group', { name: 'Language' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'EN' })).not.toBeInTheDocument();
  });

  it('AC-3 leaves the page header exactly as it was drawn: its actions straight in its row', () => {
    const { container } = render(<PageHeader title="Log Activity" actions={<button type="button">Log today</button>} />);
    const row = container.firstElementChild!;
    expect(row.className).toBe('mb-5 flex flex-wrap items-start justify-between gap-4');
    expect(Array.from(row.children).map((el) => el.tagName)).toEqual(['DIV', 'BUTTON']);
  });

  it('AC-3 leaves the bar’s wordmark as it was drawn', () => {
    atWidth(320);
    renderWithSession(shell());
    expect(within(bar()).getByText('AgencyBoost').className)
      .toBe('font-display text-lg font-extrabold leading-tight tracking-tight text-white');
  });

  it('AC-3 the switch itself renders nothing outside a live provider', () => {
    const { container } = render(<LanguageSwitch tone="page" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('P18.98-T2 the switch, live, in every shell’s header', () => {
  it('AC-3 at 375px sits in the phone’s bar between the brand and the avatar, two 44 × 44 options', () => {
    atWidth(375);
    stubFetch({});
    renderLive(shell());

    const [inBar] = switchesIn(bar());
    expect(switchesIn(bar())).toHaveLength(1);
    // Between the brand and the avatar: after the mark, before the account's control, in the bar's right-hand group.
    const mark = bar().querySelector('svg[viewBox="0 0 26 26"]')!;
    // Live, a reader who has chosen nothing reads Indonesian: the avatar is *Akun*.
    const avatar = within(bar()).getByRole('button', { name: /^(Account|Akun)/ });
    expect(mark.compareDocumentPosition(inBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inBar.compareDocumentPosition(avatar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inBar.parentElement).toBe(avatar.closest('.ml-auto'));
    // Two options, each a 44px target; the box is exactly theirs, its edge a ring that takes no room.
    const options = within(inBar).getAllByRole('button');
    expect(options.map((o) => o.textContent)).toEqual(['ID', 'EN']);
    for (const o of options) expect(o).toHaveClass('h-11', 'w-11');
    expect(inBar).toHaveClass('ring-1');
    expect(inBar).not.toHaveClass('p-1');
    // On a phone the page header leaves it to the bar.
    expect(switchesIn(main())).toHaveLength(0);
  });

  it('AC-3 makes room on the narrowest phones: below 360px the bar’s wordmark is said, not drawn (WCAG 1.4.10)', () => {
    atWidth(320);
    stubFetch({});
    renderLive(shell());
    const wordmark = within(bar()).getByText('AgencyBoost');

    expect(wordmark).toHaveClass('max-[359.98px]:sr-only');
    // Walked on a production build: ☰, the mark, the switch and the avatar fill 320px with nothing scrolling sideways.
  });

  it('AC-3 at 375px is the phone’s alone: hidden by its class from 768px, so nothing wider shows it', () => {
    atWidth(375);
    stubFetch({});
    renderLive(shell());
    const [inBar] = switchesIn(bar());

    expect(hiddenAt(inBar, 375)).toBe(false);
    expect(hiddenAt(inBar, 768)).toBe(true);
    expect(hiddenAt(inBar, 1280)).toBe(true);
  });

  it.each([768, 1024, 1280])('AC-3 at %ipx sits at the page header’s top right, after the page’s own actions: the right-most thing in it', (px) => {
    atWidth(px);
    stubFetch({});
    renderLive(shell());

    const [inHeader] = switchesIn(main());
    expect(switchesIn(main())).toHaveLength(1);
    const heading = screen.getByRole('heading', { level: 1, name: 'Log Activity' });
    const action = screen.getByRole('button', { name: 'Log today' });
    // The header's row: the title and the page's actions, which wrap among themselves; then the switch, a column of its
    // own at the top-right corner that never wraps (2026-10-29: right of every action, on every page).
    const titleAndActions = heading.parentElement!.parentElement!;
    const row = inHeader.parentElement!;
    expect(Array.from(titleAndActions.children)).toEqual([heading.parentElement, action]);
    expect(Array.from(row.children)).toEqual([titleAndActions, inHeader]);
    expect(row).not.toHaveClass('flex-wrap');
    expect(inHeader).toHaveClass('shrink-0');
    // Shown here from 768px, its 44px targets centred on the title's line; the bar's is hidden by its class.
    expect(hiddenAt(inHeader, px)).toBe(false);
    expect(wears(inHeader, px)).toContain('-my-[5px]');
    expect(hiddenAt(inHeader, 375)).toBe(true);
    for (const o of within(inHeader).getAllByRole('button')) expect(o).toHaveClass('h-11', 'w-11');
    for (const inBar of switchesIn(bar())) expect(hiddenAt(inBar, px)).toBe(true);
  });

  it('AC-3 sits at the top right of a page header with no actions', () => {
    atWidth(1280);
    stubFetch({});
    renderLive(<PageHeaderInShell />);

    const [inHeader] = switchesIn(main());
    const titleAndActions = screen.getByRole('heading', { level: 1 }).parentElement!.parentElement!;
    expect(Array.from(titleAndActions.children)).toHaveLength(1);
    expect(Array.from(inHeader.parentElement!.children)).toEqual([titleAndActions, inHeader]);
  });

  it('AC-3 is named Language, the current option pressed, each option its code and its language’s own name', () => {
    atWidth(1280);
    stubFetch({});
    renderLive(shell());
    const [inHeader] = switchesIn(main());

    expect(inHeader).toHaveAttribute('role', 'group');
    expect(inHeader).toHaveAccessibleName('Bahasa');
    const id = within(inHeader).getByRole('button', { name: 'ID' });
    const en = within(inHeader).getByRole('button', { name: 'EN' });
    // Live, a reader who has chosen nothing reads Bahasa Indonesia.
    expect(id).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    expect(id).toHaveAccessibleDescription('Bahasa Indonesia');
    expect(en).toHaveAccessibleDescription('English');
    expect(id).toHaveAttribute('lang', 'id');
    expect(en).toHaveAttribute('lang', 'en');
  });

  it('AC-3 switches the screen at once, and says so: the group’s name, the pressed option, <html lang>', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());

    await userEvent.click(option(main(), 'EN'));

    expect(switchesIn(main())[0]).toHaveAccessibleName('Language');
    expect(option(main(), 'EN')).toHaveAttribute('aria-pressed', 'true');
    expect(option(main(), 'ID')).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('en');
    // The shell's own words follow: the bar's ☰ is named in English now.
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('AC-3 is reached and chosen by keyboard: Tab to an option, then Enter or Space', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());
    const user = userEvent.setup();

    option(main(), 'ID').focus();
    await user.tab();
    expect(option(main(), 'EN')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement.lang).toBe('en');

    await user.tab({ shift: true });
    expect(option(main(), 'ID')).toHaveFocus();
    await user.keyboard(' ');
    expect(document.documentElement.lang).toBe('id');
  });

  it('AC-3 an open form keeps what was typed across a switch, both ways', async () => {
    atWidth(375);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());
    const box = screen.getByLabelText('Note');

    await userEvent.type(box, 'Follow up Pak Budi on Friday');
    await userEvent.click(option(bar(), 'EN'));
    expect(screen.getByLabelText('Note')).toBe(box);
    expect(box).toHaveValue('Follow up Pak Budi on Friday');

    await userEvent.click(option(bar(), 'ID'));
    expect(box).toHaveValue('Follow up Pak Budi on Friday');
  });

  it('AC-3, AC-5, AC-6 signed in, writes the account, the cookie and the API’s language', async () => {
    atWidth(1280);
    const { calls } = stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());

    await userEvent.click(option(main(), 'EN'));

    expect(languageCookie()).toBe('en');
    expect(getRequestLanguage()).toBe('en');
    const save = calls.find((c) => c.init.method === 'PATCH')!;
    expect(save.url).toBe('http://api.test/api/v1/auth/me');
    expect(JSON.parse(save.init.body as string)).toEqual({ locale: 'en' });
    // The save itself already carries the language just chosen.
    expect((save.init.headers as Record<string, string>)['Accept-Language']).toBe('en');
  });

  it('AC-3 does nothing for the option already pressed: no save, no cookie', async () => {
    atWidth(1280);
    const { calls } = stubFetch({});
    renderLive(shell());

    await userEvent.click(option(main(), 'ID'));

    expect(calls).toHaveLength(0);
    expect(languageCookie()).toBeNull();
  });

  it('AC-2 in a support session, changes the support person’s browser and nothing of the person’s', async () => {
    atWidth(1280);
    const { calls } = stubFetch({});
    renderLive(shell(), { me: makeMe({ isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'sa-1' }) });

    await userEvent.click(option(main(), 'EN'));

    expect(document.documentElement.lang).toBe('en');
    expect(languageCookie()).toBe('en');
    expect(calls).toHaveLength(0);
  });

  it('AC-3 keeps the screen in the language chosen when the account cannot be told, and the browser keeps it', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { status: 503, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    renderLive(shell());

    await userEvent.click(option(main(), 'EN'));

    expect(document.documentElement.lang).toBe('en');
    expect(languageCookie()).toBe('en');
  });

  it.each(['id', 'en'] as const)('AC-3 has no axe violations in the bar and the header, the screen in %s', async (language) => {
    atWidth(375);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    const { container } = renderLive(shell());
    if (language === 'en') fireEvent.click(option(bar(), 'EN'));
    // Contrast is measured in a browser, not in jsdom, which cannot draw a canvas (as every axe spec here).
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});

/** A shell's page whose header has nothing beside its title. */
function PageHeaderInShell() {
  return (
    <AppShell sections={SECTIONS} user={{ name: 'Rina', role: 'Agent', initials: 'RW' }}>
      <PageHeader title="Your 90-day activation" />
    </AppShell>
  );
}

/**
 * The two consoles, each as its reader meets it: the office's and the platform's. *Changed 2026-10-30 (UI V1, ADR-0180):*
 * the field shell has no bar on a phone or a tablet; its switch is the *Lainnya* sheet's there (the next case) and the
 * page header's from 1024px.
 */
const SHELLS: [string, () => React.ReactElement, Partial<Me>][] = [
  ['the office console', () => <TenantShell title="Overview">body</TenantShell>, {
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 3,
    },
    permissions: ['member:read_profile'],
  }],
  ['the platform console', () => <AdminShell title="Overview">body</AdminShell>, {
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  }],
];

describe('ADR-0180 the field shell’s switch: in the Lainnya sheet below 1024px, in the page header from 1024px', () => {
  it.each([375, 768])('UI-004 at %ipx is in no page header and no bar, and in the sheet the bar’s Lainnya opens', async (px) => {
    stubFetch({});
    atWidth(px);
    renderLive(<AgentShell title="Log Activity">body</AgentShell>, { me: makeMe() });
    expect(switchesIn(main())).toHaveLength(0);
    expect(document.querySelector('aside')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
    expect(switchesIn(sheet)).toHaveLength(1);
  });

  it('ADR-0180 at 1280px is the page header’s top-right corner, as before', () => {
    stubFetch({});
    atWidth(1280);
    renderLive(<AgentShell title="Log Activity">body</AgentShell>, { me: makeMe() });
    const [inHeader] = switchesIn(main());
    expect(inHeader).toBeDefined();
    expect(inHeader.parentElement!.lastElementChild).toBe(inHeader);
  });
});

describe('P18.98-T2 the switch, live, in each of the three shells', () => {
  it.each(SHELLS)('AC-3 is in %s’s phone bar at 375px, and its page header at 1280px', (_, page, who) => {
    stubFetch({});
    const width = atWidth(375);
    renderLive(page(), { me: makeMe(who) });
    expect(switchesIn(bar())).toHaveLength(1);
    expect(switchesIn(main())).toHaveLength(0);

    width.resize(1280);
    expect(switchesIn(main())).toHaveLength(1);
    // The header's top-right corner: the row's last child, right of the title and the page's actions (2026-10-29).
    const [inHeader] = switchesIn(main());
    expect(inHeader.parentElement!.lastElementChild).toBe(inHeader);
    expect(inHeader.parentElement!.firstElementChild).toBe(screen.getByRole('heading', { level: 1 }).parentElement!.parentElement);
  });
});
