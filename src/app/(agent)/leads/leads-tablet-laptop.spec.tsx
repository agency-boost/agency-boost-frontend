import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, digestAt, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import type { Lead } from '@/lib/leads';
import LeadsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

const stage = (pipeline: string, code: string, label: string, rank: number, over = {}) => ({
  id: code, pipeline, code, label, rank, isTerminal: false, isLateStage: false, version: 1, status: 'active', ...over,
});
const PIPELINES = [
  { pipeline: 'sales', statuses: [
    stage('sales', 'NOT_YET_APPROACHED', 'Not yet approached', 1),
    stage('sales', 'FOLLOW_UP', 'Follow-up', 2),
    stage('sales', 'POLICY_SUBMITTED', 'Policy submitted', 3, { isLateStage: true }),
    stage('sales', 'APPROVED_NOT_PAID', 'Approved, not paid', 4, { isLateStage: true }),
    stage('sales', 'PAID_AND_ISSUED', 'Paid and issued', 5, { isTerminal: true }),
  ] },
  { pipeline: 'recruitment', statuses: [
    stage('recruitment', 'NOT_APPROACHED', 'Not yet approached', 1),
    stage('recruitment', 'MEETING_SCHEDULED', 'Meeting scheduled', 2),
    stage('recruitment', 'NEW_ACTIVE_AGENT', 'New active agent', 3, { isTerminal: true }),
  ] },
];

/** Dates far ahead, so a digest reads the same whatever today is. */
const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Felicia Elvina', contact: { phone: '0812-1100-2200', email: null },
  statusCode: 'FOLLOW_UP', thisMonth: true, closedThisMonth: false, committedMonths: [], lastEditedBy: null,
  remarks: 'Hot button: the eldest starts university in two years.', nextActionDate: '2099-11-12',
  nextActionNote: 'Ketemu di starbucks cp, bawa ilustrasi dua plan dan brosur PRUSehat untuk suaminya juga.',
  outcome: null, source: null, dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null, ...over,
});

const ROWS = [
  lead(),
  lead({ id: 'l2', name: 'Ibu Tari Anjani', statusCode: 'NOT_YET_APPROACHED', thisMonth: false, nextActionDate: '2099-11-07', nextActionNote: null, remarks: null }),
  lead({ id: 'l3', name: 'Ibu Sekar Arum', nextActionDate: '2099-11-02', nextActionNote: 'Meet at her shop after closing.', thisMonth: false }),
  lead({ id: 'l4', name: 'Ibu Yuliana Tanjung', statusCode: 'NOT_YET_APPROACHED', nextActionDate: null, nextActionNote: null, thisMonth: false }),
  lead({ id: 'l5', name: 'Mas Andi', type: 'recruitment', statusCode: 'MEETING_SCHEDULED', thisMonth: false }),
];

const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });
const detail = (row: Lead) => ({ ...row, history: [{ at: '2026-10-28T03:00:00.000Z', fromStatusCode: null, toStatusCode: row.statusCode }] });

const BASE = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'outcome=won': { body: page([]) },
  'outcome=lost': { body: page([]) },
  'outcome=open': { body: page(ROWS) },
  ...Object.fromEntries(ROWS.map((row) => [`/leads/${row.id}`, { body: detail(row) }])),
};

const open = (px: number, routes: Record<string, unknown> = {}) => {
  atWidth(px);
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};

const list = () => screen.findByRole('list', { name: 'Your leads' });

afterEach(() => vi.unstubAllGlobals());

/**
 * **The phone is the T0 baseline** (P19.1-T2 AC-13; the full report's *mobile out of scope: it must not change*). The
 * digests were taken from the build before UI-116 (P18.9-T7's technique, `test/harness.tsx`): the list and the open
 * sheet at 375 and 360, and the sheet at 768, which UI-116 keeps as the phone's.
 */
const BASELINE = {
  list: '5fc92766b47f69c3dfec477dcd7bb8fe22dea562e6177775d4d62fdbea08d394',
  sheet375: 'be60f76c89d4527df37b48862ac59ac3c8b4b0227fd166d55d6b0f3eb9c74d5d',
  sheet768: 'f6682847c25fc3fb1eb90ef2bc7c6b0e7774f0fd78c669e053444a10212b7f69',
};

