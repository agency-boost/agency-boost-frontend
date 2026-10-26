import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import {
  notFound, PGB, plan, product, READ_ONLY_RINA, RINA_ME, SCRIPT, serverError, SHELF, SHELL_STUBS,
} from '@test/sales-tools-fixtures';
import { SessionContext } from '@/lib/session';
import AttackPlanPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/attack-plan',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Query = Record<string, string>;
type Routes = Record<string, StubReply | StubReply[]>;

/** The page at an address, as the App Router hands it its query: a settled thenable. */
const searchParams = (query: Query) => Object.assign(Promise.resolve(query), { status: 'fulfilled', value: query });

function show(query: Query = {}, routes: Routes = {}, me = RINA_ME) {
  const stub = stubFetch({
    ...SHELL_STUBS, 'GET /attack-plan': { body: plan() }, 'GET /product-catalog': { body: { products: SHELF } }, ...routes,
  });
  const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams(query)} />, { me });
  return { ...stub, ...view };
}

const BRIEF = { need: 'retirement', age: '2', budget: '2' };

/**
 * The same page at a new address, as the App Router renders it: the tree kept, the query new — which is
 * how the page keeps the brief chosen and knows a plan was asked for.
 */
function navigate(view: ReturnType<typeof renderInLayout>, query: Query) {
  view.rerender(
    <SessionContext.Provider value={view.session}>
      <Suspense fallback={null}>
        <AgentLayout><AttackPlanPage searchParams={searchParams(query)} /></AgentLayout>
      </Suspense>
    </SessionContext.Provider>,
  );
}
const result = (name = 'PRUMapan (nama kami)') => screen.findByRole('heading', { level: 2, name });
const group = (name: string) => screen.getByRole('group', { name });

