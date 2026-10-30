import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import {
  atWidth, makeMe, renderInLayout, renderLive, resetLanguage, routeParams, stubFetch, wears, type StubReply,
} from '@test/harness';
import {
  category, LEARNER, PRODUCT, progressView, row, SALES, SHELL_STUBS, skill,
} from '@test/training-fixtures';
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

    it('UI-063 the description shows on a desktop only; a phone and a tablet go from the title to the list', async () => {
      list();
      await title('Training Modules');
      const sub = screen.getByText('Structured modules — tracked here.');
      expect(wears(sub, 375).split(' ')).toContain('hidden');
      expect(wears(sub, 768).split(' ')).toContain('hidden');
      expect(wears(sub, 1280).split(' ')).not.toContain('hidden');
    });

    it('UI-063 keeps ID | EN on the title row below 1024px (ADR-0180 §3: Training keeps its pill), once the switch is live', async () => {
      nav.pathname = '/training/SALES';
      stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() } });
      renderLive(
        <AgentLayout><TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></TrainingLayout></AgentLayout>,
        { me: LEARNER },
      );
      await title('Training Modules');
      const row = document.querySelector('[data-title-row]') as HTMLElement;
      const shown = within(row).getAllByRole('group', { name: /^(Language|Bahasa)$/ })
        .filter((g) => !wears(g, 375).split(' ').includes('hidden') && !wears(g.parentElement!, 375).split(' ').includes('hidden'));
      expect(shown).toHaveLength(1);
      resetLanguage();
    });

    it('P18.5-T1 AC-4, UI-063 draws the category row in the office’s words and order, directly under the title, the current one marked', async () => {
      list();
      await title('Training Modules');
      const tabs = screen.getByRole('navigation', { name: 'Training' });
      expect(within(tabs).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
        ['Sales', '/training/SALES'], ['Product', '/training/PRODUCT'],
      ]);
      expect(within(tabs).getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'page');
      expect(within(tabs).getByRole('link', { name: 'Product' })).not.toHaveAttribute('aria-current');
      // Right after the title row: nothing between them.
      expect(document.querySelector('[data-title-row]')!.nextElementSibling).toBe(tabs);
      expect(screen.queryByRole('heading', { name: /Skills List|Daftar skill/ })).not.toBeInTheDocument();
    });

    it('UI-063 the category row is one line at every width: pills on a phone, underline tabs from 768px', async () => {
      const seven = ['Sales', 'Product', 'Recruiting', 'Team Management', 'Motivation', 'Soft Skills', 'Company and KPM']
        .map((label, i) => category(label.toUpperCase().replace(/ /g, '_'), label, [skill(`S${i}`, `Skill ${i}`, [row(`M${i}`, `Module ${i}`)])]));
      list('SALES', { 'GET /training/progress': { body: progressView(seven) } });
      await title('Training Modules');
      const tabs = screen.getByRole('navigation', { name: 'Training' });
      expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual([
        'Sales', 'Product', 'Recruiting', 'Team Management', 'Motivation', 'Soft Skills', 'Company and KPM',
      ]);
      for (const px of [375, 768, 1280]) {
        expect(wears(tabs, px).split(' ')).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto']));
      }
      expect(tabs).toHaveAttribute('data-tab-row', 'below-desktop');
      const sales = within(tabs).getByRole('link', { name: 'Sales' });
      const pill = sales.firstElementChild!;
      // A phone: a 36px navy pill in a 44px target; the others white.
      expect(wears(sales, 375)).toContain('min-h-11');
      expect(wears(pill, 375).split(' ')).toEqual(expect.arrayContaining(['h-9', 'rounded-pill', 'bg-navy', 'text-white']));
      expect(wears(within(tabs).getByRole('link', { name: 'Product' }).firstElementChild!, 375)).toContain('bg-card');
      // A tablet and a desktop: the accent's underline under the current one, no pill.
      expect(wears(sales, 768).split(' ')).toEqual(expect.arrayContaining(['border-b-2', 'border-amber', 'text-navy']));
      expect(wears(pill, 768)).not.toContain('rounded-pill');
    });

    it('UI-064, UI-066 a desktop draws a card per skill in two columns: its number, name and done/total, then Module · Format · Status · ›', async () => {
      list();
      await title('Training Modules');
      const wide = document.querySelector('[data-skill-list="wide"]')!;
      expect(wide.className).toContain('grid-cols-2');
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        '1Prospecting3/3', '2Needs Analysis1/2', '3Objection Handling0/2', '4Closing0/1', '5Cross-sell0/1', '6Retention0/1',
      ]);
      const prospecting = screen.getByRole('list', { name: 'Prospecting modules' });
      const card = prospecting.closest('[data-skill]')!;
      expect(card.textContent).toMatch(/ModuleFormatStatus/);
      expect(card.textContent).not.toMatch(/No\.|Skill(?!:)/);
      expect(within(prospecting).getAllByRole('link').map((a) => a.querySelector('span')!.textContent)).toEqual([
        'Building Your Prospect List', 'Referral Generation Techniques', 'Cold Approach Scripts',
      ]);
      const header = card.querySelector('div[aria-hidden="true"]')!;
      expect(header.className).toContain('grid-cols-[minmax(0,1fr)_130px_110px_16px]');
      expect(header.className).toContain('text-xs');
    });

    it('UI-064 the whole row is the link to the module, with › and a hover on a desktop; Tab reaches each row', async () => {
      list();
      await title('Training Modules');
      const link = screen.getByRole('link', { name: /^Asking the Right Discovery Questions/ });
      expect(link).toHaveAttribute('href', '/training/SALES/DISCOVERY_QUESTIONS');
      expect(link.tagName).toBe('A');
      expect(link.className).toContain('hover:bg-hover-row');
      expect(link.querySelector('svg')).not.toBeNull();
      expect(screen.getByRole('link', { name: /^Closing Techniques That Work/ })).toHaveAttribute('href', '/training/SALES/CLOSING_TECHNIQUES');
      // The name is a link's text: the module, its format and its status, as the row reads.
      expect(link).toHaveAccessibleName(/Asking the Right Discovery Questions.*In progress/);
    });

    it('UI-065 draws the three pills with their words: Done green, Not started grey, In progress in its existing paint', async () => {
      list();
      await title('Training Modules');
      const needs = screen.getByRole('list', { name: 'Needs Analysis modules' });
      expect(within(needs).getByText('Done')).toHaveAttribute('data-tone', 'green');
      const going = within(needs).getByText('In progress');
      expect(going.className).toContain('bg-amber/15');
      expect(going.className).toContain('text-navy');
      expect(within(screen.getByRole('list', { name: 'Closing modules' })).getByText('Not started')).toHaveAttribute('data-tone', 'grey');
    });

    it('UI-066 draws the kinds present as Format words with their icons, and — for a module holding nothing', async () => {
      list();
      await title('Training Modules');
      const closing = within(screen.getByRole('list', { name: 'Closing modules' })).getByRole('link');
      expect(closing.textContent).toContain('FileLink');
      const retention = within(screen.getByRole('list', { name: 'Retention modules' })).getByRole('link');
      expect(within(retention).getByText('—')).toHaveAttribute('aria-hidden', 'true');
      expect(within(retention).getByText('No material yet').className).toContain('sr-only');
    });

    it('P18.5-T1 AC-4, OD-150 draws no footer: nothing promises a Skill Tracker', async () => {
      list();
      await title('Training Modules');
      expect(document.body.textContent).not.toMatch(/Skill Tracker|Onboarding checklist once/i);
    });

    it('P18.5-T1 AC-4 gives a category with nothing offered the prototype’s empty card and sub-line, and no list', async () => {
      list('PRODUCT');
      await title('Training Modules');
      expect(screen.getAllByText('Modules for this category are coming soon.')).toHaveLength(2);
      // The empty card keeps the category's own title; the heading is the nav item's (P18.95-T9 AC-2).
      expect(screen.getAllByText('Product Training')).toHaveLength(1);
      expect(screen.queryByRole('list', { name: / modules$/ })).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-4 leaves out a skill with nothing offered, and numbers the cards that remain', async () => {
      const sales = category('SALES', 'Sales', [
        skill('EMPTY', 'Empty skill', []),
        skill('CLOSING', 'Closing', [row('CLOSING_TECHNIQUES', 'Closing Techniques That Work')]),
      ]);
      list('SALES', { 'GET /training/progress': { body: progressView([sales]) } });
      await title('Training Modules');
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['1Closing0/1']);
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

    it('P18.5-T1 AC-3 never offers a withdrawn category as a tab or a list', async () => {
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

    it('P18.5-T1 AC-9 marks Training current in the nav (UI-004: *Training*, under *Saya*), a live link with no pill', async () => {
      list();
      await title('Training Modules');
      const item = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Training' });
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

    it('UI-071 waits under a skeleton shaped like the list: rows below 1024px, two columns of cards above, no category row', () => {
      stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() } });
      nav.pathname = '/training/SALES';
      renderInLayout(AgentLayout, <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></TrainingLayout>, { me: LEARNER });
      const skeleton = screen.getByText('Loading training…').closest('[aria-busy], [role="status"]') ?? document.body;
      const shapes = Array.from(skeleton.querySelectorAll('div')).map((d) => d.getAttribute('class') ?? '');
      expect(shapes.some((c) => c.includes('lg:hidden') && c.includes('rounded-lg'))).toBe(true);
      expect(shapes.some((c) => c.includes('grid-cols-2') && c.includes('max-lg:hidden'))).toBe(true);
      expect(shapes.some((c) => c.includes('border-b border-hairline'))).toBe(false);
    });
  });
});