describe('P19.1-T2 AC-13 the phone as it was', () => {
  it.each([375, 360])('P19.1-T2 AC-13 at %ipx the list is drawn as before UI-116', async (px) => {
    open(px);
    await list();
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
    const root = document.querySelector('[data-leads-list]')!;
    /*
     * *Amended 2026-11-07 (P19.8-T1 AC-1; R6, MOB UI-171: the stage chips at weight 600):* each stage's name in the
     * pipeline strip is a header control's 13px / 600, where it was 12px / 400, and is marked `data-stage-name`. The
     * digest is taken with those names put back as they were, and still matches the baseline: nothing else moved.
     */
    const before = root.cloneNode(true) as Element;
    const names = before.querySelectorAll('[data-stage-name]');
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toHaveClass('text-base', 'font-semibold');
      name.removeAttribute('data-stage-name');
      name.setAttribute('class', 'line-clamp-2 text-xs leading-tight text-secondary-muted');
    }
    expect(digestAt(before, px)).toBe(BASELINE.list);
  });

  it.each([375, 768])('P19.1-T2 AC-13 at %ipx the lead sheet is drawn as before UI-116', async (px) => {
    open(px);
    await userEvent.click(within(await list()).getByRole('button', { name: 'Felicia Elvina' }));
    const sheet = await screen.findByRole('dialog', { name: /Felicia Elvina/i });
    await waitFor(() => expect(within(sheet).queryByText('Loading the history…')).not.toBeInTheDocument());
    /*
     * *Amended 2026-11-05 (P19.7-T1 AC-1; the proposal spec's step 1, a client request):* the sheet gains *Umur ulang
     * tahun berikutnya* and *Jenis kelamin* above *Riwayat* (`[data-client-fields]`). Everything else is drawn as before:
     * the digest is taken with that block lifted out, and still matches the baseline.
     */
    const without = sheet.cloneNode(true) as Element;
    without.querySelector('[data-client-fields]')!.remove();
    expect(within(sheet).getByRole('group', { name: 'Age at next birthday' })).toBeInTheDocument();
    expect(digestAt(without, px)).toBe(px === 768 ? BASELINE.sheet768 : BASELINE.sheet375);
  });
});

/**
 * **The Leads chips are header controls** (P19.8-T1 AC-1; R6, D-38; MOB UI-171's table): *Semua · Sales · Recruit*
 * 13px / 600 / 44px, as they were; **the stage chips' words at weight 600**, where they were 400 — at every size.
 */
describe('P19.8-T1 AC-1 the Leads chips at one header-control size (MOB UI-171)', () => {
  it.each([360, 375, 768, 1024, 1280])('P19.8-T1 AC-1 MOB UI-171 at %ipx: the type chips and the stage chips are 13px / 600, 44px', async (px) => {
    open(px);
    await list();
    for (const chip of within(screen.getByRole('group', { name: 'Lead type' })).getAllByRole('button')) {
      expect(wears(chip, px).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'text-base', 'font-semibold']));
    }
    const strip = screen.getByRole('group', { name: 'Sales pipeline' });
    const stages = within(strip).getAllByRole('button');
    expect(stages).toHaveLength(5);
    for (const chip of stages) {
      expect(wears(chip, px).split(' ')).toContain('min-h-11');
      const words = chip.querySelector('[data-stage-name]')!;
      expect(wears(words, px).split(' ')).toEqual(expect.arrayContaining(['text-base', 'font-semibold']));
      expect(wears(words, px).split(' ')).not.toContain('text-xs');
    }
  });
});

const card = (name: string) => screen.getByRole('button', { name }).closest('li')!;
const pane = (name: string | RegExp) => screen.findByRole('region', { name });
/** The question asked before unsaved changes are discarded (`Dialog`, no modal head). */
const question = async () => {
  const asked = () => screen.queryAllByRole('dialog').find((d) => !d.querySelector('[data-modal-head]'));
  await waitFor(() => expect(asked()).toBeDefined());
  return asked()!;
};
const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')} ${String(c.init.body ?? '')}`);

/**
 * **Leads: one design on a tablet and a laptop** (P19.1-T2, UI-116; `leads-tablet-desktop-2026-11-02`: 1 laptop 1280
 * list + detail, 1b laptop 1024 with the rail, 2 tablet two to a row). The ticket's *Done when*, one test each.
 */
