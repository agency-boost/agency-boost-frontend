import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  APE, CHALLENGE, campaign, detail, LIST, notFound, notOpen, PROMO_AGENT, PUSH, READ_ONLY_RINA,
  RINA_ME, serverError, SHELL_STUBS, SPRINT,
} from '@test/campaigns-fixtures';
import type { CampaignList } from '@/lib/campaigns';
import { SessionContext } from '@/lib/session';
import CampaignsLayout from './layout';
import CampaignsPage from './page';
import CampaignDialogPage from './[campaignCode]/page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/campaigns' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

/** The list alone, at `/campaigns`. */
function list(routes: Routes = {}, me: typeof RINA_ME = RINA_ME) {
  nav.pathname = '/campaigns';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /campaigns': { body: LIST }, ...routes });
  const view = renderInLayout(AgentLayout, <CampaignsLayout><CampaignsPage /></CampaignsLayout>, { me });
  return { ...stub, view };
}

/** The dialog over the list, at `/campaigns/{code}` — a typed address, or Back to one. */
function dialogAt(code: string, routes: Routes = {}, me: typeof RINA_ME = RINA_ME) {
  nav.pathname = `/campaigns/${code}`;
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /campaigns': { body: LIST },
    [`GET /campaigns/${code}`]: { body: detail() },
    ...routes,
  });
  const view = renderInLayout(
    AgentLayout,
    <CampaignsLayout><CampaignDialogPage params={routeParams({ campaignCode: code })} /></CampaignsLayout>,
    { me },
  );
  return { ...stub, view };
}

