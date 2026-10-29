import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  atWidth, digestAt, makeMe, renderInIndonesian, renderInLayout, renderWithLanguage, resetLanguage, stubFetch, wears,
  type StubReply,
} from '@test/harness';
import {
  ADMIN_ME, analyticsView, CORE_LEADER_ME, NO_AB, OWNER_ME, SHELL_STUBS,
} from '@test/kpm-analytics-fixtures';
import KpmAnalyticsLayout from './layout';
import KpmAnalyticsPage from './page';
import { englishOnly, englishShown } from '@test/english-left';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { landingFor } from '@/lib/landing';
import { TERMS } from '@/lib/terms';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/kpm/analytics', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

const ANALYTICS = 'GET /kpm/analytics';

function open(reply: StubReply | StubReply[] = { body: analyticsView() }, { me = OWNER_ME, period }: { me?: typeof OWNER_ME; period?: string } = {}) {
  const stub = stubFetch({ ...SHELL_STUBS, [ANALYTICS]: reply });
  nav.search = new URLSearchParams(period ? { period } : {}).toString();
  renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me });
  return stub;
}

const table = () => screen.findByRole('table', { name: 'Unit comparison' });
const main = () => screen.getByRole('main');
const reads = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/kpm/analytics')).map((c) => c.url);
const rowOf = (name: string) => screen.getByRole('rowheader', { name }).closest('tr') as HTMLElement;
/** The total row, first in the table — its name and, when someone left, its ⓘ's. */
const total = () => screen.getByRole('rowheader', { name: /^Total — all 4 ABs/ }).closest('tr') as HTMLElement;

/**
 * KPM analytics' *Overview* (P18-T2): *Unit comparison* by AB agency with its *(Direct)* and AAB rows, the
 * total, MOC with its dialog, the club badges, *Monthly production*, and each leader's drill to their Unit
 * Dashboard in a new tab — over `GET /kpm/analytics`, the period in the address.
 */
