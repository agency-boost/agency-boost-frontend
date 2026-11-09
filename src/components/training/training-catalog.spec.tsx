import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import TrainingLayout from '@/app/(agent)/training/layout';
import TrainingCategoryPage from '@/app/(agent)/training/[categoryCode]/page';
import { atWidth, renderInLayout, routeParams, stubFetch, wears } from '@test/harness';
import { category, LEARNER, progressView, row, SALES, SHELL_STUBS, skill } from '@test/training-fixtures';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), pathname: '/training/SALES' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => ({}),
}));

/** Every category KPM 0000 publishes, as the owner saw them on a phone on 3 November — and one no longer offered. */
const oneModule = (code: string) => [skill(`${code}_SKILL`, `${code} skill`, [row(`${code}_MOD`, `${code} module`)])];
const CATEGORIES = [
  SALES,
  category('PRODUK', 'Produk', oneModule('PRODUK')),
  category('RECRUITMENT', 'Recruitment', oneModule('RECRUITMENT')),
  category('MANAJEMEN', 'Manajemen tim', oneModule('MANAJEMEN')),
  category('LEGACY', 'Legacy', [], { offered: false }),
];

function list(code = 'SALES') {
  nav.pathname = `/training/${code}`;
  stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView(CATEGORIES) } });
  renderInLayout(
    AgentLayout,
    <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: code })} /></TrainingLayout>,
    { me: LEARNER },
  );
}

/** The row's widths, which jsdom never lays out: `content` wide inside `visible`. */
function layOut(strip: HTMLElement, { content, visible }: { content: number; visible: number }) {
  let left = 0;
  Object.defineProperty(strip, 'scrollWidth', { configurable: true, get: () => content });
  Object.defineProperty(strip, 'clientWidth', { configurable: true, get: () => visible });
  Object.defineProperty(strip, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (v: number) => { left = Math.max(0, Math.min(content - visible, v)); },
  });
}

/**
 * **Training on a phone shows every published category** (P19-T6 AC-5; the 11-06 handover's UI-167, *"Training on phone
 * shows only Sales"*): each category the office offers is a tab in the row under the title, in its order, and a row
 * wider than the phone says so with a fade at the side that has more.
 */
describe('P19-T6 AC-5 the training categories on a 375px phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T6 AC-5 draws every published category as a tab, in the office’s order, and no withdrawn one', async () => {
    atWidth(375);
    list();
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    expect(within(strip).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Sales', 'Produk', 'Recruitment', 'Manajemen tim',
    ]);
    expect(within(strip).getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'page');
    expect(within(strip).queryByRole('link', { name: 'Legacy' })).not.toBeInTheDocument();
  });

  it('P19-T6 AC-5 keeps the row on one line that scrolls sideways at 375px, every tab its full width', async () => {
    atWidth(375);
    list();
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    const drawn = wears(strip, 375).split(' ');
    expect(drawn).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto']));
    for (const tab of within(strip).getAllByRole('link')) {
      expect(wears(tab, 375).split(' ')).toEqual(expect.arrayContaining(['shrink-0', 'whitespace-nowrap']));
    }
  });

  it('P19-T6 AC-5 cues that the row scrolls: a fade at the side with more, which follows the reader', async () => {
    atWidth(375);
    list();
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    // Four pills of KPM 0000's names are about 470px; a 375px phone shows 343 of them inside its gutters.
    layOut(strip, { content: 470, visible: 343 });
    fireEvent.scroll(strip);
    expect(strip).toHaveAttribute('data-fade', 'end');

    strip.scrollLeft = 60;
    fireEvent.scroll(strip);
    expect(strip).toHaveAttribute('data-fade', 'both');

    strip.scrollLeft = 127;
    fireEvent.scroll(strip);
    expect(strip).toHaveAttribute('data-fade', 'start');
  });

  it('P19-T6 AC-5 shows no fade when every tab fits', async () => {
    atWidth(375);
    list();
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    layOut(strip, { content: 300, visible: 343 });
    fireEvent.scroll(strip);
    expect(strip).not.toHaveAttribute('data-fade');
  });

  it('P19-T6 AC-5 leads each tab to its own category’s modules', async () => {
    atWidth(375);
    list();
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    expect(within(strip).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/training/SALES', '/training/PRODUK', '/training/RECRUITMENT', '/training/MANAJEMEN',
    ]);
  });

  it('P19-T6 AC-5 opens a category other than the first with its own tab current', async () => {
    atWidth(375);
    list('MANAJEMEN');
    const strip = await screen.findByRole('navigation', { name: 'Training' });
    expect(within(strip).getByRole('link', { name: 'Manajemen tim' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('MANAJEMEN module')).toBeInTheDocument();
  });
});

/** P19.6-T4 (UI-161, ADR-0220 §2): each skill and module one short line, its *Deskripsi singkat* under it in grey. */
describe('short names with a grey description (P19.6-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const described = [category('SALES', 'Sales', [
    skill('LEADS_GEN', 'Leads generation', [
      row('LEADS_101', 'Media sosial', { description: 'Dari konten ke janji temu' }),
      row('LEADS_102', 'Referensi'),
    ], { description: '8 cara mendapat calon nasabah' }),
  ])];
  const show = () => {
    nav.pathname = '/training/SALES';
    stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView(described) } });
    renderInLayout(
      AgentLayout,
      <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></TrainingLayout>,
      { me: LEARNER },
    );
  };

  it.each([375, 1280])('P19.6-T4 AC-1 at %ipx the skill and the module read their name, with the description under it in grey', async (px) => {
    atWidth(px);
    show();
    const heading = await screen.findByRole('heading', { level: 2, name: /Leads generation/ });
    expect(within(heading).getByText('8 cara mendapat calon nasabah')).toHaveClass('text-muted', 'block');
    const link = screen.getByRole('link', { name: /Media sosial/ });
    expect(within(link).getByText('Dari konten ke janji temu')).toHaveClass('text-muted', 'block');
    // A module with none draws no second line.
    expect(screen.getByRole('link', { name: /Referensi/ }).querySelectorAll('.text-muted.block')).toHaveLength(0);
  });
});

