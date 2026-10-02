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

  it('P11-T7 AC-1 heads the page with the way back, the initials, the name, and the rung and unit', async () => {
    const { calls } = show(RINA);

    const heading = await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Coaching Session$/);
    expect(screen.getByRole('link', { name: '← Back to Coaching Session' })).toHaveAttribute('href', '/coaching');
    expect(heading.nextElementSibling).toHaveTextContent(/^Agent · Direct unit$/);
    expect(screen.getByText('RW')).toBeInTheDocument();
    // One read of the person, by their membership.
    expect(calls.filter((c) => c.url.includes('/coaching/coachees/')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/coaching/coachees/mem-rina']);
  });

  it('P11-T7 AC-1 names whose unit somebody further down is in, without ADR-0084’s six words', async () => {
    nav.pathname = '/coaching/mem-novi/summary';
    show(NOVI, 'mem-novi');

    const heading = await screen.findByRole('heading', { level: 2, name: 'Novi Lestari' });
    expect(heading.nextElementSibling).toHaveTextContent(/^Agent · Arief Nugroho’s unit$/);
    expect(screen.getByText('NL')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(SIX_WORDS);
  });

  it('P11-T7 AC-2 lists the six tabs in the prototype’s order and words, the current one marked', async () => {
    show(RINA);
    const tabs = within(await screen.findByRole('navigation', { name: 'Coaching' }));

    expect(tabs.getAllByRole('link').map((t) => t.textContent)).toEqual([
      'Personal Summary', 'Goal Setting', 'Training', 'Activation', 'Coaching Session', '🔒Leader Notes',
    ]);
    expect(tabs.getByRole('link', { name: 'Personal Summary' })).toHaveAttribute('href', '/coaching/mem-rina/summary');
    expect(tabs.getByRole('link', { name: 'Personal Summary' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Goal Setting' })).toHaveAttribute('href', '/coaching/mem-rina/goal-setting');
    expect(tabs.getByRole('link', { name: 'Goal Setting' })).not.toHaveAttribute('aria-current');
    expect(tabs.getByRole('link', { name: 'Coaching Session' })).toHaveAttribute('href', '/coaching/mem-rina/session');
    // The lock is the prototype's, drawn and not read out.
    const notes = tabs.getByRole('link', { name: 'Leader Notes' });
    expect(notes).toHaveAttribute('href', '/coaching/mem-rina/leader-notes');
    expect(within(notes).getByText('🔒')).toHaveAttribute('aria-hidden', 'true');
  });

  it('P11-T7 AC-7 draws Training and Activation disabled, named for assistive technology, with no phase', async () => {
    show(RINA);
    const tabs = within(await screen.findByRole('navigation', { name: 'Coaching' }));

    for (const name of ['Training', 'Activation']) {
      const tab = tabs.getByRole('link', { name: `${name}, upcoming` });
      expect(tab).toHaveAttribute('aria-disabled', 'true');
      expect(tab).not.toHaveAttribute('href');
      // `.nav a.disabled` (`Overall.html:63`): muted, a plain cursor, nothing else.
      expect(tab.className).toContain('cursor-default');
      expect(tab.className).toContain('text-muted/50');
      expect(tab.textContent).not.toMatch(/phase|\d/i);
    }
  });

  it('P11-T7 AC-3 Agent view takes Leader Notes out of the bar, and Leader view brings it back', async () => {
    show(RINA);
    await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' });
    const leaderView = screen.getByRole('button', { name: 'Leader view' });
    const agentView = screen.getByRole('button', { name: 'Agent view' });
    expect(within(screen.getByRole('group', { name: 'View' })).getAllByRole('button')).toEqual([leaderView, agentView]);
    expect(leaderView).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(agentView);
    expect(agentView).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: 'Leader Notes' })).not.toBeInTheDocument();
    // Nothing else changes, as in the prototype: the other five are still there, and so is the tab.
    expect(within(screen.getByRole('navigation', { name: 'Coaching' })).getAllByRole('link')).toHaveLength(5);
    expect(screen.getByText('Tab for Rina Wijaya')).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();

    await userEvent.click(leaderView);
    expect(screen.getByRole('link', { name: 'Leader Notes' })).toBeInTheDocument();
  });

  it('P11-T7 AC-3 moves a reader standing on Leader Notes to Personal Summary, and drops the tab at once', async () => {
    nav.pathname = '/coaching/mem-rina/leader-notes';
    show(RINA);
    expect(await screen.findByText('Tab for Rina Wijaya')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Agent view' }));

    expect(nav.replace).toHaveBeenCalledWith('/coaching/mem-rina/summary');
    // The notes tab is unmounted before the address changes, so nothing it fetched stays on screen.
    expect(screen.queryByText('Tab for Rina Wijaya')).not.toBeInTheDocument();
  });

  it('P11-T7 AC-3 keeps the view across a change of tab: the shell is mounted once, in the layout', async () => {
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
    await userEvent.click(await screen.findByRole('button', { name: 'Agent view' }));

    await userEvent.click(screen.getByRole('button', { name: 'Go to Goal Setting' }));

    expect(screen.getByRole('button', { name: 'Agent view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Goal Setting' })).toHaveAttribute('aria-current', 'page');
    // And the person was read once, not once per tab.
    expect(calls.filter((c) => c.url.includes('/coaching/coachees/'))).toHaveLength(1);
  });

  it('P11-T7 AC-8 is one shell whoever the person is: another id, another read, the same parts', async () => {
    const first = show(RINA);
    await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' });
    first.unmount();
    vi.unstubAllGlobals();

    nav.pathname = '/coaching/mem-novi/summary';
    const { calls } = show(NOVI, 'mem-novi');
    await screen.findByRole('heading', { level: 2, name: 'Novi Lestari' });
    expect(calls.some((c) => c.url.endsWith('/coaching/coachees/mem-novi'))).toBe(true);
    expect(screen.getByRole('navigation', { name: 'Coaching' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personal Summary' })).toHaveAttribute('href', '/coaching/mem-novi/summary');
  });

  it('P11-T7 AC-8 answers somebody outside the reader’s reach with the not-found state, inside the shell', async () => {
    show(null, 'mem-elsewhere', 404);

    const heading = await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' });
    expect(heading.nextElementSibling).toHaveTextContent(
      /^They may have moved to another leader, or the address may be mistyped\. Everyone you coach is on Coaching Session\.$/,
    );
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
    expect(screen.getByRole('heading', { level: 2, name: 'Rina Wijaya' })).toBeVisible();
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
    expect(screen.queryByRole('heading', { level: 2, name: 'Rina Wijaya' })).not.toBeInTheDocument();
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