describe('KPM analytics (P18-T2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.replace.mockClear();
    nav.pathname = '/kpm/analytics';
  });

  describe('AC-1 the page', () => {
    it('is titled as the prototype titles it, with its sub-line (KPM_Owner.html:2028)', async () => {
      open();
      const title = await screen.findByRole('heading', { level: 1 });
      expect(title).toHaveTextContent(/^KPM Analytics$/);
      expect(screen.getByText('Unit comparisons, club qualification, and trends')).toBeInTheDocument();
    });

    it('has the two tabs as links, saying which is current (:1228-1229)', async () => {
      open();
      const tabs = within(await screen.findByRole('navigation', { name: 'KPM Analytics' }));
      expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
      const compliance = tabs.getByRole('link', { name: 'Compliance, Events, and Campaigns' });
      expect(compliance).toHaveAttribute('href', '/kpm/analytics/compliance');
      expect(compliance).not.toHaveAttribute('aria-current');
      expect(tabs.queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  describe('AC-2 the table, verbatim', () => {
    it('heads the comparison with its counted sub-line, the Period select, and the eight headers', async () => {
      open();
      await table();
      expect(screen.getByRole('heading', { level: 2, name: 'Unit comparison' })).toBeInTheDocument();
      expect(screen.getByText('All 4 ABs, this year — peer benchmark, always shown at group level')).toBeInTheDocument();

      const period = screen.getByRole('combobox', { name: 'Period' });
      expect(within(period).getAllByRole('option').map((o) => o.textContent)).toEqual(['This month', 'Previous month']);
      expect(period).toHaveValue('this_month');

      // Each heading's own words; the MOC heading's ⓘ and its bubble come after them, as *APE*'s do (P18.95-T9 AC-3).
      const words = (h: HTMLElement) => (h.querySelector('[role=tooltip]') ? h.textContent!.split('ⓘ')[0] : h.textContent);
      expect(screen.getAllByRole('columnheader').map(words)).toEqual([
        // P18.97-T3 AC-9 (UI-021): the prototype's *Active this month* reads *Producing this month*.
        'AB', 'Manpower', 'APE — This Month', 'APE — Annual', 'Coached (7d)', 'Producing this month', 'Total leads', 'MOC',
      ]);
    });

    it('gives the MOC header the prototype’s tooltip, verbatim (:1247) — P18.97-T3 AC-8: after the glossary’s line for MOC', async () => {
      open();
      await table();
      // One ⓘ: what MOC is (UI-021), then the company's rules as the server composes them.
      const rules = screen.getByRole('button', { name: 'What is MOC?' });
      // The bubble keeps its lines (`whitespace-pre-line`): the term's, a blank line, then the rules' two.
      expect(document.getElementById(rules.getAttribute('aria-describedby')!)!.textContent).toBe(
        `${TERMS.MOC.definition}\n\n`
        + 'AAB: Net APE ≥ Rp 200 jt AND Monthly2 AA ≥ 2 AND Rolling Persistency DU ≥ 75%.\n'
        + 'AB: (Net APE ≥ Rp 600 jt AND Monthly2 AA DU ≥ 4 / DG ≥ 6 AND Rolling Persistency DU/DG ≥ 75%) OR Direct AB (AB on AB) ≥ 5.',
      );
      expect(rules).toHaveAccessibleDescription(expect.stringMatching(/^Maintenance of Contract: .+ AAB: Net APE ≥ Rp 200 jt/));
      expect(screen.queryByRole('button', { name: 'How is MOC decided?' })).not.toBeInTheDocument();
    });

    it('draws one row per agency, the total first, an AB two levels down in a row of its own (D-units)', async () => {
      open();
      await table();
      const headers = screen.getAllByRole('rowheader').map((h) => h.getAttribute('aria-label') ?? h.textContent);
      expect(headers).toEqual(['Total — all 4 ABs', 'Hendra Wibowo', 'Wilson Tanoto (you)', 'Budi Santoso', 'Fajar Nugroho']);
      // Rows the server made a partition of the members: the total's manpower is their sum.
      expect(within(rowOf('Total — all 4 ABs')).getByText('68')).toBeInTheDocument();
      expect([31, 28, 5, 4].reduce((a, b) => a + b)).toBe(68);
    });

    it('expands an agency into its (Direct) row tagged AB and its AAB rows tagged AAB, with a button saying so', async () => {
      open();
      await table();
      const expander = screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' });
      expect(expander).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('rowheader', { name: 'Hendra Wibowo (Direct)' })).not.toBeInTheDocument();

      await userEvent.click(expander);
      expect(expander).toHaveAttribute('aria-expanded', 'true');
      const directRow = rowOf('Hendra Wibowo (Direct)');
      expect(within(directRow).getByText('AB', { selector: 'span' })).toBeInTheDocument();
      expect(within(directRow).getByText('See Hendra Wibowo above')).toBeInTheDocument();
      expect(within(directRow).getByText('8 Agents')).toBeInTheDocument();
      for (const name of ['Ika Wirawan', 'Yoga Pratama']) {
        expect(within(rowOf(name)).getByText('AAB', { selector: 'span' })).toBeInTheDocument();
      }
      // An agency with no AAB unit has nothing to expand (`:3324`).
      expect(screen.queryByRole('button', { name: 'Units in Budi Santoso’s agency' })).not.toBeInTheDocument();

      await userEvent.click(expander);
      expect(screen.queryByRole('rowheader', { name: 'Hendra Wibowo (Direct)' })).not.toBeInTheDocument();
    });

    it('opens and closes an agency from its row, as the prototype’s row click does (:3417-3422)', async () => {
      open();
      await table();
      await userEvent.click(within(rowOf('Hendra Wibowo')).getByText('IDR 1.3B'));
      expect(screen.getByRole('rowheader', { name: 'Ika Wirawan' })).toBeInTheDocument();
    });

    it('writes "{n} AAB · {m} Agents", and its toggle lists the agency’s people by name, with no "example roster" note', async () => {
      open();
      await table();
      const row = rowOf('Hendra Wibowo');
      expect(within(row).getByText('2 AAB · 28 Agents')).toBeInTheDocument();
      const toggle = within(row).getByRole('button', { name: '31 people in Hendra Wibowo’s agency' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const list = screen.getByRole('list', { name: 'Hendra Wibowo' });
      expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Dimas Pratama', 'Indah Lestari']);
      expect(main().textContent).not.toMatch(/example roster|full list coming|isn't wired up/i);
    });

    it('closes the total row with "Total — all {n} ABs" and "{n} / {m}" "ABs meeting MOC" (:3388, :3395)', async () => {
      open();
      await table();
      const total = rowOf('Total — all 4 ABs');
      expect(within(total).getByText('1 / 4')).toBeInTheDocument();
      expect(within(total).getByText('ABs meeting MOC')).toBeInTheDocument();
      expect(within(total).getByText('2 AAB · 62 Agents')).toBeInTheDocument();
    });
  });

  describe('AC-3 the figures', () => {
    it('writes each APE with "of {target} target" and the pill at the prototype’s 70% — P18.97-T3 AC-1, AC-3: compact money, whole percentages', async () => {
      open();
      await table();
      const row = rowOf('Hendra Wibowo');
      expect(within(row).getByText('IDR 62M')).toBeInTheDocument();
      expect(within(row).getByText(/^of IDR 150M target/)).toBeInTheDocument();
      expect(within(row).getByText('41%')).toHaveClass('text-alert');
      expect(within(row).getByText('87%')).toHaveClass('text-success');
      // A table's money is compact too (ADR-0174 §4): no sum on the page is written to the rupiah.
      expect(main().textContent).not.toMatch(/IDR \d{1,3},\d{3},\d{3}/);
    });

    it('colours the pill by the split the server sends, keeping no copy of its own (invariant §7)', async () => {
      open({ body: analyticsView('this_month', { thresholds: { statusSplitPct: 90 } }) });
      await table();
      expect(within(rowOf('Hendra Wibowo')).getByText('87%')).toHaveClass('text-alert');
      expect(within(rowOf('Wilson Tanoto (you)')).getByText('100%')).toHaveClass('text-success');
    });

    it('P18.97-T3 AC-10: writes the Producing share the server serves, and divides nothing (invariant §7)', async () => {
      const view = analyticsView('this_month');
      const [hendra, ...rest] = view.agencies;
      // 21 of 31 is 68%; a served 58 is written as 58% — proof the screen takes the server's figure, not its own.
      open({ body: { ...view, agencies: [{ ...hendra, activePct: 58 }, ...rest], total: { ...view.total, activePct: 31 } } });
      await table();
      expect(within(rowOf('Hendra Wibowo')).getByText('21 / 31')).toBeInTheDocument();
      expect(within(rowOf('Hendra Wibowo')).getByText('58%')).toBeInTheDocument();
      expect(within(rowOf('Hendra Wibowo')).queryByText('68%')).not.toBeInTheDocument();
      expect(within(total()).getByText('54 / 68')).toBeInTheDocument();
      expect(within(total()).getByText('31%')).toBeInTheDocument();
    });

    it('P18.97-T3 AC-4: the total’s APE — Annual says what it counts, Current members only, its ⓘ still naming what it leaves out', async () => {
      const view = analyticsView('this_month');
      open({ body: { ...view, total: { ...view.total, leaversExcludedMinor: 98_000_000_00 } } });
      await table();
      const annual = total().querySelectorAll('td')[2] as HTMLElement;
      expect(within(annual).getByText('Current members only')).toBeInTheDocument();
      expect(within(annual).getByText('IDR 5.8B')).toBeInTheDocument();
      // On the total alone: an agency's own row is its members by definition, and says nothing more.
      expect(within(rowOf('Hendra Wibowo')).queryByText('Current members only')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {
        name: 'Leaves out IDR 98M produced this year by members who have since left; the Overview’s year counts it.',
      })).toBeInTheDocument();
    });

    it('writes Coached (7d), Active and Total leads as the prototype does', async () => {
      open();
      await table();
      const row = rowOf('Hendra Wibowo');
      expect(within(row).getByText('6 / 31')).toBeInTheDocument();
      expect(within(row).getByText('19%')).toBeInTheDocument();
      expect(within(row).getByText('21 / 31')).toBeInTheDocument();
      expect(within(row).getByText('68%')).toBeInTheDocument();
      expect(within(row).getByText('23')).toBeInTheDocument();
      expect(within(row).getByText('15 sales (9 potential) · 8 recruit (5 potential)')).toBeInTheDocument();
    });

    it('never writes 0 for a month with no file: Not uploaded yet, and no pill', async () => {
      open();
      await table();
      const row = rowOf('Budi Santoso');
      expect(within(row).getAllByText('Not uploaded yet')).toHaveLength(2);
      expect(within(row).getByText(/^of IDR 75M target$/)).toBeInTheDocument();
    });

    it('keeps the period in the address: choosing Previous month re-reads it and replaces the address', async () => {
      const { calls } = open([{ body: analyticsView('this_month') }, { body: analyticsView('previous_month') }]);
      await table();
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'previous_month');

      expect(nav.replace).toHaveBeenCalledWith('/kpm/analytics?period=previous_month', { scroll: false });
      expect(await screen.findByRole('columnheader', { name: 'Producing last month' })).toBeInTheDocument();
      expect(reads(calls)).toEqual([
        'http://api.test/api/v1/kpm/analytics?period=this_month',
        'http://api.test/api/v1/kpm/analytics?period=previous_month',
      ]);
    });

    it('reads the period the address names, so a refresh keeps it, and This month for one it does not know', async () => {
      const first = open({ body: analyticsView('previous_month') }, { period: 'previous_month' });
      await table();
      expect(screen.getByRole('combobox', { name: 'Period' })).toHaveValue('previous_month');
      expect(screen.getByRole('columnheader', { name: 'Producing last month' })).toBeInTheDocument();
      expect(reads(first.calls)).toEqual(['http://api.test/api/v1/kpm/analytics?period=previous_month']);
    });

    it('sends no period the read would refuse', async () => {
      const { calls } = open(undefined, { period: 'yesterday' });
      await table();
      expect(reads(calls)).toEqual(['http://api.test/api/v1/kpm/analytics?period=this_month']);
    });

    it('moves the month’s columns with the period and leaves APE — Annual, Coached (7d) and Manpower as they are', async () => {
      open([{ body: analyticsView('this_month') }, { body: analyticsView('previous_month') }]);
      await table();
      const cells = () => [...rowOf('Hendra Wibowo').querySelectorAll('td')].map((td) => td.textContent);
      const before = cells();
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'previous_month');
      await screen.findByRole('columnheader', { name: 'Producing last month' });
      // F-174: the month's APE column says which month it reads, as *Active* does.
      // Its name then *What is APE?*, the ⓘ beside it (P18.95-T9 AC-3).
      expect(screen.getByRole('columnheader', { name: /^APE — Last Month/ })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /^APE — This Month/ })).not.toBeInTheDocument();
      const after = cells();
      // Manpower, APE — Annual, Coached (7d): unchanged. APE — This Month, Active, Total leads: moved.
      expect([after[0], after[2], after[3]]).toEqual([before[0], before[2], before[3]]);
      expect(after[1]).not.toBe(before[1]);
      expect(after[4]).not.toBe(before[4]);
      expect(after[5]).not.toBe(before[5]);
    });
  });

  it('AC-8 (ADR-0136): the total says what production of members who left it leaves out, and nothing when nobody left', async () => {
    const view = analyticsView('this_month');
    open([{ body: { ...view, total: { ...view.total, leaversExcludedMinor: 12_500_000_00 } } }]);
    await table();
    expect(screen.getByRole('button', {
      name: /^Leaves out IDR 12\.5M produced this year by members who have since left; the Overview’s year counts it\.$/,
    })).toBeInTheDocument();
  });

  it('AC-4: the MOC header’s rules are the company’s, as the server composes them, never the prototype’s numbers', async () => {
    const view = analyticsView('this_month');
    open([{ body: { ...view, mocRulesText: 'AB: Net APE ≥ Rp750M OR Direct AB (AB on AB) ≥ 4.' } }]);
    await table();
    const glyph = screen.getByRole('button', { name: 'What is MOC?' });
    expect(glyph).toHaveAccessibleDescription(`${TERMS.MOC.definition} AB: Net APE ≥ Rp750M OR Direct AB (AB on AB) ≥ 4.`);
  });

  describe('AC-4 MOC', () => {
    it('opens a met leader’s dialog from a button named for them, verbatim (:3291-3318)', async () => {
      open();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' }));
      const dialog = screen.getByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' });
      expect(within(dialog).getByText('Requirements met')).toBeInTheDocument();
      const rows = within(dialog).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Net APE');
      expect(rows[0]).toHaveTextContent('Jan – Sep 2026');
      expect(rows[0]).toHaveTextContent('IDR 1.3B / IDR 600M — Met');
      expect(rows[3]).toHaveTextContent('82% / 75% — Met');
      expect(rows[4]).toHaveTextContent('— OR — Direct AB (AB on AB)');
      expect(rows[4]).toHaveTextContent('1 / 5 — Gap');
      expect(within(dialog).getByText('Met via the standard three-criteria path.')).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens a leader who has not met it, with Not yet met and the gaps', async () => {
      open();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'MOC requirements not yet met for Budi Santoso' }));
      const dialog = screen.getByRole('dialog', { name: 'Budi Santoso — Maintenance of Contract' });
      expect(within(dialog).getByText('Not yet met')).toBeInTheDocument();
      expect(within(dialog).getAllByText('Gap')).toHaveLength(5);
      expect(within(dialog).getByText('Needs to clear either the three standard criteria together, or reach 5 Direct ABs.'))
        .toBeInTheDocument();
    });

    it('draws a missing input as —, never ✕, with its sentence (D-moc)', async () => {
      open();
      await table();
      const cell = within(rowOf('Wilson Tanoto (you)')).getByRole('button', {
        name: 'MOC for Wilson Tanoto — Not uploaded yet: Rolling Persistency — DU/DG.',
      });
      expect(cell).toHaveTextContent('—');
      expect(cell).not.toHaveTextContent('✕');
      await userEvent.click(cell);
      const dialog = screen.getByRole('dialog', { name: 'Wilson Tanoto — Maintenance of Contract' });
      expect(dialog).toHaveAccessibleDescription('Not uploaded yet: Rolling Persistency — DU/DG.');
      expect(within(dialog).queryByText('Not yet met')).not.toBeInTheDocument();
      expect(within(dialog).getAllByRole('listitem')[1]).toHaveTextContent('— / 75% — Not uploaded yet');
    });

    it('says "See {name} above" on a (Direct) row and gives an AAB row its own verdict', async () => {
      open();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
      expect(within(rowOf('Hendra Wibowo (Direct)')).queryByRole('button', { name: /MOC/ })).not.toBeInTheDocument();
      await userEvent.click(within(rowOf('Ika Wirawan')).getByRole('button', { name: 'MOC requirements not yet met for Ika Wirawan' }));
      const dialog = screen.getByRole('dialog', { name: 'Ika Wirawan — Maintenance of Contract' });
      expect(within(dialog).getByText('AAB requirements have no alternate path — all three must be met.')).toBeInTheDocument();
      // A leader the company's rules do not cover is a plain —, with nothing to open.
      expect(within(rowOf('Yoga Pratama')).queryByRole('button', { name: /MOC/ })).not.toBeInTheDocument();
    });
  });

  describe('AC-5 the clubs', () => {
    it('badges an agency with its highest tier, in words, on its annual cell alone', async () => {
      open();
      await table();
      const hendra = rowOf('Hendra Wibowo');
      expect(within(hendra).getByText('Star Club').closest('td')).toBe(hendra.querySelectorAll('td')[2]);
      expect(within(rowOf('Wilson Tanoto (you)')).getByText("Chairman's Club")).toBeInTheDocument();
      expect(within(rowOf('Budi Santoso')).queryByText(/Club/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/Club$/)).toHaveLength(2);
    });

    it('P18.97-T3 AC-8: each club’s ⓘ beside the first badge that shows it, the glossary’s one line (UI-021)', async () => {
      const view = analyticsView('this_month');
      const [hendra, owner, budi, fajar] = view.agencies;
      // Budi and Fajar at Star Club too: Hendra's badge is the first, and the only one with the ⓘ.
      const star = { code: 'STAR_CLUB', label: 'Star Club' };
      open({ body: { ...view, agencies: [hendra, owner, { ...budi, club: star }, { ...fajar, club: star }] } });
      await table();
      const starTip = within(rowOf('Hendra Wibowo')).getByRole('button', { name: 'What is Star Club?' });
      expect(starTip).toHaveAccessibleDescription(TERMS.STAR_CLUB.definition);
      expect(screen.getAllByRole('button', { name: 'What is Star Club?' })).toHaveLength(1);
      expect(within(rowOf('Wilson Tanoto (you)')).getByRole('button', { name: 'What is Chairman’s Club?' }))
        .toHaveAccessibleDescription(TERMS.CHAIRMANS_CLUB.definition);
      expect(within(rowOf('Budi Santoso')).queryByRole('button', { name: /^What is/ })).not.toBeInTheDocument();
      // The dash's name is unchanged (AC-8).
      expect(screen.queryByRole('button', { name: 'What is Elite Club?' })).not.toBeInTheDocument();
    });

    it('paints no badge with a raw colour', async () => {
      open();
      await table();
      for (const badge of screen.getAllByText(/Club$/)) expect(badge.className).not.toMatch(/#|\[rgb/);
    });
  });

  describe('AC-6 Monthly production', () => {
    it('draws the six months with each value in text, a month with no file a labelled gap', async () => {
      open();
      await table();
      expect(screen.getByRole('heading', { level: 2, name: 'Monthly production' })).toBeInTheDocument();
      expect(screen.getByText('Last 6 months, combined APE — whole group')).toBeInTheDocument();
      const months = within(screen.getByRole('list', { name: 'Monthly production' })).getAllByRole('listitem');
      expect(months.map((m) => m.textContent)).toEqual([
        // A bar's label is compact (ADR-0167 §1), its month and its sum in the reader's language (P18.98-T4).
        'Apr 2026: IDR 520MApr',
        'May 2026: IDR 610MMay',
        'Jun 2026: IDR 580MJun',
        'Jul 2026: IDR 700MJul',
        'Aug 2026: Not uploaded yetAug',
        'Sep 2026: IDR 800MSep',
      ]);
      // The gap has no bar with a height: an outline, never a zero-height bar.
      expect(months[4].querySelector('[style*="height"]')).toBeNull();
      expect(months[5].querySelector('[style*="height"]')).toHaveStyle({ height: '100%' });
    });
  });

  describe('AC-7 the drills', () => {
    it('opens each leader’s Unit Dashboard in a new tab, and says so', async () => {
      open();
      await table();
      const hendra = screen.getByRole('link', { name: 'Hendra Wibowo (opens their Unit Dashboard in a new tab)' });
      expect(hendra).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      expect(hendra).toHaveAttribute('target', '_blank');
      expect(hendra).toHaveAttribute('rel', 'noopener noreferrer');

      // The reader's own goes to their own: the page of one's own id answers "not a unit you can open".
      expect(screen.getByRole('link', { name: 'Wilson Tanoto (opens your Unit Dashboard in a new tab)' }))
        .toHaveAttribute('href', '/unit/dashboard');

      await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
      expect(screen.getByRole('link', { name: 'Hendra Wibowo (Direct) (opens their Unit Dashboard in a new tab)' }))
        .toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      const ika = screen.getByRole('link', { name: 'Ika Wirawan (opens their Unit Dashboard in a new tab)' });
      expect(ika).toHaveAttribute('href', '/unit/dashboard/mem-ika');
      expect(ika).toHaveAttribute('target', '_blank');
    });

    it('inside a support session opens the Unit Dashboard in the same tab, which carries the session', async () => {
      open(undefined, { me: makeMe({ ...OWNER_ME, isImpersonating: true, impersonationReadOnly: true }) });
      await table();
      const hendra = screen.getByRole('link', { name: 'Hendra Wibowo' });
      expect(hendra).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      expect(hendra).not.toHaveAttribute('target');
    });

    it('draws a head who leads nobody as plain text: they have no Unit Dashboard to open', async () => {
      const view = analyticsView('this_month');
      const [first, ...rest] = view.agencies;
      const lone = { ...first, head: { ...first.head, leads: false } };
      open([{ body: { ...view, agencies: [lone, ...rest] } }]);
      await table();
      expect(screen.queryByRole('link', { name: new RegExp(`^${first.head.name}`) })).not.toBeInTheDocument();
      expect(screen.getAllByText(first.head.name).length).toBeGreaterThan(0);
    });

    it('writes nothing: the screen only ever reads', async () => {
      const { mock } = open();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
      await userEvent.click(screen.getByRole('button', { name: '31 people in Hendra Wibowo’s agency' }));
      await userEvent.click(screen.getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' }));
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      const methods = mock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.method ?? 'GET');
      expect(methods.every((m) => m === 'GET')).toBe(true);
    });
  });

  describe('AC-9 the states the prototype lacks', () => {
    it('shows a skeleton while the comparison is read', () => {
      stubFetch({ ...SHELL_STUBS, [ANALYTICS]: { body: analyticsView() } });
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
      renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me: OWNER_ME });
      expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading the unit comparison…');
    });

    it('shows an error with a retry that keeps the period', async () => {
      const failure = { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } };
      const { calls } = open([failure, { body: analyticsView('previous_month') }], { period: 'previous_month' });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await table();
      expect(reads(calls)).toEqual([
        'http://api.test/api/v1/kpm/analytics?period=previous_month',
        'http://api.test/api/v1/kpm/analytics?period=previous_month',
      ]);
    });

    it('says so for a team with no AB, and still draws the months', async () => {
      open({ body: NO_AB });
      expect(await screen.findByText('There are no ABs to compare yet.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText(/All 0 ABs/)).not.toBeInTheDocument();
      expect(within(screen.getByRole('list', { name: 'Monthly production' })).getAllByText('Not uploaded yet')).toHaveLength(6);
    });
  });

  describe('AC-10 accessibility, phones and refusals', () => {
    it('is a table with its headers, every row headed by whose it is, scrolling inside its own card', async () => {
      open();
      const t = await table();
      expect(t).toHaveClass('min-w-[1180px]');
      // `relative`, so a screen-reader label's absolute position is clipped by the box, never the page.
      expect(t.parentElement).toHaveClass('relative', 'overflow-x-auto');
      expect(within(t).getAllByRole('columnheader')).toHaveLength(8);
      for (const row of within(t).getAllByRole('row').slice(1)) expect(within(row).getByRole('rowheader')).toBeInTheDocument();
    });

    it('gives the Admin the same screen', async () => {
      open(undefined, { me: ADMIN_ME });
      expect(await table()).toBeInTheDocument();
    });

    it.each([
      // An AB holds the grant since ADR-0159 (the API answers one who is no Core Leader 404); an Agent does not.
      ['an AB who is no Core Leader', makeMe({
        membership: {
          membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 3, isCoreLeader: false,
        },
        permissions: ['member:read_profile', 'org_tree:read', 'kpm_analytics:read'],
      })],
      ['an Agent', makeMe({ permissions: ['member:read_profile'] })],
    ])('P18.8-T5 AC-5 refuses %s as their own field app does, never in the console’s chrome, and asks the API for nothing', async (_who, me) => {
      // The console's chrome is never drawn round a field member (the product owner's report, 2026-10-11): the route
      // is outside every group now, and wears the reader's own shell (`RoleShell`).
      nav.replace.mockClear();
      const { calls } = open(undefined, { me });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
      // A leader holding the grant is refused inside their sidebar; an Agent without it, as on any page they lack.
      if (me.permissions.includes('kpm_analytics:read')) {
        expect(screen.getByRole('link', { name: /Activity management/ })).toBeInTheDocument();
      }
      expect(screen.queryByRole('table', { name: 'Unit comparison' })).not.toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalledWith(landingFor(me));
      expect(reads(calls)).toEqual([]);
    });

    describe('P18.8-T5 AC-4, AC-5 a Core Leader (ADR-0159 §2, §3)', () => {
      it('reads the whole office in their own field shell, the Core leader group’s KPM analytics current', async () => {
        const { calls } = open(undefined, { me: CORE_LEADER_ME });
        expect(await table()).toBeInTheDocument();
        expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'KPM analytics' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /Core leader/ })).toBeInTheDocument();
        expect(reads(calls)).toEqual(['http://api.test/api/v1/kpm/analytics?period=this_month']);
      });

      it('opens no other leader’s Unit Dashboard: their names are plain text, their own unit a link', async () => {
        open(undefined, { me: CORE_LEADER_ME });
        await table();
        expect(screen.queryByRole('link', { name: /Hendra Wibowo \(opens/ })).not.toBeInTheDocument();
        expect(within(rowOf('Hendra Wibowo')).getByText('Hendra Wibowo')).toBeInTheDocument();
        // The fixture's reader row, `isReader`, is still theirs to open.
        expect(screen.getByRole('link', { name: 'Wilson Tanoto (opens your Unit Dashboard in a new tab)' }))
          .toHaveAttribute('href', '/unit/dashboard');
      });

      it('is told the API’s 404 as an error, should the session be stale', async () => {
        open({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM analytics not found.', requestId: 'r' } } }, { me: CORE_LEADER_ME });
        expect(await screen.findByRole('alert')).toHaveTextContent('KPM analytics not found.');
      });
    });

    it('refuses an Admin without the grant, in the console, and asks the API for nothing', async () => {
      const { calls } = open(undefined, { me: makeMe({ ...ADMIN_ME, permissions: ['member:read_profile'] }) });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_analytics:read');
      await waitFor(() => expect(reads(calls)).toEqual([]));
    });

    it('names no phase and no permission in its words', async () => {
      open();
      await table();
      expect(main().textContent).not.toMatch(/phase|kpm_analytics/i);
    });
  });
});

