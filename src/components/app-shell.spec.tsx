import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, PageHeader, type NavSection } from './app-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
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
      const bell = container.querySelector('a[aria-label="Notifications"]')!;
      const row = bell.parentElement!;
      const chip = row.firstElementChild!;
      return { row, chip, bell, unmount };
    };

    it.each([['a short name', 'Al'], ['a long one', 'Bambang Wijayakusuma Hartono']])(
      'gives the chip the space, so the bell is last in the row for %s',
      (_label, name) => {
        const { row, chip, bell, unmount } = footerOf(name);

        // The chip absorbs the width; the bell is the final child, pinned to the end.
        expect(chip.className).toContain('flex-1');
        expect(row.lastElementChild).toBe(bell);
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
      const bell = document.querySelector('a[aria-label^="Notifications"]')!;
      return { column: bell.parentElement!, bell };
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
      const { column, bell } = await collapse();

      expect(column.firstElementChild).toBe(bell);
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
