import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, Suspense, use, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import AgentLoading from '@/app/(agent)/loading';
import { useCoachee, useCoacheeNotFound } from '@/components/coaching-person';
import { makeMe, renderInLayout, renderWithSession, routeParams, stubFetch } from '@test/harness';
import CoachingPersonLayout from './layout';

const nav = vi.hoisted(() => ({ pathname: '/coaching/mem-rina/summary', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
}));

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read', 'personal_summary:read', 'goal:read', 'goal:update'],
});

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
};
const NOVI = {
  membershipId: 'mem-novi', name: 'Novi Lestari', pronoun: 'they', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-arief', name: 'Arief Nugroho' }, direct: false, downline: { members: 0, leaders: 0 },
};

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

/** A tab that says whose page it is on, so a spec can see the shell hand the person down. */
function Probe() {
  const coachee = useCoachee();
  return <p>Tab for {coachee.name}</p>;
}

const show = (person: unknown, id = 'mem-rina', status = 200) => {
  const stub = stubFetch({ ...SHELL, '/coaching/coachees/': { status, body: status === 200 ? person : { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
  const view = renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: id })}><Probe /></CoachingPersonLayout>,
    { me: LEADER },
  );
  return { ...stub, ...view };
};

/** The six words coaching's own strings never use (ADR-0084). */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('the person shell (P11-T7)', () => {
  beforeEach(() => {
    nav.pathname = '/coaching/mem-rina/summary';
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T7 AC-1, P18.95-T7 AC-2, UI-031 heads the page with the way back, the avatar, the name as its title, and the rung and unit under it', async () => {
    const { calls } = show(RINA);

    // P18.95-T7 AC-2 (UI-021): the person's name is the page's one title; *Coaching Session* is the tab and the way back.
    const heading = await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Coaching Session' })).not.toBeInTheDocument();
    const back = screen.getByRole('link', { name: '← Back to Coaching Session' });
    expect(back).toHaveAttribute('href', '/coaching');
    // UI-031: below 1024px a 44px ‹ with its words for a screen reader; from 1024px the words on their own line.
    expect(back).toHaveClass('h-11', 'w-11', 'lg:basis-full');
    expect(within(back).getByText('← Back to Coaching Session')).toHaveClass('max-lg:sr-only');
    // UI-031: the line on its own line directly under the name, never beside it — 12px below 1024px.
    expect(heading.nextElementSibling).toHaveTextContent(/^Agent · Direct unit$/);
    expect(heading.nextElementSibling?.tagName).toBe('P');
    expect(heading.nextElementSibling).toHaveClass('text-xs', 'lg:text-base');
    // The 36px avatar below 1024px, the 52px initials from 1024px: both pictures, neither read out.
    expect(screen.getAllByText('RW')).toHaveLength(2);
    for (const avatar of screen.getAllByText('RW')) expect(avatar).toHaveAttribute('aria-hidden', 'true');
    // One read of the person, by their membership.
    expect(calls.filter((c) => c.url.includes('/coaching/coachees/')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/coaching/coachees/mem-rina']);
  });

  it('UI-111 the header’s avatar shows the coachee’s saved photo; a coachee without one shows their initials', async () => {
    const photo = 'https://cdn.test/user/u-rina/avatar/a.jpg?sig=abc';
    const { container } = show({ ...RINA, photoUrl: photo });
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    const img = container.querySelector('[data-coachee-header] img');
    expect(img).toHaveAttribute('src', photo);
    expect(img).toHaveAttribute('aria-hidden', 'true');
    // The photo takes the 36px avatar's place; the initials stay only where no photo is drawn.
    expect(screen.getAllByText('RW')).toHaveLength(1);
  });

  it('UI-111 a coachee without a saved photo shows their initials, never an empty picture', async () => {
    const { container } = show({ ...RINA, photoUrl: null });
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    expect(container.querySelector('[data-coachee-header] img')).toBeNull();
    expect(screen.getAllByText('RW')).toHaveLength(2);
  });

  it('UI-029 the way back goes to where the leader came from: an in-app `?from=`, never another site', async () => {
    window.history.replaceState(null, '', '/coaching/mem-rina/session?from=%2Fnew-hires');
    show(RINA);
    expect(await screen.findByRole('link', { name: '← Back' })).toHaveAttribute('href', '/new-hires');
    window.history.replaceState(null, '', '/');

    const { backFrom } = await import('@/components/coaching-person');
    expect(backFrom('?from=%2Fnew-hires')).toBe('/new-hires');
    expect(backFrom('?from=%2F%2Fevil.test')).toBeNull();
    expect(backFrom('?from=https%3A%2F%2Fevil.test')).toBeNull();
    expect(backFrom('')).toBeNull();
  });

  it('P11-T7 AC-1 names whose unit somebody further down is in, without ADR-0084’s six words', async () => {
    nav.pathname = '/coaching/mem-novi/summary';
    show(NOVI, 'mem-novi');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Novi Lestari' });
    expect(heading.nextElementSibling).toHaveTextContent(/^Agent · Arief Nugroho’s unit$/);
    expect(screen.getAllByText('NL').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(SIX_WORDS);
  });

  it('UI-029 lists the eight tabs in the owner’s order, Leads new, Capability mapping renamed, a line lock and no emoji', async () => {
    show(RINA);
    const nav0 = await screen.findByRole('navigation', { name: 'Coaching' });
    const tabs = within(nav0);

    expect(tabs.getAllByRole('link').map((t) => t.textContent)).toEqual([
      'Coaching Session', 'Activity', 'Leads', 'Goal Setting', 'Personal Summary', 'Activation', 'Training', 'Capability mapping',
    ]);
    const hrefs = tabs.getAllByRole('link').map((t) => t.getAttribute('href'));
    expect(hrefs).toEqual([
      '/coaching/mem-rina/session', '/coaching/mem-rina/activity', '/coaching/mem-rina/leads', '/coaching/mem-rina/goal-setting',
      '/coaching/mem-rina/summary', '/coaching/mem-rina/activation', '/coaching/mem-rina/training', '/coaching/mem-rina/leader-notes',
    ]);
    expect(tabs.getByRole('link', { name: 'Personal Summary' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Goal Setting' })).not.toHaveAttribute('aria-current');
    // UI-029: 🔒 → a line lock, drawn and not read out; no emoji anywhere in the row.
    const notes = tabs.getByRole('link', { name: 'Capability mapping' });
    expect(notes.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(nav0.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('UI-030 one row that never wraps and scrolls sideways with no scrollbar, a fade while more follow, tabs 44px below 1024px', async () => {
    show(RINA);
    const row = await screen.findByRole('navigation', { name: 'Coaching' });
    expect(row).toHaveClass('flex-nowrap', 'overflow-x-auto', '[scrollbar-width:none]');
    expect(row).not.toHaveClass('flex-wrap');
    expect(row.className).toMatch(/md:data-\[fade=end\]:\[mask-image/);
    expect(row.style.getPropertyValue('--tab-fade')).toBe('2rem');
    for (const tab of within(row).getAllByRole('link')) expect(tab).toHaveClass('max-lg:min-h-11', 'shrink-0', 'whitespace-nowrap');
  });

  it('UI-029 Coaching Session is the first tab and the default: /coaching/{id} opens it', async () => {
    show(RINA);
    const first = within(await screen.findByRole('navigation', { name: 'Coaching' })).getAllByRole('link')[0];
    expect(first).toHaveTextContent('Coaching Session');
    expect(first).toHaveAttribute('href', '/coaching/mem-rina/session');
  });

  it('P18.5-T4 AC-2 makes Training a live tab', async () => {
    show(RINA);
    const tabs = within(await screen.findByRole('navigation', { name: 'Coaching' }));

    const tab = tabs.getByRole('link', { name: 'Training' });
    expect(tab).toHaveAttribute('href', '/coaching/mem-rina/training');
    expect(tab).not.toHaveAttribute('aria-disabled');
    expect(tab).not.toHaveAttribute('aria-current');
  });

  it('P13.1-T9 AC-3 makes Activity a live tab, current on its own address', async () => {
    nav.pathname = '/coaching/mem-rina/activity';
    show(RINA);
    const tabs = within(await screen.findByRole('navigation', { name: 'Coaching' }));

    const tab = tabs.getByRole('link', { name: 'Activity' });
    expect(tab).toHaveAttribute('href', '/coaching/mem-rina/activity');
    expect(tab).not.toHaveAttribute('aria-disabled');
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Personal Summary' })).not.toHaveAttribute('aria-current');
  });

  it('P13-T9 AC-3 makes Activation a live tab, current on its own address', async () => {
    nav.pathname = '/coaching/mem-rina/activation';
    show(RINA);
    const tabs = within(await screen.findByRole('navigation', { name: 'Coaching' }));

    const tab = tabs.getByRole('link', { name: 'Activation' });
    expect(tab).toHaveAttribute('href', '/coaching/mem-rina/activation');
    expect(tab).not.toHaveAttribute('aria-disabled');
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tabs.queryByRole('link', { name: 'Activation, upcoming' })).not.toBeInTheDocument();
  });

  it('UI-041 draws no Leader view / Agent view toggle on any tab', async () => {
    for (const tab of ['session', 'activity', 'leads', 'goal-setting', 'summary', 'activation', 'training', 'leader-notes']) {
      nav.pathname = `/coaching/mem-rina/${tab}`;
      const view = show(RINA);
      await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
      expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Leader view|Agent view/ })).not.toBeInTheDocument();
      expect(screen.getByText('Tab for Rina Wijaya')).toBeInTheDocument();
      view.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('P11-T7 AC-3 keeps the shell across a change of tab: it is mounted once, in the layout', async () => {
    const params = routeParams({ membershipId: 'mem-rina' });
    // What the App Router does on a change of tab: the same layout, re-rendered at a new address.
    function Router() {
      const [, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => { nav.pathname = '/coaching/mem-rina/goal-setting'; setTick((n) => n + 1); }}>
            Go to Goal Setting
          </button>
          <CoachingPersonLayout params={params}><Probe /></CoachingPersonLayout>
        </>
      );
    }
    const { calls } = stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA } });
    renderInLayout(AgentLayout, <Router />, { me: LEADER });
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });

    await userEvent.click(screen.getByRole('button', { name: 'Go to Goal Setting' }));

    // The person's own tab — the field sidebar has a *Goal Setting* of its own since UI V1 (UI-004).
    expect(within(screen.getByRole('navigation', { name: 'Coaching' })).getByRole('link', { name: 'Goal Setting' }))
      .toHaveAttribute('aria-current', 'page');
    // And the person was read once, not once per tab.
    expect(calls.filter((c) => c.url.includes('/coaching/coachees/'))).toHaveLength(1);
  });

  it('P11-T7 AC-8 is one shell whoever the person is: another id, another read, the same parts', async () => {
    const first = show(RINA);
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    first.unmount();
    vi.unstubAllGlobals();

    nav.pathname = '/coaching/mem-novi/summary';
    const { calls } = show(NOVI, 'mem-novi');
    await screen.findByRole('heading', { level: 1, name: 'Novi Lestari' });
    expect(calls.some((c) => c.url.endsWith('/coaching/coachees/mem-novi'))).toBe(true);
    expect(screen.getByRole('navigation', { name: 'Coaching' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Coaching' })).getByRole('link', { name: 'Personal Summary' }))
      .toHaveAttribute('href', '/coaching/mem-novi/summary');
  });

  it('P11-T7 AC-8 answers somebody outside the reader’s reach with the not-found state, inside the shell', async () => {
    show(null, 'mem-elsewhere', 404);

    const heading = await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' });
    expect(heading.nextElementSibling).toHaveTextContent(
      /^They may have moved to another leader, or the address may be mistyped\. Everyone you coach is on Coaching Session\.$/,
    );
    // P18.95-T7 AC-2: with nobody to name, the page keeps the prototype's title, and the card is a section under it.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Coaching Session$/);
    expect(heading.tagName).toBe('H2');
    // Inside the agent shell: its nav is there, and the way back.
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to Coaching Session' })).toHaveAttribute('href', '/coaching');
    // Not a disabled shell: no tabs, no toggle, no tab content, and nothing about who it was.
    expect(screen.queryByRole('navigation', { name: 'Coaching' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agent view' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Tab for/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/mem-elsewhere|NOT_FOUND/);
    expect(document.body.textContent).not.toMatch(SIX_WORDS);
  });

  it('P11 final walk F4 offers a reader who leads nobody their own coaching, not an empty roster', async () => {
    stubFetch({ ...SHELL, '/coaching/coachees/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-elsewhere' })}><Probe /></CoachingPersonLayout>,
      { me: { ...LEADER, membership: { ...LEADER.membership!, directCount: 0 } } },
    );

    const heading = await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' });
    expect(heading.nextElementSibling).toHaveTextContent(/^They may have moved to another leader, or the address may be mistyped\.$/);
    expect(screen.getByRole('link', { name: '← Back to My Coaching Notes' })).toHaveAttribute('href', '/coaching/me');
    expect(screen.queryByRole('link', { name: '← Back to Coaching Session' })).not.toBeInTheDocument();
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
  });

  it('P11 final walk F5 keeps the shell up while a tab suspends, and reads the person once, under StrictMode', async () => {
    const { calls } = stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA } });
    // A promise React has not seen settle, as the App Router hands a client page its params.
    const address = Promise.resolve({ membershipId: 'mem-rina' });
    function SuspendingTab() {
      const { membershipId } = use(address);
      return <p>Tab for {useCoachee().name}, {membershipId === 'mem-rina' ? 'at her address' : 'elsewhere'}</p>;
    }
    await act(async () => {
      renderWithSession(
        <StrictMode>
          <AgentLayout>
            {/* `(agent)/loading.tsx`'s boundary, above the shell, as the App Router places it. */}
            <Suspense fallback={<AgentLoading />}>
              <CoachingPersonLayout params={Promise.resolve({ membershipId: 'mem-rina' })}><SuspendingTab /></CoachingPersonLayout>
            </Suspense>
          </AgentLayout>
        </StrictMode>,
        { me: LEADER },
      );
    });

    expect(await screen.findByText('Tab for Rina Wijaya, at her address')).toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    // Hidden behind the route's skeleton and shown again, the shell read the person a second time.
    expect(calls.filter((c) => c.url.endsWith('/coaching/coachees/mem-rina'))).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Rina Wijaya' })).toBeVisible();
  });

  it('shows the error banner for any other failure, and no tab', async () => {
    stubFetch({ ...SHELL, '/coaching/coachees/': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } } });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><Probe /></CoachingPersonLayout>,
      { me: LEADER },
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    expect(screen.queryByText(/Tab for/)).not.toBeInTheDocument();
  });

  it('shows a skeleton while the person is read, then the tab', async () => {
    show(RINA);
    expect(screen.getByRole('status')).toHaveTextContent('Loading this person…');
    expect(await screen.findByText('Tab for Rina Wijaya')).toBeInTheDocument();
  });

  it('is refused, with no read, to a reader without coaching_session:read', async () => {
    const { calls } = stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA } });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><Probe /></CoachingPersonLayout>,
      { me: { ...LEADER, permissions: [] } },
    );
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'coaching_session:read');
    expect(calls.some((c) => c.url.includes('/coaching/coachees/'))).toBe(false);
  });

  it('P11-T9 lets a tab hand the shell a 404 of its own: the not-found state replaces the header and the tabs', async () => {
    function Gone() {
      const coachee = useCoachee();
      const gone = useCoacheeNotFound();
      return <button type="button" onClick={gone}>Read {coachee.name}’s notes</button>;
    }
    stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA } });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><Gone /></CoachingPersonLayout>,
      { me: LEADER },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Read Rina Wijaya’s notes' }));

    expect(screen.getByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Coaching' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Rina Wijaya' })).not.toBeInTheDocument();
  });

  it('useCoacheeNotFound() refuses to be used outside the shell', () => {
    function Outside() {
      useCoacheeNotFound();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderInLayout(({ children }) => <>{children}</>, <Outside />, { me: LEADER }))
      .toThrow(/only available inside the coaching person shell/);
    spy.mockRestore();
  });

  it('useCoachee() refuses to be read outside the shell', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderInLayout(({ children }) => <>{children}</>, <Probe />, { me: LEADER }))
      .toThrow(/only available inside the coaching person shell/);
    spy.mockRestore();
  });
});
