import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  notFound, PGB, product, READ_ONLY_RINA, RINA_ME, SCRIPT, serverError, SHELF, SHELL_STUBS,
} from '@test/sales-tools-fixtures';
import { SessionContext } from '@/lib/session';
import ProductCatalogLayout from './layout';
import ProductCatalogPage from './page';
import ProductDrawerPage from './[productCode]/page';

const nav = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/product-catalog', search: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

/** The grid alone, at `/product-catalog`. */
function grid(routes: Routes = {}, me = RINA_ME) {
  nav.pathname = '/product-catalog';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } }, ...routes });
  renderInLayout(AgentLayout, <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, { me });
  return stub;
}

/** The drawer over the grid, at `/product-catalog/{code}` — a typed address, or Back to one. */
function drawer(code: string, routes: Routes = {}, me = RINA_ME) {
  nav.pathname = `/product-catalog/${code}`;
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /product-catalog': { body: { products: SHELF } },
    [`GET /product-catalog/${code}`]: { body: product() },
    ...routes,
  });
  renderInLayout(
    AgentLayout,
    <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: code })} /></ProductCatalogLayout>,
    { me },
  );
  return stub;
}

const shelfReady = () => screen.findByRole('heading', { level: 2, name: 'Life' });
const dialog = () => screen.findByRole('dialog', { name: 'PRUMapan (nama kami)' });

