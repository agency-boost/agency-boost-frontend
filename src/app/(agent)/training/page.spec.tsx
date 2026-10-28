import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  category, LEARNER, PRODUCT, progressView, row, SALES, SHELL_STUBS, skill,
} from '@test/training-fixtures';
import { PHONE_QUERY } from '@/lib/use-phone';
import TrainingLayout from './layout';
import TrainingPage from './page';
import TrainingCategoryPage from './[categoryCode]/page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), pathname: '/training/SALES' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

function landing(routes: Routes = {}, me = LEARNER) {
  nav.pathname = '/training';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() }, ...routes });
  renderInLayout(AgentLayout, <TrainingLayout><TrainingPage /></TrainingLayout>, { me });
  return stub;
}

function list(code = 'SALES', routes: Routes = {}, me = LEARNER) {
  nav.pathname = `/training/${code}`;
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() }, ...routes });
  renderInLayout(
    AgentLayout,
    <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: code })} /></TrainingLayout>,
    { me },
  );
  return stub;
}

const title = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('/training, the learner’s list (P18.5-T1)', () => {
  beforeEach(() => {
    nav.replace.mockReset();
    nav.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('/training itself', () => {
    it('P18.5-T1 AC-4 replaces itself with the office’s first offered category', async () => {
      landing();
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/training/SALES'));
    });

    it('P18.5-T1 AC-4 skips a category no longer offered, kept only for a person’s history', async () => {
      const gone = category('LEGACY', 'Legacy', [], { offered: false });
      landing({ 'GET /training/progress': { body: progressView([gone, PRODUCT, SALES]) } });
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/training/PRODUCT'));
    });

    it('P18.5-T1 AC-4 shows the empty state for an office with no category at all', async () => {
      landing({ 'GET /training/progress': { body: progressView([]) } });
      expect(await screen.findByText('No training to show yet.')).toBeInTheDocument();
      expect(screen.getByText('Modules appear here once they are published for you.')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Training' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Training Modules' })).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('P18.5-T1 AC-4 shows why the read failed, and asks again', async () => {
      const failed = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } };
      const { calls } = landing({ 'GET /training/progress': [failed, { body: progressView() }] });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/training/SALES'));
      expect(calls.filter((c) => c.url.includes('/training/progress'))).toHaveLength(2);
    });

    it('P18.5-T1 AC-4 waits under a skeleton shaped like the list', () => {
      stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() } });
      nav.pathname = '/training';
      renderInLayout(AgentLayout, <TrainingLayout><TrainingPage /></TrainingLayout>, { me: LEARNER });
      expect(screen.getByText('Loading training…')).toBeInTheDocument();
    });
  });

  describe('/training/[categoryCode]', () => {
    it('P18.5-T1 AC-4, P18.95-T9 AC-2 titles every category Training Modules, the nav item’s words, over its own description', async () => {
      list();
      await title('Training Modules');
      // The prototype's *"{label} Training"* is gone from the heading: the menu said *Training modules* (UI-027).
      expect(screen.queryByRole('heading', { level: 1, name: 'Sales Training' })).not.toBeInTheDocument();
      expect(screen.getByText('Structured modules — tracked here.')).toBeInTheDocument();
    });

    it('P18.5-T1 AC-4 draws the subtabs in the office’s words and order, the current one marked', async () => {
      list();
      await title('Training Modules');
      const tabs = screen.getByRole('navigation', { name: 'Training' });
      expect(within(tabs).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
        ['Sales', '/training/SALES'], ['Product', '/training/PRODUCT'],
      ]);
      expect(within(tabs).getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'page');
      expect(within(tabs).getByRole('link', { name: 'Product' })).not.toHaveAttribute('aria-current');
    });

    it('P18.5-T1 AC-4 heads the list Skills List, then a numbered card per skill (ADR-0029)', async () => {
      list();
      await title('Training Modules');
      expect(screen.getByRole('heading', { level: 2, name: 'Skills List' })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '1Prospecting', '2Needs Analysis', '3Objection Handling', '4Closing', '5Cross-sell', '6Retention',
      ]);
    });

    it('P18.5-T1 AC-4 draws the five columns, the No. restarting in each card, the rows in the office’s order', async () => {
      list();
      await title('Training Modules');
      const prospecting = screen.getByRole('table', { name: 'Prospecting modules' });
      expect(within(prospecting).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['No.', 'Skill', 'Module', 'Format', 'Status']);
      const rows = within(prospecting).getAllByRole('row').slice(1);
      expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['1', '2', '3']);
      expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
        'Building Your Prospect List', 'Referral Generation Techniques', 'Cold Approach Scripts',
      ]);
      const needs = screen.getByRole('table', { name: 'Needs Analysis modules' });
      expect(within(needs).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['1', '2']);
    });

    it('P18.5-T1 AC-4 makes each module’s title a link to its page (contradiction 8)', async () => {
      list();
      await title('Training Modules');
      expect(screen.getByRole('link', { name: 'Asking the Right Discovery Questions' }))
        .toHaveAttribute('href', '/training/SALES/DISCOVERY_QUESTIONS');
      expect(screen.getByRole('link', { name: 'Closing Techniques That Work' }))
        .toHaveAttribute('href', '/training/SALES/CLOSING_TECHNIQUES');
    });

    it('P18.5-T1 AC-4 draws the three pills with their words, In progress in F-126’s paint', async () => {
      list();
      await title('Training Modules');
      const needs = screen.getByRole('table', { name: 'Needs Analysis modules' });
      const done = within(needs).getByText('Done');
      const going = within(needs).getByText('In progress');
      expect(done.className).toContain('text-success');
      expect(going.className).toContain('bg-amber/15');
      expect(going.className).toContain('text-navy');
      expect(within(screen.getByRole('table', { name: 'Closing modules' })).getByText('Not started').className).toContain('text-muted');
    });

    it('P18.5-T1 AC-4 draws the kinds present as Format chips, and — for a module holding nothing', async () => {
      list();
      await title('Training Modules');
      const closing = within(screen.getByRole('table', { name: 'Closing modules' })).getAllByRole('row')[1];
      expect(within(closing).getAllByRole('cell')[2].textContent).toBe('FileLink');
      const retention = within(screen.getByRole('table', { name: 'Retention modules' })).getAllByRole('row')[1];
      const none = within(retention).getAllByRole('cell')[2];
      expect(within(none).getByText('—')).toHaveAttribute('aria-hidden', 'true');
      expect(within(none).getByText('No material yet').className).toContain('sr-only');
    });

    it('P18.5-T1 AC-4, OD-150 draws no footer: nothing promises a Skill Tracker', async () => {
      list();
      await title('Training Modules');
      expect(document.body.textContent).not.toMatch(/Skill Tracker|Onboarding checklist once/i);
    });

    it('P18.5-T1 AC-4 scrolls each table inside its card, so a phone never scrolls the page (F-124)', async () => {
      list();
      await title('Training Modules');
      for (const table of screen.getAllByRole('table')) {
        expect(table.parentElement?.className).toContain('overflow-x-auto');
      }
    });

    it('P18.5-T1 AC-4 gives a category with nothing offered the prototype’s empty card and sub-line, and no Skills List', async () => {
      list('PRODUCT');
      await title('Training Modules');
      expect(screen.getAllByText('Modules for this category are coming soon.')).toHaveLength(2);
      // The empty card keeps the category's own title; the heading is the nav item's (P18.95-T9 AC-2).
      expect(screen.getAllByText('Product Training')).toHaveLength(1);
      expect(screen.queryByRole('heading', { name: 'Skills List' })).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-4 leaves out a skill with nothing offered, and numbers the cards that remain', async () => {
      const sales = category('SALES', 'Sales', [
        skill('EMPTY', 'Empty skill', []),
        skill('CLOSING', 'Closing', [row('CLOSING_TECHNIQUES', 'Closing Techniques That Work')]),
      ]);
      list('SALES', { 'GET /training/progress': { body: progressView([sales]) } });
      await title('Training Modules');
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['1Closing']);
    });

    it('P18.5-T1 AC-4 reads a lower-case address as the stored code', async () => {
      list('sales');
      await title('Training Modules');
    });

    it('P18.5-T1 AC-3 says a category the office does not offer cannot be found, and links back', async () => {
      list('NOPE');
      expect(await screen.findByRole('heading', { name: 'This category can’t be found.' })).toBeInTheDocument();
      expect(screen.getByText('It may have been withdrawn, or the address may be mistyped.')).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Training modules' })).toHaveAttribute('href', '/training');
    });

    it('P18.5-T1 AC-3 never offers a withdrawn category as a subtab or a list', async () => {
      const gone = category('LEGACY', 'Legacy', [skill('OLD', 'Old', [], { offered: false })], { offered: false });
      list('LEGACY', { 'GET /training/progress': { body: progressView([SALES, gone]) } });
      expect(await screen.findByRole('heading', { name: 'This category can’t be found.' })).toBeInTheDocument();
    });

    it('P18.5-T1 AC-8 calls the learner’s read and never the settings reads', async () => {
      const { calls } = list();
      await title('Training Modules');
      expect(calls.some((c) => c.url.includes('/training/progress'))).toBe(true);
      expect(calls.some((c) => c.url.includes('/kpm/settings/training'))).toBe(false);
    });

    it('P18.5-T1 AC-4 writes none of OD-39’s six words, and no phase', async () => {
      list();
      await title('Training Modules');
      const main = screen.getByRole('main');
      expect(main.textContent).not.toMatch(SIX_WORDS);
      expect(main.textContent).not.toMatch(/phase\s*\d/i);
    });

    it('P18.5-T1 AC-9 marks Training modules current in the nav, a live link with no pill', async () => {
      list();
      await title('Training Modules');
      const item = screen.getByText('Training modules').closest('a')!;
      expect(item).toHaveAttribute('href', '/training');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(item).not.toHaveAttribute('aria-disabled');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-1 refuses a reader without the read, with nothing fetched for them', async () => {
      const { calls } = list('SALES', {}, makeMe({ ...LEARNER, permissions: [] }));
      await screen.findByRole('heading', { level: 1 });
      expect(calls.some((c) => c.url.includes('/training/progress'))).toBe(false);
      expect(screen.queryByRole('heading', { name: 'Training Modules' })).not.toBeInTheDocument();
    });
  });
});

