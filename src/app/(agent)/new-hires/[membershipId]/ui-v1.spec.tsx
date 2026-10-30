import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { activationView, leaderView, LINKS, readOnlySession, rinaItems, SARI, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import type { NewHireDetail, NewHireStanding } from '@/lib/activation';
import NewHireDetailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires/mem-rina',
}));

/** Sari, Rina's AAB: she coaches, records, corrects, schedules and saves a number. */
const SARI_V1 = {
  ...SARI_ME,
  permissions: [...SARI_ME.permissions, 'calendar_entry:create', 'member:update_phone'],
};

/** Rina's 3M standing (UI-023): Teraktivasi on day 30, from the sales data, under Sari. */
const standing = (over: Partial<NewHireStanding> = {}): NewHireStanding => ({
  status: 'activated', activation3M: 'activated', joinDate: '2026-08-06', day: 59, firstSaleDate: '2026-09-04',
  firstSaleDay: 30, firstSaleSource: 'sales', leader: { ...SARI, role: 'aab' }, phone: null, ...over,
});

/** Rina with no first sale in the system: *Close first case independently* undone, waiting for a date (D-26). */
function noFirstSale(): NewHireDetail {
  const items = rinaItems().map((list) => list.map((it) => ({
    ...it, note: null, date: null,
    ...(it.code === 'FIRST_CASE_CLOSED' ? { done: false, doneAt: null, source: null, doneBy: null, record: null } : {}),
  })));
  const base = activationView({}, items);
  return { ...base, firstCaseClosed: false, newHire: standing({ status: 'not_yet', activation3M: 'in_progress', firstSaleDate: null, firstSaleDay: null, firstSaleSource: null }) };
}

/** What a pecah telor saved by Sari answers: ticked by her, the first sale manual on that day. */
function recorded(date: string, day: number): NewHireDetail {
  const items = rinaItems().map((list) => list.map((it) => ({
    ...it, note: null, date: null,
    ...(it.code === 'FIRST_CASE_CLOSED'
      ? { done: true, doneAt: '2026-10-03T03:00:00.000Z', source: 'leader' as const, doneBy: SARI, waiting: true, record: { collection: 'leads' as const, id: 'lead-pt' } }
      : {}),
  })));
  return { ...activationView({}, items), newHire: standing({ firstSaleDate: date, firstSaleDay: day, firstSaleSource: 'manual' }) };
}

const show = (body: NewHireDetail = { ...leaderView(), newHire: standing() }, routes: Record<string, StubReply | StubReply[]> = {}, me = SARI_V1) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body }, ...routes });
  const view = renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me });
  return { ...stub, ...view };
};
const strip = () => screen.findByTestId('first-sale-strip');
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => (c.init.method ?? 'GET') !== 'GET').map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(String(c.init.body)) : undefined]);

