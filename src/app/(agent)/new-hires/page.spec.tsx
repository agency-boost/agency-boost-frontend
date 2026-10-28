import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { notFound, readOnlySession, ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { PHONE_QUERY } from '@/lib/use-phone';
import NewHiresPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = SARI_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, '/new-hires': { body: ROSTER }, ...routes });
  const view = renderInLayout(AgentLayout, <NewHiresPage />, { me });
  return { ...stub, ...view };
};

const card = (name: string) => screen.findByRole('region', { name });
/** A leader who may mark a hire left and put a 1:1 on the calendar: Sari, an AAB. */
const ACTING = { ...SARI_ME, permissions: [...SARI_ME.permissions, 'new_hire:mark_left', 'calendar_entry:create'] };
const IN_PROGRESS = 'In progress (day 1–90)';

describe('/new-hires, a year of new hires by their 3M result (P13-T5, P18.96-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T7 AC-1 keeps the sub-line from 768px and draws it nowhere on a phone (grey text row 25)', async () => {
    show();
    await card(IN_PROGRESS);
    expect(screen.getByText('Track your new agents\' 90-day activation progress.')).toHaveClass('max-md:hidden');
  });

  it('P13-T5 AC-2, P18.95-T9 AC-2 is titled as its nav item (the prototype’s Your New Hires) and reads the roster once', async () => {
    const { calls } = show();
    await card(IN_PROGRESS);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^New Hires$/);
    expect(calls.filter((c) => c.url.includes('/new-hires')).map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires']);
  });

  it('P18.96-T6 AC-3 the 3M activation % at the top, then the three sections in order', async () => {
    show();
    await card(IN_PROGRESS);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '3M activation %', IN_PROGRESS, 'Activated', 'Not activated',
    ]);
  });

  it('P18.96-T6 AC-3 In progress: Name · Join date · Day · Checklist · First sale, each row as served', async () => {
    show();
    const table = within(await card(IN_PROGRESS)).getByRole('table', { name: IN_PROGRESS });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name', 'Join date', 'Day', 'Checklist', 'First sale',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    // In the order served; the unit under the name, since Agus has more than one.
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Novi LestariAAB: Arief Hidayat', 'Budi HartonoAAB: Sari Puspita', 'Rina WijayaAAB: Sari Puspita', 'Fikri RamadhanDirect Unit',
    ]);
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['4 Agu 2026', '85 /90', '56%', '23 Agu 2026']);
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['27 Agu 2026', '62 /90', '25%', '—']);
  });

  it('P18.96-T6 AC-3 a new hire with no checklist — an AAB placed as one — reads No checklist', async () => {
    show();
    const fikri = within(within(await card(IN_PROGRESS)).getByRole('row', { name: /Fikri Ramadhan/ })).getAllByRole('cell');
    expect(fikri[2]).toHaveTextContent(/^No checklist$/);
  });

  it('P18.96-T6 AC-3 Activated and Not activated carry the result; one who left reads Left {date}, their name no link', async () => {
    show({}, ACTING);
    const not = within(await card('Not activated'));
    const table = not.getByRole('table', { name: 'Not activated' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name', 'Join date', 'Checklist', 'First sale', 'Result', 'Actions',
    ]);
    const tari = not.getByRole('row', { name: /Tari Wulandari/ });
    expect(within(tari).getAllByRole('cell')[3]).toHaveTextContent(/^Not activated · Left 21 Okt 2026$/);
    expect(within(tari).queryByRole('link', { name: 'Tari Wulandari' })).not.toBeInTheDocument();
    expect(not.getByRole('link', { name: 'Lukman Hakim' })).toHaveAttribute('href', '/new-hires/mem-lukman');
    expect(within(not.getByRole('row', { name: /Lukman Hakim/ })).getAllByRole('cell')[2]).toHaveTextContent(/^23 Okt 2026$/);
    expect(within(screen.getByRole('region', { name: 'Activated' })).getByRole('row', { name: /Indah Permata/ }))
      .toHaveTextContent('Activated');
  });

  it('P18.96-T6 AC-3 an overdue checklist is red and bold, and says overdue to a screen reader', async () => {
    show();
    const indah = within(within(await card('Activated')).getByRole('row', { name: /Indah Permata/ })).getAllByRole('cell')[1];
    const mark = indah.querySelector('[data-overdue]')!;
    expect(mark).toHaveTextContent(/^94%, overdue$/);
    expect(within(indah).getByText(', overdue')).toHaveClass('sr-only');
    expect(within(indah).getByText(/94%/)).toHaveClass('font-bold', 'text-alert');
    const novi = within(within(screen.getByRole('region', { name: IN_PROGRESS })).getByRole('row', { name: /Novi Lestari/ })).getAllByRole('cell')[2];
    expect(novi.querySelector('[data-overdue]')).toBeNull();
  });

  it('P18.96-T6 AC-2 the 3M activation % is the server’s, with its counts, and each unit’s beside it', async () => {
    show();
    const top = within(await screen.findByRole('region', { name: '3M activation %' }));
    expect(top.getByText('50%')).toBeInTheDocument();
    expect(top.getByText('2 activated · 2 not activated · 4 in progress')).toBeInTheDocument();
    expect(within(top.getByRole('list', { name: 'By unit' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Direct Unit 67%', 'AAB: Arief Hidayat 0%', 'AAB: Sari Puspita —No result yet',
    ]);
  });

  it('P18.96-T6 AC-3 the join-month filter: All, then each month served, newest first; a month narrows the rows and the figures', async () => {
    show();
    const top = within(await screen.findByRole('region', { name: '3M activation %' }));
    const select = top.getByRole('combobox', { name: 'Join month' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['All', 'Sep 2026', 'Agu 2026', 'Jul 2026']);
    await userEvent.selectOptions(select, '2026-07');
    expect(top.getByText('67%', { selector: 'span.block' })).toBeInTheDocument();
    expect(top.getByText('2 activated · 1 not activated · 0 in progress')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: IN_PROGRESS })).getByText('No one here.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Not activated' })).getAllByRole('rowheader').map((h) => h.textContent))
      .toEqual(['Lukman HakimDirect Unit']);
    // A unit with nobody that month: no figure, never 0%.
    expect(within(top.getByRole('list', { name: 'By unit' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Direct Unit 67%', 'AAB: Arief Hidayat —No result yet', 'AAB: Sari Puspita —No result yet',
    ]);
  });

  it('P18.96-T6 AC-4 an overdue or not-activated row offers Schedule 1:1 and Mark left; one in progress or gone does not', async () => {
    show({}, ACTING);
    const not = within(await card('Not activated'));
    expect(not.getByRole('link', { name: 'Schedule 1:1 with Lukman Hakim' })).toHaveAttribute('href', '/calendar?with=mem-lukman');
    expect(not.getByRole('button', { name: 'Mark left — Lukman Hakim' })).toBeInTheDocument();
    // Tari left: nothing to schedule, nothing to mark.
    expect(not.queryByRole('button', { name: 'Mark left — Tari Wulandari' })).not.toBeInTheDocument();
    // Indah sold by day 90 and her checklist is overdue: a 1:1 is what she needs.
    const activated = within(screen.getByRole('region', { name: 'Activated' }));
    expect(activated.getByRole('link', { name: 'Schedule 1:1 with Indah Permata' })).toBeInTheDocument();
    const inProgress = within(screen.getByRole('region', { name: IN_PROGRESS }));
    expect(inProgress.queryByRole('link', { name: /Schedule 1:1/ })).not.toBeInTheDocument();
    expect(inProgress.queryAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Actions');
  });

  it('P18.96-T8 a row action’s name begins with the words it shows, so a voice command finds it (WCAG 2.5.3)', async () => {
    show({}, ACTING);
    const not = within(await card('Not activated'));
    for (const action of [not.getByRole('link', { name: /^Schedule 1:1.*Lukman Hakim/ }), not.getByRole('button', { name: /^Mark left.*Lukman Hakim/ })]) {
      const shown = action.textContent?.trim() ?? '';
      expect(shown).not.toBe('');
      expect(action.getAttribute('aria-label')?.startsWith(shown)).toBe(true);
    }
  });

  it('P18.96-T6 AC-4 Mark left asks first, then records it, says so and reads the roster again', async () => {
    const { calls } = show({ 'POST /new-hires/mem-lukman/left': { body: { membershipId: 'mem-lukman', leftAt: '2026-10-27T03:00:00.000Z', leftOn: '2026-10-27', activation3M: 'not_activated' } } }, ACTING);
    await userEvent.click(within(await card('Not activated')).getByRole('button', { name: 'Mark left — Lukman Hakim' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Mark Lukman Hakim as left? They stay in your records with their history, and their 3M activation is decided today. This can\'t be undone.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark left' }));
    expect(await screen.findByText('Lukman Hakim is marked as left.')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires/mem-lukman/left']);
    await vi.waitFor(() => expect(calls.filter((c) => c.url.endsWith('/new-hires') && (c.init.method ?? 'GET') === 'GET')).toHaveLength(2));
  });

  it('P18.96-T6 AC-4 Cancel sends nothing; a refusal says why', async () => {
    const { calls } = show({
      'POST /new-hires/mem-lukman/left': { status: 409, body: { error: { code: 'NEW_HIRE_HAS_REPORTS', message: '1 person reports to them.', requestId: 'r-1' } } },
    }, ACTING);
    const mark = within(await card('Not activated')).getByRole('button', { name: 'Mark left — Lukman Hakim' });
    await userEvent.click(mark);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    await userEvent.click(mark);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark left' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not marked as left. 1 person reports to them.');
  });

  it('P18.96-T6 AC-4 neither action without its grant, and none in a read-only support session', async () => {
    show();
    await card('Not activated');
    expect(screen.queryByRole('link', { name: /Schedule 1:1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as left/ })).not.toBeInTheDocument();
    cleanup();
    show({}, readOnlySession(ACTING));
    await card('Not activated');
    expect(screen.queryByRole('link', { name: /Schedule 1:1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as left/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Indah Permata' })).toBeInTheDocument();
  });

  it('P18.96-T6 AC-3 a reader with no new hire in the year meets an empty page, not an error', async () => {
    show({ '/new-hires': notFound });
    expect(await screen.findByText('No one you lead joined as a new hire in the last 12 months.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('P18.96-T6 AC-3 a section with nobody says so, and keeps its place', async () => {
    show({ '/new-hires': { body: { ...ROSTER, sections: { ...ROSTER.sections, activated: [] } } } });
    expect(within(await card('Activated')).getByText('No one here.')).toBeInTheDocument();
  });

  it('shows a skeleton while the roster is read', async () => {
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your new hires…');
    await card(IN_PROGRESS);
  });

  it('a failed read says why, and Try again reads again', async () => {
    const { calls } = show({
      '/new-hires': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } },
        { body: ROSTER },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await card(IN_PROGRESS);
    expect(calls.filter((c) => c.url.endsWith('/new-hires'))).toHaveLength(2);
  });

  it('P13-T5 AC-8 is refused, with no read, to a reader without new_hires:read_roster', async () => {
    const { calls } = show({}, { ...SARI_ME, permissions: ['activation:read'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'new_hires:read_roster');
    expect(calls.some((c) => c.url.includes('/new-hires'))).toBe(false);
  });
});

/*
 * **A card per hire below 768px** (P18.95-T3 AC-4, ADR-0167 §6; UI-012), each section's: the name, the checklist's bar,
 * the day — *Day 62 of 90* — or the result, the join date and the first sale, and the two actions where they apply.
 */
describe('P18.95-T3, P18.96-T6 — /new-hires as cards on a phone', () => {
  const onPhone = (matches = true) => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: matches && query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  const hireCard = (name: string) => screen.getByText(name).closest('li')!;

  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T3 AC-4 draws each section with a card per hire, in the order served, and no table', async () => {
    onPhone();
    show();
    const progress = within(await card(IN_PROGRESS));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(progress.getAllByRole('listitem').map((li) => li.querySelector('a')!.textContent)).toEqual([
      'Novi Lestari', 'Budi Hartono', 'Rina Wijaya', 'Fikri Ramadhan',
    ]);
    expect(hireCard('Rina Wijaya').querySelector('a')).toHaveAttribute('href', '/new-hires/mem-rina');
  });

  it('P18.96-T6 AC-3 a card says the day in words in progress, the result after it, and the dates', async () => {
    onPhone();
    show({}, ACTING);
    await card(IN_PROGRESS);
    const budi = hireCard('Budi Hartono');
    expect(budi).toHaveTextContent('Day 62 of 90');
    expect(budi).toHaveTextContent('Join date 27 Agu 2026 · First sale —');
    expect(budi.querySelector('[aria-hidden="true"] > div')).toHaveStyle({ width: '25%' });
    const lukman = hireCard('Lukman Hakim');
    expect(lukman).toHaveTextContent('Not activated');
    expect(within(lukman).getByRole('link', { name: 'Schedule 1:1 with Lukman Hakim' })).toBeInTheDocument();
    expect(hireCard('Tari Wulandari')).toHaveTextContent('Not activated · Left 21 Okt 2026');
  });

  it('P18.95-T3 AC-4 makes each name a 44px link on a phone', async () => {
    onPhone();
    show();
    await card(IN_PROGRESS);
    expect(screen.getByRole('link', { name: 'Indah Permata' })).toHaveClass('max-md:min-h-11', 'max-md:inline-flex');
  });

  it('P18.95-T3 AC-4 never draws the table first on a phone: the width is asked before the roster answers', async () => {
    onPhone();
    expect(await drewATable(async () => {
      show();
      await screen.findByRole('list', { name: IN_PROGRESS });
    })).toBe(false);
  });

  it('P18.95-T3 AC-4 keeps the tables at 768px and wider', async () => {
    onPhone(false);
    show();
    expect(within(await card(IN_PROGRESS)).getByRole('table', { name: IN_PROGRESS })).toBeInTheDocument();
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
