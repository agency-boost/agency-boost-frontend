import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import LeadsPage from '@/app/(agent)/leads/page';
import { PotensiBadge, PotensiSwitch } from '@/components/potensi-switch';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import { finalStageOf, potensiBadgeOf, type Lead } from '@/lib/leads';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

/**
 * **P19.1-T2 — the *Potensi* switch, the avatar's ✓ badge and the two outcome buttons** (UI-153 items 0–5, UI-160 items
 * 1–5; Q-3; ADR-0193 §1, ADR-0194): on `/leads` at 360px, where the card and the shared lead sheet are drawn, and on the
 * two components alone.
 */
const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

const stage = (pipeline: string, code: string, label: string, rank: number, over = {}) => ({
  id: code, pipeline, code, label, rank, isTerminal: false, isLateStage: false, version: 1, status: 'active', ...over,
});
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      stage('sales', 'FOLLOW_UP', 'Follow-up', 1),
      stage('sales', 'APPROVED_NOT_PAID', 'Approved, not paid', 2, { isLateStage: true }),
      // An office's own name for its final stage (UI-160: *Polis paid and issued* at KPM 0000).
      stage('sales', 'PAID_AND_ISSUED', 'Polis paid and issued', 3, { isTerminal: true }),
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      stage('recruitment', 'MEETING_SCHEDULED', 'Meeting scheduled', 1),
      stage('recruitment', 'AGENT_CODE_CREATED', 'Agent code created', 2, { isLateStage: true }),
      stage('recruitment', 'NEW_ACTIVE_AGENT', 'New active agent', 3, { isTerminal: true }),
    ],
  },
];

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Kartika Dewanti', contact: { phone: null, email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], closedThisMonth: false, lastEditedBy: null,
  remarks: null, nextActionDate: '2099-11-03', nextActionNote: 'Coffee after her shift.', outcome: null, source: null,
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const render = (rows: Lead[], routes: Record<string, unknown> = {}) => {
  atWidth(360);
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
    '/kpm/org-levels': { body: [] },
    'outcome=won': { body: page([]) },
    'outcome=lost': { body: page([]) },
    'outcome=open': { body: page(rows) },
    ...Object.fromEntries(rows.map((r) => [`/leads/${r.id}`, { body: { ...r, history: [] } }])),
    ...routes,
  } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};
const list = () => screen.findByRole('list', { name: 'Your leads' });
const openSheet = async (name: string) => {
  await userEvent.click(within(await list()).getByRole('button', { name }));
  return within(await screen.findByRole('dialog', { name }));
};
const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')} ${String(c.init.body ?? '')}`);