/*
 * **A row per module below 768px** (P18.95-T3 AC-5, ADR-0167 §6; the client's UI review of 2026-10-26, UI-012: the
 * table's 520px put *Format* and *Status* off the screen, and every row repeated its card's skill in *Skill*). The
 * phone is `matchMedia` answering `usePhone`'s query; every spec above is the table a tablet and a desktop keep.
 */
describe('P18.95-T3 — /training/* on a phone', () => {
  const onPhone = (matches = true) => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: matches && query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T3 AC-5 draws a row per module — its name and its status — and no table, no Skill, No. or Format', async () => {
    onPhone();
    list();
    await title('Training Modules');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const prospecting = screen.getByRole('list', { name: 'Prospecting modules' });
    const rows = within(prospecting).getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByRole('link').textContent)).toEqual([
      'Building Your Prospect List', 'Referral Generation Techniques', 'Cold Approach Scripts',
    ]);
    // The skill is the card's heading, once: no row repeats it, and no row carries a number or a Format chip.
    expect(within(prospecting).queryByText('Prospecting')).not.toBeInTheDocument();
    for (const r of rows) {
      expect(r.textContent).not.toMatch(/^\d|File|Video|Link|No material yet/);
    }
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '1Prospecting', '2Needs Analysis', '3Objection Handling', '4Closing', '5Cross-sell', '6Retention',
    ]);
  });

  it('P18.95-T3 AC-5 says the table’s status on each row, in the same pill, and links the name to the module', async () => {
    // The table's status for a row, as a tablet draws it …
    list();
    await title('Training Modules');
    const needs = screen.getByRole('table', { name: 'Needs Analysis modules' });
    const statuses = within(needs).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[3].textContent);
    cleanup();

    // … and the same on the phone's rows.
    onPhone();
    list();
    await title('Training Modules');
    const rows = within(screen.getByRole('list', { name: 'Needs Analysis modules' })).getAllByRole('listitem');
    expect(rows.map((r) => r.lastElementChild!.textContent)).toEqual(statuses);
    expect(statuses).toEqual(['Done', 'In progress']);
    expect(within(rows[1]).getByText('In progress').className).toContain('bg-amber/15');
    const link = screen.getByRole('link', { name: 'Asking the Right Discovery Questions' });
    expect(link).toHaveAttribute('href', '/training/SALES/DISCOVERY_QUESTIONS');
    expect(link).toHaveClass('max-md:min-h-11');
  });

  it('P18.95-T3 AC-5 keeps the table at 768px and wider', async () => {
    onPhone(false);
    list();
    await title('Training Modules');
    expect(screen.getByRole('table', { name: 'Prospecting modules' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Prospecting modules' })).not.toBeInTheDocument();
  });
});

/**
 * **A category with no published module is not offered to a field member** (P18.97-T4 AC-9, ADR-0176 §9; the client's
 * KPM Owner review of 2026-10-27, UI-031: *Product, Recruiting, Team Management, Soft Skills, Company and KPM are
 * "EMPTY" but appear as tabs for agents*). `GET /training/progress` leaves such a category out — or, where the member
 * has history under it, reads it as not offered — so the subtabs are the categories the read offers, and nothing else.
 */
describe('P18.97-T4 AC-9 an empty training category draws no tab', () => {
  beforeEach(() => { nav.replace.mockReset(); nav.push.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  const PRODUCT_HISTORY = category('PRODUCT', 'Product', [
    skill('PRODUCT_BASICS', 'Product Basics', [], {
      offered: false, archived: [{ code: 'OLD_PRODUCT_TALK', title: 'The old product talk', formats: ['file'], status: 'done', completedAt: '2026-03-02T00:00:00.000Z' }],
    }),
  ], { offered: false });

  it('P18.97-T4 AC-9 draws one tab for each category the read offers — Sales alone, as the server now answers', async () => {
    list('SALES', { 'GET /training/progress': { body: progressView([SALES]) } });
    await title('Training Modules');
    const tabs = screen.getByRole('navigation', { name: 'Training' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Sales']);
  });

  it('P18.97-T4 AC-9 draws no tab for a category read as not offered, though it holds the member’s history', async () => {
    list('SALES', { 'GET /training/progress': { body: progressView([SALES, PRODUCT_HISTORY]) } });
    await title('Training Modules');
    const tabs = screen.getByRole('navigation', { name: 'Training' });
    expect(within(tabs).queryByRole('link', { name: 'Product' })).toBeNull();
  });

  it('P18.97-T4 AC-9 answers its address as not found rather than opening it onto nothing', async () => {
    list('PRODUCT', { 'GET /training/progress': { body: progressView([SALES, PRODUCT_HISTORY]) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'This category can’t be found.' })).toBeInTheDocument();
    expect(screen.queryByText('Modules for this category are coming soon.')).toBeNull();
  });
});
