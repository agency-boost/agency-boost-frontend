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
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null,
  age: 42, ageRecordedOn: '2026-11-05', gender: 'female', ...over,
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

describe('P19.7-T1 AC-1 the lead’s age and gender, in the sheet and the pane', () => {
  it('P19.7-T1 AC-1 holds the API’s bounds, 1 to 100', () => {
    expect([LEAD_AGE_MIN, LEAD_AGE_MAX]).toEqual([1, 100]);
  });

  it('P19.7-T1 AC-1 the sheet shows the lead’s age and gender, below the details and above History', async () => {
    render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    const age = sheet.getByRole('textbox', { name: 'Age at next birthday' });
    expect(age).toHaveValue('42');
    expect(age).toHaveAttribute('inputmode', 'numeric');
    expect(sheet.getByRole('radio', { name: 'Female' })).toHaveAttribute('aria-checked', 'true');
    expect(sheet.getByRole('radio', { name: 'Male' })).toHaveAttribute('aria-checked', 'false');
    const history = await sheet.findByRole('heading', { name: 'History' });
    expect(age.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No birth date, no slider.
    expect(sheet.queryByRole('slider')).not.toBeInTheDocument();
    expect(sheet.queryByText(/birth date|tanggal lahir/i)).not.toBeInTheDocument();
  });

  it('P19.7-T1 AC-1 − and + move a year and save only the age that changed', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    await userEvent.click(sheet.getByRole('button', { name: 'One year more' }));
    expect(sheet.getByRole('textbox', { name: 'Age at next birthday' })).toHaveValue('43');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([{ call: 'PATCH /leads/l1', body: { age: 43, version: 2 } }]));
  });

  it('P19.7-T1 AC-1 saving another field leaves the age unsent, so its day does not move', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    await userEvent.type(sheet.getByRole('textbox', { name: 'Remarks' }), 'Dua anak.');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).not.toHaveProperty('age');
    expect(writes(stub.calls)[0].body).not.toHaveProperty('gender');
  });

  it('P19.7-T1 AC-1 tapping the chosen gender again clears it; an emptied box clears the age', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    await userEvent.click(sheet.getByRole('radio', { name: 'Female' }));
    await userEvent.clear(sheet.getByRole('textbox', { name: 'Age at next birthday' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([{ call: 'PATCH /leads/l1', body: { age: null, gender: null, version: 2 } }]));
  });

  it('P19.7-T1 AC-1 an age outside 1–100 is said under the box and nothing is sent', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet('Ibu Rosa Damayanti');
    const age = sheet.getByRole('textbox', { name: 'Age at next birthday' });
    await userEvent.clear(age);
    await userEvent.type(age, '101');
    expect(sheet.getByText('Age must be 1–100.')).toBeInTheDocument();
    expect(age).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(writes(stub.calls)).toEqual([]);
    expect(age).toHaveFocus();
  });

  it('P19.7-T1 AC-1 + Tambah lead offers both, and sends them with the new lead', async () => {
    const stub = render(360, [lead()]);
    await screen.findByRole('list', { name: 'Your leads' });
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), 'Pak Hendro Gunawan');
    await userEvent.type(sheet.getByRole('textbox', { name: 'Age at next birthday' }), '51');
    await userEvent.click(sheet.getByRole('radio', { name: 'Male' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)[0]).toMatchObject({
      call: 'POST /leads', body: { name: 'Pak Hendro Gunawan', age: 51, gender: 'male' },
    }));
  });

  it('P19.7-T1 AC-1 a new lead with neither sends neither', async () => {
    const stub = render(360, [lead()]);
    await screen.findByRole('list', { name: 'Your leads' });
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), 'Ibu Sari');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).not.toHaveProperty('age');
    expect(writes(stub.calls)[0].body).not.toHaveProperty('gender');
  });

  it('P19.7-T1 AC-1 the laptop’s pane carries the same two fields, and saves them', async () => {
    const stub = render(1280, [lead({ age: null, ageRecordedOn: null, gender: null })]);
    const pane = within(await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' }));
    expect(pane.getByRole('textbox', { name: 'Age at next birthday' })).toHaveValue('');
    await userEvent.type(pane.getByRole('textbox', { name: 'Age at next birthday' }), '42');
    await userEvent.click(pane.getByRole('radio', { name: 'Female' }));
    await userEvent.click(pane.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([{ call: 'PATCH /leads/l1', body: { age: 42, gender: 'female', version: 2 } }]));
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
