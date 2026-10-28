import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, wears } from '@test/harness';
import { AppShell, PageHeader, type NavSection } from './app-shell';

// Mutable so the phone's drawer can watch the route move under it (P18.95-T2 AC-2); every other test reads `/admin`.
const route = vi.hoisted(() => ({ path: '/admin' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => route.path,
}));

const SECTIONS: readonly NavSection[] = [
  {
    label: 'Personal tools',
    items: [
      { label: 'Activity management', href: '/activity', icon: 'activity', active: true },
      { label: 'Leads management', href: '/leads', icon: 'funnel' },
    ],
  },
  {
    label: 'Reporting',
    items: [{ label: 'Advanced analytics', href: '#', icon: 'chartUp', upcoming: true }],
  },
];

const USER = { name: 'Rina Wijaya', role: 'Agent · KPM 0417', initials: 'RW' };

function renderShell() {
  // The rail preference is remembered in `localStorage`, which jsdom shares across the file
  // — so a test that collapses it would hand the next one an already-collapsed sidebar.
  window.localStorage.clear();
  return render(
    <AppShell sections={SECTIONS} user={USER} title="Log Activity" subtitle="Enter today's activities in 1 minute.">
      <p>content</p>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('renders the page title and subtitle from the topbar', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: 'Log Activity', level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Enter today's activities in 1 minute.")).toBeInTheDocument();
  });

  it('marks the active nav item for assistive technology, not just visually', () => {
    renderShell();
    expect(screen.getByRole('link', { name: /Activity management/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Leads management/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps an upcoming item visible but not navigable, so the roadmap is not a surprise', async () => {
    renderShell();
    // Every group starts open (P10.1-T3), so `Reporting`'s item is there without a click.
    const upcoming = screen.getByText('Advanced analytics').closest('a');
    expect(upcoming).toHaveAttribute('aria-disabled', 'true');
    expect(upcoming).not.toHaveAttribute('href');
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('groups nav items under their section labels', () => {
    renderShell();
    expect(screen.getByText('Personal tools')).toBeInTheDocument();
    expect(screen.getByText('Reporting')).toBeInTheDocument();
  });

  it('shows who is signed in and in what capacity', () => {
    renderShell();
    expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Agent · KPM 0417')).toBeInTheDocument();
    expect(screen.getByText('RW')).toBeInTheDocument();
  });

  it('renders its children', () => {
    renderShell();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  describe('the account menu at the foot of the sidebar', () => {
    it('is a plain label when no account is wired', () => {
      // A shell rendered outside a session has nothing to sign out of. Offering a dead
      // control would be worse than offering none.
      renderShell();
      expect(screen.queryByRole('button', { name: /Rina Wijaya/ })).not.toBeInTheDocument();
      expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
    });

    it('becomes a menu with an account link and sign out when it is', async () => {
      const onSignOut = vi.fn();
      render(
        <AppShell
          sections={SECTIONS}
          user={USER}
          account={{ href: '/profile', onSignOut }}
          title="Log Activity"
        >
          <p>content</p>
        </AppShell>,
      );

      await userEvent.click(screen.getByRole('button', { name: /Rina Wijaya/ }));
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');

      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(onSignOut).toHaveBeenCalled();
    });
  });

  describe('every group opens on its own, and all start open (P10.1-T3, client item 3)', () => {
    /*
     * The client asked on 2026-09-24 for one group open at a time, and on 2026-09-29 for the
     * opposite; the later request wins (ADR-0062). The toggles stay — they were the first
     * request's too — and only the rule that opening one closes the rest goes.
     */
    const header = (name: RegExp) => screen.getByRole('button', { name });

    it('starts with every group open (AC-1)', () => {
      renderShell();

      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();
      expect(screen.getByText('Advanced analytics')).toBeInTheDocument();
      expect(header(/Personal tools/)).toHaveAttribute('aria-expanded', 'true');
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
    });

    it('starts open on the server too, so the first client render has nothing to reconcile (AC-1)', () => {
      const html = renderToString(
        <AppShell sections={SECTIONS} user={USER}>
          <p>content</p>
        </AppShell>,
      );

      expect(html.match(/aria-expanded="true" aria-controls="nav-group-/g)).toHaveLength(2);
      expect(html).not.toMatch(/aria-expanded="false" aria-controls="nav-group-/);
    });

    it('toggles only its own group — two can be closed, and closing one opens nothing (AC-2)', async () => {
      renderShell();

      await userEvent.click(header(/Reporting/));
      expect(screen.queryByText('Advanced analytics')).toBeNull();
      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();

      await userEvent.click(header(/Personal tools/));
      expect(screen.queryByRole('link', { name: 'Activity management' })).toBeNull();
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'false');

      // Reopening one leaves the other as it was.
      await userEvent.click(header(/Reporting/));
      expect(screen.getByText('Advanced analytics')).toBeInTheDocument();
      expect(header(/Personal tools/)).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps each toggle wired to its own list (AC-2)', () => {
      renderShell();

      for (const name of [/Personal tools/, /Reporting/]) {
        const list = document.getElementById(header(name).getAttribute('aria-controls')!);
        expect(list?.tagName).toBe('UL');
      }
    });

    it('reopens a closed group when the page moves into it, and leaves the others alone (AC-3)', async () => {
      const { rerender } = renderShell();
      await userEvent.click(header(/Personal tools/));
      await userEvent.click(header(/Reporting/));

      // The reader follows a link into Reporting: the layout re-renders with it active.
      const inReporting: readonly NavSection[] = [
        { ...SECTIONS[0], items: SECTIONS[0].items.map((i) => ({ ...i, active: false })) },
        { ...SECTIONS[1], items: [{ label: 'Advanced analytics', href: '/analytics', icon: 'chartUp', active: true }] },
      ];
      rerender(
        <AppShell sections={inReporting} user={USER}>
          <p>content</p>
        </AppShell>,
      );

      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
      expect(header(/Personal tools/)).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not remember a closed group across a reload (AC-4)', async () => {
      const { unmount } = renderShell();
      await userEvent.click(header(/Reporting/));
      // Nothing about groups is stored: the rail is the one remembered preference.
      expect(Object.keys(window.localStorage)).toEqual([]);
      unmount();

      render(
        <AppShell sections={SECTIONS} user={USER}>
          <p>content</p>
        </AppShell>,
      );
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes a group that was open, so the nav can be put away entirely', async () => {
      renderShell();
      await userEvent.click(screen.getByRole('button', { name: /Personal tools/ }));

      expect(screen.queryByRole('link', { name: 'Activity management' })).toBeNull();
      expect(screen.getByRole('button', { name: /Personal tools/ }))
        .toHaveAttribute('aria-expanded', 'false');
    });

    it('collapses to icons, and every one of them keeps its name', async () => {
      // The glyph is aria-hidden, so without the label as the accessible name the rail is a
      // column of links called nothing.
      renderShell();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();
      // The words themselves are gone; the name is not.
      expect(screen.queryByText('Activity management')).toBeNull();
    });

    it('flattens the groups in the rail, so nothing is behind a heading that is not there', async () => {
      renderShell();
      // Closed at full width first — every group starts open now (P10.1-T3), so the test makes
      // the case it is about.
      await userEvent.click(screen.getByRole('button', { name: /Reporting/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

      // `Reporting` was closed at full width; collapsed, its item is reachable.
      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reporting/ })).toBeNull();
      // An upcoming item has no href and so no link role; its name reaches a pointer as the
      // title and assistive technology as the label, and it says it is not ready yet.
      expect(screen.getByTitle('Advanced analytics — Upcoming')).toBeInTheDocument();
    });

    it('P13-T7 AC-5 an item with the amber check keeps saying so in the rail', async () => {
      window.localStorage.clear();
      render(
        <AppShell
          sections={[{ label: 'New agent', items: [{ label: 'Your 90-day activation', href: '/activation', icon: 'clipboard', done: true }] }]}
          user={USER}
          title="x"
        >
          <p>content</p>
        </AppShell>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      const item = screen.getByRole('link', { name: 'Your 90-day activation — complete' });
      expect(item).toHaveAttribute('title', 'Your 90-day activation — complete');
      // Only the glyph is drawn collapsed: the check has nowhere to sit.
      expect(item.querySelector('[data-mark="done"]')).toBeNull();
    });

    it('offers the way back, and remembers the choice', async () => {
      renderShell();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

      expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
      expect(window.localStorage.getItem('ab.sidebar.rail')).toBe('1');
    });
  });

  describe('the rail actually narrows the sidebar (client feedback, 2026-09-24)', () => {
    /*
     * Collapsing it made the sidebar cover the page. `w-sidebar-rail` needed a new key in
     * `tailwind.config.ts`, which Tailwind's JIT does not pick up without a dev-server
     * restart — so the class did not exist, the `w-full` underneath it won, and the one
     * control that decides whether anything else is visible silently did nothing.
     *
     * Asserted on the class rather than on a computed width, because jsdom applies no
     * stylesheet: what can be checked here is that the element asks for the right width, in
     * a form that cannot fail to be generated.
     */
    const aside = () => document.querySelector('aside')!;

    it('asks for a width that needs no theme key, and drops w-sidebar', async () => {
      renderShell();
      expect(aside().className).toContain('md:w-sidebar');

      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

      expect(aside().className).toContain('md:w-[var(--sidebar-rail-width)]');
      expect(aside().className).not.toContain('md:w-sidebar ');
    });

    it('keeps the toggle beside the brand mark, not above the nav', async () => {
      // A window control belongs on the frame. Its own row under the brand read as the first
      // item in the menu.
      renderShell();
      const toggle = screen.getByRole('button', { name: 'Collapse the sidebar' });
      const brand = document.querySelector('svg[viewBox="0 0 26 26"]')!;

      expect(toggle.parentElement).toBe(brand.parentElement);
      expect(toggle.compareDocumentPosition(document.querySelector('nav')!))
        // 4 = DOCUMENT_POSITION_FOLLOWING: the nav comes after the control.
        .toBe(4);
    });
  });

  describe('the bell stays put (client feedback, 2026-09-24)', () => {
    /*
     * The chip sized itself to its contents, so a short name pulled the bell left and a long
     * one pushed it right. A control that moves with somebody's name is one nobody learns the
     * position of.
     */
    const footerOf = (name: string) => {
      window.localStorage.clear();
      const { container, unmount } = render(
        <AppShell
          sections={SECTIONS}
          user={{ name, role: 'Agent · KPM 0417', initials: 'RW' }}
          account={{ href: '/profile', onSignOut: () => {} }}
          notifications={{ href: '/notifications', unread: 0 }}
        >
          <p>content</p>
        </AppShell>,
      );
      // The bell is a button since P12.1-T2, in a box that also holds the popover it opens.
      const bell = container.querySelector('button[aria-label="Notifications"]')!;
      const box = bell.parentElement!;
      const row = box.parentElement!;
      const chip = row.firstElementChild!;
      return { row, chip, bell, box, unmount };
    };

    it.each([['a short name', 'Al'], ['a long one', 'Bambang Wijayakusuma Hartono']])(
      'gives the chip the space, so the bell is last in the row for %s',
      (_label, name) => {
        const { row, chip, bell, box, unmount } = footerOf(name);

        // The chip absorbs the width; the bell is the final child, pinned to the end.
        expect(chip.className).toContain('flex-1');
        expect(row.lastElementChild).toBe(box);
        expect(box.className).not.toContain('flex-1');
        expect(bell.className).not.toContain('flex-1');
        unmount();
      },
    );
  });

  describe('the foot of the sidebar, collapsed (client feedback, 2026-09-24)', () => {
    // `renderShell` wires neither an account nor a bell; the foot needs both.
    const collapse = async () => {
      window.localStorage.clear();
      render(
        <AppShell
          sections={SECTIONS}
          user={USER}
          account={{ href: '/profile', onSignOut: () => {} }}
          notifications={{ href: '/notifications', unread: 0 }}
        >
          <p>content</p>
        </AppShell>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      const bell = document.querySelector('button[aria-label^="Notifications"]')!;
      return { column: bell.parentElement!.parentElement!, box: bell.parentElement!, bell };
    };

    it('shows the avatar alone — the name and the role go, they do not shrink', async () => {
      // Truncated to a few characters they say nothing and take the width the avatar needs.
      const { column } = await collapse();

      expect(within(column as HTMLElement).queryByText('Rina Wijaya')).toBeNull();
      expect(within(column as HTMLElement).queryByText('Agent · KPM 0417')).toBeNull();
      expect(within(column as HTMLElement).getByText('RW')).toBeInTheDocument();
    });

    it('keeps the name reachable, in the trigger’s own name', async () => {
      // What is announced should not change with the width.
      const { column } = await collapse();

      expect(within(column as HTMLElement)
        .getByRole('button', { name: 'Rina Wijaya — Agent · KPM 0417' })).toBeInTheDocument();
    });

    it('puts the bell above the avatar, in the DOM as well as on screen', async () => {
      // `flex-col-reverse` would leave a keyboard reaching the chip first while the eye reads
      // the bell first — a mismatch only the people who cannot see it would meet.
      const { column, box } = await collapse();

      expect(column.firstElementChild).toBe(box);
    });

    it('gives the account menu its own width, so it is not a column of one word', async () => {
      await collapse();
      await userEvent.click(screen.getByRole('button', { name: 'Rina Wijaya — Agent · KPM 0417' }));

      const panel = document.getElementById('sidebar-user-actions')!;
      expect(panel.className).toContain('w-48');
      expect(within(panel).getByRole('link', { name: 'Your account' })).toBeInTheDocument();
    });
  });
});

/*
 * A screen of a given width, as far as the shell can ask: `atWidth` (`test/harness.tsx`), which answers each of
 * `useMediaQuery`'s three ranges for the width. Until P18.97-T6 this file had its own, which answered the phone's
 * query alone: 768 was then a desktop to the shell, which was true until a tablet opened on the rail.
 */

/**
 * **The phone's menu** (P18.95-T2, ADR-0167 §3, OD-198; the client's UI review, UI-009). Below 768px ☰ in the
 * bar opens the sidebar as a drawer; the account chip keeps the account's items. Until 2026-10-26 the chip's
 * panel held the nav (ADR-0085, P11-T6 AC-11), and these cases replace that block's.
 */
describe('below 768px, ☰ opens the sidebar as a drawer (P18.95-T2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/admin';
    document.body.style.overflow = '';
  });

  /** An unheaded group, a badge, a divider and an upcoming item: everything the sidebar draws. */
  const PHONE_SECTIONS: readonly NavSection[] = [
    { label: null, divider: true, items: [{ label: 'Overview', href: '/admin', icon: 'gauge', active: true }] },
    {
      label: 'Personal tools',
      divider: true,
      items: [
        { label: 'Activity management', href: '/activity', icon: 'activity' },
        { label: 'Leads management', href: '/leads', icon: 'funnel', badge: 3 },
      ],
    },
    { label: 'Reporting', items: [{ label: 'Advanced analytics', href: '#', icon: 'chartUp', upcoming: true }] },
  ];

  function shell(over: Partial<React.ComponentProps<typeof AppShell>> = {}) {
    return (
      <AppShell
        sections={PHONE_SECTIONS}
        user={{ ...USER, email: 'rina@kpm0417.test' }}
        account={{ href: '/profile', onSignOut: vi.fn() }}
        notifications={{ href: '/notifications', unread: 2 }}
        brandTag="KPM OWNER"
        title="Log Activity"
        {...over}
      >
        <p>content</p>
      </AppShell>
    );
  }
  function renderPhoneShell(px = 375, over: Partial<React.ComponentProps<typeof AppShell>> = {}) {
    window.localStorage.clear();
    const onSignOut = vi.fn();
    const width = atWidth(px);
    const result = render(shell({ account: { href: '/profile', onSignOut }, ...over }));
    return { ...result, onSignOut, width };
  }
  const burger = () => screen.getByRole('button', { name: 'Open menu' });
  const drawer = () => screen.queryByRole('dialog', { name: 'Menu' });
  /** The bar's chip — the one outside the drawer — from 768px. */
  const barChip = () => within(document.querySelector('aside')!).getByRole('button', { name: /Rina Wijaya/ });
  /** The bar's avatar below 768px (P18.95-T12): the chip and the bell in one, named for both. */
  const avatar = () => within(document.querySelector('aside')!).getByRole('button', { name: /^Account and notifications/ });
  /** What a nav says, in order: each group's heading and each item's name. */
  const navWords = (nav: HTMLElement) => Array.from(nav.querySelectorAll('[aria-controls^="nav-group"], a'))
    .map((el) => (el.textContent ?? '').trim());

  it('P18.95-T2 AC-1 puts ☰ in the bar, named Open menu, a 44px target before the brand, below 768px only', () => {
    renderPhoneShell();
    const button = burger();
    // Hidden from 768px by its class, so the phone's first paint has it and nothing wider ever does.
    expect(button).toHaveClass('md:hidden');
    expect(button).toHaveClass('h-11', 'w-11');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    // Before the brand: the first thing in the bar, ahead of the mark.
    const aside = document.querySelector('aside')!;
    expect(aside.firstElementChild).toBe(button);
    const mark = aside.querySelector('svg[viewBox="0 0 26 26"]')!;
    expect(button.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No nav on the bar until it opens, and no rail toggle: there is no sidebar here to collapse.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /the sidebar/ })).not.toBeInTheDocument();
    expect(drawer()).not.toBeInTheDocument();
  });

  it('P18.95-T2 AC-2 opens the sidebar’s own nav from the left: the same groups, order, labels, badges and current page', async () => {
    // The sidebar first, at a desktop's width, to compare against.
    const { width } = renderPhoneShell(1280);
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const sidebarWords = navWords(sidebar);
    const sidebarMarkup = sidebar.innerHTML;

    width.resize(375);
    await userEvent.click(burger());
    const open = drawer()!;
    expect(burger()).toHaveAttribute('aria-expanded', 'true');
    expect(burger()).toHaveAttribute('aria-controls', open.id);
    // From the left, the sidebar's width and never more than most of the screen.
    expect(open).toHaveClass('fixed', 'left-0', 'inset-y-0', 'w-sidebar', 'max-w-[85vw]', 'bg-navy');

    const nav = within(open).getByRole('navigation', { name: 'Main' });
    // One `NavGroups` draws both, so the drawer's nav is the sidebar's, to the attribute.
    expect(nav.innerHTML).toBe(sidebarMarkup);
    expect(navWords(nav)).toEqual(sidebarWords);
    expect(navWords(nav)).toEqual(['Overview', 'Personal tools', 'Activity management', 'Leads management3', 'Reporting', 'Advanced analyticsUpcoming']);
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Leads management/ })).toHaveAttribute('href', '/leads');
    expect(within(nav).getAllByRole('separator')).toHaveLength(2);
    expect(within(nav).getByText('Advanced analytics').closest('a')).toHaveAttribute('aria-disabled');
    // The brand above it, with the app's tag, as the sidebar's.
    expect(within(open).getByText('KPM OWNER')).toBeInTheDocument();
    // One nav at a time: the bar holds none.
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('P18.95-T2 AC-2 keeps the sidebar’s foot at the bottom: who is signed in, and their menu opening upward', async () => {
    renderPhoneShell();
    await userEvent.click(burger());
    const open = drawer()!;
    const foot = within(open).getByRole('button', { name: /Rina Wijaya/ });
    expect(foot).toHaveTextContent('Agent · KPM 0417');
    expect(foot).toHaveAttribute('aria-controls', 'phone-menu-account');
    expect(within(open).getByRole('navigation').compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The notices are the bar's avatar's (P18.95-T12), which a phone always shows, and are not drawn twice.
    expect(within(open).queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(within(open).queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();

    await userEvent.click(foot);
    const panel = document.getElementById('phone-menu-account')!;
    expect(open).toContainElement(panel);
    expect(panel).toHaveClass('bottom-full');
    expect(within(panel).getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    expect(within(panel).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('P18.95-T2 AC-2 lets a group close inside it without closing the drawer, and the sidebar remembers it', async () => {
    const { width } = renderPhoneShell();
    await userEvent.click(burger());
    await userEvent.click(within(drawer()!).getByRole('button', { name: /Personal tools/ }));
    expect(drawer()).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Leads management/ })).not.toBeInTheDocument();

    // One state for both: the sidebar, wider, has the group closed as the reader left it.
    width.resize(1024);
    expect(screen.getByRole('button', { name: /Personal tools/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('P18.95-T2 AC-2 navigates and closes when an item is chosen, so it is not left open over the next screen', async () => {
    // jsdom cannot navigate, and the navigation is next/link's: the href is where it goes, and the click
    // is what closes the drawer.
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    try {
      renderPhoneShell();
      await userEvent.click(burger());
      const leads = within(drawer()!).getByRole('link', { name: /Leads management/ });
      expect(leads).toHaveAttribute('href', '/leads');
      await userEvent.click(leads);
      expect(drawer()).toBeNull();
      expect(burger()).toHaveFocus();

      // *Your account*, from the foot's menu, closes it too.
      await userEvent.click(burger());
      await userEvent.click(within(drawer()!).getByRole('button', { name: /Rina Wijaya/ }));
      await userEvent.click(within(drawer()!).getByRole('link', { name: 'Your account' }));
      expect(drawer()).toBeNull();

      // An upcoming item goes nowhere, and leaves the drawer open.
      await userEvent.click(burger());
      await userEvent.click(within(drawer()!).getByText('Advanced analytics'));
      expect(drawer()).not.toBeNull();
    } finally {
      document.removeEventListener('click', swallow);
    }
  });

  it('P18.95-T2 AC-2 closes when the route moves under it — Back, or any other way the page changes', async () => {
    const { rerender } = renderPhoneShell();
    await userEvent.click(burger());
    expect(drawer()).not.toBeNull();

    route.path = '/leads';
    rerender(shell());
    expect(drawer()).toBeNull();
  });

  it('P18.95-T2 AC-3 is a modal dialog: focus moves to its ✕ and goes round inside it both ways', async () => {
    renderPhoneShell();
    await userEvent.click(burger());
    const open = drawer()!;
    expect(open).toHaveAttribute('aria-modal', 'true');
    const close = within(open).getByRole('button', { name: 'Close menu' });
    expect(close).toHaveFocus();
    // A 44px target, as every target on a phone.
    expect(close).toHaveClass('h-11', 'w-11');

    const foot = within(open).getByRole('button', { name: /Rina Wijaya/ });
    // Shift+Tab from the first goes round to the last — the foot's chip — and Tab from it back to ✕.
    await userEvent.tab({ shift: true });
    expect(foot).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    // In between, Tab walks the drawer in order: ✕, the first item, the next group.
    await userEvent.tab();
    expect(within(open).getByRole('link', { name: 'Overview' })).toHaveFocus();
    await userEvent.tab();
    expect(within(open).getByRole('button', { name: /Personal tools/ })).toHaveFocus();
  });

  it('P18.95-T2 AC-3 closes on Escape and puts focus back on ☰', async () => {
    renderPhoneShell();
    await userEvent.click(burger());
    await userEvent.keyboard('{Escape}');
    expect(drawer()).toBeNull();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(burger()).toHaveFocus();
  });

  it('P18.95-T2 AC-3 closes on its ✕ and on the scrim, focus back on ☰ each time', async () => {
    renderPhoneShell();
    await userEvent.click(burger());
    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(drawer()).toBeNull();
    expect(burger()).toHaveFocus();

    await userEvent.click(burger());
    const scrim = document.querySelector('[data-scrim]')!;
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(scrim);
    expect(drawer()).toBeNull();
    expect(burger()).toHaveFocus();
    expect(document.querySelector('[data-scrim]')).toBeNull();
  });

  it('P18.95-T2 AC-3 shuts the foot’s account menu first on Escape, and the drawer on the next', async () => {
    renderPhoneShell();
    await userEvent.click(burger());
    const foot = within(drawer()!).getByRole('button', { name: /Rina Wijaya/ });
    await userEvent.click(foot);
    await userEvent.keyboard('{Escape}');
    expect(document.getElementById('phone-menu-account')).toBeNull();
    expect(drawer()).not.toBeNull();
    expect(foot).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(drawer()).toBeNull();
    expect(burger()).toHaveFocus();
  });

  it('P18.95-T2 AC-3 holds the page behind still while it is open, and gives it back as it was', async () => {
    renderPhoneShell();
    document.body.style.overflow = 'auto';
    await userEvent.click(burger());
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('P18.95-T2 AC-3 has no axe violations while it is open', async () => {
    const { container } = renderPhoneShell();
    await userEvent.click(burger());
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toHaveLength(0);
  });

  it('P18.95-T2 AC-4, P18.95-T12 AC-3 leaves the bar’s menu the account’s items — no nav — below the bar, after the notices', async () => {
    renderPhoneShell(360, {
      account: { href: '/profile', onSignOut: vi.fn(), viewSwitch: { href: '/unit/dashboard', label: 'Open agent view' } },
    });
    await userEvent.click(avatar());
    const panel = document.getElementById('sidebar-user-actions')!;
    // Below the bar, across it, as before (ADR-0085).
    expect(panel).toHaveClass('top-full', 'inset-x-0');
    expect(within(panel).queryByRole('navigation')).not.toBeInTheDocument();
    // *Notifications* first since P18.95-T12, its pill reading the count; then the account's items as before.
    expect(within(panel).getAllByRole('link').map((a) => a.textContent)).toEqual(['Notifications2', 'Open agent view', 'Your account']);
    expect(within(panel).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(panel).getByText('rina@kpm0417.test')).toBeInTheDocument();
    // Focus into it, and held there, as before.
    expect(within(panel).getByRole('link', { name: 'Notifications, 2 unread' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(avatar()).toHaveFocus();
  });

  it('P18.95-T2 AC-4 signs out from the bar’s menu', async () => {
    const { onSignOut } = renderPhoneShell();
    await userEvent.click(avatar());
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('P18.95-T2 AC-1 opens no drawer at 768px: the sidebar holds the nav, the chip opens its panel upward', async () => {
    renderPhoneShell(768);
    // ☰ is in the markup and hidden by its class from 768px; pressing it there opens nothing.
    expect(burger()).toHaveClass('md:hidden');
    await userEvent.click(burger());
    expect(drawer()).toBeNull();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');

    const sidebarNav = screen.getByRole('navigation', { name: 'Main' });
    expect(sidebarNav).toHaveAttribute('id', 'sidebar-nav');
    expect(sidebarNav).toHaveClass('hidden', 'md:block');
    // The sidebar's own nav, as the rail since P18.97-T6 AC-1: a tablet opens on it (UI-033).
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();

    await userEvent.click(barChip());
    const open = document.getElementById('sidebar-user-actions')!;
    expect(within(open).queryByRole('navigation')).not.toBeInTheDocument();
    expect(open.className).toContain('bottom-full');
    expect(open.className).not.toContain('top-full');
    // Focus stays on the chip, as the desktop disclosure always has: Tab reaches the two items.
    expect(barChip()).toHaveFocus();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('P18.95-T2 AC-1 draws the sidebar at 1280px exactly as it was drawn before ☰', () => {
    renderPhoneShell(1280);
    const aside = document.querySelector('aside')!;
    // The bar's classes, unchanged, and every element after ☰ the sidebar's own.
    expect(aside.className).toBe(
      'sticky top-0 z-10 flex w-full shrink-0 flex-row items-center bg-navy px-4 py-3.5 text-sidebar-text print:hidden '
      + 'md:h-screen md:flex-col md:items-stretch md:py-5 md:w-sidebar',
    );
    const [first, brand, nav, foot] = Array.from(aside.children);
    expect(first).toBe(burger());
    expect(brand.className).toBe('flex items-center gap-2 px-1 md:mb-3 md:border-b md:border-white/10 md:pb-4');
    expect(within(brand as HTMLElement).getByText('AgencyBoost').className)
      .toBe('font-display text-lg font-extrabold leading-tight tracking-tight text-white');
    expect(nav).toBe(screen.getByRole('navigation', { name: 'Main' }));
    expect(foot.className).toContain('md:border-t');
    expect(aside.children).toHaveLength(4);
    expect(drawer()).toBeNull();
  });

  it('P18.95-T2 AC-1 closes the drawer when the width crosses 768px, and the sidebar has the nav again', async () => {
    const { width } = renderPhoneShell(375);
    await userEvent.click(burger());
    expect(drawer()).not.toBeNull();

    width.resize(1024);
    expect(drawer()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveAttribute('id', 'sidebar-nav');
    expect(document.body.style.overflow).toBe('');

    // Back on a phone it waits for ☰ again rather than reopening on its own.
    width.resize(375);
    expect(drawer()).toBeNull();
  });

  it('P11-T6 AC-11, P18.95-T12 AC-4 keeps the phone’s bar and drawer whole, whatever rail a wider window remembered', async () => {
    window.localStorage.setItem('ab.sidebar.rail', '1');
    atWidth(360);
    render(shell());
    // The bar's avatar opens the phone's menu below the bar, never the rail's narrow one above it.
    await userEvent.click(avatar());
    expect(document.getElementById('sidebar-user-actions')).toHaveClass('top-full');
    expect(document.getElementById('sidebar-user-actions')).not.toHaveClass('w-48');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(burger());
    // The drawer's foot is the whole chip: the name and the profile line.
    expect(within(within(drawer()!).getByRole('button', { name: /Rina Wijaya/ })).getByText('Rina Wijaya')).toBeInTheDocument();
    // The rail is a desktop control: the drawer's groups keep their headings and their words.
    expect(within(drawer()!).getByRole('button', { name: /Personal tools/ })).toBeInTheDocument();
    expect(within(drawer()!).getByText('Activity management')).toBeInTheDocument();
    window.localStorage.clear();
  });

  /*
   * At 360×800 the Super Admin's bar ran 23px past the screen and clipped the bell: *AgencyBoost
   * SUPERADMIN* beside a chip that would not give way, because its row was `shrink-0` (the 2026-10-02
   * walk, `superadmin-360-panel.png`). jsdom lays nothing out, so this pins the classes that let the
   * row take what the brand leaves and the chip's name truncate inside it, below 768px only.
   */
  it('P11-T6 AC-11, P18.95-T12 AC-1 fits the Super Admin’s bar at 360px: the avatar alone, at the bar’s right edge', () => {
    atWidth(360);
    window.localStorage.clear();
    render(
      <AppShell
        sections={SECTIONS}
        brandTag="SUPERADMIN"
        user={{ name: 'Platform Operator', role: 'Superadmin', initials: 'PO' }}
        account={{ href: '/profile', onSignOut: vi.fn() }}
        notifications={{ href: '/notifications', unread: 3 }}
      >
        <p>content</p>
      </AppShell>,
    );
    const bar = document.querySelector('aside')!;
    // Nothing on the bar to cut: no name, no role, no bell beside the brand.
    expect(within(bar).queryByText('Platform Operator')).not.toBeInTheDocument();
    expect(within(bar).queryByText('Superadmin')).not.toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    const trigger = within(bar).getByRole('button', { name: 'Account and notifications, 3 unread' });
    const row = trigger.parentElement!.parentElement!;
    // The row still gives way below 768px, and holds in the sidebar from it; the 44px avatar never shrinks.
    expect(row.classList).toContain('min-w-0');
    expect(row.classList).toContain('shrink');
    expect(row.classList).toContain('ml-auto');
    expect(row.classList).toContain('md:shrink-0');
    expect(trigger.parentElement!.classList).toContain('shrink-0');
    expect(trigger.className).toContain('shrink-0');
    expect(bar.lastElementChild).toBe(row);
  });

  it('P11-T6 AC-11 keeps the Super Admin’s sidebar foot from 768px: the chip gives way, the bell stays whole', () => {
    atWidth(1280);
    window.localStorage.clear();
    render(
      <AppShell
        sections={SECTIONS}
        brandTag="SUPERADMIN"
        user={{ name: 'Platform Operator', role: 'Superadmin', initials: 'PO' }}
        account={{ href: '/profile', onSignOut: vi.fn() }}
        notifications={{ href: '/notifications', unread: 3 }}
      >
        <p>content</p>
      </AppShell>,
    );
    const bell = screen.getByRole('button', { name: 'Notifications, 3 unread' });
    const box = bell.parentElement!;
    const row = box.parentElement!;
    // The row shrinks below its contents' width on the bar, and holds in the sidebar from 768px.
    expect(row.classList).toContain('min-w-0');
    expect(row.classList).toContain('shrink');
    expect(row.classList).not.toContain('shrink-0');
    expect(row.classList).toContain('md:shrink-0');
    // The chip takes the space and truncates its words; the bell keeps its size.
    const chipBox = row.firstElementChild!;
    expect(chipBox.classList).toContain('min-w-0');
    expect(chipBox.classList).toContain('flex-1');
    expect(within(chipBox as HTMLElement).getByText('Platform Operator').className).toContain('truncate');
    expect(within(chipBox as HTMLElement).getByText('Superadmin').className).toContain('truncate');
    expect(bell.className).toContain('shrink-0');
    expect(box.className).toContain('shrink-0');
    expect(row.lastElementChild).toBe(box);
  });
});

/**
 * **The phone's bar: the avatar holds the account and the notices** (P18.95-T12, the product owner's request of
 * 2026-10-27, on a screenshot of the bar with *Wilson T…*, the profile line cut and the bell beside it). Below 768px
 * the bar is ☰, the brand and the avatar alone; the avatar wears the bell's badge and opens one menu: who is signed
 * in, *Notifications*, then the account's items. 768px and wider are as they were, to the byte.
 */
describe('below 768px, the avatar holds the account and the notices (P18.95-T12)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/admin';
  });

  const LINE = 'AB · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih';
  function phoneBar(px = 375, over: Partial<React.ComponentProps<typeof AppShell>> = {}) {
    window.localStorage.clear();
    const width = atWidth(px);
    const result = render(
      <AppShell
        sections={SECTIONS}
        user={{ name: 'Wilson', fullName: 'Wilson Tanoto', role: LINE, initials: 'WT', email: 'wilson@kpm0417.test' }}
        account={{ href: '/profile', onSignOut: vi.fn(), viewSwitch: { href: '/kpm/overview', label: 'Open Owner view' } }}
        notifications={{ href: '/notifications', unread: 3 }}
        brandTag="KPM OWNER"
        title="Log Activity"
        {...over}
      >
        <p>content</p>
      </AppShell>,
    );
    return { ...result, width };
  }
  const bar = () => document.querySelector('aside')!;
  const avatar = () => within(bar()).getByRole('button', { name: /^Account and notifications/ });
  const panel = () => document.getElementById('sidebar-user-actions');

  it('P18.95-T12 AC-1 holds ☰, the brand and, at its right edge, the avatar alone: no name, no profile line, no bell', () => {
    phoneBar();
    const [burger, brand, foot] = Array.from(bar().children);
    expect(bar().children).toHaveLength(3);
    expect(burger).toBe(screen.getByRole('button', { name: 'Open menu' }));
    expect(within(brand as HTMLElement).getByText('AgencyBoost')).toBeInTheDocument();
    // The foot is one control, pushed to the bar's end.
    expect(foot).toHaveClass('ml-auto');
    expect(within(foot as HTMLElement).getAllByRole('button')).toEqual([avatar()]);
    expect(avatar()).toHaveClass('h-11', 'w-11');
    expect(within(avatar()).getByText('WT')).toHaveClass('h-8', 'w-8', 'rounded-full', 'bg-amber', 'text-navy');
    // Nothing else of the chip or the bell on the bar.
    for (const words of ['Wilson', 'Wilson Tanoto', LINE, 'wilson@kpm0417.test']) {
      expect(within(bar()).queryByText(words)).not.toBeInTheDocument();
    }
    expect(within(bar()).queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    expect(within(bar()).queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P18.95-T12 AC-2 wears the bell’s own badge, as the bell drew it, and says the count in its name', () => {
    const { width } = phoneBar(1280);
    const bell = screen.getByRole('button', { name: 'Notifications, 3 unread' });
    const drawn = within(bell).getByText('3').outerHTML;

    width.resize(375);
    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    const trigger = within(bar()).getByRole('button', { name: 'Account and notifications, 3 unread' });
    expect(within(trigger).getByText('3').outerHTML).toBe(drawn);
    // Placed against the avatar's box, as the bell's against its own: on the circle's corner.
    expect(trigger).toHaveClass('relative');
  });

  it.each([
    [1, '1', 'Account and notifications, 1 unread'],
    [9, '9', 'Account and notifications, 9 unread'],
    [10, '9+', 'Account and notifications, 10 unread'],
    [42, '9+', 'Account and notifications, 42 unread'],
  ])('P18.95-T12 AC-2 at %i unread reads %s on the avatar, and the exact count in its name', (unread, badge, name) => {
    phoneBar(375, { notifications: { href: '/notifications', unread } });
    const trigger = within(bar()).getByRole('button', { name });
    expect(within(trigger).getByText(badge)).toHaveAttribute('aria-hidden', 'true');
  });

  it('P18.95-T12 AC-2 wears no badge with nothing unread, and is named for what it opens', () => {
    phoneBar(375, { notifications: { href: '/notifications', unread: 0 } });
    const trigger = within(bar()).getByRole('button', { name: 'Account and notifications' });
    expect(trigger).toHaveTextContent(/^WT$/);
  });

  it('P18.95-T12 AC-3 opens one menu: the full name, the profile line and the email, then Notifications with its count, then the account’s items', async () => {
    phoneBar();
    await userEvent.click(avatar());
    const open = panel()!;
    // Below the bar, at its full width (ADR-0085), and in the reading order the eye has.
    expect(open).toHaveClass('absolute', 'inset-x-0', 'top-full');
    const lines = Array.from(open.querySelectorAll('p, a, button')).map((el) => el.textContent);
    expect(lines).toEqual(['Wilson Tanoto', LINE, 'wilson@kpm0417.test', 'Notifications3', 'Open Owner view', 'Your account', 'Sign out']);
    expect(within(open).getByText(LINE)).not.toHaveClass('truncate');
    const notices = within(open).getByRole('link', { name: 'Notifications, 3 unread' });
    expect(notices).toHaveAttribute('href', '/notifications');
    // 44px rows, every one.
    for (const row of [...within(open).getAllByRole('link'), within(open).getByRole('button', { name: 'Sign out' })]) {
      expect(row).toHaveClass('max-md:min-h-11', 'items-center');
    }
  });

  it('P18.95-T12 AC-3 goes to /notifications from Notifications and closes, so it is not left open over the inbox', async () => {
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    try {
      phoneBar();
      await userEvent.click(avatar());
      const notices = within(panel()!).getByRole('link', { name: 'Notifications, 3 unread' });
      expect(notices).toHaveAttribute('href', '/notifications');
      await userEvent.click(notices);
      expect(panel()).toBeNull();
      expect(avatar()).toHaveAttribute('aria-expanded', 'false');
    } finally {
      document.removeEventListener('click', swallow);
    }
  });

  it('P18.95-T12 AC-4 keeps the house menu’s keyboard: focus in, round both ways, Escape back to the avatar', async () => {
    phoneBar();
    const trigger = avatar();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'sidebar-user-actions');
    // A disclosure, as the chip has always been (*The account menu*): no popup role it does not implement.
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).toHaveAttribute('id', trigger.getAttribute('aria-controls'));

    const notices = within(panel()!).getByRole('link', { name: 'Notifications, 3 unread' });
    expect(notices).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(within(panel()!).getByRole('button', { name: 'Sign out' })).toHaveFocus();
    await userEvent.tab();
    expect(notices).toHaveFocus();
    await userEvent.tab();
    expect(within(panel()!).getByRole('link', { name: 'Open Owner view' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(avatar()).toHaveFocus();
  });

  it('P18.95-T12 AC-4 leaves the drawer’s foot as it was: the whole chip, opening upward, with no notices in it', async () => {
    phoneBar();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    const foot = within(drawer).getByRole('button', { name: /Wilson/ });
    expect(foot).toHaveTextContent(`WTWilson${LINE}▴`);
    expect(foot).toHaveAttribute('aria-controls', 'phone-menu-account');
    await userEvent.click(foot);
    const footPanel = document.getElementById('phone-menu-account')!;
    expect(footPanel).toHaveClass('bottom-full');
    expect(within(footPanel).getAllByRole('link').map((a) => a.textContent)).toEqual(['Open Owner view', 'Your account']);
    expect(within(footPanel).getByText('wilson@kpm0417.test')).toHaveClass('truncate');
  });

  it('P18.95-T12 AC-4 leaves the shell with no account as it was on a phone: the plain label, and the bell beside it', () => {
    phoneBar(375, { account: undefined });
    expect(within(bar()).queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
    expect(within(bar()).getByText('Wilson')).toBeInTheDocument();
    expect(within(bar()).getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('P18.95-T12 AC-4 has no axe violations with the avatar’s menu open', async () => {
    const { container } = phoneBar();
    await userEvent.click(avatar());
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toHaveLength(0);
  });

  it('P18.95-T12 AC-5 gives the chip and the bell back when the width crosses 768px', () => {
    const { width } = phoneBar(375);
    expect(within(bar()).queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    width.resize(1024);
    expect(within(bar()).getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(within(bar()).getByRole('button', { name: /Wilson/ })).toHaveTextContent(`WTWilson${LINE}▴`);
    expect(within(bar()).queryByRole('button', { name: /^Account and notifications/ })).not.toBeInTheDocument();
    width.resize(375);
    expect(avatar()).toBeInTheDocument();
  });

  /*
   * **768px and wider, to the byte.** The bar's markup, closed and with the chip's menu open, digested as it was
   * rendered before P18.95-T12 (captured 2026-10-27 from this fixture on the T11 build) — React's generated ids
   * aside, which follow render order. The fixture passes `fullName` and the notices, which the desktop chip must not
   * read. A change here is a change to the tablet and the desktop the client has not reviewed (ADR-0167 §12): if it
   * is meant, it is registered, and the digests are taken again.
   *
   * *Retaken 2026-10-28 (P18.97-T6 AC-1, AC-5; parity I-522):* **768px changed, and 1280px did not.** The client has
   * reviewed the tablet (UI-033), and from 768 to 1023px the sidebar opens on the rail: the 56px column, the mark
   * with the toggle under it reading *Expand the sidebar*, the glyphs named by their labels, and the bell above the
   * avatar — the rail as a desktop has drawn it since 2026-09-24, nothing else (the next case proves the two equal).
   * `T6_TABLET` is that markup, captured from this fixture on the T6 build; `BEFORE_T12` still holds at 1280px, so the
   * desktop is unchanged to the byte.
   */
  const BEFORE_T12 = {
    closed: '13fbabe71d23dac7ac3706efde8438f7f798afccf4346825e4425c086264084f',
    open: '78d55ee46f5b85e26a69379d471747902b9fd8c4fe8a20387eee2628dfa613c9',
  };
  const T6_TABLET = {
    closed: '509090f496b8db38735646d96a6fe98c68ed28025d594baaebeb1dd9bbe7b0ad',
    open: '1dafc10cde45fd6282eaabc68f287281fa646c458048dd1335192f285b7cc255',
  };
  const DIGESTS = { 768: T6_TABLET, 1280: BEFORE_T12 } as const;
  const digest = (html: string) => createHash('sha256').update(html.replace(/_r_[0-9a-z]+_/g, '_id_')).digest('hex');

  it.each([768, 1280] as const)('P18.95-T12 AC-5, P18.97-T6 AC-5 draws the bar at %ipx to its recorded digest: the bell says how many, the chip who', async (px) => {
    window.localStorage.clear();
    atWidth(px);
    render(
      <AppShell
        sections={[{ label: 'Personal tools', items: [{ label: 'Leads management', href: '/leads', icon: 'funnel' }] }]}
        user={{ name: 'Rina Wijaya', fullName: 'Rina Wijaya Kusuma', role: LINE, initials: 'RW', email: 'rina@kpm0417.test' }}
        account={{ href: '/profile', onSignOut: vi.fn(), viewSwitch: { href: '/kpm/overview', label: 'Open Owner view' } }}
        notifications={{ href: '/notifications', unread: 12 }}
        brandTag="KPM OWNER"
      >
        <p>content</p>
      </AppShell>,
    );
    expect(digest(bar().outerHTML)).toBe(DIGESTS[px].closed);
    // The chip says who — by its words from 1024px, by its name in the rail — and the bell says how many.
    expect(within(bar()).getByRole('button', { name: 'Notifications, 12 unread' })).toBeInTheDocument();
    expect(within(bar()).queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
    expect(within(bar()).getByRole('button', { name: px === 768 ? 'Expand the sidebar' : 'Collapse the sidebar' }))
      .toBeInTheDocument();

    await userEvent.click(within(bar()).getByRole('button', { name: /Rina Wijaya/ }));
    expect(digest(bar().outerHTML)).toBe(DIGESTS[px].open);
    expect(within(panel()!).queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
  });
});

/**
 * **A tablet opens on the rail** (P18.97-T6 AC-1, ADR-0178 §1; the client's KPM Owner review of 2026-10-27, UI-033:
 * at 768px the sidebar took 252px and left the page 501). From 768 to 1023px the sidebar is the icon rail by
 * default, and opening it full is remembered for that range on its own (`ab.sidebar.rail.tablet`); from 1024px the
 * sidebar and its remembered choice (`ab.sidebar.rail`) are as they were; below 768px the ☰ drawer is unchanged.
 */
describe('P18.97-T6 AC-1 a tablet opens on the rail, and remembers opening it full on its own', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  const TABLET_KEY = 'ab.sidebar.rail.tablet';
  const DESK_KEY = 'ab.sidebar.rail';

  const shell = () => (
    <AppShell
      sections={SECTIONS}
      user={USER}
      account={{ href: '/profile', onSignOut: vi.fn() }}
      notifications={{ href: '/notifications', unread: 2 }}
      brandTag="KPM OWNER"
      title="Log Activity"
    >
      <p>content</p>
    </AppShell>
  );
  /** The shell at a width, with whatever a reader's browser already remembers. */
  function at(px: number, stored: Record<string, string> = {}) {
    window.localStorage.clear();
    for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value);
    const width = atWidth(px);
    return { ...render(shell()), width };
  }
  const aside = () => document.querySelector('aside')!;
  const toggle = () => screen.getByRole('button', { name: /^(Expand|Collapse) the sidebar$/ });
  /** Which the sidebar is: the rail, or full. */
  const drawn = () => (toggle().getAttribute('aria-label') === 'Expand the sidebar' ? 'rail' : 'full');
  const stored = () => ({ tablet: window.localStorage.getItem(TABLET_KEY), desk: window.localStorage.getItem(DESK_KEY) });
  const withoutIds = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_id_');

  it.each([768, 1023])('P18.97-T6 AC-1 at %ipx opens on the rail: a glyph per item, its name and its tooltip', (px) => {
    at(px);
    expect(drawn()).toBe('rail');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAttribute('title', 'Expand the sidebar');
    // The 56px column, by the class that cannot fail to exist, and not the 252px one.
    expect(wears(aside(), px).split(' ')).toContain('w-[var(--sidebar-rail-width)]');
    expect(wears(aside(), px).split(' ')).not.toContain('w-sidebar');
    // Every item is its glyph, named and tipped by its label; the words are not drawn.
    const item = screen.getByRole('link', { name: 'Activity management' });
    expect(item).toHaveAttribute('title', 'Activity management');
    expect(screen.queryByText('Activity management')).toBeNull();
    expect(screen.getByTitle('Advanced analytics — Upcoming')).toBeInTheDocument();
    // The groups flatten: no heading to click, so nothing behind one.
    expect(screen.queryByRole('button', { name: /Personal tools/ })).toBeNull();
    // The mark stays and the wordmark goes; the bell stands above the avatar.
    expect(wears(screen.getByText('AgencyBoost'), px).split(' ')).toContain('hidden');
    const bell = screen.getByRole('button', { name: 'Notifications, 2 unread' });
    const chip = screen.getByRole('button', { name: 'Rina Wijaya — Agent · KPM 0417' });
    expect(bell.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing is written by arriving.
    expect(stored()).toEqual({ tablet: null, desk: null });
  });

  /*
   * *Found by axe on the tablet's rail* (parity F-253): the first run of axe with the rail drawn. An *Upcoming* item
   * has no `href`, so no role, and carried its name in `aria-label`, which ARIA allows on no element without a role;
   * and a count rode the glyph as a dot and was in no name, where this file's comments and the design doc said it
   * was. Both were true of the desktop's rail since 2026-09-24; a tablet now opens on it.
   */
  const EVERY_KIND: readonly NavSection[] = [
    { label: null, divider: true, items: [{ label: 'Overview', href: '/admin', icon: 'gauge', active: true }] },
    {
      label: 'Reporting',
      items: [
        { label: 'Leaders past the limit', href: '/admin/leader-limit-requests', icon: 'users', badge: 2 },
        { label: 'Your 90-day activation', href: '/activation', icon: 'clipboard', done: true },
        { label: 'Advanced analytics', href: '/kpm/advanced-analytics', icon: 'chartUp', upcoming: true },
      ],
    },
  ];

  it('P18.97-T6 F-253 an Upcoming item in the rail says its name in words, with its tooltip, and no aria-label', () => {
    atWidth(768);
    render(<AppShell sections={EVERY_KIND} user={USER} upcomingLabel="Upcoming"><p>content</p></AppShell>);
    const item = screen.getByTitle('Advanced analytics — Upcoming');
    expect(item.tagName).toBe('A');
    expect(item).not.toHaveAttribute('href');
    expect(item).not.toHaveAttribute('aria-label');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(within(item).getByText('Advanced analytics — Upcoming')).toHaveClass('sr-only');
  });

  it('P18.97-T6 F-253 a count is in a rail item’s name and tooltip — and wider, the row’s words are as they were', () => {
    const width = atWidth(768);
    render(<AppShell sections={EVERY_KIND} user={USER}><p>content</p></AppShell>);
    const counted = screen.getByRole('link', { name: 'Leaders past the limit, 2' });
    expect(counted).toHaveAttribute('title', 'Leaders past the limit, 2');
    // The dot still rides the glyph, for the eye.
    expect(counted.querySelector('.bg-alert')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Your 90-day activation — complete' })).toBeInTheDocument();

    width.resize(1280);
    const wide = screen.getByRole('link', { name: /Leaders past the limit/ });
    expect(wide).not.toHaveAttribute('aria-label');
    expect(wide).toHaveTextContent('Leaders past the limit2');
    expect(screen.getByText('Advanced analytics').closest('a')).not.toHaveAttribute('title');
  });

  it('P18.97-T6 AC-1, F-253 has no axe violations on the rail, with every kind of item in it', async () => {
    atWidth(1023);
    const { container } = render(
      <AppShell
        sections={EVERY_KIND}
        user={USER}
        account={{ href: '/profile', onSignOut: vi.fn() }}
        notifications={{ href: '/notifications', unread: 2 }}
        brandTag="KPM OWNER"
        title="Log Activity"
      >
        <p>content</p>
      </AppShell>,
    );
    expect(drawn()).toBe('rail');
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toHaveLength(0);
  });

  it('P18.97-T6 AC-1 the tablet’s rail is the desktop’s rail, to the attribute', async () => {
    const { unmount } = at(1280);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
    // The toggle keeps the focus the click gave it; the markup is the question here.
    const collapsedOnDesktop = withoutIds(aside().outerHTML);
    unmount();

    at(768);
    expect(withoutIds(aside().outerHTML)).toBe(collapsedOnDesktop);
  });

  it.each([1024, 1280])('P18.97-T6 AC-1 at %ipx opens full, as before', (px) => {
    at(px);
    expect(drawn()).toBe('full');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(wears(aside(), px).split(' ')).toContain('w-sidebar');
    expect(screen.getByRole('button', { name: /Personal tools/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Activity management')).toBeInTheDocument();
  });

  it.each([
    ['nothing remembered', {}],
    ['both sizes remembering the rail', { [TABLET_KEY]: '1', [DESK_KEY]: '1' }],
  ])('P18.97-T6 AC-1 at 767px, with %s, is the phone’s bar: ☰ opens the drawer whole, and there is no rail', async (_case, remembered) => {
    at(767, remembered);
    expect(screen.queryByRole('button', { name: /the sidebar$/ })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('button', { name: /Personal tools/ })).toBeInTheDocument();
    expect(within(menu).getByText('Activity management')).toBeInTheDocument();
  });

  it('P18.97-T6 AC-1 opening it full on a tablet is remembered for a tablet alone, and the desktop keeps its own', async () => {
    const { width, unmount } = at(768);
    await userEvent.click(toggle());
    expect(drawn()).toBe('full');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(stored()).toEqual({ tablet: '0', desk: null });

    // A desktop has its own default, the full sidebar; collapsing it there writes the desktop's choice only.
    width.resize(1024);
    expect(drawn()).toBe('full');
    await userEvent.click(toggle());
    expect(drawn()).toBe('rail');
    expect(stored()).toEqual({ tablet: '0', desk: '1' });

    // Each size shows its own as the width crosses 1024px.
    width.resize(1023);
    expect(drawn()).toBe('full');
    width.resize(1280);
    expect(drawn()).toBe('rail');
    unmount();

    // And after a reload.
    at(900, { [TABLET_KEY]: '0', [DESK_KEY]: '1' });
    expect(drawn()).toBe('full');
  });

  it('P18.97-T6 AC-1 collapsing it again on a tablet is remembered as well', async () => {
    const { unmount } = at(900, { [TABLET_KEY]: '0' });
    expect(drawn()).toBe('full');
    await userEvent.click(toggle());
    expect(drawn()).toBe('rail');
    expect(stored()).toEqual({ tablet: '1', desk: null });
    unmount();
    at(900, { [TABLET_KEY]: '1' });
    expect(drawn()).toBe('rail');
  });

  it.each([
    ['the desktop’s rail and the tablet’s full sidebar', { [DESK_KEY]: '1', [TABLET_KEY]: '0' }, 'rail', 'full'],
    ['the desktop’s full sidebar and the tablet’s rail', { [DESK_KEY]: '0', [TABLET_KEY]: '1' }, 'full', 'rail'],
    ['the desktop’s rail, and nothing for a tablet', { [DESK_KEY]: '1' }, 'rail', 'rail'],
    ['the tablet’s full sidebar, and nothing for a desktop', { [TABLET_KEY]: '0' }, 'full', 'full'],
  ] as const)('P18.97-T6 AC-1 keeps the two choices apart — %s', (_case, remembered, desk, tablet) => {
    const { width } = at(1280, remembered);
    expect(drawn()).toBe(desk);
    width.resize(768);
    expect(drawn()).toBe(tablet);
    width.resize(1023);
    expect(drawn()).toBe(tablet);
    width.resize(1024);
    expect(drawn()).toBe(desk);
    // Crossing the line reads the choices; it never writes one.
    const kept: Record<string, string> = remembered;
    expect(stored()).toEqual({ tablet: kept[TABLET_KEY] ?? null, desk: kept[DESK_KEY] ?? null });
  });

  it('P18.97-T6 AC-1 with storage refused, each size keeps its default, and the toggle still works for the visit', async () => {
    const refuse = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    const width = atWidth(768);
    const { unmount } = render(shell());
    expect(drawn()).toBe('rail');

    await userEvent.click(toggle());
    expect(drawn()).toBe('full');
    width.resize(1024);
    expect(drawn()).toBe('full');
    await userEvent.click(toggle());
    expect(drawn()).toBe('rail');
    width.resize(768);
    expect(drawn()).toBe('full');
    unmount();

    // Nothing could be kept, so a reload is each size's default again.
    render(shell());
    expect(drawn()).toBe('rail');
    width.resize(1024);
    expect(drawn()).toBe('full');
  });

  it('P18.97-T6 AC-1 with no storage at all, a tablet still opens on the rail', () => {
    // A browser with site data blocked throws on the accessor itself, before any key is asked.
    const own = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('The operation is insecure.', 'SecurityError'); },
    });
    try {
      atWidth(800);
      render(shell());
      expect(drawn()).toBe('rail');
    } finally {
      if (own) Object.defineProperty(window, 'localStorage', own);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
  });

  /*
   * **No frame of the wrong sidebar** (AC-1, AC-2). The shell mounts once the session is read, so its first render
   * cannot know the width; it answers before the browser paints. Mounted outside `act`, as a browser mounts it, a
   * microtask queued from the commit that mounts it — which runs before the browser could paint — already reads the
   * rail on a tablet, and each size's remembered choice. An answer in an ordinary effect would still read the full
   * sidebar there: the effect runs in a later task, after a paint.
   */
  it.each([
    [800, {}, 'rail'],
    [800, { [TABLET_KEY]: '0' }, 'full'],
    [1280, {}, 'full'],
    [1280, { [DESK_KEY]: '1' }, 'rail'],
  ] as const)('P18.97-T6 AC-1 at %ipx with %o is drawn %s from the first paint', async (px, remembered, expected) => {
    window.localStorage.clear();
    for (const [key, value] of Object.entries(remembered)) window.localStorage.setItem(key, value);
    atWidth(px);
    const seen: (string | null)[] = [];
    function BeforePaint({ children }: { children: React.ReactNode }) {
      useLayoutEffect(() => {
        queueMicrotask(() => {
          seen.push(document.querySelector('button[aria-controls="sidebar-nav"]')?.getAttribute('aria-label') ?? null);
        });
      }, []);
      return children;
    }
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasAct = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    try {
      root.render(<BeforePaint>{shell()}</BeforePaint>);
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toBe(expected === 'rail' ? 'Expand the sidebar' : 'Collapse the sidebar');
    } finally {
      root.unmount();
      host.remove();
      env.IS_REACT_ACT_ENVIRONMENT = wasAct;
    }
  });
});

describe('PageHeader: the title holds its place (P10.1-T8, client item 1)', () => {
  it('top-aligns the heading row, so an actions slot taller than the title cannot push it down', () => {
    // `Overall.html:839`, the last of four `.topbar` rules and the one that renders, is
    // `align-items:flex-start`. Bottom-aligned, Log's Date block set the line and its title sat
    // ~25px below Dashboard's. jsdom lays nothing out, so the alignment class is what is checked.
    render(
      <PageHeader
        title="Log Activity"
        subtitle="Enter today's activities in 1 minute."
        actions={(
          <div className="flex h-32 flex-col gap-1.5">
            <label>Date<input type="date" /></label>
            <span>Not yet saved</span>
          </div>
        )}
      />,
    );
    const row = screen.getByRole('heading', { name: 'Log Activity', level: 1 })
      .parentElement!.parentElement!;
    expect(row).toContainElement(screen.getByLabelText('Date'));
    expect(row).toHaveClass('items-start');
    expect(row).not.toHaveClass('items-end');
  });
});