describe('/product-catalog, the office’s shelf (P14-T7)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the page, verbatim (AC-1, AC-2)', () => {
    it('P14-T7 AC-1 the nav items are live for a field member, the catalog current', async () => {
      grid();
      await shelfReady();
      const catalog = screen.getByRole('link', { name: 'Product Catalog' });
      expect(catalog).toHaveAttribute('href', '/product-catalog');
      expect(catalog).not.toHaveAttribute('aria-disabled');
      expect(within(catalog).queryByText('Upcoming')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sales Attack Plan' })).toHaveAttribute('href', '/attack-plan');
    });

    it('P14-T7 AC-2 is titled and sub-titled as drawn, and reads the shelf once', async () => {
      const { calls } = grid();
      await shelfReady();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Product Catalog$/);
      expect(screen.getByText(
        'The full individual shelf — conventional and syariah. Click any product for benefits, positioning, and its sales script.',
      )).toBeInTheDocument();
      expect(calls.filter((c) => /\/product-catalog$/.test(c.url))).toHaveLength(1);
    });

    it('P14-T7 AC-2, AC-11 the category tabs and the channel toggle, each saying which is on', async () => {
      grid();
      await shelfReady();
      const tabs = within(screen.getByRole('group', { name: 'Category' })).getAllByRole('button');
      expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-pressed')])).toEqual([
        ['All products', 'true'], ['Life', 'false'], ['Health', 'false'], ['Critical illness', 'false'],
        ['Education', 'false'], ['Investment-linked', 'false'],
      ]);
      const toggle = within(screen.getByRole('group', { name: 'Channel' })).getAllByRole('button');
      expect(toggle.map((t) => [t.textContent, t.getAttribute('aria-pressed')])).toEqual([
        ['All', 'true'], ['Conventional', 'false'], ['Syariah', 'false'],
      ]);
    });

    it('ADR-0137: the chip and the channel that are on stay navy — a filter says what is chosen, it is not an action', async () => {
      grid();
      await shelfReady();
      const [allProducts, life] = within(screen.getByRole('group', { name: 'Category' })).getAllByRole('button');
      const [all, conventional] = within(screen.getByRole('group', { name: 'Channel' })).getAllByRole('button');
      for (const on of [allProducts, all]) {
        expect(on).toHaveClass('bg-navy', 'text-white');
        expect(on).not.toHaveClass('bg-amber');
      }
      for (const off of [life, conventional]) expect(off).not.toHaveClass('bg-navy');
    });

    it('P14-T7 AC-2 a section per category in order, hidden when empty, each with its count', async () => {
      grid();
      await shelfReady();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Life', 'Health', 'Investment-linked']);
      const life = screen.getByRole('region', { name: 'Life' });
      expect(within(life).getByText('2 products')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Health' })).getByText('1 product')).toBeInTheDocument();
    });

    it('P14-T7 AC-2 each card: its channel tag, In run-off where it is, the office’s name, the tagline, View detail →', async () => {
      grid();
      await shelfReady();
      const mapan = document.querySelector('[data-product-card="PRUMAPAN"]') as HTMLElement;
      expect(mapan.tagName).toBe('BUTTON');
      expect(mapan.textContent).toBe('ConventionalPRUMapan (nama kami)Dana pensiun yang cair rutin dari usia 55.View detail →');
      const syariah = document.querySelector('[data-product-card="PRUSEHAT_SYARIAH"]') as HTMLElement;
      expect(within(syariah).getByText('Syariah')).toHaveClass('text-navy');
      const pgb = document.querySelector('[data-product-card="PRULINK_GENERASI_BARU_PGB"]') as HTMLElement;
      expect(within(pgb).getByText('In run-off')).toHaveClass('text-alert');
    });

    it('P14 exit review: a card’s button holds phrasing content only — its tags a <span>, no <div> inside', async () => {
      grid();
      await shelfReady();
      for (const card of document.querySelectorAll('[data-product-card]')) {
        expect([card.getAttribute('data-product-card'), card.querySelectorAll('div').length])
          .toEqual([card.getAttribute('data-product-card'), 0]);
      }
    });
  });

  describe('the filters, in the address (D-urls)', () => {
    it('a tab replaces the address with its category; the toggle with its channel', async () => {
      grid();
      await shelfReady();
      await userEvent.click(screen.getByRole('button', { name: 'Health' }));
      expect(nav.replace).toHaveBeenCalledWith('/product-catalog?category=health', { scroll: false });
      await userEvent.click(screen.getByRole('button', { name: 'Syariah' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/product-catalog?channel=syariah', { scroll: false });
    });

    it('draws what the address asks for', async () => {
      nav.search = 'channel=syariah';
      grid();
      await screen.findByRole('heading', { level: 2, name: 'Health' });
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Health']);
      expect(screen.getByRole('button', { name: 'Syariah' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('P14-T7 AC-2 says so when nothing matches the filter', async () => {
      nav.search = 'category=education';
      grid();
      expect(await screen.findByText('No products match this filter.')).toBeInTheDocument();
    });

    it('P14-T7 AC-4 a card opens the drawer’s address over the grid, the filters with it', async () => {
      nav.search = 'category=life';
      grid();
      await shelfReady();
      await userEvent.click(document.querySelector('[data-product-card="PRUMAPAN"]') as HTMLElement);
      expect(nav.push).toHaveBeenCalledWith('/product-catalog/PRUMAPAN?category=life', { scroll: false });
    });
  });

  describe('the states the prototype lacks (AC-10)', () => {
    it('a skeleton while the shelf loads, announced', async () => {
      grid({ 'GET /product-catalog': [{ body: { products: SHELF } }] });
      expect((await screen.findByText('Loading products…')).closest('[role="status"]')).not.toBeNull();
      await shelfReady();
    });

    it('an error with a retry that reads again', async () => {
      const { calls } = grid({ 'GET /product-catalog': [serverError, { body: { products: SHELF } }] });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await shelfReady();
      expect(calls.filter((c) => /\/product-catalog$/.test(c.url))).toHaveLength(2);
    });

    it('the empty shelf — a company with no catalog, or nothing kept on', async () => {
      grid({ 'GET /product-catalog': { body: { products: [] } } });
      expect(await screen.findByText('There are no products on your shelf yet.')).toBeInTheDocument();
      expect(screen.getByText('Products appear here once they are made available to you.')).toBeInTheDocument();
      expect(screen.queryByText('No products match this filter.')).not.toBeInTheDocument();
    });

    it('P14-T7 AC-12 a read-only support session reads the page, which has no write control to draw', async () => {
      grid({}, READ_ONLY_RINA);
      await shelfReady();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });
});

describe('/product-catalog/[productCode], the drawer (P14-T7)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the dialog (AC-4, AC-11)', () => {
    it('P14-T7 AC-11 is a dialog named by the product, the focus moved into it, over an inert grid', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      expect(box).toHaveAttribute('aria-modal', 'true');
      expect(box.contains(document.activeElement)).toBe(true);
      expect(document.querySelector('[data-product-card="PRUMAPAN"]')!.closest('[inert]')).not.toBeNull();
    });

    it('P14-T7 AC-4 the tags, the name and the tagline, verbatim', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      expect(within(box).getByText('Conventional')).toBeInTheDocument();
      expect(within(box).getByRole('heading', { level: 2, name: 'PRUMapan (nama kami)' })).toBeInTheDocument();
      expect(within(box).getByText('Dana pensiun yang cair rutin dari usia 55.')).toBeInTheDocument();
    });

    it('P14-T7 AC-4, AC-11 the three tabs are a tab list; arrows move between them', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      const tabs = within(box).getAllByRole('tab');
      expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([
        ['Details', 'true'], ['Attack Plan', 'false'], ['Documents', 'false'],
      ]);
      expect(within(box).getByRole('tabpanel', { name: 'Details' })).toBeInTheDocument();
      tabs[0].focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(within(box).getByRole('tab', { name: 'Attack Plan' })).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(within(box).getByRole('tab', { name: 'Attack Plan' }));
      expect(within(box).getByRole('tabpanel', { name: 'Attack Plan' })).toBeInTheDocument();
    });

    it('P14-T7 AC-4 ✕, the scrim and Escape close it — to the grid’s address when it was typed', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      await userEvent.click(within(box).getByRole('button', { name: 'Close' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/product-catalog', { scroll: false });
      await userEvent.keyboard('{Escape}');
      expect(nav.replace).toHaveBeenCalledTimes(2);
      await userEvent.click(document.querySelector('[data-scrim]') as HTMLElement);
      expect(nav.replace).toHaveBeenCalledTimes(3);
      expect(nav.back).not.toHaveBeenCalled();
    });

    it('P14-T7 AC-4 closing a drawer the grid opened goes back, so Back and ✕ agree', async () => {
      nav.search = 'category=life';
      drawer('PRUMAPAN');
      await dialog();
      // The grid opened it: a card pushed the address.
      await userEvent.click(document.querySelector('[data-product-card="PRUMAPAN"]') as HTMLElement, { pointerEventsCheck: 0 });
      expect(nav.push).toHaveBeenCalledWith('/product-catalog/PRUMAPAN?category=life', { scroll: false });
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(nav.back).toHaveBeenCalledTimes(1);
    });

    it('P14-T7 AC-11 as it closes, the focus goes back to the product’s card', async () => {
      nav.pathname = '/product-catalog/PRUMAPAN';
      stubFetch({ ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRUMAPAN': { body: product() } });
      const view = renderInLayout(
        AgentLayout,
        <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>,
        { me: RINA_ME },
      );
      await dialog();
      await shelfReady();
      // Back: the grid's address, the drawer gone.
      nav.pathname = '/product-catalog';
      view.rerender(
        <SessionContext.Provider value={view.session}>
          <Suspense fallback={null}>
            <AgentLayout><ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout></AgentLayout>
          </Suspense>
        </SessionContext.Provider>,
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(document.activeElement).toBe(document.querySelector('[data-product-card="PRUMAPAN"]'));
    });

    it('P14-T7 AC-10 a product the office does not keep on, or that does not exist, is the not-found state', async () => {
      drawer('PRUSMART_PLAN', { 'GET /product-catalog/PRUSMART_PLAN': notFound });
      expect(await screen.findByText('This product isn\'t on your shelf.')).toBeInTheDocument();
      expect(screen.getByText('It may have been withdrawn or switched off, or the address may be mistyped.')).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Product Catalog' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Product Catalog' }));
      expect(nav.replace).toHaveBeenCalledWith('/product-catalog', { scroll: false });
    });

    it('P14-T7 AC-10 a skeleton while the product loads, and an error with a retry', async () => {
      drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': [serverError, { body: product() }] });
      expect((await screen.findByText('Loading this product…')).closest('[role="status"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await dialog();
    });
  });

  describe('Details (AC-5)', () => {
    it('P14-T7 AC-5 the commission table, Year · Rate, a row per year, as percentages (OD-135)', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      const table = within(box).getByRole('table', { name: 'Commission rate' });
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Year', 'Rate']);
      expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Y130%', 'Y215%', 'Y35%']);
    });

    it('P14-T7 AC-5 the not-set line while the company states none — never an invented 40% / 20% (F-15)', async () => {
      drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body: product({ commissionSchedule: [] }) } });
      const box = await dialog();
      expect(within(box).getByText('Not set yet — the company has not given a rate for this product.')).toBeInTheDocument();
      expect(within(box).queryByRole('table')).not.toBeInTheDocument();
      expect(box.textContent).not.toMatch(/40%|20%/);
    });

    it('P14-T7 AC-5 draws no Commission rate at all for a reader the read leaves it out for', async () => {
      drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body: product({ commissionSchedule: undefined }) } });
      const box = await dialog();
      expect(within(box).queryByText('Commission rate')).not.toBeInTheDocument();
    });

    it('P14-T7 AC-5 Benefits, How it stands out, Best-fit customer, and the CTA to the plan page', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      expect(within(box).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        'Commission rate', 'Benefits', 'How it stands out', 'Best-fit customer',
      ]);
      expect(within(box).getByText('The accessible retirement-income option.')).toBeInTheDocument();
      expect(within(box).getByRole('link', { name: 'Open full Attack Plan page' }))
        .toHaveAttribute('href', '/attack-plan?product=PRUMAPAN');
    });

    it('P14-T7 AC-5 a run-off product: its note, and No active sales script, disabled', async () => {
      drawer('PRULINK_GENERASI_BARU_PGB', { 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      const box = await screen.findByRole('dialog', { name: 'PRULink Generasi Baru (PGB)' });
      expect(within(box).getByText(
        'In run-off — not actively issued to new applicants. Shown for reference only; not part of the current sales shelf.',
      )).toBeInTheDocument();
      expect(within(box).getByRole('button', { name: 'No active sales script' })).toBeDisabled();
      expect(within(box).queryByRole('link', { name: 'Open full Attack Plan page' })).not.toBeInTheDocument();
    });
  });

  describe('Attack Plan (AC-6)', () => {
    const planTab = async (body = product()) => {
      drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body } });
      const box = await dialog();
      await userEvent.click(within(box).getByRole('tab', { name: 'Attack Plan' }));
      return within(within(box).getByRole('tabpanel', { name: 'Attack Plan' }));
    };

    it('P14-T7 AC-6 the six numbered blocks, the approved words or the company’s, and the plan page’s link', async () => {
      const panel = await planTab();
      expect(panel.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Good fit for', '11 Opening line', '22 Lead with these benefits', '33 Full script — how to narrate it',
        '44 If they push back', '55 Next action',
      ]);
      expect(panel.getByText(`“${SCRIPT.opening}”`)).toBeInTheDocument();
      expect(panel.getByText(`“${SCRIPT.objectionTheySay}”`)).toBeInTheDocument();
      expect(panel.getByText(SCRIPT.objectionYouSay)).toBeInTheDocument();
      expect(panel.getByRole('link', { name: 'Open in Sales Attack Plan page (add customer age & budget for a fit check) →' }))
        .toHaveAttribute('href', '/attack-plan?product=PRUMAPAN');
    });

    it('P14-T7 AC-6 D-noscript: Good fit for, the benefits, the push-back, and the line — each from its own field', async () => {
      const panel = await planTab(product({ script: { ...SCRIPT, fullScript: '' } }));
      expect(panel.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Good fit for', '11 Lead with these benefits', '22 If they push back',
      ]);
      expect(panel.getByText('No authored script yet for this product.')).toBeInTheDocument();
    });

    it('P14-T7 AC-6 a run-off product shows its note instead, and no link', async () => {
      drawer('PRULINK_GENERASI_BARU_PGB', { 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      const box = await screen.findByRole('dialog', { name: 'PRULink Generasi Baru (PGB)' });
      await userEvent.click(within(box).getByRole('tab', { name: 'Attack Plan' }));
      expect(within(box).getByText(
        'This product is in run-off — no active sales script. Use the Details tab for reference information only.',
      )).toBeInTheDocument();
      expect(within(box).queryByRole('link', { name: /Open in Sales Attack Plan page/ })).not.toBeInTheDocument();
    });

    it('P14-T7 AC-6 every authored field is rendered as text: a bold tag and a script tag print as characters', async () => {
      const marked = 'Halo <b>Pak</b><script>noop</script>';
      const panel = await planTab(product({
        script: {
          goodFit: marked, opening: marked, benefits: [marked], fullScript: marked,
          objectionTheySay: marked, objectionYouSay: marked, nextAction: marked,
        },
      }));
      const box = screen.getByRole('dialog');
      expect(box.querySelector('b')).toBeNull();
      expect(box.querySelector('script')).toBeNull();
      expect(panel.getAllByText(/<b>Pak<\/b><script>noop<\/script>/).length).toBe(7);
    });
  });

  describe('Documents (AC-7)', () => {
    it('P14-T7 AC-7 the three slots in order: Open link →, or Not uploaded by KPM yet.', async () => {
      drawer('PRUMAPAN');
      const box = await dialog();
      await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
      const rows = [...box.querySelectorAll('[data-slot]')].map((r) => r.textContent);
      expect(rows).toEqual([
        'BrochureBrochure — opens in a new tabOpen link →', 'Illustration / SimulationNot uploaded by KPM yet.',
        'Product DocumentNot uploaded by KPM yet.',
      ]);
    });

    it('P14-T7 AC-7 signs the link when asked, and opens it in a new tab cut from this page', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const open = vi.fn(() => tab);
      vi.stubGlobal('open', open);
      const { calls } = drawer('PRUMAPAN', {
        'GET /product-catalog/PRUMAPAN/documents/brochure/url': {
          body: { url: 'https://cdn.test/brochure?sig=abc', expiresAt: '2026-10-08T02:05:00.000Z' },
        },
      });
      const box = await dialog();
      await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
      const link = within(box).getByRole('button', { name: 'Open link →' });
      expect(link).toHaveAccessibleDescription('Brochure — opens in a new tab');
      await userEvent.click(link);
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/brochure?sig=abc'));
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(tab.opener).toBeNull();
      expect(calls.some((c) => c.url.endsWith('/product-catalog/PRUMAPAN/documents/brochure/url'))).toBe(true);
    });

    it('P14 exit review: while it signs, Open link → stays focusable in the dialog and ignores a second click', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const open = vi.fn(() => tab);
      vi.stubGlobal('open', open);
      const { mock } = drawer('PRUMAPAN', {
        'GET /product-catalog/PRUMAPAN/documents/brochure/url': {
          body: { url: 'https://cdn.test/brochure?sig=abc', expiresAt: '2026-10-08T02:05:00.000Z' },
        },
      });
      // Hold the signing open, so the link can be seen while it waits.
      let release!: () => void;
      const signing = new Promise<void>((resolve) => { release = resolve; });
      const answer = mock.getMockImplementation()!;
      mock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/documents/brochure/url')) await signing;
        return answer(url, init);
      });
      const box = await dialog();
      await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
      const link = within(box).getByRole('button', { name: 'Open link →' });

      await userEvent.click(link);
      // Not `disabled`, which would drop the focus out of the modal: announced as unavailable, and kept.
      expect(link).not.toBeDisabled();
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(document.activeElement).toBe(link);
      await userEvent.click(link);
      expect(mock.mock.calls.filter(([url]) => String(url).includes('/documents/brochure/url'))).toHaveLength(1);
      expect(open).toHaveBeenCalledTimes(1);

      release();
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/brochure?sig=abc'));
      expect(link).not.toHaveAttribute('aria-disabled');
      expect(document.activeElement).toBe(link);
    });

    it('P14-T7 AC-7 a link that cannot be signed closes the tab and says why', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      vi.stubGlobal('open', vi.fn(() => tab));
      drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN/documents/brochure/url': notFound });
      const box = await dialog();
      await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
      await userEvent.click(within(box).getByRole('button', { name: 'Open link →' }));
      expect(await within(box).findByRole('alert')).toHaveTextContent('Product not found.');
      expect(within(box).getByText('Could not open this document.')).toBeInTheDocument();
      expect(tab.close).toHaveBeenCalled();
    });
  });
});