/**
 * **The comparison as cards on a phone** (P18.97-T7 AC-1, ADR-0178 §4; the client's KPM Owner review of 2026-10-27,
 * UI-034: the table, 1329px in some 318px). Below 768px a card per agency, each label above its value, through the
 * shared card pieces (`components/ui/row-cards.tsx`), carrying what P18.97-T3 put on the table; at 768px and wider the
 * table it was, to the byte.
 */
describe('P18.97-T7 AC-1 the comparison as cards on a phone (UI-034)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** The comparison's markup on the build before P18.97-T7, rendered from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<768 | 1280, string> = {
    768: 'a5436f7afc8b6b5f23d9d9a41356394d39e5ec91049a0a07e2d83454ebf57b30',
    1280: 'a5436f7afc8b6b5f23d9d9a41356394d39e5ec91049a0a07e2d83454ebf57b30',
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-1 at %ipx draws the table it drew, to the byte', async (px) => {
    atWidth(px);
    stubFetch({ ...SHELL_STUBS, [ANALYTICS]: { body: analyticsView() } });
    // As a reader who has chosen no language reads it while the switch is not live — English words, Indonesian figures
    // (P18.98-T3) — which is the page as it was: since P18.98-T4 wired its figures, a spec's English is a chosen English.
    renderWithLanguage(<KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, { me: OWNER_ME }, { live: false });
    const comparison = (await table()).closest('.rounded-lg')!;
    expect(digestAt(comparison, px)).toBe(BEFORE_T7[px]);
    resetLanguage();
  });
  const cardsOf = () => screen.findByRole('list', { name: 'Unit comparison' });
  /** The cards, the list's own: the total, then an agency each — the units opened inside an agency are its own. */
  const cards = (list: HTMLElement) => [...list.children] as HTMLElement[];
  const cardOf = (list: HTMLElement, name: string) => cards(list).find((li) => li.textContent?.includes(name))!;
  const labels = (card: HTMLElement) => [...card.querySelectorAll(':scope > dl > div > dt')].map((dt) => dt.textContent);

  it.each([375, 767])('P18.97-T7 AC-1 at %ipx draws a card per agency, the total first, each value under its heading, and no table', async (px) => {
    atWidth(px);
    open();
    const list = await cardsOf();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Each card's first line, as a screen reader has it: the name, where its link opens, and *(you)*.
    expect(cards(list).map((li) => li.querySelector('p')!.textContent)).toEqual([
      'Total — all 4 ABs',
      '▸Hendra Wibowo (opens their Unit Dashboard in a new tab)',
      'Wilson Tanoto (opens your Unit Dashboard in a new tab) (you)',
      'Budi Santoso (opens their Unit Dashboard in a new tab)',
      'Fajar Nugroho (opens their Unit Dashboard in a new tab)',
    ]);
    const hendra = cardOf(list, 'Hendra Wibowo');
    expect(labels(hendra)).toEqual([
      'Manpower', 'APE — This Month', 'APE — Annual', 'Coached (7d)', 'Producing this month', 'Total leads', 'MOC',
    ]);
    // The row's figures, in the table's words.
    expect(hendra).toHaveTextContent('6 / 31');
    expect(hendra).toHaveTextContent('21 / 31');
    expect(within(hendra).getByText('15 sales (9 potential) · 8 recruit (5 potential)')).toBeInTheDocument();
    expect(within(cardOf(list, 'Budi Santoso')).getAllByText('Not uploaded yet')).toHaveLength(2);
  });

  it('P18.97-T7 AC-1 carries P18.97-T3’s words: Current members only, Producing this month at the server’s share, and each ⓘ once', async () => {
    atWidth(375);
    const view = analyticsView('this_month');
    const [hendra, ...rest] = view.agencies;
    open({ body: { ...view, agencies: [{ ...hendra, activePct: 58 }, ...rest], total: { ...view.total, activePct: 31, leaversExcludedMinor: 98_000_000_00 } } });
    const list = await cardsOf();
    const total = cards(list)[0];
    // *Current members only* under the total's annual APE, and on no agency (AC-4).
    expect(within(total).getByText('Current members only')).toBeInTheDocument();
    expect(within(cardOf(list, 'Hendra Wibowo')).queryByText('Current members only')).not.toBeInTheDocument();
    expect(within(total).getByRole('button', {
      name: 'Leaves out IDR 98M produced this year by members who have since left; the Overview’s year counts it.',
    })).toBeInTheDocument();
    // *Producing this month*, its share the server's (AC-9, AC-10): 58 served where 21 of 31 would be 68.
    expect(screen.getAllByText('Producing this month')).toHaveLength(5);
    expect(within(cardOf(list, 'Hendra Wibowo')).getByText('58%')).toBeInTheDocument();
    expect(within(total).getByText('31%')).toBeInTheDocument();
    // APE's, AAB's and MOC's ⓘ on the first card, once; each club's on its first badge (AC-8).
    for (const name of ['What is APE?', 'What is AAB?', 'What is MOC?']) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
      expect(within(total).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(cardOf(list, 'Hendra Wibowo')).getByRole('button', { name: 'What is Star Club?' }))
      .toHaveAccessibleDescription(TERMS.STAR_CLUB.definition);
    expect(within(cardOf(list, 'Wilson Tanoto')).getByRole('button', { name: 'What is Chairman’s Club?' })).toBeInTheDocument();
  });

  it('P18.97-T7 AC-1 opens an agency’s units one step in, from its ▸ or a tap on the card, and its people from the manpower figure', async () => {
    atWidth(375);
    open();
    const list = await cardsOf();
    const hendra = cardOf(list, 'Hendra Wibowo');
    const expand = within(hendra).getByRole('button', { name: 'Units in Hendra Wibowo’s agency' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    const units = screen.getByRole('list', { name: 'Units in Hendra Wibowo’s agency' });
    expect(expand).toHaveAttribute('aria-controls', units.id);
    expect([...units.children].map((li) => li.querySelector('p')!.textContent)).toEqual([
      'Hendra Wibowo (Direct) (opens their Unit Dashboard in a new tab) AB',
      'Ika Wirawan (opens their Unit Dashboard in a new tab) AAB',
      'Yoga Pratama (opens their Unit Dashboard in a new tab) AAB',
    ]);
    expect(within(units).getByText('See Hendra Wibowo above')).toBeInTheDocument();
    // A tap on the card is the row's click; on a link or a button it is that control's.
    fireEvent.click(within(hendra).getAllByText('Manpower')[0]);
    expect(expand).toHaveAttribute('aria-expanded', 'false');

    const people = within(hendra).getByRole('button', { name: /31 people in Hendra Wibowo’s agency/ });
    await userEvent.click(people);
    expect(people).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByRole('list', { name: 'Hendra Wibowo' })).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Dimas Pratama', 'Indah Lestari']);
    expect(expand).toHaveAttribute('aria-expanded', 'false');
  });

  it('P18.97-T7 AC-1 opens MOC’s dialog from the card, and a leader’s Unit Dashboard from their name', async () => {
    atWidth(375);
    open();
    const list = await cardsOf();
    await userEvent.click(within(cardOf(list, 'Hendra Wibowo')).getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' }));
    expect(screen.getByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    const link = within(cardOf(list, 'Hendra Wibowo')).getByRole('link', { name: 'Hendra Wibowo (opens their Unit Dashboard in a new tab)' });
    expect(link).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('P18.97-T7 AC-1 makes each control on a card a 44px target', async () => {
    atWidth(375);
    open();
    const list = await cardsOf();
    const hendra = cardOf(list, 'Hendra Wibowo');
    const worn = (el: Element) => wears(el, 375).split(' ');
    expect(worn(within(hendra).getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }))).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    expect(worn(within(hendra).getByRole('button', { name: /people in Hendra Wibowo’s agency/ }))).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    expect(worn(within(hendra).getByRole('link', { name: /^Hendra Wibowo/ }))).toContain('min-h-11');
    expect(worn(within(hendra).getByRole('button', { name: /^MOC requirements met/ }))).toContain("after:h-[max(100%,2.75rem)]");
  });

  it('P18.97-T7 AC-1 never draws the table first on a phone: the width is asked before the comparison answers', async () => {
    atWidth(375);
    let drew = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches('table') || node.querySelector('table'))) drew = true;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    open();
    await cardsOf();
    observer.disconnect();
    expect(drew).toBe(false);
  });
});