/*
 * **Below 1024px, one card of rows** (UI-065; UI-066's tablet: *the mobile list, not the table*). A phone and a tablet are
 * `atWidth`'s; every spec above is the desktop's two columns of cards.
 */
describe('UI-065 — /training/* below 1024px', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 360, 768])('UI-065 at %ipx: one white card, six skill headers with done/total, ten rows, each a link with ›', async (px) => {
    atWidth(px);
    list();
    await title('Training Modules');
    const lists = document.querySelectorAll('[data-skill-list]');
    expect(lists).toHaveLength(1);
    expect(lists[0]).toHaveAttribute('data-skill-list', 'compact');
    expect(lists[0].className).toContain('rounded-lg');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '1Prospecting3/3', '2Needs Analysis1/2', '3Objection Handling0/2', '4Closing0/1', '5Cross-sell0/1', '6Retention0/1',
    ]);
    const links = within(lists[0] as HTMLElement).getAllByRole('link');
    expect(links).toHaveLength(10);
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
      expect(link.querySelector('svg')).not.toBeNull();
      // No Format, no number, no Skill on a row: the name and the status.
      expect(link.textContent).not.toMatch(/^\d|File|Video|Link|No material yet/);
    }
  });

  it('UI-065 says each row’s status in the same pill, and the whole row links to the module', async () => {
    atWidth(375);
    list();
    await title('Training Modules');
    const rows = within(screen.getByRole('list', { name: 'Needs Analysis modules' })).getAllByRole('link');
    expect(rows.map((r) => r.textContent)).toEqual(['Conducting a Financial Needs AnalysisDone', 'Asking the Right Discovery QuestionsIn progress']);
    expect(within(rows[1]).getByText('In progress').className).toContain('bg-amber/15');
    expect(rows[1]).toHaveAttribute('href', '/training/SALES/DISCOVERY_QUESTIONS');
  });

  it('UI-066 keeps the two columns of cards at 1024px and wider', async () => {
    atWidth(1024);
    list();
    await title('Training Modules');
    expect(document.querySelector('[data-skill-list]')).toHaveAttribute('data-skill-list', 'wide');
  });
});

