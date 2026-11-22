import { render, screen, within } from '@testing-library/react';
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

  /*
   * *Removed 2026-11-05 (P19.2-T1; ADR-0197):* the chip's phone mode — the avatar alone in the consoles' phone bar,
   * holding the notices (ADR-0085, P11-T6 AC-11, P18.7-T2 AC-4, P18.7-T12). No role has that bar now: below 1024px the
   * title row's avatar and the *Lainnya* sheet are the account (`shell-views.spec.tsx`).
   */

  /*
   * **P19.17-T3 AC-1: Akun Anda · Keluar, for everybody** (ADR-0269 §2; the brief's gaps 3 and 5). The views
   * (ADR-0198), *Tambah akun* (ADR-0199) and *📘 Panduan* (ADR-0219) went; the panel holds the email, *ID | EN*, the
   * account and signing out, nothing else.
   */
  it('P19.17-T3 AC-1 opens to the email, Your account and Sign out — no view, no Add account, no guide', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Platform Operator/ }));
    const panel = document.getElementById('sidebar-user-actions')!;
    expect(within(panel).getAllByRole('link').map((a) => a.textContent)).toEqual(['Your account']);
    expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sign out']);
    expect(panel.textContent).not.toMatch(/Add account|Guide|Panduan|My account/);
    expect(document.querySelector('[data-panduan], [data-account-views]')).toBeNull();
  });

  it('P19.17-T3 (`DESIGN-RULES.md` *Names*) writes the name in capitals', () => {
    setup();
    expect(screen.getByText('Platform Operator')).toHaveClass('uppercase');
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
