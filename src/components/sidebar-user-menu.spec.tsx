import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { UnreadBadge } from './notification-bell';
import { SidebarUserMenu } from './sidebar-user-menu';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

const USER = {
  name: 'Platform Operator',
  role: 'Super Admin',
  initials: 'PO',
  email: 'superadmin@agencyboost.test',
};

function setup(props: Partial<React.ComponentProps<typeof SidebarUserMenu>> = {}) {
  const onSignOut = vi.fn();
  const result = render(
    <SidebarUserMenu user={USER} accountHref="/profile" onSignOut={onSignOut} {...props} />,
  );
  return { ...result, onSignOut };
}

describe('SidebarUserMenu', () => {
  it('shows who is signed in without opening anything', () => {
    setup();
    const trigger = screen.getByRole('button', { name: /Platform Operator/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Your account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('opens to the account link and sign out', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));

    expect(screen.getByRole('button', { name: /Platform Operator/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('names the account you are about to leave', async () => {
    // A Super Admin who has been impersonating needs to see whose session this is
    // before ending it.
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
    expect(screen.getByText('superadmin@agencyboost.test')).toBeInTheDocument();
  });

  it('omits the email line when there is none, rather than showing an empty row', async () => {
    setup({ user: { name: 'A', role: 'B', initials: 'AB' } });
    await userEvent.click(screen.getByRole('button', { name: /A/ }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByTitle(/@/)).not.toBeInTheDocument();
  });

  it('signs out when asked', async () => {
    const { onSignOut } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and puts focus back on the trigger', async () => {
    // Leaving focus on a node that was just removed drops a keyboard user at the top
    // of the document.
    setup();
    const trigger = screen.getByRole('button', { name: /Platform Operator/ });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes on a click elsewhere', async () => {
    render(<p data-testid="outside">elsewhere</p>);
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('closes when the account link is followed, so it is not left open behind the next screen', async () => {
    // jsdom cannot navigate, and the navigation is not what is under test — the click
    // handler is. Swallowing the default keeps the assertion honest and the output clean.
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    try {
      setup();
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
      await userEvent.click(screen.getByRole('link', { name: 'Your account' }));
      expect(screen.queryByRole('link', { name: 'Your account' })).not.toBeInTheDocument();
    } finally {
      document.removeEventListener('click', swallow);
    }
  });

  it('locks and says so while a sign-out is in flight', async () => {
    const { onSignOut } = setup({ signingOut: true });
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));

    const button = screen.getByRole('button', { name: 'Signing out…' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('is reachable by keyboard alone, both items in the tab order', async () => {
    // A disclosure, deliberately — not role="menu", which would promise arrow-key
    // navigation this does not implement.
    setup();
    const trigger = screen.getByRole('button', { name: /Platform Operator/ });
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
  });

  describe('in the phone’s bar (ADR-0085, P11-T6 AC-11; P18.95-T2 AC-4; P18.95-T12)', () => {
    /** The bar's avatar, named for what it opens (P18.95-T12 AC-2): *Account* where there is nothing to count. */
    const avatar = (name: string | RegExp = /^Account/) => screen.getByRole('button', { name });

    it('P11-T6 AC-11, P18.95-T12 AC-1 opens downward from the avatar alone: no name, no profile line, no caret', async () => {
      setup({ phone: true });
      const trigger = avatar('Account');
      // A 44px box round the initials' circle, the circle as everywhere else.
      expect(trigger).toHaveClass('h-11', 'w-11');
      expect(trigger).toHaveTextContent(/^PO$/);
      expect(within(trigger).getByText('PO')).toHaveClass('h-8', 'w-8', 'rounded-full', 'bg-amber');
      await userEvent.click(trigger);
      const panel = document.getElementById('sidebar-user-actions')!;
      expect(panel.className).toContain('top-full');
      // The panel hangs from the bar, not from the chip: the chip's box is not its containing block.
      expect(trigger.parentElement!.className).not.toContain('relative');
      expect(trigger).toHaveTextContent(/^PO$/);
    });

    it('P18.95-T2 AC-4 holds the account’s items alone — no nav — and takes the focus to the first', async () => {
      setup({ phone: true });
      await userEvent.click(avatar());
      const panel = document.getElementById('sidebar-user-actions')!;
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Your account']);
      expect(within(panel).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
      // Nothing above the details to rule off: the line under them is a border, not a separator.
      expect(within(panel).queryByRole('separator')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveFocus();
    });

    it('P18.95-T2 AC-4 holds the focus inside, round its two items', async () => {
      setup({ phone: true });
      await userEvent.click(avatar());
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    });

    it('P18.95-T2 AC-2 names a panel of its own when the shell asks, so two chips never share an id', async () => {
      setup({ panelId: 'phone-menu-account' });
      const trigger = screen.getByRole('button', { name: /Platform Operator/ });
      expect(trigger).toHaveAttribute('aria-controls', 'phone-menu-account');
      await userEvent.click(trigger);
      expect(document.getElementById('phone-menu-account')).toContainElement(screen.getByRole('link', { name: 'Your account' }));
      expect(document.getElementById('sidebar-user-actions')).toBeNull();
    });

    it('P11-T6 AC-11 keeps a desktop chip as it was: upward, caret up, focus on the chip', async () => {
      setup();
      const trigger = screen.getByRole('button', { name: /Platform Operator/ });
      expect(trigger).toHaveTextContent('▴');
      await userEvent.click(trigger);
      expect(document.getElementById('sidebar-user-actions')!.className).toContain('bottom-full');
      expect(trigger).toHaveFocus();
    });
  });

  /**
   * **The phone's bar: the avatar holds the account and the notices** (P18.95-T12, the product owner's request of
   * 2026-10-27). `app-shell.spec.tsx` and `shell-nav.spec.tsx` hold the bar and the three shells; this is the menu.
   */
  describe('the avatar on a phone’s bar holds the account and the notices (P18.95-T12)', () => {
    const NOTICES = { href: '/notifications', unread: 3 };
    const SWITCH = { href: '/kpm/overview', label: 'Open Owner view' };
    const LINE = 'AB · Core Leader · Mentoring Circle, Top Producers 2026 · 0417 · Cempaka Putih';
    const PERSON = {
      name: 'Wilson', fullName: 'Wilson Tanoto Hadiwijaya', role: LINE, initials: 'WT', email: 'wilson.tanoto@kpm0417.test',
    };
    const phoneMenu = (over: Partial<React.ComponentProps<typeof SidebarUserMenu>> = {}) =>
      setup({ phone: true, user: PERSON, notifications: NOTICES, viewSwitch: SWITCH, ...over });
    const avatar = () => screen.getByRole('button', { name: /^Account and notifications/ });
    const panel = () => document.getElementById('sidebar-user-actions')!;

    it('P18.95-T12 AC-2 carries the bell’s badge while anything is unread, and says the count in its name', () => {
      phoneMenu();
      const trigger = screen.getByRole('button', { name: 'Account and notifications, 3 unread' });
      const badge = within(trigger).getByText('3');
      // The bell's own badge, by construction: the same element, classes and tokens.
      const { container } = render(<UnreadBadge unread={3} />);
      expect(badge.outerHTML).toBe(container.innerHTML);
      expect(badge).toHaveAttribute('aria-hidden', 'true');
      // On the avatar's corner: placed against the 44px box, as the bell's is against its own.
      expect(badge).toHaveClass('absolute', '-right-0.5', '-top-0.5');
      expect(trigger).toHaveClass('relative');
    });

    it('P18.95-T12 AC-2 caps the badge at 9+ and keeps the exact count in the name', () => {
      phoneMenu({ notifications: { href: '/notifications', unread: 12 } });
      const trigger = screen.getByRole('button', { name: 'Account and notifications, 12 unread' });
      expect(within(trigger).getByText('9+')).toBeInTheDocument();
    });

    it('P18.95-T12 AC-2 wears no badge with nothing unread', () => {
      phoneMenu({ notifications: { href: '/notifications', unread: 0 } });
      const trigger = screen.getByRole('button', { name: 'Account and notifications' });
      expect(trigger).toHaveTextContent(/^WT$/);
      expect(trigger.querySelector('.bg-alert')).toBeNull();
    });

    it('P18.95-T12 AC-2 is named Account, with no badge and no Notifications row, where there is nothing to count', async () => {
      setup({ phone: true, user: PERSON });
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      expect(within(panel()).queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
    });

    it('P18.95-T12 AC-3 reads top to bottom: the full name, the profile line and the email, then Notifications, then the account’s items', async () => {
      phoneMenu();
      await userEvent.click(avatar());
      // Every line of the panel, in the order it reads.
      const lines = Array.from(panel().querySelectorAll('p, a, button')).map((el) => el.textContent);
      expect(lines).toEqual([
        'Wilson Tanoto Hadiwijaya', LINE, 'wilson.tanoto@kpm0417.test',
        'Notifications3', 'Open Owner view', 'Your account', 'Sign out',
      ]);
      // Whole, never cut: they wrap inside the panel.
      for (const text of ['Wilson Tanoto Hadiwijaya', LINE, 'wilson.tanoto@kpm0417.test']) {
        expect(within(panel()).getByText(text)).not.toHaveClass('truncate');
        expect(within(panel()).getByText(text)).toHaveClass('break-words');
      }
      // Words, not controls; the sidebar's rule under them.
      expect(within(panel()).getByText(LINE).parentElement).toHaveClass('border-b', 'border-white/10');
    });

    it.each([[undefined], [''], ['   ']])('P18.95-T12 AC-3 heads the details with the name it greets by when the full name is %j', async (fullName) => {
      phoneMenu({ user: { ...PERSON, fullName } });
      await userEvent.click(avatar());
      expect(panel().querySelector('p')).toHaveTextContent(/^Wilson$/);
    });

    it('P18.95-T12 AC-3 gives Notifications the count, to the inbox, its exact number in the name', async () => {
      phoneMenu({ notifications: { href: '/notifications', unread: 12 } });
      await userEvent.click(avatar());
      const row = within(panel()).getByRole('link', { name: 'Notifications, 12 unread' });
      expect(row).toHaveAttribute('href', '/notifications');
      const pill = within(row).getByText('9+');
      expect(pill).toHaveAttribute('aria-hidden', 'true');
      expect(pill).toHaveClass('ml-auto', 'rounded-pill', 'bg-alert', 'text-white');
    });

    it('P18.95-T12 AC-3 shows Notifications with no pill when nothing is unread', async () => {
      phoneMenu({ notifications: { href: '/notifications', unread: 0 } });
      await userEvent.click(avatar());
      const row = within(panel()).getByRole('link', { name: 'Notifications' });
      expect(row).toHaveTextContent(/^Notifications$/);
    });

    it('P18.95-T12 AC-3 makes every row 44px tall, its words centred', async () => {
      phoneMenu();
      await userEvent.click(avatar());
      const rows = [...within(panel()).getAllByRole('link'), within(panel()).getByRole('button', { name: 'Sign out' })];
      expect(rows).toHaveLength(4);
      for (const row of rows) expect(row).toHaveClass('flex', 'items-center', 'max-md:min-h-11');
    });

    it('P18.95-T12 AC-3 closes when Notifications is followed, so it is not left open over the inbox', async () => {
      const swallow = (event: Event) => event.preventDefault();
      document.addEventListener('click', swallow);
      try {
        phoneMenu();
        await userEvent.click(avatar());
        await userEvent.click(within(panel()).getByRole('link', { name: /^Notifications/ }));
        expect(document.getElementById('sidebar-user-actions')).toBeNull();
        expect(avatar()).toHaveAttribute('aria-expanded', 'false');
      } finally {
        document.removeEventListener('click', swallow);
      }
    });

    it('P18.95-T12 AC-4 is the house disclosure: expanded and controlling its panel, no popup role it does not implement', async () => {
      phoneMenu();
      const trigger = avatar();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-controls', 'sidebar-user-actions');
      // A disclosure of links and buttons, not a `menu` or a `dialog`: claiming either promises keys it lacks.
      expect(trigger).not.toHaveAttribute('aria-haspopup');
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(panel()).not.toHaveAttribute('role');
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    it('P18.95-T12 AC-4 takes the focus to Notifications, holds it round the panel both ways, and Escape gives it back to the avatar', async () => {
      phoneMenu();
      await userEvent.click(avatar());
      const notices = within(panel()).getByRole('link', { name: /^Notifications/ });
      expect(notices).toHaveFocus();
      await userEvent.tab();
      expect(within(panel()).getByRole('link', { name: 'Open Owner view' })).toHaveFocus();
      await userEvent.tab();
      expect(within(panel()).getByRole('link', { name: 'Your account' })).toHaveFocus();
      await userEvent.tab();
      expect(within(panel()).getByRole('button', { name: 'Sign out' })).toHaveFocus();
      await userEvent.tab();
      expect(notices).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(within(panel()).getByRole('button', { name: 'Sign out' })).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      expect(document.getElementById('sidebar-user-actions')).toBeNull();
      expect(avatar()).toHaveFocus();
    });

    it('P18.95-T12 AC-4 closes on a click outside it', async () => {
      render(<p data-testid="outside">elsewhere</p>);
      phoneMenu();
      await userEvent.click(avatar());
      await userEvent.click(screen.getByTestId('outside'));
      expect(document.getElementById('sidebar-user-actions')).toBeNull();
    });

    it('P18.95-T12 AC-5 leaves a chip wider than a phone as it was: the notices passed to it change nothing', async () => {
      const { container: before } = setup({ user: PERSON, viewSwitch: SWITCH });
      const closed = before.innerHTML;
      const { container: after, unmount } = setup({ user: PERSON, viewSwitch: SWITCH, notifications: NOTICES });
      expect(after.innerHTML).toBe(closed);
      // Open, the same panel: the email, the switch, Your account and Sign out — no Notifications row.
      await userEvent.click(within(after).getByRole('button', { name: /Wilson/ }));
      expect(within(after).getAllByRole('link').map((a) => a.textContent)).toEqual(['Open Owner view', 'Your account']);
      expect(within(after).getByText('wilson.tanoto@kpm0417.test')).toHaveClass('truncate');
      // The chip's name is the one it greets by, as before; the full name is the phone menu's.
      expect(within(after).queryByText('Wilson Tanoto Hadiwijaya')).not.toBeInTheDocument();
      unmount();
    });

    it('P18.95-T12 AC-4 has no axe violations, open or closed', async () => {
      const { container } = phoneMenu();
      const clean = async () =>
        expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
      await clean();
      await userEvent.click(avatar());
      await clean();
    });
  });

  describe('with a view switch, for an Owner or an Admin (ADR-0114, P13.2-T5)', () => {
    // A leader's field landing, as `viewSwitchFor` answers it (P15-T4 AC-4); the menu draws whatever it is given.
    const SWITCH = { href: '/unit/dashboard', label: 'Open agent view' };

    it('P13.2-T5 AC-1 puts the switch above Your account, a link like it, and shows nothing more until opened', async () => {
      setup({ viewSwitch: SWITCH });
      expect(screen.queryByRole('link', { name: 'Open agent view' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));

      expect(screen.getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/unit/dashboard');
      // The disclosure's own vocabulary: links and a button, no `menuitem` it does not implement.
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Open agent view', 'Your account']);
    });

    it('P13.2-T5 AC-1 is in the tab order, before the account’s two', async () => {
      setup({ viewSwitch: SWITCH });
      screen.getByRole('button', { name: /Platform Operator/ }).focus();
      await userEvent.keyboard('{Enter}');

      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Open agent view' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    });

    it('P13.2-T5 AC-1 closes when followed, so the panel is not left open over the other view', async () => {
      const swallow = (event: Event) => event.preventDefault();
      document.addEventListener('click', swallow);
      try {
        setup({ viewSwitch: SWITCH });
        await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
        await userEvent.click(screen.getByRole('link', { name: 'Open agent view' }));
        expect(screen.queryByRole('link', { name: 'Your account' })).not.toBeInTheDocument();
      } finally {
        document.removeEventListener('click', swallow);
      }
    });

    it('P13.2-T5 AC-3, P18.95-T2 AC-4 on a phone comes first, before Your account, and takes the focus', async () => {
      // With nothing to count there is no Notifications row (P18.95-T12), so the switch is the panel's first control.
      setup({ viewSwitch: { href: '/kpm/overview', label: 'Open Owner view' }, phone: true });
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Open Owner view', 'Your account']);
      // The nav is the drawer's now (P18.95-T2): the switch is the panel's first control.
      expect(screen.getByRole('link', { name: 'Open Owner view' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveFocus();
    });

    it('P13.2-T5 AC-1 has no axe violations with the switch open', async () => {
      const { container } = setup({ viewSwitch: SWITCH });
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
      const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations ?? []).toHaveLength(0);
    });
  });

  it('has no axe violations, open or closed', async () => {
    const { container } = setup();
    const clean = async () =>
      expect(
        (await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? [],
      ).toHaveLength(0);

    await clean();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
    await clean();
  });
});
