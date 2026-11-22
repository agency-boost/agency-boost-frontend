import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/settings-screen';
import { renderWithSession } from '../../test/harness';

/*
 * `PublishBar` reads the API on mount. This suite is about block order, not about what
 * the office has published, so the module is stubbed to a fixed bar rather than wired to
 * a fetch double — a bar that renders nothing would make an order assertion vacuous.
 */
vi.mock('@/components/publish-bar', () => ({
  PublishBar: () => <div data-testid="publish-bar">publish</div>,
}));

/** Where the page is — a settings page under the hub (P19.21-T2), unless a test moves it. */
const at = vi.hoisted(() => ({ path: '/kpm/settings/lead-statuses' as string | null }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => at.path,
}));

const TABS = [
  { label: 'Activity types', href: '/kpm/settings/activity-types' },
  { label: 'Ratio benchmarks', href: '/kpm/settings/ratio-benchmarks' },
];
const SUBTABS = [{ label: 'Sales', href: '#sales' }, { label: 'Recruitment', href: '#recruitment' }];

function renderFull() {
  return renderWithSession(
    <SettingsScreen
      title="Lead statuses"
      subtitle="The stages a lead moves through."
      tabs={TABS}
      activeHref="/kpm/settings/activity-types"
      subtabs={SUBTABS}
      activeSubtab="#sales"
      subtabsLabel="Lead pipeline"
      error={{ code: 'CONFIG_INVALID', message: 'Something was refused', requestId: 'req-1' }}
      bars={<div data-testid="bars">bars</div>}
      toolbar={{ hint: '6 statuses', actions: <button type="button">Show archived</button> }}
    >
      <div data-testid="content">the rows</div>
    </SettingsScreen>,
  );
}

/** Every block this shell places, in the order it must place them. */
function order() {
  const marks = [
    ['header', screen.getByRole('heading', { name: 'Lead statuses' })],
    ['back', screen.getByRole('link', { name: 'Back to Settings' })],
    ['tabs', screen.getByRole('navigation', { name: 'Activity settings' })],
    ['subtabs', screen.getByRole('navigation', { name: 'Lead pipeline' })],
    ['error', screen.getByRole('alert')],
    ['bars', screen.getByTestId('bars')],
    ['toolbar', screen.getByText('6 statuses')],
    ['content', screen.getByTestId('content')],
  ] as const;

  return [...marks]
    .sort(([, a], [, b]) => (
      // eslint-disable-next-line no-bitwise
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map(([name]) => name);
}

describe('SettingsScreen', () => {
  /*
   * The assertion this component exists for.
   *
   * Lead statuses rendered its publish bar *above* its Sales/Recruitment row, so the
   * client read the ladder tabs as belonging to publishing rather than to the screen —
   * reported as "subtab muncul setelah save draft, harusnya subtab dulu baru save draft".
   * Four screens each composed this stack by hand and no two agreed.
   *
   * Asserted as document order rather than as "the tabs are present", because presence is
   * exactly what every one of those screens already had.
   */
  it('lays the blocks out header → back → tabs → subtabs → error → bars → toolbar → content', () => {
    renderFull();

    expect(order()).toEqual([
      'header', 'back', 'tabs', 'subtabs', 'error', 'bars', 'toolbar', 'content',
    ]);
  });

  it('P19.21-T2 AC-3 opens every page under Pengaturan with the way back to the hub', () => {
    renderFull();
    const back = screen.getByRole('link', { name: 'Back to Settings' });
    expect(back).toHaveAttribute('href', '/kpm/settings');
    expect(back).toHaveTextContent('Settings');
  });

  it.each([['/kpm/settings'], ['/admin/companies/c1/template'], [null]])(
    'P19.21-T2 AC-3 draws no way back on %s, which is not a page under the hub', (path) => {
      at.path = path;
      try {
        renderFull();
        expect(screen.queryByRole('link', { name: 'Back to Settings' })).toBeNull();
      } finally {
        at.path = '/kpm/settings/lead-statuses';
      }
    },
  );

  it('names the two tab rows differently, so they are separable landmarks', () => {
    renderFull();

    // Two <nav>s sharing a name is a landmark a screen-reader user cannot tell apart.
    expect(screen.getByRole('navigation', { name: 'Activity settings' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Lead pipeline' })).toBeInTheDocument();
  });

  it('renders subtabs as pills and tabs as an underlined row', () => {
    renderFull();

    // Faithful labels can still collide: on the template screen the group is "Activity
    // types" and so is the first of its halves. Two identical rows read as a bug.
    expect(screen.getByRole('link', { name: 'Activity types' }).className).toContain('border-b-2');
    expect(screen.getByRole('link', { name: 'Sales' }).className).toContain('rounded-full');
  });

  it('omits every optional block, so a screen with one form is not given chrome', () => {
    renderWithSession(
      <SettingsScreen title="Branch info">
        <div data-testid="content">the form</div>
      </SettingsScreen>,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The way back to the hub is the one block every page under it has (P19.21-T2).
    expect(screen.getByRole('link', { name: 'Back to Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('keeps the toolbar hint slot occupied while the count is still loading', () => {
    // `justify-between` with one child pushes it left, so a toolbar whose only control
    // jumps sides when the count arrives is the heading defect in another place.
    renderWithSession(
      <SettingsScreen title="Activity types" toolbar={{ actions: <button type="button">Show archived</button> }}>
        <div />
      </SettingsScreen>,
    );

    // `PageHeader` has a `justify-between` of its own, so the toolbar is found from the
    // control inside it rather than by class.
    const bar = screen.getByRole('button', { name: 'Show archived' })
      .closest('.justify-between');
    expect(bar?.children).toHaveLength(2);
    expect(bar?.firstElementChild).not.toContainElement(
      screen.getByRole('button', { name: 'Show archived' }),
    );
  });
});
