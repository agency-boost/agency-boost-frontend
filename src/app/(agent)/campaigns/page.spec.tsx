import { Suspense } from 'react';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  APE, CHALLENGE, campaign, detail, LIST, NEW_HIRE, notFound, notOpen, PROMO_AGENT, PUSH, READ_ONLY_RINA,
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

/**
 * **The list as a desktop reads it** — jsdom answers no width, so these draw the laptop's list. *Changed 2026-11-05
 * (P19.1-T5 AC-4, AC-5; UI-123: "Card content as UI-108"):* a tablet and a laptop draw the phone's compact list, so the
 * prototype's underlined tabs, *All · Running · Upcoming · Ended* row, poster, blurb, *Chase* / *View details* buttons
 * and the five empty lines are gone from here; the tests that pinned them now pin what replaced each. The grid and the
 * groups sharing a row are pinned at their widths in `campaigns-wide.spec.tsx`.
 */
describe('/campaigns, the list (P18.2-T7)', () => {
  /** An ended campaign's short row: a button whose name starts with its title. */
  const endedRow = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });
  const star = (title: string) => screen.getByRole('button', { name: `Chase ${title}` });

  describe('the page, verbatim (AC-2)', () => {
    it('P18.2-T7 AC-2 the nav item is live and current, its Upcoming pill gone', async () => {
      list();
      await listReady();
      // The field shell's sidebar since UI V1 (UI-004): *Campaign*, under *Program*.
      const item = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Campaign' });
      expect(item).toHaveAttribute('href', '/campaigns');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-2 the nav item stays current over a campaign’s dialog', async () => {
      dialogAt('APE_SPRINT');
      await dialog();
      expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Campaign' }))
        .toHaveAttribute('aria-current', 'page');
    });

    it('P18.2-T7 AC-2, P18.7-T9 AC-2 and AC-5 is titled as its nav item, sub-titled as drawn, and reads the list once', async () => {
      const { calls } = list();
      await listReady();
      // P18.7-T9 AC-2: the nav item's words, *Campaign list* — the prototype titled the page *Campaigns*.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Campaign List$/);
      // P18.7-T9 AC-5: *tap*, where the prototype said *click into*.
      expect(screen.getByText(
        "Company and KPM campaigns — mark the ones you're chasing, tap any card for full requirements.",
      )).toBeInTheDocument();
      expect(calls.filter((c) => /\/campaigns$/.test(c.url))).toHaveLength(1);
    });

    it('P18.2-T7 AC-2, P19.1-T5 AC-4 Seasonal · Structural are a tab list: one segmented control, the chosen one navy', async () => {
      list();
      await listReady();
      const tabs = within(screen.getByRole('tablist', { name: 'Campaign types' })).getAllByRole('tab');
      expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([['Seasonal', 'true'], ['Structural', 'false']]);
      // Changed by P19.1-T5 (UI-123, `.seg`): navy on a white pill track, where it was navy words over an amber rule.
      expect(tabs[0]).toHaveClass('bg-secondary', 'text-secondary-contrast', 'rounded-pill');
      expect(tabs[0]).not.toHaveClass('border-primary');
      tabs[0].focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Structural' })).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getByRole('tabpanel', { name: 'Structural' })).toBeInTheDocument();
    });

    it('P18.2-T7 AC-2, P19.1-T5 AC-4 no All · Running · Upcoming · Ended row (UI-108: no extra chip row)', async () => {
      list();
      await listReady();
      expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-2, P19.1-T5 AC-4 the seasonal groups in order, each in sentence case with its count', async () => {
      list();
      await listReady();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Running2', 'Upcoming1', 'Ended1']);
      for (const h of screen.getAllByRole('heading', { level: 2 })) expect(h).not.toHaveClass('uppercase');
      expect(within(screen.getByRole('region', { name: 'Running' })).getAllByRole('article').map((a) => a.querySelector('h3')!.textContent))
        .toEqual(['Q4 APE Sprint', 'October New Hire Blitz']);
      expect(within(screen.getByRole('region', { name: 'Ended' })).getByRole('button', { name: /^Mid-Year Persistency Push/ })).toBeInTheDocument();
    });

    it('P18.2-T7 AC-2 the structural sections, Promotion Criteria and Production Clubs, with no filter', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Promotion Criteria2', 'Production Clubs1']);
      expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Production Clubs' })).getByRole('article', { name: 'MDRT Qualification' })).toBeInTheDocument();
    });

    it('P18.2-T7 AC-2, P19.1-T5 AC-5 an empty group is hidden; with nothing at all, one line, verbatim', async () => {
      list({ 'GET /campaigns': { body: { campaigns: [CHALLENGE], can: { chase: true } } } });
      await screen.findByRole('region', { name: 'Upcoming' });
      // D-08 at every size (UI-123): *Running* and *Ended* have nothing, so neither is drawn — nor its empty line.
      expect(screen.queryByRole('region', { name: 'Running' })).not.toBeInTheDocument();
      expect(screen.queryByText('No running campaigns right now.')).not.toBeInTheDocument();
      expect(screen.queryByText('No ended campaigns to show.')).not.toBeInTheDocument();
      cleanup();
      vi.unstubAllGlobals();
      list({ 'GET /campaigns': { body: { campaigns: [], can: { chase: true } } } });
      expect(await screen.findByText('No running campaigns right now.')).toBeInTheDocument();
      expect(screen.queryByText('No upcoming campaigns.')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(screen.getByText('No promotion criteria published yet.')).toBeInTheDocument();
      expect(screen.queryByText('No ongoing incentives right now.')).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-2 keeps the server’s order (D-lists): nothing on screen sorts', async () => {
      const later = campaign({ code: 'B', title: 'Ahead by title, after by date' });
      const sooner = campaign({ code: 'A', title: 'Zeta, first by its end' });
      list({ 'GET /campaigns': { body: { campaigns: [sooner, later], can: { chase: true } } } });
      await listReady();
      expect([...screen.getByRole('region', { name: 'Running' }).querySelectorAll('h3')].map((h) => h.textContent))
        .toEqual(['Zeta, first by its end', 'Ahead by title, after by date']);
    });
  });

  describe('the card (AC-3; UI-108’s since P19.1-T5)', () => {
    it('P18.2-T7 AC-3, P19.1-T5 AC-4 a line icon in a tinted tile where the poster was, no emoji; KPM and the period', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      expect(card.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
      const tile = card.querySelector('svg')!.parentElement!;
      expect(tile).toHaveAttribute('aria-hidden', 'true');
      expect(tile).toHaveClass('bg-amber/[0.14]');
      expect(tile.getAttribute('style')).toBeNull();
      expect(within(card).getByText('KPM')).toHaveClass('bg-pill-grey', 'text-pill-grey-ink');
      expect(card).toHaveTextContent('1 Okt – 31 Des 2026');
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(cardOf('MDRT Qualification').querySelector('svg')!.parentElement).toHaveClass('bg-gold/[0.14]');
    });

    it('P18.2-T7 AC-3, P19.1-T5 AC-4 the title on one line and its window, Prize and Requirements aligned; the blurb is the detail’s', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(/^Q4 APE Sprint$/);
      expect(within(card).getByRole('heading', { level: 3 })).toHaveClass('truncate');
      const rows = [...card.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
      expect(rows).toEqual([
        ['Prize', 'Top 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus'],
        ['Requirements', 'IDR 500M APE + 1 new hire'],
      ]);
      // UI-108: *description and full terms on the detail page only*.
      expect(within(card).queryByText('Push for APE this quarter — top 10 unit-wide win a trip.')).not.toBeInTheDocument();
      expect(card).not.toHaveTextContent('🏆');
    });

    it('P18.7-T10 AC-3, P18.7-T9 AC-3 the client’s example: Rp 16 jt APE + 3 new hires, APE’s ⓘ where the list first names it', async () => {
      const sixteen = campaign({ code: 'SIXTEEN', title: 'Sixteen', requirements: [APE(16), NEW_HIRE(3)] });
      list({ 'GET /campaigns': { body: { campaigns: [sixteen, PROMO_AGENT], can: { chase: true } } } });
      await listReady();
      // *APE*'s first appearance on the list carries its ⓘ (P18.7-T9 AC-3, kept on the compact card from 768px).
      expect(cardOf('Sixteen')).toHaveTextContent(/IDR 16M APE ⓘWhat is APE\?.+ \+ 3 new hires/);
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(cardOf('Promotion: Agent → AAB')).toHaveTextContent(/IDR 1.2B APE ⓘWhat is APE\?.+ \+ 3 new active agents/);
    });

    it('P18.7-T9 AC-3 a term in a title carries its ⓘ beside the heading, not in it, and once on the list', async () => {
      list();
      await listReady();
      const card = cardOf('Q4 APE Sprint');
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(/^Q4 APE Sprint$/);
      expect(card).toHaveTextContent(/Q4 APE SprintⓘWhat is APE\?/);
      expect(screen.getAllByText('What is APE?')).toHaveLength(1);
    });

    it('P18.2-T7 AC-3, P19.1-T5 AC-4 a promotion’s card shows its window; Promotion path is the detail’s', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(cardOf('Promotion: Agent → AAB')).toHaveTextContent('Rolling 12-month window');
      expect(within(cardOf('Promotion: Agent → AAB')).queryByText('Promotion path')).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-3, P19.1-T5 AC-4 Kejar is a round star: its state aria-pressed, its name the campaign’s, amber when chased', async () => {
      list();
      await listReady();
      expect(star('Q4 APE Sprint')).toHaveAttribute('aria-pressed', 'true');
      expect(star('Q4 APE Sprint')).toHaveClass('bg-primary', 'text-primary-contrast');
      expect(star('October New Hire Blitz')).toHaveAttribute('aria-pressed', 'false');
      expect(star('October New Hire Blitz')).toHaveClass('bg-card');
      expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-3, P18.7-T10 AC-2 an ended campaign is a short greyed row with ›: no chase, not even disabled', async () => {
      list();
      await listReady();
      const row = endedRow('Mid-Year Persistency Push');
      expect(row.querySelector('[data-chase]')).toBeNull();
      expect(within(row).queryByRole('button')).not.toBeInTheDocument();
      expect(row.querySelector('svg')!.parentElement).toHaveClass('bg-pill-grey', 'text-muted');
      expect(screen.queryByRole('article', { name: 'Mid-Year Persistency Push' })).not.toBeInTheDocument();
      expect(star('Q4 APE Sprint')).toBeEnabled();
      expect(star('Q1 APE Challenge')).toBeEnabled();
    });

    it('P18.2-T7 AC-3 a campaign not for the reader’s rung draws its chase held, saying why', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      expect(star('Promotion: AAB → AB')).toBeDisabled();
      expect(star('Promotion: AAB → AB')).toHaveAttribute('title', 'This campaign is not open to your role.');
      expect(star('Promotion: Agent → AAB')).toBeEnabled();
    });

    it('P18.2-T7 AC-1 a read-only support session reads the list and draws no chase', async () => {
      list({ 'GET /campaigns': { body: { ...LIST, can: { chase: false } } } }, READ_ONLY_RINA);
      await listReady();
      expect(cardOf('Q4 APE Sprint')).toBeInTheDocument();
      expect(document.querySelector('[data-chase]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Q4 APE Sprint' })).toBeInTheDocument();
    });

    it('P18.2-T7 AC-3, P19.1-T5 AC-4 the whole card opens the detail; the star is its own target', async () => {
      list();
      await listReady();
      await userEvent.click(star('October New Hire Blitz'));
      expect(nav.push).not.toHaveBeenCalled();
      await userEvent.click(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Q4 APE Sprint' }));
      expect(nav.push).toHaveBeenCalledWith('/campaigns/APE_SPRINT', { scroll: false });
      await userEvent.click(endedRow('Mid-Year Persistency Push'));
      expect(nav.push).toHaveBeenCalledWith('/campaigns/PERSISTENCY_PUSH', { scroll: false });
    });

    it('row 25: authored words are text, never markup', async () => {
      const hostile = campaign({
        code: 'X', title: '<img src=x onerror=alert(1)>', blurb: '<script>alert(1)</script>', reward: '<b>prize</b>',
      });
      list({ 'GET /campaigns': { body: { campaigns: [hostile], can: { chase: true } } } });
      await listReady();
      expect(screen.getByRole('heading', { level: 3, name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
      expect(screen.getByText('<b>prize</b>')).toBeInTheDocument();
      expect(document.querySelector('script, img[src="x"], b')).toBeNull();
    });

    it('P18.2-T7 AC-3, P19.1-T5 AC-4 the grid: columns of at least 300px, never wider than the page', async () => {
      list();
      await listReady();
      const grid = cardOf('Q4 APE Sprint').parentElement!;
      expect(grid).toHaveClass('grid', 'grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]');
    });
  });

  describe('chasing (AC-5)', () => {
    it('P18.2-T7 AC-5 a chase is a PUT, its toast verbatim, the card the server’s answer', async () => {
      const { calls } = list({ 'PUT /campaigns/NEW_HIRE_BLITZ/chase': { body: { ...LIST.campaigns[1], chasing: true } } });
      await listReady();
      await userEvent.click(star('October New Hire Blitz'));
      expect(await screen.findByText('Now chasing "October New Hire Blitz"')).toBeInTheDocument();
      expect(star('October New Hire Blitz')).toHaveAttribute('aria-pressed', 'true');
      const put = calls.find((c) => c.init.method === 'PUT')!;
      expect(put.url).toBe('http://api.test/api/v1/campaigns/NEW_HIRE_BLITZ/chase');
      expect(put.init.body).toBeUndefined();
    });

    it('P18.2-T7 AC-5 stopping is a DELETE, its toast verbatim', async () => {
      const { calls } = list({ 'DELETE /campaigns/APE_SPRINT/chase': { body: { ...SPRINT, chasing: false } } });
      await listReady();
      await userEvent.click(star('Q4 APE Sprint'));
      expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
      expect(star('Q4 APE Sprint')).toHaveAttribute('aria-pressed', 'false');
      expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
    });

    it('P18.2-T7 AC-5 a refusal is said on the card, and the list read again so the campaign moves to Ended', async () => {
      const ended: CampaignList = {
        ...LIST,
        campaigns: LIST.campaigns.map((c) => (c.code === 'NEW_HIRE_BLITZ' ? { ...c, phase: 'ended', chaseBlocked: 'ended' } : c)),
      };
      const { calls } = list({
        'GET /campaigns': [{ body: LIST }, { body: ended }],
        'PUT /campaigns/NEW_HIRE_BLITZ/chase': notOpen,
      });
      await listReady();
      await userEvent.click(star('October New Hire Blitz'));
      await waitFor(() => expect(calls.filter((c) => /\/campaigns$/.test(c.url))).toHaveLength(2));
      // P18.7-T10 AC-2: read again, it is an ended row under *Ended*, with no chase at all — where it says why.
      await waitFor(() => expect(within(screen.getByRole('region', { name: 'Ended' })).getByRole('button', { name: /^October New Hire Blitz/ })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Chase October New Hire Blitz' })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Now chasing/)).not.toBeInTheDocument();
    });

    it('P18.2-T7 AC-5 a refusal the list does not re-read is said under the card', async () => {
      const { calls } = list({ 'PUT /campaigns/NEW_HIRE_BLITZ/chase': serverError });
      await listReady();
      await userEvent.click(star('October New Hire Blitz'));
      expect(await within(cardOf('October New Hire Blitz')).findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(calls.filter((c) => /\/campaigns$/.test(c.url))).toHaveLength(1);
    });
  });

  describe('the exit review’s fixes', () => {
    it('P18.2-T7 AC-5 a chaser whose rung has changed can still drop the chase: only joining is closed to them', async () => {
      const moved = campaign({ code: 'MOVED', title: 'Closed to my new rung', chasing: true, eligible: false, chaseBlocked: 'not_eligible' });
      const { calls } = list({
        'GET /campaigns': { body: { campaigns: [moved], can: { chase: true } } },
        'DELETE /campaigns/MOVED/chase': { body: { ...moved, chasing: false } },
      });
      await listReady();
      expect(star('Closed to my new rung')).toBeEnabled();
      expect(star('Closed to my new rung')).not.toHaveAttribute('title');
      await userEvent.click(star('Closed to my new rung'));
      expect(await screen.findByText('Removed "Closed to my new rung" from your chase list')).toBeInTheDocument();
      expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
      // Dropped, the campaign is closed to the rung again: held, and why.
      expect(star('Closed to my new rung')).toBeDisabled();
      expect(star('Closed to my new rung')).toHaveAttribute('title', 'This campaign is not open to your role.');
    });

    it('P18.2-T7 AC-1 an elevated support session draws no chase either: the server’s can.chase decides', async () => {
      const elevated = { ...RINA_ME, isImpersonating: true, impersonationReadOnly: false, impersonatedBy: 'u-root' };
      list({ 'GET /campaigns': { body: { ...LIST, can: { chase: false } } } }, elevated);
      await listReady();
      expect(document.querySelector('[data-chase]')).toBeNull();
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

describe('/campaigns/[campaignCode], the dialog (P18.2-T7 AC-4, P18.2-T8 AC-6)', () => {
  it('P18.2-T7 AC-4 is a dialog named by the campaign, the focus moved into it, over an inert list', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    expect(box).toHaveAttribute('aria-modal', 'true');
    expect(box.contains(document.activeElement)).toBe(true);
    await listReady();
    expect(document.querySelector('[data-campaign-card="APE_SPRINT"]')!.closest('[inert]')).not.toBeNull();
  });

  it('P18.2-T7 AC-4 the poster, ✕ named Close, the tags, the title, 📅 the window, the description as text, the Prize', async () => {
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

  it('P18.8-T1 AC-2 the dialog is capped at the dynamic viewport and scrolls inside, and the page behind holds still', async () => {
    document.body.style.overflow = 'auto';
    try {
      dialogAt('APE_SPRINT');
      const box = await dialog();
      // Below the top inset as well, never under a Home Screen app's clock (staging review, 2026-10-31).
      expect(box).toHaveClass('max-h-[calc(100dvh-1rem-max(1rem,env(safe-area-inset-top)))]', 'overflow-y-auto', 'overscroll-contain');
      expect(box.parentElement).toHaveClass('pt-[max(1rem,env(safe-area-inset-top))]');
      expect(box.className).not.toContain('100vh');
      expect(document.body.style.overflow).toBe('hidden');
      cleanup();
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      document.body.style.overflow = '';
    }
  });

  it('P18.2-T7 AC-4 Promotion path in a promotion’s dialog', async () => {
    dialogAt('PROMOTION_AGENT_AAB', { 'GET /campaigns/PROMOTION_AGENT_AAB': { body: detail({ ...PROMO_AGENT, progress: null }) } });
    const box = await dialog('Promotion: Agent → AAB');
    expect(within(box).getByText('Promotion path')).toBeInTheDocument();
    expect(within(box).getByText('Ongoing')).toBeInTheDocument();
  });

  it('P18.2-T8 AC-6 each requirement row: "{current} of {target}", ✓ when met, Not uploaded yet — never ✕ — and the months read', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    const requirements = within(box).getByRole('region', { name: /^Requirements/ });
    expect(within(requirements).getByRole('heading', { level: 3 })).toHaveTextContent('RequirementsOkt – Des 2026');
    const rows = within(requirements).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'APE achievedIDR 620M of IDR 500M ✓, met',
      'New Hire1Not uploaded yet',
    ]);
    expect(within(rows[0]).getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(box).not.toHaveTextContent('✕Not');
  });

  it('P18.2-T8 AC-6 a row not yet met reads its figure with no mark; one nothing measures says so', async () => {
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
      'APE achievedIDR 320M of IDR 500M',
      'Old metric3Not measured yet',
    ]);
  });

  it('P18.2-T8 AC-6 an activity requirement with nothing logged reads Nothing logged yet, not Not uploaded yet', async () => {
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
    expect(rows.map((r) => r.textContent)).toEqual(['Selling success rate0.15Nothing logged yet']);
    expect(rows[0]).not.toHaveTextContent('Not uploaded yet');
  });

  it('P18.2-T8 AC-6 an upcoming campaign’s rows are their targets alone, as drawn', async () => {
    dialogAt('APE_CHALLENGE_NEXT', { 'GET /campaigns/APE_CHALLENGE_NEXT': { body: detail({ ...CHALLENGE, progress: null }) } });
    const box = await dialog('Q1 APE Challenge');
    expect(within(box).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['APE achievedIDR 300M']);
    expect(within(box).getByRole('heading', { level: 3 })).toHaveTextContent(/^Requirements$/);
  });

  it('P18.2-T7 AC-4 ✕, the backdrop and Escape close it — to the list’s address when it was typed', async () => {
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

  it('P18.2-T7 AC-4 closing a dialog the list opened goes back, so Back and ✕ agree', async () => {
    dialogAt('APE_SPRINT');
    await dialog();
    await listReady();
    // The whole card opens it (UI-108 at every size since P19.1-T5): its stretched button, named by the title.
    await userEvent.click(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Q4 APE Sprint', hidden: true }), { pointerEventsCheck: 0 });
    expect(nav.push).toHaveBeenCalledWith('/campaigns/APE_SPRINT', { scroll: false });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('P18.2-T7 AC-4 the focus stays inside it: Tab from the last control comes back to the first', async () => {
    dialogAt('APE_SPRINT');
    const box = await dialog();
    const chase = within(box).getByRole('button', { name: 'Chasing' });
    chase.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(within(box).getByRole('button', { name: 'Close' }));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(chase);
  });

  it('P18.2-T7 AC-4 as it closes, the focus goes back to the card’s own target (its View details until P19.1-T5)', async () => {
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
    expect(document.activeElement).toBe(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Q4 APE Sprint' }));
  });

  it('P18.2-T7 AC-5 a chase in the dialog updates the dialog and the card beneath, with one toast', async () => {
    dialogAt('APE_SPRINT', { 'DELETE /campaigns/APE_SPRINT/chase': { body: { ...SPRINT, chasing: false } } });
    const box = await dialog();
    await listReady();
    await userEvent.click(within(box).getByRole('button', { name: 'Chasing' }));
    expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Chase' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Chase Q4 APE Sprint', hidden: true })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByText('Removed "Q4 APE Sprint" from your chase list')).toHaveLength(1);
  });

  it('P18.2-T7 AC-1 a read-only support session’s dialog draws no chase', async () => {
    dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': { body: detail({ can: { chase: false } }) } }, READ_ONLY_RINA);
    const box = await dialog();
    expect(within(box).queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
  });

  it('P18.2-T7 AC-1 another office’s code, an archived one or a typo is the not-found state', async () => {
    dialogAt('GADING_PUSH', { 'GET /campaigns/GADING_PUSH': notFound });
    expect(await screen.findByText('This campaign isn’t on your list.')).toBeInTheDocument();
    expect(screen.getByText('It may have been withdrawn, or the address may be mistyped.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Campaign List' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(nav.replace).toHaveBeenCalledWith('/campaigns', { scroll: false });
  });

  it('P18.2-T7 AC-1 /campaigns/chasing typed in the address is a campaign not found, and nothing reads it as one', async () => {
    const { calls } = dialogAt('chasing', { 'GET /campaigns/chasing': { body: { membershipId: 'mem-rina', campaigns: [] } } });
    expect(await screen.findByText('This campaign isn’t on your list.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/campaigns/chasing'))).toBe(false);
  });

  it('P18.2-T8 AC-6 two requirements on one metric each read their own progress row, by position', async () => {
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
      'APE achievedIDR 620M of IDR 500M ✓, met',
      'APE achievedIDR 620M of IDR 1B',
    ]);
  });

  it('a skeleton while the campaign loads, and an error with a retry', async () => {
    dialogAt('APE_SPRINT', { 'GET /campaigns/APE_SPRINT': [serverError, { body: detail() }] });
    expect((await screen.findByText('Loading the campaign…')).closest('[role="status"]')).not.toBeNull();
    const box = screen.getByRole('dialog', { name: 'Campaign List' });
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

  it('P18.7-T10 AC-2 the dialog of an ended campaign the reader chased draws no chase; its tag says Ended', async () => {
    dialogAt('PERSISTENCY_PUSH', { 'GET /campaigns/PERSISTENCY_PUSH': { body: detail({ ...PUSH, progress: null }) } });
    const box = await dialog('Mid-Year Persistency Push');
    expect(within(box).queryByRole('button', { name: /^Chas/ })).not.toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'This campaign has ended.' })).not.toBeInTheDocument();
    expect(within(box).getByText('Ended')).toBeInTheDocument();
  });
});

/**
 * **A ratio requirement in the office's unit for it** (P18.9-T7; ADR-0174 §2, *one way of writing a percentage*): the
 * card's *Needs:* line and the dialog's rows read *30%* where the office writes the ratio as a percentage, as its
 * settings have since P18.9-T4 AC-8 — where the card read *0,30*.
 */
describe('P18.9-T7 a ratio requirement on the agents’ cards and dialog', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const RATE = {
    metricKey: 'RECRUIT_SUCCESS_RATE', metricName: 'Recruitment success rate', comparator: 'gte' as const, value: 0.3, unit: 'ratio', measured: true,
  };
  const RECRUIT = campaign({ code: 'RECRUIT_DRIVE', title: 'Recruitment Drive', requirements: [RATE] });
  const config = (displayUnit: 'percent' | 'decimal') => ({
    '/kpm/config': {
      body: {
        activity: [], leadPipelines: [], version: 1,
        ratios: [{
          id: 'r1', code: 'RECRUIT_SUCCESS_RATE', label: 'Recruitment success rate', numerator: [], denominator: [], benchmark: 0.3,
          comparison: 'gte', displayUnit, displayOrder: 1, version: 1, status: 'active', origin: 'platform',
        }],
      },
    },
  });

  // The card's *Needs:* line is its *Requirements* row since P19.1-T5 (UI-108's card at every size).
  it('P18.9-T7 writes the card’s Needs: line in the office’s unit for the ratio: 30%', async () => {
    list({ ...config('percent'), 'GET /campaigns': { body: { ...LIST, campaigns: [RECRUIT] } } });
    await listReady();
    await waitFor(() => expect(cardOf('Recruitment Drive')).toHaveTextContent('RequirementsRecruitment success rate 30%'));
    expect(cardOf('Recruitment Drive')).not.toHaveTextContent('0.30');
  });

  it('P18.9-T7 keeps a ratio the office writes as a number a number: 0,30', async () => {
    list({ ...config('decimal'), 'GET /campaigns': { body: { ...LIST, campaigns: [RECRUIT] } } });
    await listReady();
    expect(cardOf('Recruitment Drive')).toHaveTextContent('RequirementsRecruitment success rate 0.30');
  });

  it('P18.9-T7 writes the dialog’s row in the same unit: the figure to its tenth, of the target as typed', async () => {
    dialogAt('RECRUIT_DRIVE', {
      ...config('percent'),
      'GET /campaigns': { body: { ...LIST, campaigns: [RECRUIT] } },
      'GET /campaigns/RECRUIT_DRIVE': {
        body: detail({
          ...RECRUIT,
          progress: {
            windowLabel: 'Okt – Des 2026', final: false,
            rows: [{ metricKey: 'RECRUIT_SUCCESS_RATE', current: 2 / 7, target: 0.3, unit: 'ratio', state: 'in_progress' }],
          },
        }),
      },
    });
    const box = await dialog('Recruitment Drive');
    await waitFor(() => expect(within(box).getAllByRole('listitem').map((r) => r.textContent))
      .toEqual(['Recruitment success rate29% of 30%']));
  });
});

/**
 * **UI V1 on a phone** (UI-108; `campaign-event-mobile` 1): no sub-line; *Seasonal | Structural* as one segmented
 * control; the groups with their counts and no status row; a card with a line icon in a tinted tile — no emoji — the
 * name on one line, the office's tag and the period, a round star for *Chase*, and *Prize* and *Requirements* aligned; an
 * ended campaign a short row. 375px.
 */
describe('UI-108 /campaigns on a phone', () => {
  beforeEach(() => atWidth(375));
  afterEach(() => vi.unstubAllGlobals());

  it('UI-108 the groups with their counts, no status row; a card with its icon, tag, period, star and the two rows', async () => {
    list();
    await listReady();
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Running' })).toHaveTextContent(/^Running2/);
    const sprint = cardOf('Q4 APE Sprint');
    expect(within(sprint).getByRole('heading', { level: 3 })).toHaveClass('truncate');
    expect(sprint).toHaveTextContent('KPM');
    // A line icon where the poster's emoji was: no emoji on a phone's card (UI-108, UI-102).
    expect(sprint.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(sprint.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const rows = [...sprint.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
    expect(rows[0]).toEqual(['Prize', 'Top 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus']);
    expect(rows[1][0]).toBe('Requirements');
    // The round star: its state its `aria-pressed`, its name the campaign's.
    expect(within(sprint).getByRole('button', { name: 'Chase Q4 APE Sprint' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(cardOf('October New Hire Blitz')).getByRole('button', { name: 'Chase October New Hire Blitz' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('UI-108 the star chases; the card opens the detail; an ended campaign is a short row that opens it too', async () => {
    const { calls } = list({ 'PUT /campaigns/NEW_HIRE_BLITZ/chase': { body: { ...LIST.campaigns[1], chasing: true } } });
    await listReady();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chase October New Hire Blitz' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Chase October New Hire Blitz' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chase October New Hire Blitz' })).toHaveAttribute('aria-pressed', 'true'));
    expect(calls.some((c) => c.init.method === 'PUT' && c.url.endsWith('/campaigns/NEW_HIRE_BLITZ/chase'))).toBe(true);
    await userEvent.click(within(cardOf('Q4 APE Sprint')).getByRole('button', { name: 'Q4 APE Sprint' }));
    expect(nav.push).toHaveBeenCalledWith('/campaigns/APE_SPRINT', { scroll: false });
    const ended = screen.getByRole('button', { name: /Mid-Year Persistency Push/ });
    expect(ended.querySelector('[data-chase]')).toBeNull();
    await userEvent.click(ended);
    expect(nav.push).toHaveBeenCalledWith('/campaigns/PERSISTENCY_PUSH', { scroll: false });
  });

  it('UI-108 the two kinds are one segmented control on a phone, and no sub-line is drawn there', async () => {
    list();
    await listReady();
    const tabs = screen.getByRole('tablist');
    expect(tabs).toHaveClass('max-md:rounded-pill', 'max-md:bg-card');
    expect(within(tabs).getByRole('tab', { name: 'Seasonal' }).firstElementChild).toHaveClass('max-md:bg-secondary');
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toHaveClass('max-md:hidden');
  });
});
