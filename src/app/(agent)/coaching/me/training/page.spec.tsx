import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { LEARNER, progressView, SHELL_STUBS } from '@test/training-fixtures';
import CoachingPersonLayout from '../../[membershipId]/layout';
import CoacheeTrainingTab from '../../[membershipId]/training/page';
import MyCoachingTrainingPage from './page';

const nav = vi.hoisted(() => ({ pathname: '/coaching/me/training' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = LEARNER) => {
  nav.pathname = '/coaching/me/training';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() }, ...routes });
  renderInLayout(AgentLayout, <MyCoachingTrainingPage />, { me });
  return stub;
};

const sales = () => screen.findByRole('heading', { level: 2, name: 'Sales (4/10)' });

/** Each row of every table as the reader sees it: the skill's card, the module, its status cell. */
const rowsShown = () => screen.getAllByRole('table').flatMap((table) =>
  within(table).getAllByRole('row').slice(1).map((r) => [
    table.querySelector('caption')?.textContent,
    within(r).getByRole('rowheader').textContent,
    within(r).getAllByRole('cell')[3].textContent,
  ]));

describe('/coaching/me/training, the reader’s own Training tab (P18.5-T4 AC-3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.5-T4 AC-3 is /coaching/me’s head with Training current, and the reader’s own read, without `for`', async () => {
    const { calls } = show();
    await sales();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Coaching Session$/);
    expect(screen.getByRole('heading', { level: 2, name: 'Rina Wijaya' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Coaching' }));
    expect(tabs.getByRole('link', { name: 'Training' })).toHaveAttribute('href', '/coaching/me/training');
    expect(tabs.getByRole('link', { name: 'Training' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Coaching Session' })).not.toHaveAttribute('aria-current');
    expect(calls.filter((c) => c.url.includes('/training/progress')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/training/progress']);
  });

  it('P18.5-T4 AC-3 draws the coaching renderer, read-only: every category with its counts, no link, no toggle', async () => {
    show();
    await sales();
    expect(screen.getByRole('heading', { level: 2, name: 'Product (0/0)' })).toBeInTheDocument();
    for (const table of screen.getAllByRole('table')) expect(within(table).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('P18.5-T4 AC-3 shows why the read failed, and asks again', async () => {
    const failed = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } };
    show({ 'GET /training/progress': [failed, { body: progressView() }] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await sales();
  });

  it('P18.5-T4 AC-3 waits under a skeleton', () => {
    show();
    expect(screen.getByText('Loading training…')).toBeInTheDocument();
  });

  it('P18.5-T4 AC-3 is refused, with no read, to a reader without coaching_session:read', async () => {
    const { calls } = show({}, makeMe({ ...LEARNER, permissions: ['training_progress:read'] }));
    await screen.findByRole('heading', { level: 1 });
    expect(calls.some((c) => c.url.includes('/training/progress'))).toBe(false);
  });

  /*
   * Exit test 3's first half, on the screen's side: the coach's tab and the reader's own draw one record
   * the same way — the same categories, counts, rows and statuses — because they are one renderer over
   * one read (`?for=` and without). The server's half is `training.controller.int.spec.ts`'s.
   */
  it('P18.5-T4 AC-4 draws what the coach’s tab draws for the same record: one renderer, one read', async () => {
    show();
    await sales();
    const mine = { headings: screen.getAllByRole('heading', { level: 2 }).slice(1).map((h) => h.textContent), rows: rowsShown() };
    cleanup();
    vi.unstubAllGlobals();

    nav.pathname = '/coaching/mem-rina/training';
    stubFetch({
      ...SHELL_STUBS,
      '/coaching/coachees/': {
        body: {
          membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
          leader: { membershipId: 'mem-sari', name: 'Sari Puspita' }, direct: true, downline: { members: 0, leaders: 0 },
        },
      },
      'GET /training/progress': { body: progressView() },
    });
    const coach = makeMe({
      membership: {
        membershipId: 'mem-sari', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 3,
      },
      permissions: ['coaching_session:read', 'training_progress:read'],
    });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeTrainingTab /></CoachingPersonLayout>,
      { me: coach },
    );
    await sales();
    // The coach's tab: the coachee's name is its page title since P18.95-T7 AC-2, so every h2 is a category.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(mine.headings);
    expect(rowsShown()).toEqual(mine.rows);
  });
});
