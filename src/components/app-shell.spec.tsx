import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fieldChrome } from '@test/shell-fixtures';
import { AppShell, type NavSection } from './app-shell';
import { PageHeader } from './page-header';

// Every test reads `/admin`.
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
    <AppShell field={fieldChrome()} sections={SECTIONS} user={USER} title="Log Activity" subtitle="Enter today's activities in 1 minute.">
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
    // Every group starts open (P19.17-T3 AC-5): `Reporting`'s item is there without a click.
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
    // The sidebar's chip; the title row's avatar draws the same initials since P19.1-T1.
    expect(within(document.querySelector('aside')!).getByText('RW')).toBeInTheDocument();
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
        field={fieldChrome()}
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

  describe('P19.17-T3 AC-5 every group starts open; a group’s name folds it, remembered for the session', () => {
    /*
     * P19.13-T2 (ADR-0252 §4) opened the current page's group alone, because the office menu did not fit its column. The
     * approved sidebar of 19 November draws every group open, and the part above *Pengaturan* scrolls instead (part E;
     * ADR-0269 §5). The name still folds a group, and a folded group stays folded for the tab's session.
     */
    const header = (name: RegExp) => screen.getByRole('button', { name });

    it('P19.17-T3 AC-5 starts with every group open', () => {
      renderShell();

      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();
      expect(screen.getByText('Advanced analytics')).toBeInTheDocument();
      expect(header(/Personal tools/)).toHaveAttribute('aria-expanded', 'true');
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
    });

    it('P19.17-T3 AC-5 draws the same on the server, so the first client render has nothing to reconcile', () => {
      const html = renderToString(
        <AppShell field={fieldChrome()} sections={SECTIONS} user={USER}>
          <p>content</p>
        </AppShell>,
      );

      expect(html.match(/aria-expanded="true" aria-controls="nav-group-/g)).toHaveLength(2);
      expect(html.match(/aria-expanded="false" aria-controls="nav-group-/g)).toBeNull();
    });

    it('P19.17-T3 AC-5 a group’s name is grey capitals with a chevron and no icon; its rows carry their own icons', () => {
      renderShell();
      const name = header(/Personal tools/);
      expect(name).toHaveClass('uppercase', 'text-secondary-muted');
      expect(name.querySelectorAll('svg')).toHaveLength(1);
      expect(name.querySelector('svg')).toHaveAttribute('data-icon', 'ti-chevron-down');
      // Every row has its icon, in the top section's column (part E: *sub-items are no longer indented without icons*).
      const row = screen.getByRole('link', { name: 'Leads management' });
      expect(row.querySelector('svg')).not.toBeNull();
      expect(row.className).not.toMatch(/pl-\[/);
    });

    it('P19.17-T3 AC-5 the extras’ group names carry the orange Owner tag, said with the name', () => {
      window.localStorage.clear();
      render(
        <AppShell field={fieldChrome()} sections={[{ label: 'KPM', tag: 'Owner', items: [{ label: 'Overview', href: '/kpm/overview', icon: 'ti-layout-dashboard' }] }]} user={USER}>
          <p>content</p>
        </AppShell>,
      );
      const name = screen.getByRole('button', { name: 'KPM Owner' });
      expect(name.querySelector('[data-owner-tag]')).toHaveClass('text-primary-on-secondary');
    });

    it('keeps each toggle wired to its own list (AC-2)', () => {
      renderShell();

      for (const name of [/Personal tools/, /Reporting/]) {
        const list = document.getElementById(header(name).getAttribute('aria-controls')!);
        expect(list?.tagName).toBe('UL');
      }
    });

    it('P19.17-T3 AC-5 folding one group folds nothing else', async () => {
      renderShell();

      await userEvent.click(header(/Personal tools/));
      expect(screen.queryByRole('link', { name: 'Activity management' })).toBeNull();
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
    });

    it('P19.17-T3 AC-5 unfolds the group the page moves into', async () => {
      const { rerender } = renderShell();
      await userEvent.click(header(/Reporting/));
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'false');

      // The reader follows a link into Reporting: the layout re-renders with it active.
      const inReporting: readonly NavSection[] = [
        { ...SECTIONS[0], items: SECTIONS[0].items.map((i) => ({ ...i, active: false })) },
        { ...SECTIONS[1], items: [{ label: 'Advanced analytics', href: '/analytics', icon: 'chartUp', active: true }] },
      ];
      rerender(
        <AppShell field={fieldChrome()} sections={inReporting} user={USER}>
          <p>content</p>
        </AppShell>,
      );

      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
      expect(header(/Personal tools/)).toHaveAttribute('aria-expanded', 'true');
    });

    it('P19.17-T3 AC-5 remembers a group the reader folded for the session — across pages and a reload — and forgets it unfolded', async () => {
      window.sessionStorage.clear();
      const { unmount } = renderShell();
      await userEvent.click(header(/Reporting/));
      expect(JSON.parse(window.sessionStorage.getItem('ab.sidebar.closed') ?? '[]')).toEqual(['Reporting']);
      // The rail stays the one preference kept across sessions; the groups are the tab's.
      expect(Object.keys(window.localStorage)).toEqual([]);
      unmount();

      render(
        <AppShell field={fieldChrome()} sections={SECTIONS} user={USER}>
          <p>content</p>
        </AppShell>,
      );
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(header(/Reporting/));
      expect(JSON.parse(window.sessionStorage.getItem('ab.sidebar.closed') ?? '[]')).toEqual([]);
      expect(header(/Reporting/)).toHaveAttribute('aria-expanded', 'true');
      window.sessionStorage.clear();
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

    it('flattens a group with no rail icon in the rail, so nothing is behind a heading that is not there', async () => {
      window.sessionStorage.clear();
      renderShell();
      await userEvent.click(screen.getByRole('button', { name: /Reporting/ }));
      expect(screen.getByRole('button', { name: /Reporting/ })).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      window.sessionStorage.clear();

      // `Reporting` was folded at full width; collapsed, its item is reachable.
      expect(screen.getByRole('link', { name: 'Activity management' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reporting/ })).toBeNull();
      // An upcoming item has no href and so no link role; its name reaches assistive technology in words, and a pointer
      // as the drawn tip (P19.1-T1 AC-4) — every role's rail since P19.2-T1 — and it says it is not ready yet.
      expect(screen.getByText('Advanced analytics — Upcoming')).toHaveClass('sr-only');
    });

    it('P13-T7 AC-5 an item with the amber check keeps saying so in the rail', async () => {
      window.localStorage.clear();
      render(
        <AppShell
        field={fieldChrome()}
          sections={[{ label: 'New agent', items: [{ label: 'Your 90-day activation', href: '/activation', icon: 'clipboard', done: true }] }]}
          user={USER}
          title="x"
        >
          <p>content</p>
        </AppShell>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      const item = screen.getByRole('link', { name: 'Your 90-day activation — complete' });
      // Its name is drawn beside it on hover and focus (P19.1-T1 AC-4), not a `title` shown twice.
      expect(item).not.toHaveAttribute('title');
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

  /*
   * **P19.17-T3 AC-5, AC-6: Pengaturan pinned, and the rail's groups as flyouts** (ADR-0269 §5; part E,
   * `sidebar-icons-laptop`): only the menu above Pengaturan scrolls, with no scrollbar drawn; collapsed, one icon per
   * group opens that group's items beside the rail.
   */
  describe('P19.17-T3 AC-5, AC-6 Pengaturan pinned, and one icon per group on the rail', () => {
    const OWNER_SECTIONS: readonly NavSection[] = [
      { label: null, divider: true, items: [{ label: 'Home', href: '/home', icon: 'ti-home', active: true }] },
      {
        label: 'Saya', railIcon: 'ti-user-circle',
        items: [{ label: 'Leads', href: '/leads', icon: 'ti-address-book' }, { label: 'Goal Setting', href: '/goals', icon: 'ti-target' }],
      },
      {
        label: 'KPM', tag: 'Owner', railIcon: 'ti-building-skyscraper',
        items: [{ label: 'Overview', href: '/kpm/overview', icon: 'ti-layout-dashboard' }],
      },
    ];
    const PINNED = { item: { label: 'Pengaturan', href: '/kpm/settings', icon: 'ti-settings' }, tag: 'Owner' } as const;
    const renderOwner = (sections: readonly NavSection[] = OWNER_SECTIONS) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      return render(
        <AppShell field={fieldChrome()} sections={sections} pinned={PINNED} user={USER}>
          <p>content</p>
        </AppShell>,
      );
    };

    it('P19.17-T3 AC-5 Pengaturan sits under a thin line, outside the part that scrolls, before the account card — in the one nav', () => {
      renderOwner();
      const nav = screen.getByRole('navigation', { name: 'Main' });
      const scroll = nav.querySelector('[data-sidebar-scroll]')!;
      const pinned = nav.querySelector('[data-sidebar-pinned]')!;
      expect(scroll).toHaveClass('overflow-y-auto', '[scrollbar-width:none]');
      expect(scroll.contains(pinned)).toBe(false);
      expect(pinned).toHaveClass('border-t-[1.5px]');
      expect(within(pinned as HTMLElement).getByRole('link', { name: /Pengaturan/ })).toHaveAttribute('href', '/kpm/settings');
      expect(pinned.querySelector('[data-owner-tag]')).toHaveTextContent('Owner');
      // Then the account card, after the nav.
      expect(nav.compareDocumentPosition(document.querySelector('[data-account-card]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('P19.17-T3 AC-5 the current page is a white pill with navy words and a navy icon', () => {
      renderOwner();
      const home = screen.getByRole('link', { name: 'Home' });
      expect(home).toHaveClass('bg-card', 'text-secondary-ink', 'font-bold');
      expect(home.querySelector('svg')!.parentElement).toHaveClass('text-secondary-ink');
      expect(screen.getByRole('link', { name: 'Leads' }).querySelector('svg')!.parentElement).toHaveClass('text-secondary-muted');
    });

    it('P19.17-T3 AC-6 collapsed: the top items, one icon per group named by it, then Pengaturan', async () => {
      renderOwner();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(within(nav).getByRole('button', { name: 'Saya' })).toHaveAttribute('aria-expanded', 'false');
      expect(within(nav).getByRole('button', { name: 'KPM Owner' })).toBeInTheDocument();
      // A group's items are behind its icon until it is opened.
      expect(within(nav).queryByRole('link', { name: 'Leads' })).toBeNull();
      expect(within(nav.querySelector('[data-sidebar-pinned]') as HTMLElement).getByRole('link', { name: 'Pengaturan' })).toBeInTheDocument();
    });

    it('P19.17-T3 AC-6 a group’s icon opens its flyout — its name, tag and items — and Escape closes it, the focus back', async () => {
      renderOwner();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      const kpm = screen.getByRole('button', { name: 'KPM Owner' });
      await userEvent.click(kpm);
      expect(kpm).toHaveAttribute('aria-expanded', 'true');
      const flyout = document.getElementById(kpm.getAttribute('aria-controls')!)!;
      expect(flyout).toHaveAttribute('data-rail-flyout');
      expect(within(flyout).getByText('KPM')).toBeInTheDocument();
      expect(within(flyout).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/kpm/overview');
      expect(within(flyout).getByRole('link', { name: 'Overview' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(kpm).toHaveAttribute('aria-expanded', 'false');
      expect(kpm).toHaveFocus();
    });

    it('P19.17-T3 AC-6 one flyout at a time; a click outside closes it', async () => {
      renderOwner();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      await userEvent.click(screen.getByRole('button', { name: 'Saya' }));
      await userEvent.click(screen.getByRole('button', { name: 'KPM Owner' }));
      expect(screen.getByRole('button', { name: 'Saya' })).toHaveAttribute('aria-expanded', 'false');
      expect(document.querySelectorAll('[data-rail-flyout]')).toHaveLength(1);
      await userEvent.click(screen.getByText('content'));
      expect(document.querySelectorAll('[data-rail-flyout]')).toHaveLength(0);
    });

    it('P19.17-T3 AC-6 a group whose page is current is white on the rail', async () => {
      renderOwner([
        OWNER_SECTIONS[0],
        { ...OWNER_SECTIONS[1], items: [{ label: 'Leads', href: '/leads', icon: 'ti-address-book', active: true }] },
        OWNER_SECTIONS[2],
      ]);
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
      expect(screen.getByRole('button', { name: 'Saya' })).toHaveClass('bg-card', 'text-secondary-ink');
      expect(screen.getByRole('button', { name: 'KPM Owner' })).not.toHaveClass('bg-card');
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
      expect(aside().className.split(' ')).toContain('w-sidebar');

      await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

      expect(aside().className.split(' ')).toContain('w-[var(--sidebar-rail-width)]');
      expect(aside().className.split(' ')).not.toContain('w-sidebar');
    });

    it('keeps the toggle beside the app icon, not above the nav', async () => {
      // A window control belongs on the frame. Its own row under the brand read as the first
      // item in the menu.
      renderShell();
      const toggle = screen.getByRole('button', { name: 'Collapse the sidebar' });
      const brand = document.querySelector('img[data-app-icon]')!;

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
        field={fieldChrome()}
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
        field={fieldChrome()}
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
 * *Removed 2026-11-05 (P19.2-T1; ADR-0197, which ends ADR-0167 §3 and ADR-0178 §1):* three describes pinned the chrome
 * `AppShell` drew without `field` — the consoles' ☰ drawer below 768px (P18.7-T2), the phone bar's avatar holding the
 * account and the notices (P18.7-T12), and the tablet's icon rail remembered on its own from 768 to 1023px (P18.9-T6
 * AC-1). Every role is in the one shell now, and `field` is required: below 1024px the title row, the floating bar and
 * *Lainnya* (`field-shell.spec.tsx`, `shell-views.spec.tsx`); from 1024 to 1279px the 64px rail by default, the
 * Super Admin's labelled sidebar excepted (`field-shell-laptop.spec.tsx`).
 */

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