describe('P19.1-T2 the Potensi switch (UI-153)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.1-T2 AC-5 the sheet’s switch is one 44px switch card between Status and Next action, labelled by the type', async () => {
    render([lead()]);
    const sheet = await openSheet('Ibu Kartika Dewanti');
    const toggle = sheet.getByRole('switch', { name: 'Potential closing this month' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveClass('h-11', 'border-dashed', 'border-switch-off-edge', 'bg-switch-off');
    // A switch, not a checkbox and not a status option.
    expect(sheet.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(sheet.getAllByRole('radio').map((r) => r.getAttribute('value'))).not.toContain('thisMonth');
    // Between *Status* and *Next action*, in the document's order.
    const status = sheet.getByRole('group', { name: 'Status' });
    const next = sheet.getByRole('group', { name: 'Next action' });
    expect(status.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No sub-line, nothing orange: its words are the label alone.
    expect(toggle).toHaveTextContent(/^Potential closing this month$/);
    expect(toggle.className).not.toMatch(/amber/);
  });

  it('P19.1-T2 AC-5 on, it turns navy; Save writes the month’s commitment as the old box did', async () => {
    const { calls } = render([lead()], {
      'PATCH /leads/l1': { body: lead({ thisMonth: true, committedMonths: ['2026-11'], version: 3 }) },
    });
    const sheet = await openSheet('Ibu Kartika Dewanti');
    const toggle = sheet.getByRole('switch', { name: 'Potential closing this month' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('bg-secondary', 'border-secondary');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /leads/l1 {"thisMonth":true,"version":2}']));
  });

  it('P19.1-T2 AC-5 a Recruit lead’s switch says Potential recruit this month', async () => {
    render([lead({ type: 'recruitment', statusCode: 'MEETING_SCHEDULED', thisMonth: true })]);
    const sheet = await openSheet('Ibu Kartika Dewanti');
    expect(sheet.getByRole('switch', { name: 'Potential recruit this month' })).toHaveAttribute('aria-checked', 'true');
  });

  it('P19.1-T2 AC-5 in Indonesian the words are UI-153’s, verbatim', () => {
    renderInIndonesian(<>
      <PotensiSwitch type="sales" checked={false} onChange={() => undefined} />
      <PotensiSwitch type="recruitment" checked onChange={() => undefined} />
    </>);
    expect(screen.getByRole('switch', { name: 'Potensi closing bulan ini' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Potensi rekrut bulan ini' })).toHaveAttribute('aria-checked', 'true');
  });

  it('P19.1-T2 AC-5 held, it does not change: a finalized session’s sheet reads', async () => {
    const onChange = vi.fn();
    renderWithSession(<PotensiSwitch type="sales" checked={false} disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('P19.1-T2 the avatar’s ✓ badge (UI-153 item 5; Q-3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.1-T2 AC-8 yellow while switched on and open, green once that lead closed this month, none when off', () => {
    expect(potensiBadgeOf(lead({ thisMonth: true }))).toBe('potensi');
    expect(potensiBadgeOf(lead({ thisMonth: true, closedThisMonth: true, outcome: 'won' }))).toBe('won');
    expect(potensiBadgeOf(lead({ thisMonth: false }))).toBeNull();
    // Lost with the switch on is no potential and no success.
    expect(potensiBadgeOf(lead({ thisMonth: true, outcome: 'lost' }))).toBeNull();
    // An older answer without the field draws no badge rather than a wrong one.
    expect(potensiBadgeOf({ thisMonth: true, outcome: 'won' })).toBeNull();
  });

  it('P19.1-T2 AC-8 each badge is named, its name its tooltip; the yellow one’s ✓ is navy, the green one’s white', () => {
    renderWithSession(<>
      <span className="relative"><PotensiBadge lead={lead({ thisMonth: true })} /></span>
      <span className="relative"><PotensiBadge lead={lead({ thisMonth: true, closedThisMonth: true, outcome: 'won' })} /></span>
      <span className="relative"><PotensiBadge lead={lead()} /></span>
    </>);
    const [yellow, green] = screen.getAllByRole('img');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(yellow).toHaveAccessibleName('Potential this month');
    expect(yellow).toHaveAttribute('title', 'Potential this month');
    expect(yellow).toHaveClass('bg-badge-potensi', 'text-navy', 'h-[17px]', 'w-[17px]', 'border-2', 'border-white');
    expect(green).toHaveAccessibleName('Potential this month, closed');
    expect(green).toHaveClass('bg-badge-won', 'text-white');
  });

  it('P19.1-T2 AC-8 in Indonesian', () => {
    renderInIndonesian(<PotensiBadge lead={lead({ thisMonth: true, closedThisMonth: true, outcome: 'won' })} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Potensi bulan ini, berhasil');
  });

  it('P19.1-T2 AC-8 the card shows the badge on its avatar; the card’s shape does not change', async () => {
    render([lead({ thisMonth: true }), lead({ id: 'l2', name: 'Pak Hendro Gunawan' })]);
    const cards = within(await list()).getAllByRole('listitem');
    expect(within(cards[0]).getByRole('img', { name: 'Potential this month' })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('img', { name: /Potential/ })).not.toBeInTheDocument();
    expect(cards[0].className).toBe(cards[1].className);
  });
});

describe('P19.1-T2 the two outcome buttons (UI-160)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.1-T2 AC-9 below the final stage: both, side by side; Mark successful held with the office’s final stage named', async () => {
    render([lead({ statusCode: 'APPROVED_NOT_PAID' })]);
    const sheet = await openSheet('Ibu Kartika Dewanti');
    const won = sheet.getByRole('button', { name: 'Mark successful' });
    const lost = sheet.getByRole('button', { name: 'Mark not successful' });
    expect(won).toBeDisabled();
    expect(won).toHaveAccessibleDescription('Active after status Polis paid and issued');
    expect(lost).toBeEnabled();
    // The same size, in one row of two.
    expect(won).toHaveClass('w-full', 'min-h-11');
    expect(lost).toHaveClass('w-full', 'min-h-11');
    expect(won.closest('[data-outcome-buttons]')).toHaveClass('grid-cols-2');
    expect(lost.closest('[data-outcome-buttons]')).toBe(won.closest('[data-outcome-buttons]'));
  });

  it('P19.1-T2 AC-9 at the final stage: Mark successful enabled and highlighted; Mark not successful held, saying why', async () => {
    const { calls } = render([lead({ statusCode: 'PAID_AND_ISSUED', thisMonth: true })], {
      'PATCH /leads/l1/outcome': { body: lead({ statusCode: 'PAID_AND_ISSUED', thisMonth: true, closedThisMonth: true, outcome: 'won', version: 3 }) },
    });
    const sheet = await openSheet('Ibu Kartika Dewanti');
    const won = sheet.getByRole('button', { name: 'Mark successful' });
    const lost = sheet.getByRole('button', { name: 'Mark not successful' });
    expect(won).toBeEnabled();
    expect(won).toHaveClass('bg-primary', 'text-primary-contrast');
    expect(lost).toBeDisabled();
    expect(lost).toHaveAccessibleDescription('Policy already paid and issued');
    // AC-11: asks first, then writes won.
    await userEvent.click(won);
    const asked = screen.getAllByRole('dialog').find((d) => !d.querySelector('[data-modal-head]'))!;
    await userEvent.click(within(asked).getByRole('button', { name: 'Mark successful' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /leads/l1/outcome {"outcome":"won","version":2}']));
  });

  it('P19.1-T2 AC-9 a Recruit lead at its final stage: Mark not successful held — the candidate has joined', async () => {
    render([lead({ type: 'recruitment', statusCode: 'NEW_ACTIVE_AGENT' })]);
    const sheet = await openSheet('Ibu Kartika Dewanti');
    expect(sheet.getByRole('button', { name: 'Mark successful' })).toBeEnabled();
    expect(sheet.getByRole('button', { name: 'Mark not successful' })).toHaveAccessibleDescription('The candidate has joined');
  });

  it('P19.1-T2 AC-9 the reasons in Indonesian are UI-160’s and ADR-0194’s', async () => {
    const { leadsMessages } = await import('@/i18n/messages/leads');
    const { messagesIn } = await import('@/i18n/catalogue');
    const id = messagesIn(leadsMessages, 'id');
    expect(id.menu.wonHeld({ stage: 'Polis paid and issued' })).toBe('Aktif setelah status Polis paid and issued');
    expect(id.menu.lostHeld).toEqual({ sales: 'Polis sudah dibayar dan terbit', recruitment: 'Kandidat sudah bergabung' });
    expect(id.menu.markWon).toBe('Tandai berhasil');
    expect(id.menu.markLost).toBe('Tandai tidak berhasil');
  });

  it('P19.1-T2 AC-9 the final stage is the office’s isTerminal one, by attribute, never by code or position', () => {
    expect(finalStageOf(PIPELINES[0].statuses)?.label).toBe('Polis paid and issued');
    expect(finalStageOf([stage('sales', 'X', 'X', 9, { isTerminal: true }), stage('sales', 'Y', 'Y', 1)])?.code).toBe('X');
    expect(finalStageOf([stage('sales', 'Y', 'Y', 1)])).toBeNull();
  });
});