describe('/attack-plan, the Sales Attack Plan (P14-T8)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the brief, verbatim (AC-1, AC-2)', () => {
    it('P14-T8 AC-1 the nav item is live and current', async () => {
      show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      const item = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Sales Attack Plan' });
      expect(item).toHaveAttribute('href', '/attack-plan');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it('P18.8-T12 AC-2 the tabs Sales Attack Plan | Product Catalog under the title, this one current', async () => {
      show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      const tabs = screen.getByRole('navigation', { name: 'Sales tools' });
      const links = within(tabs).getAllByRole('link');
      expect(links.map((l) => [l.textContent, l.getAttribute('href'), l.getAttribute('aria-current')])).toEqual([
        ['Sales Attack Plan', '/attack-plan', 'page'], ['Product Catalog', '/product-catalog', null],
      ]);
      // Beneath the page's own title and sub-line, as `/activity/*`'s strip is.
      expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Route tabs, not a tablist: a `tab` promises a panel in this document.
      expect(within(tabs).queryByRole('tab')).not.toBeInTheDocument();
    });

    it('P14-T8 AC-2 the title, the sub-line, the step pills, the card and its hint; no plan read yet, the shelf read once', async () => {
      const { calls } = show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Sales Attack Plan$/);
      expect(screen.getByText('Tell us about the customer. Get the product, the pitch, and the objection response.')).toBeInTheDocument();
      const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
      expect(steps.map((s) => s.textContent)).toEqual(['11 Customer brief', '22 Attack plan']);
      expect(steps[0]).toHaveAttribute('aria-current', 'step');
      expect(screen.getByText('Three questions. Enough to get a defensible recommendation, fast.')).toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/attack-plan'))).toEqual([]);
      expect(calls.filter((c) => c.url.includes('/product-catalog')).map((c) => c.url)).toEqual(['http://api.test/api/v1/product-catalog']);
    });

    it('P14-T8 AC-2, AC-11 three labelled groups of toggle buttons, the chips verbatim, nothing chosen', async () => {
      show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      const chips = (name: string) => within(group(name)).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
      expect(chips('Primary need').map(([t]) => t)).toEqual([
        'Life protection', 'Health', 'Critical illness', 'Accident-only', 'Education', 'Investment', 'Retirement income',
        'Legacy / inheritance',
      ]);
      expect(chips('Age band').map(([t]) => t)).toEqual(['< 25', '25–34', '35–49', '50–64', '65+']);
      expect(chips('Monthly premium budget').map(([t]) => t)).toEqual([
        '< Rp 500 rb', 'Rp 500 rb–Rp 2 jt', 'Rp 2 jt–Rp 5 jt', 'Rp 5 jt–Rp 10 jt', 'Rp 10 jt–Rp 20 jt', '> Rp 20 jt', 'Lump-sum',
      ]);
      for (const name of ['Primary need', 'Age band', 'Monthly premium budget']) {
        expect(chips(name).every(([, pressed]) => pressed === 'false')).toBe(true);
      }
    });

    it('P14-T8 AC-2 Build is disabled, with its note, until the brief is complete; then the note empties', async () => {
      show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      const build = screen.getByRole('button', { name: 'Build attack plan' });
      expect(build).toBeDisabled();
      expect(screen.getByText('Pick a need, age band, and budget to continue.')).toBeInTheDocument();
      await userEvent.click(within(group('Primary need')).getByRole('button', { name: 'Retirement income' }));
      await userEvent.click(within(group('Age band')).getByRole('button', { name: '25–34' }));
      expect(build).toBeDisabled();
      await userEvent.click(within(group('Monthly premium budget')).getByRole('button', { name: 'Rp 500 rb–Rp 2 jt' }));
      expect(build).toBeEnabled();
      expect(screen.queryByText('Pick a need, age band, and budget to continue.')).not.toBeInTheDocument();
      expect(within(group('Age band')).getByRole('button', { name: '25–34' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('P14-T8 AC-7 Build puts the brief in the address', async () => {
      show();
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(group('Primary need')).getByRole('button', { name: 'Health' }));
      await userEvent.click(within(group('Age band')).getByRole('button', { name: '65+' }));
      await userEvent.click(within(group('Monthly premium budget')).getByRole('button', { name: 'Lump-sum' }));
      await userEvent.click(screen.getByRole('button', { name: 'Build attack plan' }));
      expect(nav.push).toHaveBeenCalledWith('/attack-plan?need=health&age=5&budget=7', { scroll: false });
    });

    it('P14-T8 AC-7 a brief address with a band out of range opens the brief with nothing chosen', async () => {
      const { calls } = show({ need: 'health', age: '9', budget: '2' });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      for (const name of ['Primary need', 'Age band', 'Monthly premium budget']) {
        expect(within(group(name)).getAllByRole('button').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
      }
      expect(calls.filter((c) => c.url.includes('/attack-plan'))).toEqual([]);
    });
  });

  describe('the plan (AC-3)', () => {
    it('P14-T8 AC-7 a refresh keeps the plan: the brief in the address is read, once — and the catalog not at all', async () => {
      const { calls } = show(BRIEF);
      await result();
      expect(calls.filter((c) => c.url.includes('/attack-plan')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/attack-plan?need=retirement&age=2&budget=2']);
      // P14 exit review: the plan says whether the shelf is empty (`shelfEmpty`), so nothing reads the catalog to know.
      expect(calls.filter((c) => c.url.includes('/product-catalog'))).toEqual([]);
    });

    it('P14-T8 AC-3 the summary, the result card — tag, the office’s name, tagline, pill — the blocks and the alternative', async () => {
      show(BRIEF);
      await result();
      expect(screen.getByLabelText('Customer brief').textContent).toBe('Need: Retirement incomeAge: 25–34Budget: Rp 500 rb–Rp 2 jt');
      expect(screen.getByText('Retirement income · Conventional')).toBeInTheDocument();
      expect(screen.getByText('Dana pensiun yang cair rutin dari usia 55.')).toBeInTheDocument();
      expect(screen.getByText('Good fit')).toHaveAttribute('data-tone', 'success');
      expect(screen.queryByText(/Outside the typical/)).not.toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Good fit for', '11 Opening line', '22 Lead with these benefits', '33 Full script — how to narrate it',
        '44 If they push back', '55 Next action',
      ]);
      expect(screen.getByText(SCRIPT.fullScript)).toBeInTheDocument();
      expect(screen.getByText('Also matches this need — click to switch the plan above:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PRUAnugerah' })).toBeInTheDocument();
      expect(screen.queryByText(/more also match/)).not.toBeInTheDocument();
    });

    it('P14-T8 AC-3 Check fit, in words, with the note naming what is outside', async () => {
      show({ need: 'retirement', age: '5', budget: '6' }, {
        'GET /attack-plan': { body: plan({ verdict: 'check_fit', outside: ['age'], product: product({ name: 'PRUAnugerah' }), alternatives: [] }) },
      });
      await result('PRUAnugerah');
      expect(screen.getByText('Check fit')).toHaveAttribute('data-tone', 'alert');
      expect(screen.getByText(
        'Outside the typical age band for this product — still workable, but check eligibility and premium sizing before quoting.',
      )).toBeInTheDocument();
      expect(screen.queryByText('Also matches this need — click to switch the plan above:')).not.toBeInTheDocument();
    });

    it('P14-T8 AC-3 four chips and the more line past them', async () => {
      const alternatives = ['A', 'B', 'C', 'D'].map((c) => ({ code: c, name: `Product ${c}` }));
      show({ need: 'health', age: '2', budget: '2' }, { 'GET /attack-plan': { body: plan({ alternatives, moreCount: 3 }) } });
      await result();
      expect(screen.getAllByRole('button', { name: /^Product / })).toHaveLength(4);
      expect(screen.getByText('3 more also match. Open the Product Catalog to browse the full shelf.')).toBeInTheDocument();
    });

    it('P14-T8 AC-3 when nothing the office keeps on serves the need, the no-match line', async () => {
      show({ need: 'education', age: '2', budget: '2' }, {
        'GET /attack-plan': { body: plan({ product: null, verdict: null, alternatives: [] }) },
        'GET /product-catalog': { body: { products: SHELF } },
      });
      expect(await screen.findByText('No active product matches this need. Try a different need in the brief.')).toBeInTheDocument();
    });

    it('P14-T8 AC-10 the empty shelf, in the catalog’s words, in the brief’s place', async () => {
      show({}, { 'GET /product-catalog': { body: { products: [] } } });
      expect(await screen.findByText('There are no products on your shelf yet.')).toBeInTheDocument();
      expect(screen.getByText('Products appear here once they are made available to you.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Who are we talking to?' })).not.toBeInTheDocument();
    });

    it('P14-T8 AC-10 a plan address over an empty shelf says so too, not that the need has no match — from the plan alone', async () => {
      const { calls } = show(BRIEF, {
        'GET /attack-plan': { body: plan({ product: null, verdict: null, alternatives: [], shelfEmpty: true }) },
      });
      expect(await screen.findByText('There are no products on your shelf yet.')).toBeInTheDocument();
      expect(screen.queryByText(/No active product matches this need/)).not.toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/product-catalog'))).toEqual([]);
    });

    it('P14 exit review: back on the brief after a plan said the shelf is empty, the empty shelf — with no catalog read', async () => {
      const stub = stubFetch({
        ...SHELL_STUBS, 'GET /attack-plan': { body: plan({ product: null, verdict: null, alternatives: [], shelfEmpty: true }) },
      });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams(BRIEF)} />, { me: RINA_ME });
      await screen.findByText('There are no products on your shelf yet.');
      navigate(view, {});
      await waitFor(() => expect(screen.queryByLabelText('Customer brief')).not.toBeInTheDocument());
      expect(screen.getByText('There are no products on your shelf yet.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Who are we talking to?' })).not.toBeInTheDocument();
      expect(stub.calls.filter((c) => c.url.includes('/product-catalog'))).toEqual([]);
    });

    it('P14-T8 AC-10 a skeleton while the plan is built, and an error with a retry that keeps the brief', async () => {
      const { calls } = show(BRIEF, { 'GET /attack-plan': [serverError, { body: plan() }] });
      expect((await screen.findByText('Building your attack plan…')).closest('[role="status"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(screen.getByLabelText('Customer brief')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await result();
      expect(calls.filter((c) => c.url.includes('/attack-plan?need=retirement&age=2&budget=2'))).toHaveLength(2);
    });

    it('P14-T8 AC-3 Back and the first step’s pill return to the brief, adding no history: a plan opened by its address replaces it', async () => {
      show(BRIEF);
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/attack-plan', { scroll: false });
      await userEvent.click(screen.getByRole('button', { name: '1 Customer brief' }));
      expect(nav.replace).toHaveBeenCalledTimes(2);
      expect(nav.push).not.toHaveBeenCalled();
      expect(nav.back).not.toHaveBeenCalled();
    });

    it('P14 exit review: Back from a plan this screen built goes back — the brief’s own entry, not a new one', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /attack-plan': { body: plan() }, 'GET /product-catalog': { body: { products: SHELF } } });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams({})} />, { me: RINA_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(group('Primary need')).getByRole('button', { name: 'Retirement income' }));
      await userEvent.click(within(group('Age band')).getByRole('button', { name: '25–34' }));
      await userEvent.click(within(group('Monthly premium budget')).getByRole('button', { name: 'Rp 500 rb–Rp 2 jt' }));
      await userEvent.click(screen.getByRole('button', { name: 'Build attack plan' }));
      navigate(view, BRIEF);
      await result();

      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(nav.back).toHaveBeenCalledTimes(1);
      expect(nav.push).toHaveBeenCalledTimes(1); // Build's, and only Build's.
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('P14-T8 AC-3 back on the brief, it is as it was', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /attack-plan': { body: plan() }, 'GET /product-catalog': { body: { products: SHELF } } });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams(BRIEF)} />, { me: RINA_ME });
      await result();
      navigate(view, {});
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      expect(within(group('Primary need')).getByRole('button', { name: 'Retirement income' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(group('Monthly premium budget')).getByRole('button', { name: 'Rp 500 rb–Rp 2 jt' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Build attack plan' })).toBeEnabled();
    });

    it('P14-T8 AC-9 every authored field is rendered as text', async () => {
      const marked = 'Halo <b>Pak</b><script>noop</script>';
      show(BRIEF, {
        'GET /attack-plan': {
          body: plan({
            product: product({
              script: {
                goodFit: marked, opening: marked, benefits: [marked], fullScript: marked,
                objectionTheySay: marked, objectionYouSay: marked, nextAction: marked,
              },
            }),
          }),
        },
      });
      await result();
      expect(document.querySelector('main b, main script')).toBeNull();
      expect(screen.getAllByText(/<b>Pak<\/b><script>noop<\/script>/)).toHaveLength(7);
    });

    it('D-noscript on the page: Opening line from Good fit for, and Next action saying there is no script', async () => {
      show(BRIEF, { 'GET /attack-plan': { body: plan({ product: product({ script: { ...SCRIPT, fullScript: '' } }) }) } });
      await result();
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Good fit for', '11 Opening line', '22 Lead with these benefits', '33 If they push back', '44 Next action',
      ]);
      expect(screen.getByText(`“${SCRIPT.goodFit}”`)).toBeInTheDocument();
      expect(screen.getByText('No authored script yet for this product — confirm details manually before proposing.')).toBeInTheDocument();
    });

    it('P14-T8 AC-12 a read-only support session builds a plan', async () => {
      show(BRIEF, {}, READ_ONLY_RINA);
      await result();
      expect(screen.getByText('Good fit')).toBeInTheDocument();
    });
  });

  describe('switching (AC-5, D-alternatives)', () => {
    it('P14-T8 AC-5 a chip opens that alternative for the same brief, replacing the address so Back returns to the brief', async () => {
      show(BRIEF);
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'PRUAnugerah' }));
      expect(nav.replace).toHaveBeenCalledWith('/attack-plan?need=retirement&age=2&budget=2&product=PRUANUGERAH', { scroll: false });
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('P14-T8 AC-5 the switched address asks for that product re-fitted, keeps the summary, and draws the list it is answered', async () => {
      const { calls } = show({ ...BRIEF, product: 'PRUANUGERAH' }, {
        'GET /attack-plan': {
          body: plan({
            product: product({ code: 'PRUANUGERAH', name: 'PRUAnugerah' }), verdict: 'check_fit', outside: ['age', 'budget'],
            alternatives: [{ code: 'PRUMAPAN', name: 'PRUMapan (nama kami)' }],
          }),
        },
      });
      await result('PRUAnugerah');
      expect(calls.filter((c) => c.url.includes('/attack-plan')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/attack-plan?need=retirement&age=2&budget=2&product=PRUANUGERAH']);
      expect(screen.getByLabelText('Customer brief')).toBeInTheDocument();
      expect(screen.getByText(/Outside the typical age band and budget band/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PRUMapan (nama kami)' })).toBeInTheDocument();
    });

    it('P14-T8 AC-11 after a switch the result’s heading takes the focus', async () => {
      stubFetch({
        ...SHELL_STUBS,
        'GET /attack-plan': [{ body: plan() }, { body: plan({ product: product({ code: 'PRUANUGERAH', name: 'PRUAnugerah' }) }) }],
        'GET /product-catalog': { body: { products: SHELF } },
      });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams(BRIEF)} />, { me: RINA_ME });
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'PRUAnugerah' }));
      navigate(view, { ...BRIEF, product: 'PRUANUGERAH' });
      const heading = await result('PRUAnugerah');
      await waitFor(() => expect(document.activeElement).toBe(heading));
    });

    it.each([
      ['the no-match line', { body: plan({ product: null, verdict: null, alternatives: [] }) }, 'No active product matches this need. Try a different need in the brief.'],
      ['the empty shelf', { body: plan({ product: null, verdict: null, alternatives: [], shelfEmpty: true }) }, 'There are no products on your shelf yet.'],
      ['an error', serverError, 'Something went wrong.'],
    ] as const)('P14 exit review: after Build attack plan with no heading to land on, %s takes the focus', async (_name, reply, words) => {
      stubFetch({ ...SHELL_STUBS, 'GET /attack-plan': reply, 'GET /product-catalog': { body: { products: SHELF } } });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams({})} />, { me: RINA_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(group('Primary need')).getByRole('button', { name: 'Retirement income' }));
      await userEvent.click(within(group('Age band')).getByRole('button', { name: '25–34' }));
      await userEvent.click(within(group('Monthly premium budget')).getByRole('button', { name: 'Rp 500 rb–Rp 2 jt' }));
      await userEvent.click(screen.getByRole('button', { name: 'Build attack plan' }));
      navigate(view, BRIEF);
      const shown = await screen.findByText(words);
      await waitFor(() => expect(document.activeElement).not.toBe(document.body));
      expect(document.activeElement).toHaveAttribute('tabindex', '-1');
      expect(document.activeElement!.contains(shown)).toBe(true);
    });

    it('P14 exit review: after a switch to a product that is not found, the not-found state takes the focus', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /attack-plan': [{ body: plan() }, notFound], 'GET /product-catalog': { body: { products: SHELF } } });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams(BRIEF)} />, { me: RINA_ME });
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'PRUAnugerah' }));
      navigate(view, { ...BRIEF, product: 'PRUANUGERAH' });
      const shown = await screen.findByText('This product isn\'t on your shelf.');
      await waitFor(() => expect(document.activeElement!.contains(shown)).toBe(true));
      expect(document.activeElement).toHaveAttribute('data-state', 'not-found');
    });

    it('P14-T8 AC-11 after Build attack plan the result’s heading takes the focus', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /attack-plan': { body: plan() }, 'GET /product-catalog': { body: { products: SHELF } } });
      const view = renderInLayout(AgentLayout, <AttackPlanPage searchParams={searchParams({})} />, { me: RINA_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(group('Primary need')).getByRole('button', { name: 'Retirement income' }));
      await userEvent.click(within(group('Age band')).getByRole('button', { name: '25–34' }));
      await userEvent.click(within(group('Monthly premium budget')).getByRole('button', { name: 'Rp 500 rb–Rp 2 jt' }));
      await userEvent.click(screen.getByRole('button', { name: 'Build attack plan' }));
      navigate(view, BRIEF);
      const heading = await result();
      await waitFor(() => expect(document.activeElement).toBe(heading));
    });
  });

  describe('the catalog’s deep link (AC-6)', () => {
    it('P14-T8 AC-6 reads the product alone: the banner, From catalog, no summary and no alternatives', async () => {
      const { calls } = show({ product: 'PRUMAPAN' }, { 'GET /product-catalog/PRUMAPAN': { body: product() } });
      await result();
      expect(calls.filter((c) => c.url.includes('/attack-plan'))).toEqual([]);
      expect(screen.getByText(/no customer profile set yet, so fit isn't checked\./).textContent)
        .toBe('Opened from the Product Catalog — no customer profile set yet, so fit isn\'t checked.');
      expect(screen.getByText('From catalog')).toHaveAttribute('data-tone', 'neutral');
      expect(screen.queryByLabelText('Customer brief')).not.toBeInTheDocument();
      expect(screen.queryByText('Also matches this need — click to switch the plan above:')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add age & budget' }));
      expect(nav.push).toHaveBeenCalledWith('/attack-plan', { scroll: false });
    });

    it('P14-T8 AC-6 a run-off product’s: In run-off, and its note — F-17 amended', async () => {
      show({ product: 'PRULINK_GENERASI_BARU_PGB' }, { 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      await result('PRULink Generasi Baru (PGB)');
      expect(screen.getByText('In run-off')).toHaveAttribute('data-tone', 'neutral');
      expect(screen.queryByText('From catalog')).not.toBeInTheDocument();
      expect(screen.getByText(
        'This product is in run-off and not actively issued to new applicants. No active sales script — shown for reference against existing policyholders only.',
      )).toBeInTheDocument();
    });

    it('P14-T8 AC-6 a code the office does not keep on is the not-found state', async () => {
      show({ product: 'PRUSMART_PLAN' }, { 'GET /product-catalog/PRUSMART_PLAN': notFound });
      expect(await screen.findByText('This product isn\'t on your shelf.')).toBeInTheDocument();
      expect(screen.getByText('It may have been withdrawn or switched off, or the address may be mistyped.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to Product Catalog' })).toHaveAttribute('href', '/product-catalog');
    });

    it('a switch to something that is not one of the brief’s matches is the not-found state too', async () => {
      show({ ...BRIEF, product: 'PRUSEHAT' }, { 'GET /attack-plan': notFound });
      expect(await screen.findByText('This product isn\'t on your shelf.')).toBeInTheDocument();
    });
  });
});
