import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { ADMIN_ME, CORE_LEADER_ME, OWNER_ME, SHELL_STUBS } from '@test/kpm-analytics-fixtures';
import { TOWN_HALL_SUMMARY } from '@test/events-fixtures';
import {
  complianceView, EMPTY_CATALOG, ITEM_REFUSED, NEXT_YEAR_CAMPAIGN, NO_AB, NOT_FOUND, SERVER_ERROR,
} from '@test/kpm-compliance-fixtures';
import type { ComplianceCategory, ComplianceView } from '@/lib/kpm-compliance';
import KpmAnalyticsLayout from '../layout';
import KpmAnalyticsCompliancePage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/kpm/analytics/compliance',
}));

const READ = 'GET /kpm/analytics/compliance';
const FEEDBACK = 'GET /kpm/settings/events/';
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

/** The read as the server answers it: the selection the address sent, or the category's default. */
const answer = (over: (view: ComplianceView) => ComplianceView = (v) => v): StubReply => ({ url }) => {
  const q = new URL(url).searchParams;
  return { body: over(complianceView((q.get('category') ?? 'training') as ComplianceCategory, q.get('item'))) };
};

function open(
  reply: StubReply | StubReply[] = answer(),
  { me = OWNER_ME, query = {} }: { me?: typeof OWNER_ME; query?: Record<string, string> } = {},
) {
  const stub = stubFetch({ ...SHELL_STUBS, [READ]: reply, [FEEDBACK]: { body: TOWN_HALL_SUMMARY } });
  renderInLayout(
    KpmAnalyticsLayout,
    <KpmAnalyticsCompliancePage searchParams={routeParams(query)} />,
    { me },
  );
  return stub;
}

const reads = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.includes('/kpm/analytics/compliance')).map((c) => c.url.replace('http://api.test/api/v1', ''));
const tree = () => screen.findAllByRole('region');
const section = (id: string) => document.querySelector(`[data-section="${id}"]`) as HTMLElement;
const unit = (id: string) => document.querySelector(`[data-unit="${id}"]`) as HTMLElement;
const row = (id: string) => document.querySelector(`[data-row="${id}"]`) as HTMLElement;
const order = (unitId: string) => [...unit(unitId).querySelectorAll('[data-row]')].map((r) => r.getAttribute('data-row'));
const chip = (label: string) => within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: new RegExp(`${label}$`) });
const sortButton = () => screen.getByRole('button', { name: /first$/ });
const main = () => screen.getByRole('main');
/** What a screen reader says of an element: its text, less anything `aria-hidden`. */
const spoken = (el: Element): string => [...el.childNodes].map((n) => {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
  if (n instanceof Element && n.getAttribute('aria-hidden') !== 'true') return spoken(n);
  return '';
}).join('');

/**
 * *Compliance, Events, and Campaigns* (P18.6-T1, P18.6-T2): the six chips, Training's tabs, the single-item
 * categories, the event and campaign pickers, search, sort and the tree — over `GET /kpm/analytics/compliance`,
 * the selection in the address.
 */
