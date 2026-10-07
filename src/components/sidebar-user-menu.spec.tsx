import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
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

  describe('with the shell’s nav, on a phone (ADR-0085, P11-T6 AC-11)', () => {
    const NAV = (
      <nav aria-label="Main">
        <a href="/leads">Leads management</a>
      </nav>
    );

    it('P11-T6 AC-11 opens downward, the caret pointing the way it opens', async () => {
      setup({ nav: NAV });
      const trigger = screen.getByRole('button', { name: /Platform Operator/ });
      expect(trigger).toHaveTextContent('▾');
      await userEvent.click(trigger);
      expect(trigger).toHaveTextContent('▴');
      const panel = document.getElementById('sidebar-user-actions')!;
      expect(panel.className).toContain('top-full');
      // The panel hangs from the bar, not from the chip: the chip's box is not its containing block.
      expect(trigger.parentElement!.className).not.toContain('relative');
    });

    it('P11-T6 AC-11 puts the nav first, then the account’s two, and focus on the first link', async () => {
      setup({ nav: NAV });
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
      const links = screen.getAllByRole('link').map((a) => a.textContent);
      expect(links).toEqual(['Leads management', 'Your account']);
      expect(screen.getByRole('link', { name: 'Leads management' })).toHaveFocus();
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

  describe('with a view switch, for an Owner or an Admin (ADR-0114, P13.2-T5)', () => {
    const SWITCH = { href: '/coaching', label: 'Open agent view' };

    it('P13.2-T5 AC-1 puts the switch above Your account, a link like it, and shows nothing more until opened', async () => {
      setup({ viewSwitch: SWITCH });
      expect(screen.queryByRole('link', { name: 'Open agent view' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));

      expect(screen.getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/coaching');
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

    it('P13.2-T5 AC-3 on a phone sits after the nav groups and before Your account', async () => {
      setup({
        viewSwitch: { href: '/kpm/overview', label: 'Open Owner view' },
        nav: <nav aria-label="Main"><a href="/leads">Leads management</a></nav>,
      });
      await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
      expect(screen.getAllByRole('link').map((a) => a.textContent))
        .toEqual(['Leads management', 'Open Owner view', 'Your account']);
      // Focus still starts on the nav's first link, and Tab from it reaches the switch next.
      expect(screen.getByRole('link', { name: 'Leads management' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Open Owner view' })).toHaveFocus();
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