describe('P19.1-T2 AC-1 the same lead card at 375, 768, 1024 and 1280 (UI-116)', () => {
  it.each([375, 768, 1024, 1280])('P19.1-T2 AC-1 at %ipx: the phone’s card — no native select, no remarks column, no row numbers', async (px) => {
    open(px);
    const ul = await list();
    const felicia = within(ul).getByRole('button', { name: 'Felicia Elvina' });
    // The card component's own name button, as a phone draws it.
    expect(felicia).toHaveClass('block', 'w-full', 'truncate', 'uppercase', 'after:absolute', 'after:inset-0');
    expect(felicia.closest('li')).toHaveAttribute('data-lead-card', 'l1');
    expect(within(felicia.closest('li')!).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(ul.querySelectorAll('select')).toHaveLength(0);
    expect(within(ul).queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The remark is the sheet's or the pane's alone; nothing numbers a card.
    expect(within(ul).queryByText(/Hot button/)).not.toBeInTheDocument();
    expect(within(ul).queryByText(/^\d+\.?$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });
});

describe('P19.1-T2 AC-2 a tablet in portrait: the phone’s top block, cards two to a row, the phone’s sheet (UI-116)', () => {
  it('P19.1-T2 AC-2 at 768px draws the search pill and filter, the chips, the navy strip, and the cards two to a row', async () => {
    open(768);
    const ul = await list();
    expect(screen.getByRole('searchbox', { name: 'Search lead names' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter and sort' })).toHaveClass('rounded-full');
    expect(screen.getByRole('group', { name: 'Lead type' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sales pipeline' })).toHaveClass('bg-secondary');
    const at768 = wears(ul, 768).split(' ');
    expect(at768).toEqual(expect.arrayContaining(['grid', 'grid-cols-2']));
    // A phone keeps one column (AC-13), and so does the laptop's list beside the pane.
    expect(wears(ul, 375).split(' ')).not.toContain('grid-cols-2');
    expect(screen.queryByRole('region', { name: /Felicia/i })).not.toBeInTheDocument();
  });

  it('P19.1-T2 AC-2 at 768px a tap opens the phone’s lead sheet, not a pane', async () => {
    open(768);
    await userEvent.click(within(await list()).getByRole('button', { name: 'Felicia Elvina' }));
    const sheet = await screen.findByRole('dialog', { name: 'Felicia Elvina' });
    expect(within(sheet).getByRole('radiogroup', { name: 'Type' })).toBeInTheDocument();
    expect(document.querySelector('[data-lead-pane]')).toBeNull();
    // The + floats above the tab bar on a tablet; the title row has no add button there.
    expect(screen.getByRole('button', { name: 'Add lead' })).toHaveClass('fixed');
  });
});

describe('P19.1-T2 AC-3 from 1024px, list + detail (UI-116)', () => {
  it('P19.1-T2 AC-3 sizes the list 360px from 1024 and 420px from 1280, the pane never under 540px', async () => {
    const { SPLIT } = await import('@/components/leads-list');
    open(1024);
    await list();
    const split = document.querySelector('[data-leads-split]')!;
    expect(wears(split, 1024).split(' ')).toContain('grid-cols-[22.5rem_minmax(0,1fr)]');
    expect(wears(split, 1280).split(' ')).toContain('xl:grid-cols-[26.25rem_minmax(0,1fr)]'.slice(3));
    expect(22.5 * 16).toBe(SPLIT.listLaptop);
    expect(26.25 * 16).toBe(SPLIT.listWide);
    expect(split).toHaveClass('gap-4');
    // The page's gutter: the shell's 40px less 20 from 1024px, as the mockup's frames draw it.
    const page = document.querySelector('[data-leads-page]')!;
    expect(wears(page, 1024).split(' ')).toContain('-mx-5');
    expect(wears(page, 375)).toBe('');
    // 1024: the 64px rail (P19.1-T1 AC-4); 1280: the 252px sidebar (`--sidebar-width`).
    expect(1024 - 64 - 2 * SPLIT.gutter - SPLIT.listLaptop - SPLIT.gap).toBeGreaterThanOrEqual(SPLIT.paneMin);
    expect(1280 - 252 - 2 * SPLIT.gutter - SPLIT.listWide - SPLIT.gap).toBeGreaterThanOrEqual(SPLIT.paneMin);
  });

  it.each([1024, 1280])('P19.1-T2 AC-3 at %ipx: the list scrolls on its own, a long note ends in “…”, the first lead open in the pane', async (px) => {
    open(px);
    const ul = await list();
    const scroller = ul.closest('[data-leads-scroll]')!;
    expect(scroller).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    const note = within(card('Felicia Elvina')).getByText(/^Ketemu di starbucks/);
    expect(note).toHaveClass('truncate');
    // The mockup opens on the first card: the 2px accent outline, said as the current one. Chosen once the leads have
    // arrived, a render after the list itself, so it is waited for (a slow runner looked between the two).
    await waitFor(() => expect(card('Felicia Elvina')).toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]'));
    expect(within(card('Felicia Elvina')).getByRole('button', { name: 'Felicia Elvina' })).toHaveAttribute('aria-current', 'true');
    expect(within(card('Ibu Tari Anjani')).getByRole('button', { name: 'Ibu Tari Anjani' })).not.toHaveAttribute('aria-current');
    expect(await pane('Felicia Elvina')).toBeInTheDocument();
  });

  it('P19.1-T2 AC-3 the pane is the lead sheet: head, Jenis, status two to a row, Potensi, next action, Keterangan, Riwayat, the foot', async () => {
    open(1024);
    const p = await pane('Felicia Elvina');
    // The head: the avatar, the NAME, the type and stage pills, WhatsApp.
    const heading = within(p).getByRole('heading', { level: 2, name: 'Felicia Elvina' });
    expect(heading).toHaveClass('uppercase', 'font-extrabold', 'text-xl');
    const head = heading.parentElement!.parentElement!;
    expect(within(head).getByText('Sales')).toBeInTheDocument();
    expect(within(head).getByText('Follow-up')).toBeInTheDocument();
    expect(within(head).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(within(p).getByRole('radiogroup', { name: 'Type' })).toBeInTheDocument();
    const status = within(p).getByRole('group', { name: 'Status' });
    expect(within(status).getAllByRole('radio')[0].closest('label')!.parentElement).toHaveClass('grid', 'grid-cols-2');
    // The order of the sheet: Status, then the Potensi switch, then the next action.
    const order = [status, within(p).getByRole('switch', { name: 'Potential closing this month' }), within(p).getByRole('group', { name: 'Next action' })];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(p).getByLabelText('Next action date')).toBeInTheDocument();
    expect(within(p).getByRole('textbox', { name: 'Remarks' })).toHaveValue('Hot button: the eldest starts university in two years.');
    await within(p).findByText(/Status → Follow-up/);
    // The foot: Hapus left, the save state, Simpan right.
    const foot = p.querySelector('[data-pane-foot]')!;
    const buttons = within(foot as HTMLElement).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Delete', 'Save']);
    expect(within(foot as HTMLElement).getByRole('status')).toHaveTextContent('Saved ✓');
    expect(buttons[0].compareDocumentPosition(within(foot as HTMLElement).getByRole('status')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The pane is not a dialog: nothing modal is open.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P19.1-T2 AC-3 + Tambah lead sits in the title row and opens a new lead in the pane; the title is Leads', async () => {
    open(1280);
    await list();
    const row = screen.getByRole('heading', { level: 1, name: 'Leads' }).closest('[data-title-row]') as HTMLElement;
    const add = within(row).getByRole('button', { name: 'Add lead' });
    // No floating + from 1024px: the title row's button is the only one.
    expect(screen.getAllByRole('button', { name: 'Add lead' })).toEqual([add]);
    await userEvent.click(add);
    const p = await pane('New lead');
    expect(within(p).getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('P19.1-T2 AC-3 keeps the closed lists under the cards, one under the other', async () => {
    open(1024, { 'outcome=won': { body: page([lead({ id: 'w1', name: 'Ibu Wulan Sari', outcome: 'won', statusCode: 'PAID_AND_ISSUED' })]) } });
    await screen.findByText('Ibu Wulan Sari');
    const scroller = document.querySelector('[data-leads-scroll]')!;
    expect(scroller).toContainElement(screen.getByText('Ibu Wulan Sari'));
    expect(scroller.querySelector('section .grid')).not.toHaveClass('lg:grid-cols-2');
    expect(within(scroller as HTMLElement).getByRole('button', { name: '↺ Move to active' })).toBeInTheDocument();
  });

  it('P19.1-T2 AC-3 names who last changed the lead in the pane, as the table’s details did (ADR-0044)', async () => {
    const edited = lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } });
    open(1280, {
      'outcome=open': { body: page([edited, ...ROWS.slice(1)]) },
      '/leads/l1': { body: detail(edited) },
    });
    const p = await pane('Felicia Elvina');
    expect(await within(p).findByText('Last changed by Ibu Sari')).toBeInTheDocument();
  });
});

describe('P19.1-T2 AC-4 at 1280px: open, save, and never lose an edit silently (UI-116)', () => {
  it('P19.1-T2 AC-4 clicking a card opens it in the pane, and Simpan shows Tersimpan with the pane still open', async () => {
    const saved = { ...ROWS[2], nextActionNote: 'Bawa brosur.', version: 3 };
    const { calls } = open(1280, { 'PATCH /leads/l3': { body: saved } });
    await pane('Felicia Elvina');
    await userEvent.click(within(await list()).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const p = await pane('Ibu Sekar Arum');
    expect(card('Ibu Sekar Arum')).toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]');
    expect(card('Felicia Elvina')).not.toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]');

    const note = within(p).getByRole('textbox', { name: 'Next action note' });
    await userEvent.clear(note);
    await userEvent.type(note, 'Bawa brosur.');
    expect(within(p).getByRole('status')).toHaveTextContent('Not saved yet');
    await userEvent.click(within(p).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes(calls)).toContain('PATCH /leads/l3 {"nextActionNote":"Bawa brosur.","version":2}'));
    await waitFor(() => expect(within(p).getByRole('status')).toHaveTextContent('Saved ✓'));
    expect(screen.getByRole('region', { name: 'Ibu Sekar Arum' })).toBe(p);
    // The card follows the saved lead.
    expect(within(card('Ibu Sekar Arum')).getByText('Bawa brosur.')).toBeInTheDocument();
  });

  it('P19.1-T2 AC-4 another card with unsaved edits asks first; staying keeps the edit and the lead', async () => {
    open(1280);
    const p = await pane('Felicia Elvina');
    const remarks = within(p).getByRole('textbox', { name: 'Remarks' });
    await userEvent.type(remarks, ' Suami juga tertarik.');
    await userEvent.click(within(await list()).getByRole('button', { name: 'Ibu Tari Anjani' }));

    const asked = await question();
    expect(asked).toHaveTextContent('You have changes that are not saved yet. Close without saving?');
    await userEvent.click(within(asked).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('region', { name: 'Felicia Elvina' })).toBe(p);
    expect(remarks).toHaveValue('Hot button: the eldest starts university in two years. Suami juga tertarik.');
    expect(card('Felicia Elvina')).toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]');

    // Asked again, and discarding goes on to the card chosen.
    await userEvent.click(within(await list()).getByRole('button', { name: 'Ibu Tari Anjani' }));
    await userEvent.click(within(await question()).getByRole('button', { name: 'Close without saving' }));
    expect(await pane('Ibu Tari Anjani')).toBeInTheDocument();
  });

  it('P19.1-T2 AC-4 Escape with unsaved edits asks first; with none it closes the pane', async () => {
    open(1280);
    const p = await pane('Felicia Elvina');
    const remarks = within(p).getByRole('textbox', { name: 'Remarks' });
    await userEvent.type(remarks, '!');
    await userEvent.keyboard('{Escape}');
    const asked = await question();
    // Escape in the question cancels the question, and nothing else.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(asked).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Felicia Elvina' })).toBeInTheDocument();
    expect(remarks).toHaveValue('Hot button: the eldest starts university in two years.!');

    await userEvent.clear(remarks);
    await userEvent.type(remarks, 'Hot button: the eldest starts university in two years.');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Felicia Elvina' })).not.toBeInTheDocument());
    expect(screen.getByText('Choose a lead to open it here.')).toBeInTheDocument();
    expect(card('Felicia Elvina')).not.toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]');
  });

  it('P19.1-T2 AC-4 + Tambah lead with unsaved edits asks first too', async () => {
    open(1280);
    const p = await pane('Felicia Elvina');
    await userEvent.type(within(p).getByRole('textbox', { name: 'Remarks' }), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    await userEvent.click(within(await question()).getByRole('button', { name: 'Close without saving' }));
    expect(await pane('New lead')).toBeInTheDocument();
  });

  it('P19.1-T2 AC-4 a new lead saved in the pane joins the list and stays open, outlined', async () => {
    // The server's answer: a Sales lead, so the list's Sales chip holds it.
    const created = lead({ id: 'l9', name: 'Ibu Nurul Aini', statusCode: 'NOT_YET_APPROACHED', thisMonth: false, remarks: null, nextActionDate: null, nextActionNote: null, version: 1 });
    const { calls } = open(1280, { 'POST /leads': { body: created }, '/leads/l9': { body: detail(created) } });
    await pane('Felicia Elvina');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    const p = await pane('New lead');
    await userEvent.type(within(p).getByRole('textbox', { name: 'Name' }), 'Ibu Nurul Aini');
    await userEvent.click(within(p).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls).some((w) => w.startsWith('POST /leads '))).toBe(true));
    expect(await pane('Ibu Nurul Aini')).toBeInTheDocument();
    await waitFor(() => expect(card('Ibu Nurul Aini')).toHaveClass('shadow-[inset_0_0_0_2px_var(--color-primary)]'));
  });

  it('P19.1-T2 AC-4 Hapus asks first, and the deleted lead leaves the list and the pane', async () => {
    const { calls } = open(1280, { 'DELETE /leads/l1': { status: 204, body: null } });
    const p = await pane('Felicia Elvina');
    await userEvent.click(within(p).getByRole('button', { name: 'Delete' }));
    const asked = await question();
    expect(asked).toHaveTextContent('Delete Felicia Elvina? It leaves your leads.');
    await userEvent.click(within(asked).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes(calls)).toContain('DELETE /leads/l1 '));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Felicia Elvina' })).not.toBeInTheDocument());
    expect(within(await list()).queryByRole('button', { name: 'Felicia Elvina' })).not.toBeInTheDocument();
  });
});

/*
 * **The reader's own order, kept from the table** (I-295; ADR-0161 §1; the client's request of 2026-10-26: *rows can be
 * dragged, the order is stored, a sort is not*). The table carried it on a desktop; the list beside the pane does now.
 */
describe('P19.1-T2 AC-3 the reader’s own order on the laptop’s list (I-295, kept)', () => {
  const LEADER_ROWS = [...ROWS.slice(0, 3), lead({ id: 'l7', name: 'Bu Rina', ownerMembershipId: 'mem-7', thisMonth: false })];

  it('P19.1-T2 AC-3 draws a handle on the reader’s own cards only, and ↓ saves the whole order', async () => {
    const { calls } = open(1280, {
      'outcome=open': { body: page(LEADER_ROWS) },
      'PATCH /leads/order': { body: { ids: [] } },
    });
    await list();
    const handle = within(card('Felicia Elvina')).getByRole('button', { name: /^Reorder Felicia Elvina/ });
    expect(within(card('Bu Rina')).queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
    handle.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(writes(calls)).toContain('PATCH /leads/order {"ids":["l2","l1","l3"]}'));
    expect(handle).toHaveFocus();
    expect(within(await list()).getAllByRole('listitem').map((li) => li.getAttribute('data-lead-card'))).toEqual(['l2', 'l1', 'l3', 'l7']);
  });

  it('P19.1-T2 AC-3 offers no handle under a chosen order, a search or a stage, nor on a phone or a tablet', async () => {
    open(1280);
    await list();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search lead names' }), 'Ibu');
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search lead names' }));
    expect(screen.getAllByRole('button', { name: /^Reorder/ }).length).toBeGreaterThan(0);
    await userEvent.click(within(screen.getByRole('group', { name: 'Sales pipeline' })).getAllByRole('button')[1]);
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
  });

  it.each([375, 768])('P19.1-T2 AC-3 at %ipx the cards have no handle (the phone’s list)', async (px) => {
    open(px);
    await list();
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
  });
});
