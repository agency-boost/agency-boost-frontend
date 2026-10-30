import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  category, NOT_FOUND, PRODUCT, progressView, row, SALES, SHELL_STUBS, skill,
} from '@test/training-fixtures';
import { PHONE_QUERY } from '@/lib/use-phone';
import CoachingPersonLayout from '../layout';
import CoacheeTrainingTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/training',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-sari', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['coaching_session:read', 'training_progress:read', 'training_progress:update'],
});

const PERSON = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-sari', name: 'Sari Puspita' }, direct: true, downline: { members: 0, leaders: 0 },
};

const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

const show = (routes: Record<string, StubReply | StubReply[]> = {}) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/coaching/coachees/': { body: PERSON },
    'GET /training/progress': { body: progressView() },
    ...routes,
  });
  renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeTrainingTab /></CoachingPersonLayout>,
    { me: LEADER },
  );
  return stub;
};

const sales = () => screen.findByRole('heading', { level: 2, name: 'Sales (4/10)' });

describe('/coaching/[membershipId]/training, a coachee’s Training tab (P18.5-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.5-T4 AC-1 reads this person through the coach’s read, once, with `for`', async () => {
    const { calls } = show();
    await sales();
    expect(calls.filter((c) => c.url.includes('/training/progress')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/training/progress?for=mem-rina']);
  });

  it('P18.5-T4 AC-2 heads every category “{Label} ({done}/{total})”, the counts the server’s, an empty one at (0/0)', async () => {
    show();
    await sales();
    // P18.95-T7 AC-2: the coachee's name is the page's title, so it is no longer a heading of its own below it.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Rina Wijaya$/);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Sales (4/10)', 'Product (0/0)',
    ]);
    // Muted, as `:7749` draws them.
    expect(screen.getByText('(4/10)').className).toContain('text-muted');
  });

  it('P18.5-T4 AC-2, UI-066 draws the skills numbered from 1 again in each category, with done/total and Module · Format · Status', async () => {
    const product = category('PRODUCT', 'Product', [skill('PRODUCT_KNOWLEDGE', 'Product Knowledge', [row('WHOLE_LIFE', 'Whole Life vs Term Life')])]);
    show({ 'GET /training/progress': { body: progressView([SALES, product]) } });
    await sales();
    const product3 = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(product3).toEqual([
      '1Prospecting3/3', '2Needs Analysis1/2', '3Objection Handling0/2', '4Closing0/1', '5Cross-sell0/1', '6Retention0/1', '1Product Knowledge0/1',
    ]);
    const card = screen.getByRole('list', { name: 'Product Knowledge modules' }).closest('[data-skill]')!;
    expect(card.querySelector('div[aria-hidden="true"]')!.textContent).toBe('ModuleFormatStatus');
  });

  it('P18.5-T4 AC-2 is read-only: no link in any row and no status control (contradiction 13)', async () => {
    show();
    await sales();
    for (const list of screen.getAllByRole('list', { name: / modules$/ })) expect(within(list).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByText('Asking the Right Discovery Questions')).toBeInTheDocument();
  });

  it('P18.5-T4 AC-2, D-history keeps a module done and since withdrawn under its skill: Done, then Archived, outside the count', async () => {
    const retention = skill('RETENTION', 'Retention', [], {
      offered: false,
      archived: [{ code: 'CLIENT_RETENTION', title: 'Client Retention Best Practices', status: 'done', completedAt: '2026-08-01T03:00:00.000Z', formats: ['file'] }],
    });
    const sales9 = category('SALES', 'Sales', [skill('CLOSING', 'Closing', [row('CLOSING_TECHNIQUES', 'Closing Techniques That Work')]), retention]);
    show({ 'GET /training/progress': { body: progressView([sales9]) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sales (0/1)' })).toBeInTheDocument();
    const archived = within(screen.getByRole('list', { name: 'Retention modules' })).getByRole('listitem');
    // The module, its Format, its pill and *Archived* after it — no › and no link (UI-066).
    expect(archived).toHaveTextContent(/^Client Retention Best PracticesFileDoneArchived$/);
    // A withdrawn module's Format is its own kinds of material, served on the history row — never “No material yet”.
    expect(archived).not.toHaveTextContent(/No material yet/);
    expect(within(archived).queryByRole('link')).not.toBeInTheDocument();
  });

  it('P18.5-T4 AC-2 draws the empty state for an office with no category', async () => {
    show({ 'GET /training/progress': { body: progressView([]) } });
    expect(await screen.findByText('No training to show yet.')).toBeInTheDocument();
  });

  it('P18.5-T4 AC-5 is a live tab, current on its own address, no longer a sign', async () => {
    show();
    await sales();
    const tab = within(screen.getByRole('navigation', { name: 'Coaching' })).getByRole('link', { name: 'Training' });
    expect(tab).toHaveAttribute('href', '/coaching/mem-rina/training');
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tab).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(/^Upcoming/)).not.toBeInTheDocument();
  });

  it('P18.5-T4 AC-1 sends a person out of reach to the shell’s not-found, not a refusal of its own', async () => {
    show({ 'GET /training/progress': NOT_FOUND });
    expect(await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
  });

  it('P18.5-T4 AC-2 shows why the read failed, and asks again', async () => {
    const failed = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } };
    const { calls } = show({ 'GET /training/progress': [failed, { body: progressView() }] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await sales();
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/training/progress'))).toHaveLength(2));
  });

  it('P18.5-T4 AC-2 writes none of OD-39’s six words, and no phase', async () => {
    show();
    await sales();
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
    expect(screen.getByRole('main').textContent).not.toMatch(/phase\s*\d/i);
  });

  it('P18.5-T4 AC-2 keeps the product’s empty Product category in its place, with its heading only', async () => {
    show({ 'GET /training/progress': { body: progressView([PRODUCT, SALES]) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Product (0/0)' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Product (0/0)', 'Sales (4/10)']);
  });
});

/*
 * **The same rows on a phone** (P18.95-T3 AC-5): the learner's list and a person's tab draw a module one way (P18.5-T4
 * AC-4), so the tab's cards are a row per module below 768px too — its name and its status, the history's *Archived*
 * after it — read-only, as the table's rows are.
 */
describe('P18.95-T3 — a coachee’s Training tab on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T3 AC-5 draws a row per module, its name and its status, Archived after a withdrawn one, and no link', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
    })));
    const retention = skill('RETENTION', 'Retention', [], {
      offered: false,
      archived: [{ code: 'CLIENT_RETENTION', title: 'Client Retention Best Practices', status: 'done', completedAt: '2026-08-01T03:00:00.000Z', formats: ['file'] }],
    });
    const sales9 = category('SALES', 'Sales', [skill('CLOSING', 'Closing', [row('CLOSING_TECHNIQUES', 'Closing Techniques That Work')]), retention]);
    // The tab asks the width before its read answers, so the table is never drawn first.
    expect(await drewATable(async () => {
      show({ 'GET /training/progress': { body: progressView([sales9]) } });
      await screen.findByRole('heading', { level: 2, name: 'Sales (0/1)' });
    })).toBe(false);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const archived = within(screen.getByRole('list', { name: 'Retention modules' })).getByRole('listitem');
    expect(archived).toHaveTextContent(/^Client Retention Best PracticesDoneArchived$/);
    const closing = within(screen.getByRole('list', { name: 'Closing modules' })).getByRole('listitem');
    expect(closing).toHaveTextContent(/^Closing Techniques That WorkNot started$/);
    expect(screen.queryByRole('link', { name: 'Closing Techniques That Work' })).not.toBeInTheDocument();
  });
});

/** Whether a `<table>` was ever put on the page while `run` waited: a phone's first paint must already be its cards. */
async function drewATable(run: () => Promise<unknown>) {
  let seen = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('table') || node.querySelector('table'))) seen = true;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  await run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  observer.disconnect();
  return seen;
}
