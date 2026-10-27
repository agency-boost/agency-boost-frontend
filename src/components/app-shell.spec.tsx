import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PHONE_QUERY } from '@/lib/use-phone';
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

/**
 * A screen of a given width, as far as the shell can ask: `matchMedia`, which jsdom does not have.
 * `resize` moves the width afterwards and tells whoever is listening, as a phone turned on its side does.
 */
function atWidth(px: number) {
  let width = px;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query,
    get matches() { return query === PHONE_QUERY && width < 768; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })));
  return {
    resize(next: number) {
      width = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

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

  it('P18.95-T2 AC-1 changes nothing at 768px: no drawer, the sidebar holds the nav, the chip opens its panel upward', async () => {
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
    expect(screen.getByRole('button', { name: 'Collapse the sidebar' })).toBeInTheDocument();

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
   */
  const BEFORE_T12 = {
    closed: '13fbabe71d23dac7ac3706efde8438f7f798afccf4346825e4425c086264084f',
    open: '78d55ee46f5b85e26a69379d471747902b9fd8c4fe8a20387eee2628dfa613c9',
  };
  const digest = (html: string) => createHash('sha256').update(html.replace(/_r_[0-9a-z]+_/g, '_id_')).digest('hex');

  it.each([768, 1280])('P18.95-T12 AC-5 draws the bar at %ipx exactly as before: the chip with the name, the bell beside it', async (px) => {
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
    expect(digest(bar().outerHTML)).toBe(BEFORE_T12.closed);
    // Read as before: the chip says who, the bell says how many.
    expect(within(bar()).getByRole('button', { name: 'Notifications, 12 unread' })).toBeInTheDocument();
    expect(within(bar()).queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();

    await userEvent.click(within(bar()).getByRole('button', { name: /Rina Wijaya/ }));
    expect(digest(bar().outerHTML)).toBe(BEFORE_T12.open);
    expect(within(panel()!).queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
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