/**
 * **A category with no published module is not offered to a field member** (P18.97-T4 AC-9, ADR-0176 §9), and **with
 * one category there is no category row at all** (UI-063): `GET /training/progress` leaves such a category out — or,
 * where the member has history under it, reads it as not offered — so the row is the categories the read offers, drawn
 * only when there are two or more.
 */
describe('P18.97-T4 AC-9, UI-063 an empty training category draws no tab', () => {
  beforeEach(() => { nav.replace.mockReset(); nav.push.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  const PRODUCT_HISTORY = category('PRODUCT', 'Product', [
    skill('PRODUCT_BASICS', 'Product Basics', [], {
      offered: false, archived: [{ code: 'OLD_PRODUCT_TALK', title: 'The old product talk', formats: ['file'], status: 'done', completedAt: '2026-03-02T00:00:00.000Z' }],
    }),
  ], { offered: false });

  it('UI-063 one category offered — Sales alone, as the server answers today — draws no category row', async () => {
    list('SALES', { 'GET /training/progress': { body: progressView([SALES]) } });
    await title('Training Modules');
    expect(screen.queryByRole('navigation', { name: 'Training' })).not.toBeInTheDocument();
  });

  it('P18.97-T4 AC-9 a category read as not offered draws no tab, though it holds the member’s history', async () => {
    list('SALES', { 'GET /training/progress': { body: progressView([SALES, PRODUCT_HISTORY]) } });
    await title('Training Modules');
    expect(screen.queryByRole('navigation', { name: 'Training' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Product' })).toBeNull();
  });

  it('P18.97-T4 AC-9 answers its address as not found rather than opening it onto nothing', async () => {
    list('PRODUCT', { 'GET /training/progress': { body: progressView([SALES, PRODUCT_HISTORY]) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'This category can’t be found.' })).toBeInTheDocument();
    expect(screen.queryByText('Modules for this category are coming soon.')).toBeNull();
  });
});