describe('/new-hires/[membershipId] — UI V1 (UI-023, UI-025, UI-027; D-25, D-26)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-027 at 375px the first screen: ‹ NAME ⋯ and the leader line, the strip, both tiles, both buttons and section 1', async () => {
    atWidth(375);
    show();
    const header = await screen.findByTestId('hire-header-phone');
    expect(within(header).getByRole('link', { name: 'Back to New Hires' })).toHaveAttribute('href', '/new-hires');
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent(/^Rina Wijaya$/);
    expect(header).toHaveTextContent(/You · Joined 6 (Aug|Agu) 2026/);
    expect(within(header).getByRole('button', { name: 'More for Rina Wijaya' })).toBeInTheDocument();
    // The strip: Teraktivasi · pecah telor hari ke-30, its short date; from the sales data, so it opens nothing.
    expect(await strip()).toHaveTextContent(/^Activated · first sale on day 30\d+ (Sep|Sep)$/);
    expect((await strip()).tagName).toBe('P');
    expect(screen.getByText('Day').parentElement).toHaveTextContent('Day59 /90');
    expect(screen.getByText('Activation checklist').parentElement).toHaveTextContent('31%');
    expect(screen.getByRole('link', { name: 'Schedule 1:1 with Rina Wijaya' })).toHaveAttribute('href', '/calendar?with=mem-rina');
    expect(screen.getByRole('button', { name: 'WhatsApp Rina Wijaya' })).toBeInTheDocument();
    // Only the current section open: Introduction, the first not done.
    const sections = screen.getAllByRole('button', { expanded: true }).concat(screen.getAllByRole('button', { expanded: false }))
      .filter((b) => b.closest('h2'));
    expect(sections.filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent)).toEqual(['1Introduction2/42 of 4 done']);
    expect(sections).toHaveLength(5);
    // No subtitle, no ASPEK table, no uppercase OTOMATIS — at this size too.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/You can update their/)).toBeNull();
    expect(document.body).not.toHaveTextContent(/AUTO|Auto —/);
  });

  it('UI-027 the sections open on their own; an item name wraps, never “…”; ⚡ and ⓘ on every automatic item', async () => {
    atWidth(375);
    show();
    await strip();
    await userEvent.click(screen.getByRole('button', { name: /Initial Setup/ }));
    for (const code of ['GOAL_SETTING', 'ADD_PROSPECTS']) {
      expect(document.querySelector(`[data-code="${code}"] [data-auto-marker]`)).not.toBeNull();
    }
    expect(screen.getByText('Goal setting: APE & activity targets')).toHaveClass('break-words');
  });

  it('UI-027 ⋯ → Koreksi tanggal bergabung: the join date in a sheet, written and audited as before', async () => {
    atWidth(375);
    const { calls } = show(undefined, { 'PUT /new-hires/mem-rina/start-date': { body: { ...leaderView({ startDate: '2026-08-01', startCorrected: { by: SARI, at: '2026-10-03T03:00:00.000Z' } }), newHire: standing({ joinDate: '2026-08-01' }) } } });
    await userEvent.click(await screen.findByRole('button', { name: 'More for Rina Wijaya' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Correct join date' }));
    const sheet = await screen.findByRole('dialog', { name: 'Correct join date' });
    const field = within(sheet).getByLabelText('Join date');
    await userEvent.clear(field);
    await userEvent.type(field, '2026-08-01');
    field.blur();
    await vi.waitFor(() => expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/start-date', { startDate: '2026-08-01' }]]));
    // *dikoreksi oleh*: who corrected it, kept beside the field.
    expect((await within(sheet).findAllByText(/Join date corrected by you/)).length).toBeGreaterThan(0);
  });

  it('UI-027, D-26 Close first case independently with no first sale: tinted, Isi tanggal ›, and Kapan pecah telor? saves a date', async () => {
    atWidth(375);
    const { calls } = show(noFirstSale(), { 'PUT /new-hires/mem-rina/items/FIRST_CASE_CLOSED': { body: recorded('2026-09-04', 30) } });
    await screen.findByTestId('hire-header-phone');
    expect(screen.queryByTestId('first-sale-strip')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /First Sale/ }));
    const open = screen.getByRole('button', { name: 'Close first case independently: Add date' });
    expect(open).toHaveTextContent('Add date');
    await userEvent.click(open);
    const sheet = await screen.findByRole('dialog', { name: 'When was the first sale?' });
    expect(sheet).toHaveTextContent(/between 6 (Aug|Agu) 2026 and today/);
    const field = within(sheet).getByLabelText('First sale date');
    expect(field).toHaveAttribute('min', '2026-08-06');
    expect(field).toHaveAttribute('max', '2026-10-03');
    await userEvent.clear(field);
    await userEvent.type(field, '2026-09-04');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/new-hires/mem-rina/items/FIRST_CASE_CLOSED', { done: true, record: { kind: 'closing', date: '2026-09-04' } }],
    ]));
    // The strip appears with its day; the item ticked with its date and ✎; *Dicatat oleh* behind ⓘ; the toast.
    expect(await strip()).toHaveTextContent(/^Activated · first sale on day 30/);
    expect(screen.getByRole('button', { name: /^Close first case independently: 4 Sep(tember)? 2026, change the date$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Recorded by you · / })).toBeInTheDocument();
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('D-26 a pecah telor recorded by hand: the strip reopens the sheet, which offers only days up to it (a first sale moves earlier only)', async () => {
    atWidth(375);
    show(recorded('2026-09-04', 30));
    const button = await strip();
    expect(button.tagName).toBe('BUTTON');
    await userEvent.click(button);
    const sheet = await screen.findByRole('dialog', { name: 'When was the first sale?' });
    expect(within(sheet).getByLabelText('First sale date')).toHaveAttribute('max', '2026-09-04');
  });

  it('UI-023 after day 90 the strip is amber with lewat 3M, and the Hari tile says 3M selesai', async () => {
    atWidth(375);
    show({ ...leaderView({ day: 96, overdue: true }), newHire: standing({ status: 'activated_late', activation3M: 'not_activated', day: 96, firstSaleDay: 96, firstSaleDate: '2026-11-09' }) });
    const amber = await strip();
    expect(amber).toHaveAttribute('data-status', 'activated_late');
    expect(amber).toHaveClass('bg-pill-amber');
    expect(amber).toHaveTextContent('Activated · first sale on day 96 · after 3M');
    expect(screen.getByText('Day').parentElement).toHaveTextContent('Day3M done');
  });

  it('UI-027, UI-081 WhatsApp: one tap opens the chat when the number is on file; without one it asks, saves to their account, then opens', async () => {
    atWidth(375);
    show({ ...leaderView(), newHire: standing({ phone: '+6281211002200' }) });
    expect(await screen.findByRole('link', { name: 'WhatsApp Rina Wijaya' })).toHaveAttribute('href', 'https://wa.me/6281211002200');
    vi.unstubAllGlobals();

    atWidth(375);
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const { calls } = show(undefined, { 'PUT /members/mem-rina/phone': { body: { membershipId: 'mem-rina', phone: '+6281211002200' } } });
    const asks = await screen.findAllByRole('button', { name: 'WhatsApp Rina Wijaya' });
    await userEvent.click(asks[asks.length - 1]);
    const sheet = await screen.findByRole('dialog', { name: 'Enter WhatsApp number' });
    await userEvent.type(within(sheet).getByRole('textbox'), '0812-1100-2200');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(writes(calls)).toContainEqual(['PUT', '/members/mem-rina/phone', { phone: '+6281211002200' }]));
  });

  it('UI-025 no Keluar and no Tandai keluar on the detail; a read-only support session draws no ⋯, no Isi tanggal and no box to tick', async () => {
    atWidth(375);
    show(noFirstSale(), {}, readOnlySession(SARI_V1));
    await screen.findByTestId('hire-header-phone');
    expect(document.body).not.toHaveTextContent(/Mark left|Left /);
    expect(screen.queryByRole('button', { name: 'More for Rina Wijaya' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /First Sale/ }));
    expect(screen.queryByText('Add date')).toBeNull();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('UI-027 from 768px: today’s layout with the strip and the two buttons added — the way back in words, no subtitle, no table', async () => {
    atWidth(1024);
    show();
    expect(await screen.findByRole('heading', { level: 2, name: 'Activation progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to New Hires' })).toHaveTextContent('Back to New Hires');
    expect(await strip()).toHaveTextContent(/^Activated · first sale on day 30/);
    expect(screen.getByRole('link', { name: 'Schedule 1:1 with Rina Wijaya' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByTestId('hire-header-phone')).toBeNull();
    // Every aspect card shows, as today.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
  });

  it('UI-027 the data-backed 1:1 item keeps its in-place form, its rule behind ⓘ', async () => {
    atWidth(375);
    show();
    await strip();
    await userEvent.click(screen.getByRole('button', { name: /Ongoing Habits/ }));
    const checkIn = document.querySelector('[data-code="WEEKLY_CHECK_IN"]') as HTMLElement;
    expect(checkIn.querySelector('[data-auto-marker]')).not.toBeNull();
    expect(LINKS['coaching:weekly:4'].form).toBe('one_on_one');
  });
});
