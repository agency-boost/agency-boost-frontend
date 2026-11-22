import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import LeadsPage from '@/app/(agent)/leads/page';
import { AgeStepper, GenderButtons } from '@/components/client-age-gender';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import { LEAD_AGE_MAX, LEAD_AGE_MIN, type Lead, type LeadGender } from '@/lib/leads';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

const PIPELINES = [{
  pipeline: 'sales',
  statuses: [{ id: 'F', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' }],
}];

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Rosa Damayanti', contact: { phone: null, email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], closedThisMonth: false, lastEditedBy: null,
  remarks: null, nextActionDate: '2099-11-03', nextActionNote: 'Kopi.', outcome: null, source: null,
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const render = (px: number, rows: Lead[]) => {
  atWidth(px);
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
    '/kpm/org-levels': { body: [] },
    'outcome=won': { body: page([]) },
    'outcome=lost': { body: page([]) },
    'outcome=open': { body: page(rows) },
    ...Object.fromEntries(rows.map((r) => [`/leads/${r.id}`, ({ method, body }: { method: string; body: unknown }) => ({
      body: method === 'PATCH' ? { ...r, ...(body as object), version: r.version + 1 } : { ...r, history: [] },
    })])),
    'POST /leads': ({ body }: { body: unknown }) => ({ status: 201, body: lead({ id: 'new', ...(body as object), version: 1 }) }),
  } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};
const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => ({ call: `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')}`, body: JSON.parse(String(c.init.body ?? '{}')) }));
const openSheet = async (name: string) => {
  await userEvent.click(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('button', { name }));
  return within(await screen.findByRole('dialog', { name }));
};

afterEach(() => vi.unstubAllGlobals());

/*
 * *Changed by P19.11-T3 AC-5 (UX-10):* the sheet showed no *Umur*. *Changed again by P19.14-T1 AC-4 (ADR-0254,
 * superseding ADR-0224):* **a lead carries no age and no gender at all** — *Jenis kelamin* left *Detail* too. The
 * client's age and gender are each proposal's, asked at its step 1 (`proposal/new/page.spec.tsx`).
 */
describe('P19.14-T1 AC-4 a lead carries no age or gender, in the sheet and the pane', () => {
  it('P19.7-T1 AC-1 the stepper holds the API’s bounds, 1 to 100 (the proposal’s client age now)', () => {
    expect([LEAD_AGE_MIN, LEAD_AGE_MAX]).toEqual([1, 100]);
  });

  it('P19.14-T1 AC-4 the sheet asks neither: no Umur box, no stepper, no Laki-laki / Perempuan', async () => {
    render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    await sheet.findByRole('heading', { name: 'History' });
    expect(sheet.queryByRole('textbox', { name: 'Age at next birthday' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'One year more' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('radiogroup', { name: 'Gender' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('radio', { name: 'Female' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('slider')).not.toBeInTheDocument();
    expect(sheet.queryByText(/birth date|tanggal lahir/i)).not.toBeInTheDocument();
  });

  it('P19.14-T1 AC-4 a save sends neither an age nor a gender', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    await userEvent.type(sheet.getByRole('textbox', { name: 'Remarks' }), 'Dua anak.');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).not.toHaveProperty('age');
    expect(writes(stub.calls)[0].body).not.toHaveProperty('gender');
  });

  it('P19.14-T1 AC-4 + Tambah lead asks neither, and sends neither', async () => {
    const stub = render(360, [lead()]);
    await screen.findByRole('list', { name: 'Your leads' });
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    expect(sheet.queryByRole('textbox', { name: 'Age at next birthday' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('radio', { name: 'Male' })).not.toBeInTheDocument();
    await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), 'Ibu Sari');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).not.toHaveProperty('age');
    expect(writes(stub.calls)[0].body).not.toHaveProperty('gender');
  });

  it('P19.14-T1 AC-4 the laptop’s pane carries the same Detail: no age, no gender', async () => {
    render(1280, [lead()]);
    const pane = within(await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' }));
    await pane.findByRole('heading', { name: 'History' });
    expect(pane.queryByRole('textbox', { name: 'Age at next birthday' })).not.toBeInTheDocument();
    expect(pane.queryByRole('radiogroup', { name: 'Gender' })).not.toBeInTheDocument();
  });
});

describe('P19.7-T1 AC-1 the stepper and the two buttons', () => {
  function Harness({ start = '' }: { start?: string }) {
    const [age, setAge] = useState(start);
    const [gender, setGender] = useState<LeadGender | null>(null);
    return (
      <>
        <span id="age-label">Umur</span>
        <AgeStepper id="age" value={age} onChange={setAge} />
        <span id="g">Jenis kelamin</span>
        <GenderButtons labelledBy="g" value={gender} onChange={setGender} />
      </>
    );
  }

  it('P19.7-T1 AC-1 gives 30 for − or + on an empty box, steps a year from there, and takes the keypad’s digits only', async () => {
    renderWithSession(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'One year more' }));
    expect(screen.getByRole('textbox')).toHaveValue('30');
    await userEvent.click(screen.getByRole('button', { name: 'One year more' }));
    expect(screen.getByRole('textbox')).toHaveValue('31');
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: 'One year less' }));
    expect(screen.getByRole('textbox')).toHaveValue('30');
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), '4a5');
    expect(screen.getByRole('textbox')).toHaveValue('45');
  });

  it('P19.7-T1 AC-1 stops − at 1 and + at 100, and its buttons are 48px', async () => {
    const { unmount } = renderWithSession(<Harness start="1" />);
    expect(screen.getByRole('button', { name: 'One year less' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One year less' })).toHaveClass('h-12', 'w-12');
    unmount();
    renderWithSession(<Harness start="100" />);
    expect(screen.getByRole('button', { name: 'One year more' })).toBeDisabled();
  });

  it('P19.7-T1 AC-1 speaks the proposal spec’s words in Indonesian', async () => {
    renderInIndonesian(<Harness start="0" />);
    expect(screen.getByRole('radio', { name: 'Laki-laki' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Perempuan' })).toBeInTheDocument();
    expect(screen.getByText('Umur harus 1–100.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah satu tahun' })).toBeInTheDocument();
  });
});
