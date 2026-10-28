import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { completeView, leaderView, notFound, readOnlySession, SHELL_STUBS } from '@test/activation-fixtures';
import CoachingPersonLayout from '../layout';
import CoacheeActivationTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/activation',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-sari', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['coaching_session:read', 'activation:read'],
});

const PERSON = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-sari', name: 'Sari Puspita' }, direct: true, downline: { members: 0, leaders: 0 },
};

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = LEADER) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/coaching/coachees/': { body: PERSON },
    'GET /new-hires/mem-rina': { body: leaderView() },
    ...routes,
  });
  const view = renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>,
    { me },
  );
  return { ...stub, ...view };
};

const card = () => screen.findByRole('region', { name: '90-Day Activation' });
const row = (code: string) => document.querySelector(`li[data-code="${code}"]`) as HTMLElement;

describe('/coaching/[membershipId]/activation, a coachee’s Activation tab (P13-T9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P13-T9 AC-1 the card: 90-Day Activation, “{pct}% complete” and a mini bar, from the leader’s read of this person', async () => {
    const { calls } = show();
    const record = await card();
    expect(within(record).getByText('31% complete')).toBeInTheDocument();
    expect(within(record).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '31');
    // The read a leader's detail makes, once — the same one computation the hire is served (exit criterion 2).
    expect(calls.filter((c) => c.url.includes('/new-hires/')).map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires/mem-rina']);
  });

  it('P13-T9 AC-1, P18.95-T7 AC-2 the five aspect cards, numbered, under the person shell’s own title, her name', async () => {
    show();
    await card();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Rina Wijaya$/);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '90-Day Activation', '1Introduction', '2Initial Setup', '3Training & Certification', '4First Sale', '5Ongoing Habits',
    ]);
  });

  it('P13-T9 AC-1 each item: “✓ Done · New Active Agent” for FIRST_CASE_CLOSED, “✓ Done”, or “Not done”', async () => {
    show();
    await card();
    expect(row('FIRST_CASE_CLOSED')).toHaveTextContent(/^Close first case independently✓ Done · New Active Agent$/);
    expect(row('INSURANCE_BASICS')).toHaveTextContent(/^Learn insurance basics✓ Done$/);
    expect(row('CRM_SETUP')).toHaveTextContent(/^Set up company CRM systemNot done$/);
    expect(row('INSURANCE_BASICS').querySelector('strong')!.className).toContain('text-success');
    expect(row('CRM_SETUP').querySelector('strong')!.className).toContain('text-muted');
  });

  it('P13-T9 AC-1 binds New Active Agent to the code, never to item 13 by position (invariant §4)', async () => {
    const view = completeView();
    // An office that moved the item: it is the last of its aspect now, and the thirteenth item is another.
    view.aspects[3].items.reverse();
    show({ 'GET /new-hires/mem-rina': { body: view } });
    await card();
    expect(row('FIRST_CASE_CLOSED')).toHaveTextContent(/✓ Done · New Active Agent$/);
    expect(row('JOINT_FIELD_WORK')).toHaveTextContent(/✓ Done$/);
    expect(screen.getAllByText('✓ Done · New Active Agent')).toHaveLength(1);
  });

  it('P13-T9 AC-1 is read-only: no box, no field, no button, no day, no table, no note', async () => {
    show();
    await card();
    const main = within(screen.getByRole('main'));
    expect(main.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(main.queryByRole('textbox')).not.toBeInTheDocument();
    expect(main.queryByRole('table')).not.toBeInTheDocument();
    expect(main.queryByText('Day')).not.toBeInTheDocument();
    expect(main.queryByText(/Great pace on prospecting/)).not.toBeInTheDocument();
    expect(main.queryByRole('button', { name: /Save|Mark/ })).not.toBeInTheDocument();
  });

  it('P13-T9 AC-3 somebody with no activation opens on an empty state, not a disabled tab', async () => {
    show({ 'GET /new-hires/mem-rina': notFound });
    expect(await screen.findByText('Rina Wijaya has no 90-day activation.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '90-Day Activation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activation' })).toHaveAttribute('aria-current', 'page');
  });

  it('a failed read says why, and Try again reads again', async () => {
    const { calls } = show({
      'GET /new-hires/mem-rina': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } },
        { body: leaderView() },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await card();
    expect(calls.filter((c) => c.url.endsWith('/new-hires/mem-rina'))).toHaveLength(2);
  });

  it('shows a skeleton while the activation is read', async () => {
    // The activation's read is held open, so the wait is there to see whichever read lands first.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { mock } = show();
    const answer = mock.getMockImplementation()!;
    mock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/new-hires/')) await held;
      return answer(url, init);
    });
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    expect(await screen.findByText('Loading this activation…')).toBeInTheDocument();
    await act(async () => { release(); });
    await card();
  });

  it('P13-T9 AC-1 a read-only support session reads it as the coach does', async () => {
    show({}, readOnlySession(LEADER));
    expect(await card()).toBeInTheDocument();
  });
});