/**
 * **OD-235, clarified 2026-10-29**: the *Producing* cell writes its count over **the same members as its percent** — a
 * past month's *4 / 5 · 80%*, never *4 / 3 · 80%* — the share's base served beside it (`activeOf`); the *Manpower*
 * column stays today's.
 */
describe('OD-235 the Producing cell over the share’s own base', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Hendra's agency in September: four producing of September's five — two have left since — and three today. */
  const september = () => {
    const view = analyticsView('previous_month');
    const [hendra, ...rest] = view.agencies;
    const row = { ...hendra, activeAgents: 4, activePct: 80, activeOf: 5, manpower: { aab: 0, agents: 2, total: 3 } };
    return { ...view, agencies: [row, ...rest] };
  };

  it('OD-235 writes a past month’s count over that month’s members, 4 / 5 · 80%, and Manpower today’s three', async () => {
    open({ body: september() }, { period: 'previous_month' });
    await table();
    const cells = [...rowOf('Hendra Wibowo').querySelectorAll('td')] as HTMLElement[];
    expect(cells[0]).toHaveTextContent(/^3/);
    expect(within(cells[4]).getByText('4 / 5')).toBeInTheDocument();
    expect(within(cells[4]).getByText('80%')).toBeInTheDocument();
    expect(rowOf('Hendra Wibowo')).not.toHaveTextContent('4 / 3');
  });

  it('OD-235 writes this month’s over today’s manpower, the base it is served', async () => {
    open();
    await table();
    const cells = [...rowOf('Hendra Wibowo').querySelectorAll('td')] as HTMLElement[];
    expect(within(cells[4]).getByText('21 / 31')).toBeInTheDocument();
    expect(cells[0]).toHaveTextContent(/^31/);
  });

  it('OD-235 writes the same on a phone’s card: the count over its base under Producing last month', async () => {
    atWidth(375);
    open({ body: september() }, { period: 'previous_month' });
    const list = await screen.findByRole('list', { name: 'Unit comparison' });
    const hendra = [...list.children].find((li) => li.textContent?.includes('Hendra Wibowo')) as HTMLElement;
    const field = [...hendra.querySelectorAll(':scope > dl > div')].find((d) => d.querySelector('dt')?.textContent === 'Producing last month')!;
    expect(field).toHaveTextContent('4 / 580%');
  });
});