describe('KPM analytics › Compliance, Events, and Campaigns (P18.6-T1, P18.6-T2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.replace.mockClear();
  });

  describe('P18.6-T1 AC-1 who reads it (the screen’s half)', () => {
    it('keeps the page’s title and tabs, this one current, and heads its panel as the prototype does', async () => {
      open();
      await tree();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^KPM Analytics$/);
      const tabs = within(screen.getByRole('navigation', { name: 'KPM Analytics' }));
      expect(tabs.getByRole('link', { name: 'Compliance, Events, and Campaigns' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('heading', { level: 2, name: 'Compliance, Events, and Campaigns' })).toBeInTheDocument();
    });

    it('gives the Admin the same screen', async () => {
      open(undefined, { me: ADMIN_ME });
      expect((await tree()).length).toBeGreaterThan(0);
    });

    it('P18.8-T5 AC-5 refuses an Agent as their own field app does, never in the console’s chrome, and asks the API for nothing', async () => {
      // The product owner's report, 2026-10-11: an Agent here was refused inside the Owner's chrome. The route wears the
      // reader's own shell since ADR-0159 §3.
      nav.replace.mockClear();
      const { calls } = open(undefined, { me: makeMe({ permissions: ['member:read_profile'] }) });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
      expect(reads(calls)).toEqual([]);
    });

    it('P18.8-T5 AC-4 a Core Leader reads the tree in their own shell; one who is not is refused without a read', async () => {
      open(undefined, { me: CORE_LEADER_ME });
      expect((await tree()).length).toBeGreaterThan(0);
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
      vi.unstubAllGlobals();
      const untagged = makeMe({ ...CORE_LEADER_ME, membership: { ...CORE_LEADER_ME.membership!, isCoreLeader: false } });
      const { calls } = open(undefined, { me: untagged });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(reads(calls)).toEqual([]);
    });

    it('refuses an Admin without the grant, in the console, and asks the API for nothing (the layout’s page)', async () => {
      const { calls } = open(undefined, { me: makeMe({ ...ADMIN_ME, permissions: ['member:read_profile'] }) });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_analytics:read');
      await waitFor(() => expect(reads(calls)).toEqual([]));
    });
  });

  describe('P18.6-T1 AC-2 one read, the selection in the address', () => {
    it('reads Training when the address names nothing, once', async () => {
      const { calls } = open();
      await tree();
      expect(reads(calls)).toEqual(['/kpm/analytics/compliance?category=training']);
    });

    it('reads the address’s category and item, so a refresh keeps them', async () => {
      const { calls } = open(undefined, { query: { category: 'events', item: 'ev-kickoff' } });
      await tree();
      expect(reads(calls)).toEqual(['/kpm/analytics/compliance?category=events&item=ev-kickoff']);
      expect(screen.getByRole('combobox', { name: 'Event' })).toHaveValue('ev-kickoff');
    });

    it('never sends an item on a single-item category, which the read would refuse', async () => {
      const { calls } = open(undefined, { query: { category: 'goals', item: 'x' } });
      await tree();
      expect(reads(calls)).toEqual(['/kpm/analytics/compliance?category=goals']);
    });

    it('reads Training for a category the read does not know', async () => {
      const { calls } = open(undefined, { query: { category: 'nonsense' } });
      await tree();
      expect(reads(calls)).toEqual(['/kpm/analytics/compliance?category=training']);
    });

    it('writes a choice into the address and reads it', async () => {
      const { calls } = open();
      await tree();
      await userEvent.click(within(screen.getByRole('group', { name: 'Skills' })).getByRole('button', { name: 'Closing' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics/compliance?category=training&item=CLOSING_TECHNIQUES', { scroll: false });
      await waitFor(() => expect(reads(calls)).toContain('/kpm/analytics/compliance?category=training&item=CLOSING_TECHNIQUES'));
    });
  });

  describe('P18.6-T1 AC-3 the summary, verbatim', () => {
    it('counts the sub-line’s people and units (contradiction 1)', async () => {
      open();
      await tree();
      expect(screen.getByText("Every AB's unit in this KPM — 11 people across 3 units")).toBeInTheDocument();
    });

    it('draws six chips in order, each “{n} / {of}” over its label, the one shown pressed', async () => {
      open();
      await tree();
      const chips = within(screen.getByRole('group', { name: 'Categories' })).getAllByRole('button');
      expect(chips.map((c) => c.textContent)).toEqual([
        '3/ 11Training', '8/ 11Goal Setting', '6/ 11Activity Mgmt', '2/ 6Activation', '5/ 9Events', '4/ 8Campaigns',
      ]);
      expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
      // A selection is navy (ADR-0137 §2): the prototype's ring, in navy rather than amber.
      expect(chips[0]).toHaveClass('border-navy', 'ring-navy');
      expect(chips[1]).not.toHaveClass('ring-navy');
      expect(chips[0].className).not.toMatch(/amber/);
    });

    it('draws — over nobody, named “No rate: nobody to count” (D-chips)', async () => {
      open({ body: EMPTY_CATALOG('training') });
      await screen.findByRole('group', { name: 'Categories' });
      expect(chip('Training')).toHaveAccessibleName('No rate: nobody to count Training');
      expect(chip('Training')).toHaveTextContent(/^—/);
      // Drawn *"8/ 11"* (`:3474`); a screen reader hears the figure and its total apart.
      expect(chip('Goal Setting')).toHaveTextContent(/^8\/ 11Goal Setting$/);
      expect(chip('Goal Setting')).toHaveAccessibleName('8 / 11 Goal Setting');
    });

    it('selects a chip’s category and turns the sort back to worst-first', async () => {
      const { calls } = open();
      await tree();
      await userEvent.click(sortButton());
      expect(sortButton()).toHaveAccessibleName('On track first');
      await userEvent.click(chip('Goal Setting'));
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics/compliance?category=goals', { scroll: false });
      expect(chip('Goal Setting')).toHaveAttribute('aria-pressed', 'true');
      expect(sortButton()).toHaveAccessibleName('Needs attention first');
      await waitFor(() => expect(reads(calls)).toContain('/kpm/analytics/compliance?category=goals'));
    });

    it('keeps the Activity chip’s tooltip, and draws its note under the tabs when chosen', async () => {
      const tip = 'Whether activity was logged at least once in the past 7 days — there\'s no partial state, only Logged or Missed.';
      open();
      await tree();
      expect(chip('Activity Mgmt')).toHaveAttribute('title', tip);
      expect(screen.queryByText(tip)).not.toBeInTheDocument();
      await userEvent.click(chip('Activity Mgmt'));
      expect(await screen.findByText(tip)).toBeInTheDocument();
    });
  });

  describe('P18.6-T1 AC-4 Training', () => {
    it('draws the three rows: the categories, the skills holding a module, their modules', async () => {
      open();
      await tree();
      const names = (group: string) => within(screen.getByRole('group', { name: group })).getAllByRole('button')
        .map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
      expect(names('Training categories')).toEqual([['Sales', 'true'], ['Product', 'false']]);
      expect(names('Skills')).toEqual([['Prospecting', 'true'], ['Closing', 'false']]);
      expect(names('Modules')).toEqual([['Building Your Prospect List', 'true'], ['Referral Generation Techniques', 'false']]);
    });

    it('paints the chosen category and skill navy, and keeps the chosen module’s amber rule (ADR-0137 §2, §3)', async () => {
      open();
      await tree();
      const pressed = (group: string) => within(screen.getByRole('group', { name: group })).getByRole('button', { pressed: true });
      expect(pressed('Training categories')).toHaveClass('bg-navy');
      expect(pressed('Skills')).toHaveClass('bg-navy');
      expect(pressed('Modules')).toHaveClass('border-amber', 'text-navy');
      expect(pressed('Modules')).not.toHaveClass('bg-navy');
    });

    it('draws the category with no module muted, and pressing it says its modules are coming soon, reading nothing', async () => {
      const { calls } = open();
      await tree();
      const product = within(screen.getByRole('group', { name: 'Training categories' })).getByRole('button', { name: 'Product' });
      expect(product).toHaveClass('text-muted/[0.86]');
      await userEvent.click(product);
      expect(product).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Modules for Product are coming soon.')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Skills' })).not.toBeInTheDocument();
      expect(screen.queryAllByRole('region')).toHaveLength(0);
      expect(reads(calls)).toHaveLength(1);
    });

    it('reads a module chosen from its tab', async () => {
      const { calls } = open();
      await tree();
      await userEvent.click(within(screen.getByRole('group', { name: 'Modules' })).getByRole('button', { name: 'Referral Generation Techniques' }));
      await waitFor(() => expect(reads(calls)).toContain('/kpm/analytics/compliance?category=training&item=REFERRALS'));
    });

    it('draws Completed with the day done — with its year when not this one — In progress and Not started', async () => {
      open();
      await tree();
      expect(row('mem-hendra')).toHaveTextContent(/Completed\s*Sep 1$/);
      expect(row('mem-ika')).toHaveTextContent(/Completed\s*Dec 20, 2025$/);
      expect(row('mem-rina')).toHaveTextContent(/In progress\s*—$/);
      expect(row('mem-dedy')).toHaveTextContent(/Not started\s*—$/);
    });
  });

  describe('P18.6-T1 AC-5, AC-6, AC-7 the single-item categories', () => {
    it.each(['goals', 'activity', 'activation'])('%s draws no item label, as the prototype draws none for one item (:3609-3611)', async (category) => {
      open(undefined, { query: { category } });
      await tree();
      expect(screen.queryByText(/^\d{4} goals$|Activity log — last 7 days|90-day checklist/)).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: /Modules|Skills/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('Goal Setting: Set with the day saved, Not set', async () => {
      open(undefined, { query: { category: 'goals' } });
      await tree();
      expect(row('mem-rina')).toHaveTextContent(/Set\s*Jan 10$/);
      expect(row('mem-dedy')).toHaveTextContent(/Not set\s*—$/);
    });

    it('Activity Mgmt: Logged with the last day, Missed', async () => {
      open(undefined, { query: { category: 'activity' } });
      await tree();
      expect(row('mem-rina')).toHaveTextContent(/Logged\s*Oct 10$/);
      expect(row('mem-dedy')).toHaveTextContent(/Missed\s*—$/);
    });

    it('Activation: Completed with the graduation day, In progress, Overdue and —', async () => {
      open(undefined, { query: { category: 'activation' } });
      await tree();
      expect(row('mem-sinta')).toHaveTextContent(/Completed\s*Aug 1$/);
      expect(row('mem-agus')).toHaveTextContent(/In progress\s*—$/);
      expect(row('mem-dedy')).toHaveTextContent(/Overdue\s*—$/);
      expect(row('mem-rina')).toHaveTextContent(/—\s*—$/);
      expect(row('mem-hendra')).toHaveTextContent(/—\s*—$/);
    });

    it('Activation: an expired one’s Overdue names its end once, the tooltip saying the same (OD-159)', async () => {
      open(undefined, { query: { category: 'activation' } });
      await tree();
      const sentence = 'Overdue: ended on Sep 30 without being marked complete';
      const overdue = within(row('mem-yoga')).getByRole('button', { name: sentence });
      // Not read twice: the bubble is no description of the button, and is hidden from a screen reader.
      expect(overdue).not.toHaveAttribute('aria-describedby');
      expect(overdue).toHaveAccessibleDescription('');
      expect(within(row('mem-yoga')).getByRole('tooltip', { hidden: true })).toHaveTextContent(sentence);
      expect(overdue).toHaveTextContent('Overdue');
      // An open one's Overdue has no end to name.
      expect(within(row('mem-dedy')).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('P18.6-T1 AC-8 the tree', () => {
    it('draws one section per agency in the read’s order, each with its total overall', async () => {
      open();
      const regions = await tree();
      expect(regions.map((r) => r.getAttribute('data-section'))).toEqual(['mem-hendra', 'mem-maya', 'mem-owner']);
      expect(section('mem-hendra')).toHaveTextContent('4 / 7 done overall');
      expect(within(section('mem-hendra').firstElementChild as HTMLElement).getByText('AB', { selector: 'span' })).toBeInTheDocument();
    });

    it('draws the AB’s own card first, then each AAB’s, each titled, tagged and totalled', async () => {
      open();
      await tree();
      const cards = [...section('mem-hendra').querySelectorAll('[data-unit]')];
      expect(cards.map((c) => c.getAttribute('data-unit'))).toEqual(['mem-hendra', 'mem-ika']);
      expect(within(unit('mem-ika')).getByRole('heading', { level: 4 })).toHaveAccessibleName("Ika Wirawan's Unit (opens their Unit Dashboard in a new tab)");
      expect(within(unit('mem-ika')).getByRole('link', { name: /^Ika Wirawan's Unit/ })).toHaveAttribute('href', '/unit/dashboard/mem-ika');
      expect(unit('mem-ika')).toHaveTextContent('AAB');
      expect(unit('mem-ika')).toHaveTextContent('2 / 3 done');
      expect(unit('mem-hendra')).toHaveTextContent('2 / 4 done');
    });

    it('draws — over nobody on a card and a section, never 0 / 0, named as the chips are (D-chips)', async () => {
      open(undefined, { query: { category: 'activation' } });
      await tree();
      // Maya Halim has no activation, and her card holds nobody else: nobody to count.
      for (const el of [unit('mem-maya').firstElementChild!, section('mem-maya').firstElementChild!]) {
        expect(el.textContent).not.toMatch(/0 \/ 0/);
        expect(el).toHaveTextContent(/— done/);
        expect(spoken(el)).toContain('No rate: nobody to count');
        expect(spoken(el)).not.toContain('—');
      }
      // A card that counts somebody keeps its figure.
      expect(unit('mem-owner')).toHaveTextContent('1 / 2 done');
    });

    it('draws — on the card of a head outside an event’s audience (D-chips)', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      await tree();
      expect(unit('mem-maya').firstElementChild).toHaveTextContent(/— joined/);
      expect(section('mem-maya').firstElementChild).toHaveTextContent(/— joined overall/);
    });

    it('puts the head’s own row first, tagged Personal', async () => {
      open();
      await tree();
      expect(order('mem-hendra')[0]).toBe('mem-hendra');
      expect(row('mem-hendra')).toHaveTextContent('Personal');
      expect(row('mem-rina')).not.toHaveTextContent('Personal');
      // The space between the name and its tag (`:3681`), a head who leads nobody's too.
      expect(row('mem-maya').firstElementChild!.textContent).toBe('Maya Halim Personal');
    });

    it('orders worst-first, then best-first, the — rows last both ways and a tie by name', async () => {
      open(undefined, { query: { category: 'activation' } });
      await tree();
      expect(sortButton()).toHaveTextContent('↓ Needs attention first');
      expect(order('mem-hendra')).toEqual(['mem-hendra', 'mem-dedy', 'mem-agus', 'mem-rina']);
      await userEvent.click(sortButton());
      expect(sortButton()).toHaveTextContent('↑ On track first');
      expect(order('mem-hendra')).toEqual(['mem-hendra', 'mem-agus', 'mem-dedy', 'mem-rina']);
    });

    it('breaks a tie by name (Goal Setting)', async () => {
      open(undefined, { query: { category: 'goals' } });
      await tree();
      expect(order('mem-hendra')).toEqual(['mem-hendra', 'mem-dedy', 'mem-agus', 'mem-rina']);
    });

    it('searches as drawn: trimmed, any case, a card kept with its head’s row, counts unchanged', async () => {
      open();
      await tree();
      const search = screen.getByRole('searchbox', { name: 'Search agent or leader name' });
      expect(search).toHaveAttribute('placeholder', 'Search agent or leader name…');
      await userEvent.type(search, '  SINTA ');
      expect(screen.getAllByRole('region').map((r) => r.getAttribute('data-section'))).toEqual(['mem-hendra']);
      expect([...section('mem-hendra').querySelectorAll('[data-unit]')].map((u) => u.getAttribute('data-unit'))).toEqual(['mem-ika']);
      expect(order('mem-ika')).toEqual(['mem-ika', 'mem-sinta']);
      expect(unit('mem-ika')).toHaveTextContent('2 / 3 done');
      expect(section('mem-hendra')).toHaveTextContent('4 / 7 done overall');
    });

    it('says so when nobody matches', async () => {
      open();
      await tree();
      await userEvent.type(screen.getByRole('searchbox'), 'zzz');
      expect(screen.getByText('No one matches this search.')).toBeInTheDocument();
      expect(screen.queryAllByRole('region')).toHaveLength(0);
    });

    it('drills by link: a leader to their Unit Dashboard in a new tab, the reader to their own, anybody else to their page', async () => {
      open();
      await tree();
      const hendra = within(row('mem-hendra')).getByRole('link', { name: 'Hendra Wibowo (opens their Unit Dashboard in a new tab)' });
      expect(hendra).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      expect(hendra).toHaveAttribute('target', '_blank');
      expect(hendra).toHaveAttribute('rel', 'noopener noreferrer');
      expect(within(row('mem-owner')).getByRole('link', { name: 'Wilson Tanoto (opens your Unit Dashboard in a new tab)' }))
        .toHaveAttribute('href', '/unit/dashboard');
      const rina = within(row('mem-rina')).getByRole('link', { name: 'Rina Agustina' });
      expect(rina).toHaveAttribute('href', '/people/members/mem-rina');
      expect(rina).not.toHaveAttribute('target');
      // A head who leads nobody opens their page too.
      expect(within(section('mem-maya')).getAllByRole('link', { name: 'Maya Halim' })[0]).toHaveAttribute('href', '/people/members/mem-maya');
    });

    it('opens the Unit Dashboard in the same tab inside a support session, which carries the session', async () => {
      open(undefined, { me: makeMe({ ...OWNER_ME, isImpersonating: true, impersonationReadOnly: true }) });
      await tree();
      const hendra = within(row('mem-hendra')).getByRole('link', { name: 'Hendra Wibowo' });
      expect(hendra).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      expect(hendra).not.toHaveAttribute('target');
    });

    it('writes nothing: choosing, searching, sorting and following a name only read', async () => {
      const { mock } = open();
      await tree();
      await userEvent.click(sortButton());
      // A leader's name opens a new tab: the click is the browser's, and asks this screen for nothing.
      await userEvent.click(within(row('mem-hendra')).getByRole('link', { name: /^Hendra Wibowo/ }));
      await userEvent.type(screen.getByRole('searchbox'), 'a');
      await userEvent.click(chip('Events'));
      await tree();
      const methods = mock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.method ?? 'GET');
      expect(methods.every((m) => m === 'GET')).toBe(true);
    });
  });

  describe('P18.6-T1 AC-10 accessibility, phones, states', () => {
    it('words every status: no pill is colour alone', async () => {
      open();
      await tree();
      for (const r of document.querySelectorAll('[data-row]')) expect(r.textContent).toMatch(/Completed|In progress|Not started/);
    });

    it('fixes the date column at one width, so every row’s pill stays in line, a date with its year included', async () => {
      open();
      await tree();
      const dateOf = (id: string) => row(id).lastElementChild!;
      expect(dateOf('mem-ika')).toHaveTextContent('Dec 20, 2025');
      for (const id of ['mem-ika', 'mem-hendra', 'mem-rina']) expect(dateOf(id)).toHaveClass('w-[84px]', 'shrink-0', 'text-right');
    });

    it('sets the pills’ words at 12px, the prototype’s .status-pill (:564)', async () => {
      open();
      await tree();
      const pill = within(row('mem-hendra')).getByText('Completed');
      expect(pill).toHaveClass('text-sm', 'font-semibold', 'normal-case');
      expect(pill).not.toHaveClass('text-xs');
    });

    it('gives the search a row of its own on a phone, the sort under it, so its placeholder is never cut', async () => {
      open(undefined, { query: { category: 'campaigns' } });
      await tree();
      expect(screen.getByRole('searchbox')).toHaveClass('basis-full', 'sm:basis-0', 'sm:max-w-[240px]');
    });

    it('clips nothing a cell opens: a unit card does not hide its overflow, its header rounding its own corners', async () => {
      open(undefined, { query: { category: 'activation' } });
      await tree();
      const card = unit('mem-hendra');
      expect(card).not.toHaveClass('overflow-hidden');
      expect(card.firstElementChild).toHaveClass('rounded-t-[9px]');
      // No row paints a background that could cross the card's rounded bottom.
      for (const r of card.querySelectorAll('[data-row]')) expect(r.className).not.toMatch(/\bbg-/);
    });

    it('stacks the pills under the name below the small breakpoint, so a phone never scrolls sideways', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      await tree();
      const r = row('mem-rina');
      expect(r).toHaveClass('flex-wrap');
      expect(r.firstElementChild).toHaveClass('basis-full', 'sm:flex-1');
    });

    it('shows the tree in outline while it is read', () => {
      stubFetch({ ...SHELL_STUBS });
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
      renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsCompliancePage searchParams={routeParams({})} />, { me: OWNER_ME });
      expect(screen.getByRole('status')).toHaveTextContent('Loading each unit’s statuses…');
    });

    it('shows the error with a retry that keeps the selection', async () => {
      const { calls } = open([SERVER_ERROR, answer()], { query: { category: 'campaigns', item: 'PERSISTENCY_PUSH' } });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await tree();
      expect(reads(calls)).toEqual([
        '/kpm/analytics/compliance?category=campaigns&item=PERSISTENCY_PUSH',
        '/kpm/analytics/compliance?category=campaigns&item=PERSISTENCY_PUSH',
      ]);
    });

    it('shows the server’s words for an item the team does not list, and leads back to the category’s default', async () => {
      const { calls } = open([NOT_FOUND, answer()], { query: { category: 'training', item: 'OTHER_OFFICE' } });
      expect(await screen.findByRole('alert')).toHaveTextContent('Training module not found.');
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Training' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics/compliance?category=training', { scroll: false });
      await tree();
      expect(reads(calls)).toEqual([
        '/kpm/analytics/compliance?category=training&item=OTHER_OFFICE',
        '/kpm/analytics/compliance?category=training',
      ]);
    });

    it('leads back to the category’s default from an item the read refuses as written (400), which no retry reads', async () => {
      const long = 'X'.repeat(101);
      const { calls } = open([ITEM_REFUSED, answer()], { query: { category: 'events', item: long } });
      expect(await screen.findByRole('alert')).toHaveTextContent('item must be shorter than or equal to 100 characters');
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Events' }));
      await tree();
      expect(reads(calls)).toEqual([
        `/kpm/analytics/compliance?category=events&item=${long}`,
        '/kpm/analytics/compliance?category=events',
      ]);
    });

    it('says so for a team with no AB yet, its sub-line left out', async () => {
      open({ body: NO_AB });
      expect(await screen.findByText('There are no ABs yet.')).toBeInTheDocument();
      expect(screen.getByText('Each AB’s agency gets a section here, with a row for each of its people.')).toBeInTheDocument();
      expect(screen.queryByText(/Every AB's unit/)).not.toBeInTheDocument();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('draws its empty lines as the prototype’s .compliance-empty (:111): centred, muted, no top rule, bottom corners rounded', async () => {
      open();
      await tree();
      await userEvent.type(screen.getByRole('searchbox'), 'zzz');
      const box = screen.getByText('No one matches this search.').parentElement!;
      expect(box).toHaveClass('p-[26px]', 'text-center', 'text-base', 'text-muted', 'border-t-0', 'rounded-b-lg', 'bg-card');
      expect(box).not.toHaveClass('rounded-lg');
      expect(box).toHaveAttribute('data-variant', 'filtered');
    });

    it.each([
      ['training', 'No training has been published yet.'],
      ['events', 'There are no events this year.'],
      ['campaigns', 'There are no campaigns this year.'],
    ] as const)('says so when %s has nothing to show', async (category, words) => {
      open({ body: EMPTY_CATALOG(category) }, { query: { category } });
      expect(await screen.findByText(words)).toBeInTheDocument();
      expect(screen.queryAllByRole('region')).toHaveLength(0);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('names no phase, and uses none of OD-39’s six words but the prototype’s own sub-line', async () => {
      open();
      await tree();
      const text = document.querySelector('[data-part="compliance"]')!.textContent!.replace("Every AB's unit in this KPM", '');
      expect(main().textContent).toContain("Every AB's unit in this KPM");
      expect(text).not.toMatch(/\bphase\b/i);
      expect(text).not.toMatch(SIX_WORDS);
    });

    it('is no longer the sign: it imports the screen, not the placeholder (scripts/lib/screens.py)', () => {
      const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
      expect(source).not.toMatch(/coming-in-phase/);
      expect(source).toMatch(/compliance-screen/);
    });
  });

  describe('P18.6-T2 AC-1 the event picker', () => {
    it('groups the year’s events: Upcoming soonest first, a running one among them, Past latest first', async () => {
      open(undefined, { query: { category: 'events' } });
      await tree();
      const picker = screen.getByRole('combobox', { name: 'Event' });
      const groups = [...picker.querySelectorAll('optgroup')].map((g) => [g.label, [...g.querySelectorAll('option')].map((o) => o.textContent)]);
      expect(groups).toEqual([
        ['Upcoming', ['Leaders’ huddle — Oct 10', 'Kickoff 2026 — Oct 24']],
        ['Past', ['PRULink briefing — Sep 19', 'August Town Hall — Aug 15']],
      ]);
      // The read's default: the first, the running huddle, its tag the phase word.
      expect(picker).toHaveValue('ev-huddle');
      expect(picker.parentElement).toHaveTextContent(/Running\s*Oct 10$/);
    });

    it('reads the event picked, and tags a past one Past', async () => {
      const { calls } = open(undefined, { query: { category: 'events' } });
      await tree();
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Event' }), 'ev-townhall');
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics/compliance?category=events&item=ev-townhall', { scroll: false });
      await waitFor(() => expect(reads(calls)).toContain('/kpm/analytics/compliance?category=events&item=ev-townhall'));
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Event' }).parentElement).toHaveTextContent(/Past\s*Aug 15$/));
    });
  });

  describe('P18.6-T2 AC-2 the events rows', () => {
    it('upcoming: Joined · Feedback, Registered or Not registered, — for anybody outside the audience', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-kickoff' } });
      await tree();
      expect(unit('mem-hendra')).toHaveTextContent(/JoinedFeedback/);
      expect(row('mem-hendra')).toHaveTextContent(/Joined: Registered\s*Feedback: —/);
      expect(row('mem-rina')).toHaveTextContent(/Joined: Not registered\s*Feedback: —/);
      expect(row('mem-sinta')).toHaveTextContent(/Joined: —\s*Feedback: —/);
      expect(unit('mem-hendra')).toHaveTextContent('3 / 4 joined');
      expect(section('mem-hendra')).toHaveTextContent('joined overall');
      expect(sortButton()).toHaveTextContent('↓ Not joined first');
    });

    it('past: Attended, No-show, Not registered, — awaiting confirmation; Shared, Not shared, —', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      await tree();
      expect(row('mem-hendra')).toHaveTextContent(/Attended\s*Feedback: Shared/);
      expect(row('mem-rina')).toHaveTextContent(/Attended\s*Feedback: Not shared/);
      expect(row('mem-dedy')).toHaveTextContent(/No-show\s*Feedback: —/);
      expect(row('mem-agus')).toHaveTextContent(/Not registered\s*Feedback: —/);
      expect(row('mem-ika')).toHaveTextContent(/Feedback: Shared/);
    });

    it('names the — of a member awaiting confirmation apart from the — of somebody outside the audience', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      await tree();
      const joined = (id: string) => row(id).children[1];
      // The eye sees the prototype's dash for both; a screen reader hears which.
      expect(joined('mem-ika')).toHaveTextContent('—');
      expect(spoken(joined('mem-ika'))).toBe('Joined: awaiting confirmation');
      expect(spoken(joined('mem-maya'))).toBe('Joined: —');
      expect(spoken(joined('mem-hendra'))).toBe('Joined: Attended');
    });

    it('orders not joined first, then attended without feedback, — last; and the reverse', async () => {
      open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      await tree();
      expect(order('mem-hendra')).toEqual(['mem-hendra', 'mem-agus', 'mem-dedy', 'mem-rina']);
      await userEvent.click(sortButton());
      expect(sortButton()).toHaveTextContent('↑ Joined first');
      expect(order('mem-hendra')).toEqual(['mem-hendra', 'mem-rina', 'mem-agus', 'mem-dedy']);
    });
  });

  describe('P18.6-T2 AC-3 the Feedback Summary', () => {
    it('mounts a past event’s card above its tree, with its own read', async () => {
      const { calls } = open(undefined, { query: { category: 'events', item: 'ev-townhall' } });
      expect(await screen.findByRole('heading', { name: 'August Town Hall — Feedback Summary' })).toBeInTheDocument();
      expect(calls.map((c) => c.url)).toContain('http://api.test/api/v1/kpm/settings/events/ev-townhall/feedback');
      const card = document.querySelector('[data-part="feedback-summary"]')!;
      const firstSection = document.querySelector('[data-section]')!;
      expect(card.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each([
      ['an upcoming', 'ev-kickoff'],
      ['a running', 'ev-huddle'],
    ])('mounts none for %s event, and asks for none', async (_phase, item) => {
      const { calls } = open(undefined, { query: { category: 'events', item } });
      await tree();
      expect(screen.getByRole('combobox', { name: 'Event' })).toHaveValue(item);
      expect(screen.queryByText(/Feedback Summary/)).not.toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/feedback'))).toEqual([]);
    });
  });

  describe('P18.6-T2 AC-4 the campaign picker', () => {
    it('groups the year’s campaigns, an upcoming one under Ongoing, each with its date label', async () => {
      open(undefined, { query: { category: 'campaigns' } });
      await tree();
      const picker = screen.getByRole('combobox', { name: 'Campaign' });
      const groups = [...picker.querySelectorAll('optgroup')].map((g) => [g.label, [...g.querySelectorAll('option')].map((o) => o.textContent)]);
      expect(groups).toEqual([
        ['Structural', ['MDRT Qualification — Always on']],
        ['Seasonal — Ongoing', ['Q4 APE Push — Since Sep 1', 'Year-End Star Club Drive — Starts Nov 1']],
        ['Seasonal — Past', ['Persistency Push — Ended Aug 31']],
      ]);
      expect(picker.parentElement).toHaveTextContent(/Structural\s*Always on$/);
    });

    it('lists an upcoming campaign of next year under Seasonal — Ongoing, tagged Upcoming, dated with its year', async () => {
      open(answer((v) => ({ ...v, catalog: { ...v.catalog, campaigns: [...v.catalog.campaigns, NEXT_YEAR_CAMPAIGN] } })), {
        query: { category: 'campaigns', item: 'NEW_YEAR_DASH' },
      });
      await tree();
      const picker = screen.getByRole('combobox', { name: 'Campaign' });
      const ongoing = picker.querySelector('optgroup[label="Seasonal — Ongoing"]')!;
      expect([...ongoing.querySelectorAll('option')].map((o) => o.textContent)).toContain('New Year Dash — Starts Jan 1, 2027');
      expect(picker).toHaveValue('NEW_YEAR_DASH');
      expect(picker.parentElement).toHaveTextContent(/Upcoming\s*Starts Jan 1, 2027$/);
    });

    it('tags the structural tag with its token, never a raw colour (contradiction 19)', async () => {
      open(undefined, { query: { category: 'campaigns' } });
      await tree();
      const tag = within(screen.getByRole('combobox', { name: 'Campaign' }).parentElement!).getByText('Structural', { selector: 'span' });
      expect(tag).toHaveClass('text-club-chairman');
    });

    it.each([
      ['APE_SPRINT', /Ongoing\s*Since Sep 1$/],
      ['APE_CHALLENGE_NEXT', /Upcoming\s*Starts Nov 1$/],
      ['PERSISTENCY_PUSH', /Past\s*Ended Aug 31$/],
    ])('tags %s and dates it', async (code, words) => {
      open(undefined, { query: { category: 'campaigns', item: code } });
      await tree();
      expect(screen.getByRole('combobox', { name: 'Campaign' }).parentElement).toHaveTextContent(words);
    });
  });

  describe('P18.6-T2 AC-6 the campaigns rows', () => {
    it('Chasing · Achieved: Chasing, Not chasing, — when not eligible; — achieved while not ended', async () => {
      open(undefined, { query: { category: 'campaigns' } });
      await tree();
      expect(unit('mem-hendra')).toHaveTextContent(/ChasingAchieved/);
      expect(row('mem-hendra')).toHaveTextContent(/Chasing: Chasing\s*Achieved: —/);
      expect(row('mem-dedy')).toHaveTextContent(/Chasing: Not chasing\s*Achieved: —/);
      expect(row('mem-maya')).toHaveTextContent(/Chasing: —\s*Achieved: —/);
      expect(unit('mem-hendra')).toHaveTextContent('3 / 4 chasing');
      expect(section('mem-hendra')).toHaveTextContent('chasing overall');
      expect(sortButton()).toHaveTextContent('↓ Not chasing first');
    });

    it('an ended seasonal campaign: Achieved, Not achieved — a non-chaser’s too — and — for an undecided one', async () => {
      open(undefined, { query: { category: 'campaigns', item: 'PERSISTENCY_PUSH' } });
      await tree();
      expect(row('mem-rina')).toHaveTextContent(/Achieved: Achieved/);
      expect(row('mem-sinta')).toHaveTextContent(/Achieved: Not achieved/);
      expect(row('mem-agus')).toHaveTextContent(/Chasing: Not chasing\s*Achieved: Not achieved/);
      expect(row('mem-ika')).toHaveTextContent(/Achieved: —/);
    });

    it('draws no override control in a read-only session (can.override false)', async () => {
      open(answer((v) => ({ ...v, can: { override: false } })), {
        me: makeMe({ ...OWNER_ME, isImpersonating: true, impersonationReadOnly: true }),
        query: { category: 'campaigns', item: 'PERSISTENCY_PUSH' },
      });
      await tree();
      expect(screen.queryAllByRole('button', { name: /Override/ })).toEqual([]);
      expect(row('mem-rina')).toHaveTextContent(/Achieved: Achieved/);
    });

    it('hands the Achieved cell the reader’s right to override, and no control to a non-chaser', async () => {
      open(undefined, { query: { category: 'campaigns', item: 'PERSISTENCY_PUSH' } });
      await tree();
      expect(within(row('mem-rina')).getByRole('button', { name: /Override Rina Agustina/ })).toBeInTheDocument();
      expect(within(row('mem-agus')).queryByRole('button', { name: /Override/ })).not.toBeInTheDocument();
    });
  });
});
