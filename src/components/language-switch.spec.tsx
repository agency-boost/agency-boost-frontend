import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  atWidth, languageCookie, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch,
} from '@test/harness';
import { getRequestLanguage } from '@/lib/api-client';
import type { Me } from '@/lib/session';
import { fieldChrome } from '@test/shell-fixtures';
import { AgentShell } from './agent-shell';
import { AppShell, PageHeader, type NavSection } from './app-shell';
import { LanguageSwitch } from './language-switch';
import { Shell } from './shell';

const route = vi.hoisted(() => ({ path: '/activity/log' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => route.path,
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

/**
 * A shell as a page meets it: the sidebar (from 1024px) or the bar and its sheet (below), a page header with an action,
 * and a form under it. *Changed 2026-11-05 (P19.2-T1; ADR-0197):* every shell is the one shell, so `field` always.
 */
function shell() {
  return (
    <AppShell
      field={fieldChrome()}
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

const main = () => document.querySelector('main')!;
/** The switches in a part of the page: the account menu's, the sheet's — and never the page's. */
const switchesIn = (el: HTMLElement) => within(el).queryAllByRole('group', { name: /^(Language|Bahasa)$/ });
const option = (el: HTMLElement, code: 'ID' | 'EN') => within(switchesIn(el)[0]).getByRole('button', { name: code });
/** The account menu at the sidebar's foot, opened: where the switch is from 1024px (UI-112, UI-129). */
async function accountMenu(): Promise<HTMLElement> {
  if (!document.querySelector('[data-account-panel]')) {
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
  }
  return document.querySelector<HTMLElement>('[data-account-panel]')!;
}
/** The *Lainnya* sheet, opened: where the switch is below 1024px (ADR-0180 §3). */
async function sheet(): Promise<HTMLElement> {
  const open = document.querySelector<HTMLElement>('[role="dialog"]');
  if (open) return open;
  await userEvent.click(within(document.querySelector<HTMLElement>('[data-tab-bar]')!).getByRole('button', { name: /^(More|Lainnya)$/ }));
  return screen.findByRole('dialog', { name: /^(More|Lainnya)$/ });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
  window.localStorage.clear();
  route.path = '/activity/log';
});

/**
 * **P18.10-T2 AC-3: the *ID | EN* switch** (ADR-0179 §2; UI-041). Built whole and held back: nothing is drawn until
 * `LANGUAGE_LIVE` turns on at P18.10-T4's exit. These cases render it live through the harness (`renderLive`), as it
 * will be then.
 */
describe('P18.10-T2 the switch, while it is not live', () => {
  it.each([375, 768, 1024, 1280])('AC-3 draws nothing at %ipx: no switch on the page or in the menu', (px) => {
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

  it('AC-3 the switch itself renders nothing outside a live provider', () => {
    const { container } = render(<LanguageSwitch tone="page" />);
    expect(container).toBeEmptyDOMElement();
  });
});

/*
 * *Changed 2026-11-05 (P19.2-T1 AC-11; UI-129, ADR-0197 §5):* the phone's bar and the page header no longer carry the
 * switch for any role — the consoles' bar is gone, and no page carries it. Its own behaviour is pinned where it lives
 * now: the account menu at the sidebar's foot from 1024px, the *Lainnya* sheet below.
 */
describe('P18.10-T2 the switch, live, in the account menu', () => {
  it('AC-3 is named Language, the current option pressed, each option its code and its language’s own name', async () => {
    atWidth(1280);
    stubFetch({});
    renderLive(shell());
    const [inMenu] = switchesIn(await accountMenu());

    expect(inMenu).toHaveAttribute('role', 'group');
    expect(inMenu).toHaveAccessibleName('Bahasa');
    const id = within(inMenu).getByRole('button', { name: 'ID' });
    const en = within(inMenu).getByRole('button', { name: 'EN' });
    // Live, a reader who has chosen nothing reads Bahasa Indonesia.
    expect(id).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    expect(id).toHaveAccessibleDescription('Bahasa Indonesia');
    expect(en).toHaveAccessibleDescription('English');
    expect(id).toHaveAttribute('lang', 'id');
    expect(en).toHaveAttribute('lang', 'en');
    expect(switchesIn(main())).toHaveLength(0);
  });

  it('AC-3 switches the screen at once, and says so: the group’s name, the pressed option, <html lang>', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());

    await userEvent.click(option(await accountMenu(), 'EN'));

    const menu = await accountMenu();
    expect(switchesIn(menu)[0]).toHaveAccessibleName('Language');
    expect(option(menu, 'EN')).toHaveAttribute('aria-pressed', 'true');
    expect(option(menu, 'ID')).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('en');
    // The shell's own words follow: the account menu's *Sign out* is in English now.
    expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('AC-3 is reached and chosen by keyboard: Tab to an option, then Enter or Space', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());
    const user = userEvent.setup();
    const menu = await accountMenu();

    option(menu, 'ID').focus();
    await user.tab();
    expect(option(menu, 'EN')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement.lang).toBe('en');

    await user.tab({ shift: true });
    expect(option(menu, 'ID')).toHaveFocus();
    await user.keyboard(' ');
    expect(document.documentElement.lang).toBe('id');
  });

  it('AC-3 an open form keeps what was typed across a switch, both ways — from the Lainnya sheet on a phone', async () => {
    atWidth(375);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());
    const box = screen.getByLabelText('Note');

    await userEvent.type(box, 'Follow up Pak Budi on Friday');
    await userEvent.click(option(await sheet(), 'EN'));
    expect(screen.getByLabelText('Note')).toBe(box);
    expect(box).toHaveValue('Follow up Pak Budi on Friday');

    await userEvent.click(option(await sheet(), 'ID'));
    expect(box).toHaveValue('Follow up Pak Budi on Friday');
  });

  it('AC-3, AC-5, AC-6 signed in, writes the account, the cookie and the API’s language', async () => {
    atWidth(1280);
    const { calls } = stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());

    await userEvent.click(option(await accountMenu(), 'EN'));

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

    await userEvent.click(option(await accountMenu(), 'ID'));

    expect(calls).toHaveLength(0);
    expect(languageCookie()).toBeNull();
  });

  it('AC-2 in a support session, changes the support person’s browser and nothing of the person’s', async () => {
    atWidth(1280);
    const { calls } = stubFetch({});
    renderLive(shell(), { me: makeMe({ isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'sa-1' }) });

    await userEvent.click(option(await accountMenu(), 'EN'));

    expect(document.documentElement.lang).toBe('en');
    expect(languageCookie()).toBe('en');
    expect(calls).toHaveLength(0);
  });

  it('AC-3 keeps the screen in the language chosen when the account cannot be told, and the browser keeps it', async () => {
    atWidth(1280);
    stubFetch({ 'PATCH /auth/me': { status: 503, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    renderLive(shell());

    await userEvent.click(option(await accountMenu(), 'EN'));

    expect(document.documentElement.lang).toBe('en');
    expect(languageCookie()).toBe('en');
  });

  it.each(['id', 'en'] as const)('AC-3 has no axe violations in the sheet, the screen in %s', async (language) => {
    atWidth(375);
    stubFetch({ 'PATCH /auth/me': { body: makeMe() } });
    renderLive(shell());
    const open = await sheet();
    if (language === 'en') fireEvent.click(option(open, 'EN'));
    // Contrast is measured in a browser, not in jsdom, which cannot draw a canvas (as every axe spec here).
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});

describe('ADR-0180, P19.1-T1 the field shell’s switch: in the Lainnya sheet below 1024px, in the account menu from 1024px', () => {
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

  /*
   * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112, Conflicts row 145):* **no page header carries it at 1280px** —
   * it is the account menu's, the sidebar foot's chip, from 1024px. It was the header's top-right corner (ADR-0180 §3).
   */
  it('P19.1-T1 AC-1 at 1280px is in no page header, and in the account menu the sidebar’s chip opens', async () => {
    stubFetch({});
    atWidth(1280);
    renderLive(<AgentShell title="Log Activity">body</AgentShell>, { me: makeMe() });
    expect(switchesIn(main())).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Rina/ }));
    const panel = document.querySelector('[data-account-panel]') as HTMLElement;
    expect(switchesIn(panel)).toHaveLength(1);
  });
});

/**
 * *Changed 2026-11-05 (P19.2-T1 AC-11; UI-129, ADR-0197 §5):* the office's and the platform's pages are in the one shell,
 * so their switch is where everybody's is — the sheet below 1024px, the account menu from 1024px — and never on a page.
 * It was each console's phone bar and page header.
 */
const ROLES: [string, string, Partial<Me>][] = [
  ['an Owner’s office page', '/kpm/overview', {
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 3,
    },
    permissions: ['member:read_profile'],
  }],
  ['a Super Admin’s page', '/admin', {
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  }],
];

describe('P19.2-T1 AC-11 the switch, live, for the office and the platform too', () => {
  it.each(ROLES)('P19.2-T1 AC-11 %s: in the sheet at 375px, the account menu at 1280px, on the page at neither', async (_, path, who) => {
    stubFetch({});
    route.path = path;
    atWidth(375);
    const phone = renderLive(<Shell title="Overview">body</Shell>, { me: makeMe(who) });
    expect(switchesIn(main())).toHaveLength(0);
    expect(switchesIn(await sheet())).toHaveLength(1);
    phone.unmount();
    atWidth(1280);
    renderLive(<Shell title="Overview">body</Shell>, { me: makeMe(who) });
    expect(switchesIn(main())).toHaveLength(0);
    expect(switchesIn(await accountMenu())).toHaveLength(1);
  });
});