/**
 * **P18.98-T4 KPM Analytics in Indonesian** (`i18n/messages/kpm-analytics.ts`; ADR-0179): its words the approved
 * glossary's, each KPI name, role and the jargon kept English (§A), a name and the server's sentences as sent, and its
 * figures Indonesian. The ⓘ's *What is …?* lines are the shared glossary's terms (`lib/terms.ts`), not this module's.
 */
describe('P18.98-T4 KPM analytics in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * The comparison as the API answers an Indonesian reader (P18.98-T5: its sentences in the request's language) — the
   * one sentence of its own a closed screen shows, the MOC cell's *which input is missing*, in Indonesian.
   */
  const fromTheApi = () => {
    const view = analyticsView();
    return {
      ...view,
      agencies: view.agencies.map((a) => (a.moc?.status === 'unknown'
        ? { ...a, moc: { ...a.moc, missing: 'Belum diunggah: Rolling Persistency — DU/DG.' } }
        : a)),
    };
  };

  const openInIndonesian = (body: unknown = fromTheApi()) => {
    stubFetch({ ...SHELL_STUBS, [ANALYTICS]: { body } });
    renderInIndonesian(<KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, { me: OWNER_ME });
  };

  it('P18.98-T4 reads its title and tabs kept, and its own words in Indonesian', async () => {
    openInIndonesian();
    await screen.findByRole('table', { name: 'Unit comparison' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^KPM Analytics$/);
    expect(screen.getByText('Perbandingan unit, kualifikasi klub, dan tren')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'KPM Analytics' }));
    expect(tabs.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(tabs.getByRole('link', { name: 'Compliance, Events, and Campaigns' })).toBeInTheDocument();
    const period = screen.getByRole('combobox', { name: 'Periode' });
    expect([...period.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Bulan ini', 'Bulan lalu']);
    expect(screen.getByText('Semua 4 AB, tahun ini — benchmark antarrekan, selalu ditampilkan di tingkat grup')).toBeInTheDocument();
  });

  it('P18.98-T4 keeps every column’s KPI name English, and writes the rows’ words and figures in Indonesian', async () => {
    openInIndonesian();
    await screen.findByRole('table', { name: 'Unit comparison' });
    // Each heading's own words, before its ⓘ (the shared glossary's *What is …?*).
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent!.split('ⓘ')[0])).toEqual([
      'AB', 'Manpower', 'APE — This Month', 'APE — Annual', 'Coached (7d)', 'Producing this month', 'Total leads', 'MOC',
    ]);
    const totalRow = screen.getByRole('rowheader', { name: /^Total — semua 4 AB/ }).closest('tr') as HTMLElement;
    expect(within(totalRow).getByText('Hanya anggota saat ini')).toBeInTheDocument();
    expect(within(totalRow).getByText('ABs meeting MOC')).toBeInTheDocument();
    expect(within(totalRow).getByText('Rp 5,8 M')).toBeInTheDocument();
    const hendra = screen.getByRole('rowheader', { name: 'Hendra Wibowo' }).closest('tr') as HTMLElement;
    expect(within(hendra).getByText('2 AAB · 28 Agents')).toBeInTheDocument();
    expect(within(hendra).getByText('Rp 62 jt')).toBeInTheDocument();
    expect(within(hendra).getByText(/^dari target Rp 150 jt/)).toBeInTheDocument();
    expect(within(hendra).getByText('15 penjualan (9 potensial) · 8 rekrut (5 potensial)')).toBeInTheDocument();
    expect(within(hendra).getByRole('button', { name: '31 orang di agensi Hendra Wibowo' })).toBeInTheDocument();
    expect(within(hendra).getByRole('button', { name: 'Unit di agensi Hendra Wibowo' })).toBeInTheDocument();
    expect(within(hendra).getByRole('button', { name: 'Syarat MOC terpenuhi untuk Hendra Wibowo' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Wilson Tanoto (Anda)' })).toBeInTheDocument();
    const budi = screen.getByRole('rowheader', { name: 'Budi Santoso' }).closest('tr') as HTMLElement;
    expect(within(budi).getAllByText('Belum diunggah')).toHaveLength(2);
    // *Monthly production* kept, its sub-line and a month with no file Indonesian.
    expect(screen.getByRole('heading', { level: 2, name: 'Monthly production' })).toBeInTheDocument();
    expect(screen.getByText('6 bulan terakhir, APE gabungan — seluruh grup')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Monthly production' })).getAllByRole('listitem')[4])
      .toHaveTextContent('Agu 2026: Belum diunggahAgu');
    // The scan reads the screen at all, so a silent zero cannot pass.
    expect(englishOnly(kpmAnalyticsMessages).length).toBeGreaterThan(15);
    expect(document.body.textContent).toContain('Hanya anggota saat ini');
    expect(englishShown(document.body, englishOnly(kpmAnalyticsMessages))).toEqual([]);
  });

  it('P18.98-T4 opens an agency’s units, the Direct row kept, and MOC’s dialog in Indonesian', async () => {
    openInIndonesian();
    await screen.findByRole('table', { name: 'Unit comparison' });
    await userEvent.click(screen.getByRole('button', { name: 'Unit di agensi Hendra Wibowo' }));
    expect(screen.getByRole('rowheader', { name: 'Hendra Wibowo (Direct)' })).toBeInTheDocument();
    expect(screen.getByText('Lihat Hendra Wibowo di atas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Syarat MOC terpenuhi untuk Hendra Wibowo' }));
    const dialog = screen.getByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' });
    expect(within(dialog).getByText('Syarat terpenuhi')).toBeInTheDocument();
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Rp 1,3 M / Rp 600 jt — Terpenuhi');
    expect(rows[4]).toHaveTextContent('1 / 5 — Gap');
    expect(within(dialog).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
  });

  it('P18.98-T4 reads a team with no AB, and a phone’s cards, in Indonesian', async () => {
    openInIndonesian(NO_AB);
    expect(await screen.findByText('Belum ada AB untuk dibandingkan.')).toBeInTheDocument();
    expect(screen.getByText('Setiap agensi AB mendapat satu baris di sini, berisi anggota dan angkanya.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    atWidth(375);
    openInIndonesian();
    const list = await screen.findByRole('list', { name: 'Unit comparison' });
    expect([...list.children][0].querySelector('p')).toHaveTextContent('Total — semua 4 AB');
    expect(englishShown(document.body, englishOnly(kpmAnalyticsMessages))).toEqual([]);
  });
});