const listReady = () => screen.findByRole('region', { name: 'Running' });
const cardOf = (title: string) => screen.getByRole('article', { name: title });
const dialog = (name = 'Q4 APE Sprint') => screen.findByRole('dialog', { name });

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
  nav.back.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('/campaigns, the list (P18.5-T7)', () => {
  describe('the page, verbatim (AC-2)', () => {
    it('P18.5-T7 AC-2 the nav item is live and current, its Upcoming pill gone', async () => {
      list();
      await listReady();
      const item = screen.getByRole('link', { name: 'Campaign list' });
      expect(item).toHaveAttribute('href', '/campaigns');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it('P18.5-T7 AC-2 the nav item stays current over a campaign’s dialog', async () => {
      dialogAt('APE_SPRINT');
      await dialog();
      expect(screen.getByRole('link', { name: 'Campaign list' })).toHaveAttribute('aria-current', 'page');
    });

    it('P18.5-T7 AC-2 is titled and sub-titled as drawn, and reads the list once', async () => {
      const { calls } = list();
      await listReady();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Campaigns$/);
      expect(screen.getByText(
        "Company and KPM campaigns — mark the ones you're chasing, click into any card for full requirements.",
      )).toBeInTheDocument();
      expect(calls.filter((c) => /\/campaigns$/.test(c.url))).toHaveLength(1);
    });

    it('P18.5-T7 AC-2 Seasonal · Structural are a tab list, the chosen one navy over the amber rule', async () => {
      list();
      await listReady();
      const tabs = within(screen.getByRole('tablist', { name: 'Campaign types' })).getAllByRole('tab');
      expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([['Seasonal', 'true'], ['Structural', 'false']]);
      expect(tabs[0]).toHaveClass('border-amber', 'text-navy');
      tabs[0].focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Structural' })).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getByRole('tabpanel', { name: 'Structural' })).toBeInTheDocument();
    });

    it('P18.5-T7 AC-2 All · Running · Upcoming · Ended say which is on, the chosen one navy (ADR-0137)', async () => {
      list();
      await listReady();
      const filter = within(screen.getByRole('group', { name: 'Show campaigns' })).getAllByRole('button');
      expect(filter.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
        ['All', 'true'], ['Running', 'false'], ['Upcoming', 'false'], ['Ended', 'false'],
      ]);
      expect(filter[0]).toHaveClass('bg-navy', 'text-white');
      expect(filter[0]).not.toHaveClass('bg-amber');
    });

    it('P18.5-T7 AC-2 the seasonal sections in order, each shown or hidden whole by the filter', async () => {
      list();
      await listReady();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Running', 'Upcoming', 'Ended']);
      expect(within(screen.getByRole('region', { name: 'Running' })).getAllByRole('article').map((a) => a.getAttribute('aria-labelledby') && a.querySelector('h3')!.textContent))
        .toEqual(['Q4 APE Sprint', 'October New Hire Blitz']);
      await userEvent.click(screen.getByRole('button', { name: 'Ended' }));
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Ended']);
      expect(screen.getByRole('button', { name: 'Ended' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('P18.5-T7 AC-2 the structural sections, Promotion Criteria and Production Clubs, with no filter', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Promotion Criteria', 'Production Clubs']);
      expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Production Clubs' })).getByRole('article', { name: 'MDRT Qualification' })).toBeInTheDocument();
    });

    it('P18.5-T7 AC-2 the five empty lines, verbatim', async () => {
      list({ 'GET /campaigns': { body: { campaigns: [], can: { chase: true } } } });
      await listReady();
      expect(screen.getByText('No running campaigns right now.')).toBeInTheDocument();
      expect(screen.getByText('No upcoming campaigns.')).toBeInTheDocument();
      expect(screen.getByText('No ended campaigns to show.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getByText('No promotion criteria published yet.')).toBeInTheDocument();
      expect(screen.getByText('No ongoing incentives right now.')).toBeInTheDocument();
    });

    it('P18.5-T7 AC-2 keeps the server’s order (D-lists): nothing on screen sorts', async () => {
      const later = campaign({ code: 'B', title: 'Ahead by title, after by date' });
      const sooner = campaign({ code: 'A', title: 'Zeta, first by its end' });
      list({ 'GET /campaigns': { body: { campaigns: [sooner, later], can: { chase: true } } } });
      await listReady();
      expect([...screen.getByRole('region', { name: 'Running' }).querySelectorAll('h3')].map((h) => h.textContent))
        .toEqual(['Zeta, first by its end', 'Ahead by title, after by date']);
    });
  });

  describe('the card (AC-3)', () => {
    it('P18.5-T7 AC-3 the poster: the emoji hidden, the colour a token, KPM and the status tag', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      const emoji = within(card).getByText('🚀');
      expect(emoji).toHaveAttribute('aria-hidden', 'true');
      expect(emoji.parentElement).toHaveClass('bg-amber');
      expect(emoji.parentElement!.getAttribute('style')).toBeNull();
      expect(within(card).getByText('KPM')).toHaveClass('bg-amber-dark', 'text-navy');
      expect(within(card).getByText('Running')).toHaveClass('text-success');
      expect(within(cardOf('Q1 APE Challenge')).getByText('Upcoming')).toBeInTheDocument();
      expect(within(cardOf('Mid-Year Persistency Push')).getByText('Ended')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(within(cardOf('MDRT Qualification')).getByText('Ongoing')).toHaveClass('text-amber-ink');
      // The poster's 🏆 is the first; the prize line's is the second.
      expect(within(cardOf('MDRT Qualification')).getAllByText('🏆')[0].parentElement).toHaveClass('bg-gold');
    });

    it('P18.5-T7 AC-3 the title and its window, the blurb, 🏆 the prize, the requirements in rupiah joined by " | "', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(/^Q4 APE Sprint$/);
      expect(within(card).getByText('1 Okt – 31 Des 2026')).toBeInTheDocument();
      expect(within(card).getByText('Push for APE this quarter — top 10 unit-wide win a trip.')).toBeInTheDocument();
      expect(card).toHaveTextContent('🏆Top 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus');
      expect(card).toHaveTextContent('Requirements: APE achieved Rp 500 jt | New Hire 1');
    });

    it('P18.5-T7 AC-3 Promotion path over a promotion’s title, and nowhere else', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(within(cardOf('Promotion: Agent → AAB')).getByText('Promotion path')).toHaveClass('text-amber-ink');
      expect(within(cardOf('MDRT Qualification')).queryByText('Promotion path')).not.toBeInTheDocument();
      expect(within(cardOf('Promotion: Agent → AAB')).getByText('Rolling 12-month window')).toBeInTheDocument();
    });

    it('P18.5-T7 AC-3 Chase and Chasing are action buttons, amber with navy words; the chased state by its label, a ✓ and aria-pressed', async () => {
      list();
      await listReady();
      const chasing = within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Chasing' });
      expect(chasing).toHaveAttribute('aria-pressed', 'true');
      expect(chasing).toHaveTextContent('✓ ⭐Chasing');
      expect(chasing).toHaveClass('bg-amber', 'text-navy');
      const chase = within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chase' });
      expect(chase).toHaveAttribute('aria-pressed', 'false');
      expect(chase).toHaveTextContent('☆Chase');
      expect(chase).not.toHaveTextContent('✓');
      expect(chase).toHaveClass('bg-amber', 'text-navy');
      expect(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'View details' })).toBeInTheDocument();
    });

    it('P18.5-T7 AC-3 an ended card is grey, its chase disabled and its reason named', async () => {
      list();
      await listReady();
      const card = cardOf('Mid-Year Persistency Push');
      expect(card).toHaveClass('grayscale-[45%]');
      const chase = within(card).getByRole('button', { name: 'Chasing' });
      expect(chase).toBeDisabled();
      expect(within(card).getByRole('button', { name: 'This campaign has ended.' })).toHaveTextContent('ⓘ');
      expect(cardOf('Q4 APE Sprint')).not.toHaveClass('grayscale-[45%]');
    });

    it('P18.5-T7 AC-3 a campaign not for the reader’s rung draws its chase disabled, saying why', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      const card = cardOf('Promotion: AAB → AB');
      expect(within(card).getByRole('button', { name: 'Chase' })).toBeDisabled();
      expect(within(card).getByRole('button', { name: 'This campaign is not open to your role.' })).toBeInTheDocument();
      expect(within(cardOf('Promotion: Agent → AAB')).getByRole('button', { name: 'Chase' })).toBeEnabled();
    });

    it('P18.5-T7 AC-1 a read-only support session reads the list and draws no chase', async () => {
      list({ 'GET /campaigns': { body: { ...LIST, can: { chase: false } } } }, READ_ONLY_RINA);
      await listReady();
      expect(cardOf('Q4 APE Sprint')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'View details' }).length).toBeGreaterThan(0);
    });

    it('P18.5-T7 AC-3 is an article whose control is View details, not a clickable card', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      await userEvent.click(within(card).getByRole('heading', { level: 3 }));
      expect(nav.push).not.toHaveBeenCalled();
      await userEvent.click(within(card).getByRole('button', { name: 'View details' }));
      expect(nav.push).toHaveBeenCalledWith('/campaigns/APE_SPRINT', { scroll: false });
    });

    it('row 25: authored words are text, never markup', async () => {
      const hostile = campaign({
        code: 'X', title: '<img src=x onerror=alert(1)>', blurb: '<script>alert(1)</script>', reward: '<b>prize</b>',
      });
      list({ 'GET /campaigns': { body: { campaigns: [hostile], can: { chase: true } } } });
      await listReady();
      expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
      expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
      expect(document.querySelector('script, img[src="x"], b')).toBeNull();
    });

    it('P18.5-T7 AC-3 the grid is one column on a phone, never wider than the page', async () => {
      list();
      await listReady();
      const grid = cardOf('Q4 APE Sprint').parentElement!;
      expect(grid).toHaveClass('grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))]');
    });
  });

  describe('chasing (AC-5)', () => {
    it('P18.5-T7 AC-5 a chase is a PUT, its toast verbatim, the card the server’s answer', async () => {
      const { calls } = list({ 'PUT /campaigns/NEW_HIRE_BLITZ/chase': { body: { ...LIST.campaigns[1], chasing: true } } });
      await listReady();
      await userEvent.click(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chase' }));
      expect(await screen.findByText('Now chasing "October New Hire Blitz"')).toBeInTheDocument();
      expect(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chasing' })).toHaveAttribute('aria-pressed', 'true');
      const put = calls.find((c) => c.init.method === 'PUT')!;
      expect(put.url).toBe('http://api.test/api/v1/campaigns/NEW_HIRE_BLITZ/chase');
      expect(put.init.body).toBeUndefined();
    });

    it('P18.5-T7 AC-5 stopping is a DELETE, its toast verbatim', async () => {
      const { calls } = list({ 'DELETE /campaigns/APE_SPRINT/chase': { body: { ...SPRINT, chasing: false } } });
      await listReady();
      await userEvent.click(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Chasing' }));
      expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
      expect(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Chase' })).toHaveAttribute('aria-pressed', 'false');
      expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
    });

    it('P18.5-T7 AC-5 a refusal is said on the card, and the list read again so the card says why', async () => {
      const ended: CampaignList = {
        ...LIST,
        campaigns: LIST.campaigns.map((c) => (c.code === 'NEW_HIRE_BLITZ' ? { ...c, phase: 'ended', chaseBlocked: 'ended' } : c)),
      };
      const { calls } = list({
        'GET /campaigns': [{ body: LIST }, { body: ended }],
        'PUT /campaigns/NEW_HIRE_BLITZ/chase': notOpen,
      });
      await listReady();
      await userEvent.click(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chase' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('This campaign has ended, so it can no longer be chased or dropped.');
      await waitFor(() => expect(calls.filter((c) => /\/campaigns$/.test(c.url))).toHaveLength(2));
      await waitFor(() => expect(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chase' })).toBeDisabled());
      expect(screen.queryByText(/^Now chasing/)).not.toBeInTheDocument();
    });
  });

  describe('the exit review’s fixes', () => {
    it('P18.5-T7 AC-5 a chaser whose rung has changed can still drop the chase: only joining is closed to them', async () => {
      const moved = campaign({ code: 'MOVED', title: 'Closed to my new rung', chasing: true, eligible: false, chaseBlocked: 'not_eligible' });
      const { calls } = list({
        'GET /campaigns': { body: { campaigns: [moved], can: { chase: true } } },
        'DELETE /campaigns/MOVED/chase': { body: { ...moved, chasing: false } },
      });
      await listReady();
      const chasing = within(cardOf('Closed to my new rung')).getByRole('button', { name: 'Chasing' });
      expect(chasing).toBeEnabled();
      expect(within(cardOf('Closed to my new rung')).queryByRole('button', { name: 'This campaign is not open to your role.' })).not.toBeInTheDocument();
      await userEvent.click(chasing);
      expect(await screen.findByText('Removed "Closed to my new rung" from your chase list')).toBeInTheDocument();
      expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
      // Dropped, the campaign is closed to the rung again: held, and why.
      const chase = within(cardOf('Closed to my new rung')).getByRole('button', { name: 'Chase' });
      expect(chase).toBeDisabled();
      expect(within(cardOf('Closed to my new rung')).getByRole('button', { name: 'This campaign is not open to your role.' })).toBeInTheDocument();
    });

    it('P18.5-T7 AC-1 an elevated support session draws no chase either: the server’s can.chase decides', async () => {
      const elevated = { ...RINA_ME, isImpersonating: true, impersonationReadOnly: false, impersonatedBy: 'u-root' };
      list({ 'GET /campaigns': { body: { ...LIST, can: { chase: false } } } }, elevated);
      await listReady();
      expect(screen.queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
      dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': { body: detail({ can: { chase: false } }) } }, elevated);
      const box = await dialog();
      expect(within(box).queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
    });
  });

  describe('states (Fills)', () => {
    it('a skeleton while the list loads, and an error with a retry', async () => {
      list({ 'GET /campaigns': [serverError, { body: LIST }] });
      expect((await screen.findByText('Loading the campaigns…')).closest('[role="status"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await listReady();
    });
  });
});

describe('/campaigns/[campaignCode], the dialog (P18.5-T7 AC-4, P18.5-T8 AC-6)', () => {
  it('P18.5-T7 AC-4 is a dialog named by the campaign, the focus moved into it, over an inert list', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    expect(box).toHaveAttribute('aria-modal', 'true');
    expect(box.contains(document.activeElement)).toBe(true);
    await listReady();
    expect(document.querySelector('[data-campaign-card="APE_SPRINT"]')!.closest('[inert]')).not.toBeNull();
  });

  it('P18.5-T7 AC-4 the poster, ✕ named Close, the tags, the title, 📅 the window, the description as text, the Prize', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    expect(within(box).getByText('🚀')).toHaveAttribute('aria-hidden', 'true');
    expect(within(box).getByRole('button', { name: 'Close' })).toHaveTextContent('✕');
    expect(within(box).getByText('KPM')).toBeInTheDocument();
    expect(within(box).getByText('Running')).toBeInTheDocument();
    expect(within(box).getByRole('heading', { level: 2, name: 'Q4 APE Sprint' })).toBeInTheDocument();
    expect(box).toHaveTextContent('📅 1 Okt – 31 Des 2026');
    expect(within(box).getByText(/^Office-wide APE sprint for Q4\./)).toHaveClass('whitespace-pre-line');
    expect(box).toHaveTextContent('PrizeTop 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus');
  });

  it('P18.5-T7 AC-4 Promotion path in a promotion’s dialog', async () => {
    dialogAt('PROMOTION_AGENT_AAB', { 'GET /campaigns/PROMOTION_AGENT_AAB': { body: detail({ ...PROMO_AGENT, progress: null }) } });
    const box = await dialog('Promotion: Agent → AAB');
    expect(within(box).getByText('Promotion path')).toBeInTheDocument();
    expect(within(box).getByText('Ongoing')).toBeInTheDocument();
  });

  it('P18.5-T8 AC-6 each requirement row: "{current} of {target}", ✓ when met, Not uploaded yet — never ✕ — and the months read', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    const requirements = within(box).getByRole('region', { name: /^Requirements/ });
    expect(within(requirements).getByRole('heading', { level: 3 })).toHaveTextContent('RequirementsOkt – Des 2026');
    const rows = within(requirements).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'APE achievedRp 620 jt of Rp 500 jt ✓, met',
      'New Hire1Not uploaded yet',
    ]);
    expect(within(rows[0]).getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(box).not.toHaveTextContent('✕Not');
  });

  it('P18.5-T8 AC-6 a row not yet met reads its figure with no mark; one nothing measures says so', async () => {
    dialogAt('APE_SPRINT', {
      'GET /campaigns/APE_SPRINT': {
        body: detail({
          requirements: [APE(500), { ...APE(1), metricKey: 'OLD_METRIC', metricName: 'Old metric', unit: 'count', value: 3, measured: false }],
          progress: {
            windowLabel: 'Okt – Des 2026', final: false,
            rows: [
              { metricKey: 'APE_ACHIEVED', current: 32_000_000_000, target: 50_000_000_000, unit: 'idr_minor', state: 'in_progress' },
              { metricKey: 'OLD_METRIC', current: null, target: 3, unit: 'count', state: 'not_measured' },
            ],
          },
        }),
      },
    });
    const rows = within(await dialog()).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'APE achievedRp 320 jt of Rp 500 jt',
      'Old metric3Not measured yet',
    ]);
  });

  it('P18.5-T8 AC-6 an activity requirement with nothing logged reads Nothing logged yet, not Not uploaded yet', async () => {
    const ratio = {
      metricKey: 'SELLING_SUCCESS_RATE', metricName: 'Selling success rate', comparator: 'gte' as const, value: 0.15, unit: 'ratio', measured: true,
    };
    dialogAt('APE_SPRINT', {
      'GET /campaigns/APE_SPRINT': {
        body: detail({
          requirements: [ratio],
          progress: {
            windowLabel: '1 Okt – 10 Okt 2026', final: false,
            rows: [{ metricKey: 'SELLING_SUCCESS_RATE', current: null, target: 0.15, unit: 'ratio', state: 'nothing_logged' }],
          },
        }),
      },
    });
    const rows = within(await dialog()).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Selling success rate0,15Nothing logged yet']);
    expect(rows[0]).not.toHaveTextContent('Not uploaded yet');
  });

  it('P18.5-T8 AC-6 an upcoming campaign’s rows are their targets alone, as drawn', async () => {
    dialogAt('APE_CHALLENGE_NEXT', { 'GET /campaigns/APE_CHALLENGE_NEXT': { body: detail({ ...CHALLENGE, progress: null }) } });
    const box = await dialog('Q1 APE Challenge');
    expect(within(box).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['APE achievedRp 300 jt']);
    expect(within(box).getByRole('heading', { level: 3 })).toHaveTextContent(/^Requirements$/);
  });

  it('P18.5-T7 AC-4 ✕, the backdrop and Escape close it — to the list’s address when it was typed', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    await userEvent.click(within(box).getByRole('button', { name: 'Close' }));
    expect(nav.replace).toHaveBeenLastCalledWith('/campaigns', { scroll: false });
    await userEvent.keyboard('{Escape}');
    expect(nav.replace).toHaveBeenCalledTimes(2);
    await userEvent.click(document.querySelector('[data-scrim]') as HTMLElement);
    expect(nav.replace).toHaveBeenCalledTimes(3);
    await userEvent.click(within(box).getByRole('heading', { level: 2 }));
    expect(nav.replace).toHaveBeenCalledTimes(3);
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('P18.5-T7 AC-4 closing a dialog the list opened goes back, so Back and ✕ agree', async () => {
    dialogAt('APE_SPRINT');
    await dialog();
    await listReady();
    await userEvent.click(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'View details' }), { pointerEventsCheck: 0 });
    expect(nav.push).toHaveBeenCalledWith('/campaigns/APE_SPRINT', { scroll: false });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('P18.5-T7 AC-4 the focus stays inside it: Tab from the last control comes back to the first', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    const chase = within(box).getByRole('button', { name: 'Chasing' });
    chase.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(within(box).getByRole('button', { name: 'Close' }));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(chase);
  });

  it('P18.5-T7 AC-4 as it closes, the focus goes back to the card’s View details', async () => {
    const { view } = dialogAt('APE_SPRINT');
    await dialog();
    await listReady();
    nav.pathname = '/campaigns';
    view.rerender(
      <SessionContext.Provider value={view.session}>
        <Suspense fallback={null}>
          <AgentLayout><CampaignsLayout><CampaignsPage /></CampaignsLayout></AgentLayout>
        </Suspense>
      </SessionContext.Provider>,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'View details' }));
  });

  it('P18.5-T7 AC-5 a chase in the dialog updates the dialog and the card beneath, with one toast', async () => {
    dialogAt('APE_SPRINT', { 'DELETE /campaigns/APE_SPRINT/chase': { body: { ...SPRINT, chasing: false } } });
    const box = await dialog();
    await listReady();
    await userEvent.click(within(box).getByRole('button', { name: 'Chasing' }));
    expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Chase' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Chase', hidden: true })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByText('Removed "Q4 APE Sprint" from your chase list')).toHaveLength(1);
  });

  it('P18.5-T7 AC-1 a read-only support session’s dialog draws no chase', async () => {
    dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': { body: detail({ can: { chase: false } }) } }, READ_ONLY_RINA);
    const box = await dialog();
    expect(within(box).queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
  });

  it('P18.5-T7 AC-1 another office’s code, an archived one or a typo is the not-found state', async () => {
    dialogAt('GADING_PUSH', { 'GET /campaigns/GADING_PUSH': notFound });
    expect(await screen.findByText('This campaign isn’t on your list.')).toBeInTheDocument();
    expect(screen.getByText('It may have been withdrawn, or the address may be mistyped.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Campaigns' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(nav.replace).toHaveBeenCalledWith('/campaigns', { scroll: false });
  });

  it('P18.5-T7 AC-1 /campaigns/chasing typed in the address is a campaign not found, and nothing reads it as one', async () => {
    const { calls } = dialogAt('chasing', { 'GET /campaigns/chasing': { body: { membershipId: 'mem-rina', campaigns: [] } } });
    expect(await screen.findByText('This campaign isn’t on your list.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/campaigns/chasing'))).toBe(false);
  });

  it('P18.5-T8 AC-6 two requirements on one metric each read their own progress row, by position', async () => {
    dialogAt('APE_SPRINT', {
      'GET /campaigns/APE_SPRINT': {
        body: detail({
          requirements: [APE(500), APE(1000)],
          progress: {
            windowLabel: 'Okt – Des 2026', final: false,
            rows: [
              { metricKey: 'APE_ACHIEVED', current: 62_000_000_000, target: 50_000_000_000, unit: 'idr_minor', state: 'met' },
              { metricKey: 'APE_ACHIEVED', current: 62_000_000_000, target: 100_000_000_000, unit: 'idr_minor', state: 'in_progress' },
            ],
          },
        }),
      },
    });
    const rows = within(await dialog()).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'APE achievedRp 620 jt of Rp 500 jt ✓, met',
      'APE achievedRp 620 jt of Rp 1 M',
    ]);
  });

  it('a skeleton while the campaign loads, and an error with a retry', async () => {
    dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': [serverError, { body: detail() }] });
    expect((await screen.findByText('Loading the campaign…')).closest('[role="status"]')).not.toBeNull();
    const box = screen.getByRole('dialog', { name: 'Campaigns' });
    expect(await within(box).findByRole('alert')).toHaveTextContent('Something went wrong.');
    await userEvent.click(within(box).getByRole('button', { name: 'Try again' }));
    await dialog();
  });

  it('row 25: the description is text, never markup', async () => {
    dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': { body: detail({ description: '<script>alert(1)</script><b>x</b>' }) } });
    const box = await dialog();
    expect(within(box).getByText('<script>alert(1)</script><b>x</b>')).toBeInTheDocument();
    expect(box.querySelector('script, b')).toBeNull();
  });

  it('the dialog of an ended campaign the reader chased draws its chase disabled and why', async () => {
    dialogAt('PERSISTENCY_PUSH', { 'GET /campaigns/PERSISTENCY_PUSH': { body: detail({ ...PUSH, progress: null }) } });
    const box = await dialog('Mid-Year Persistency Push');
    expect(within(box).getByRole('button', { name: 'Chasing' })).toBeDisabled();
    expect(within(box).getByRole('button', { name: 'This campaign has ended.' })).toBeInTheDocument();
  });
});
