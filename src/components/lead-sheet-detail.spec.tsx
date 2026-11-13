import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import LeadsPage from '@/app/(agent)/leads/page';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import type { Lead } from '@/lib/leads';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

/**
 * **P19.11-T3 — the lead sheet's *Detail*, *Hasil*'s helper and the section gap** (UX-10, UX-17; UXQ9): *Detail* as
 * labelled fields — *Nama* (required), *WhatsApp* (`+62` and the number: `contact.phone`, the number at the top),
 * *Email* (checked only when filled), *Jenis kelamin* — with *Umur* and *Sumber lead* gone and kept; *Aktif setelah
 * status …* out of sight but still *Tandai berhasil*'s description; and one section gap, the box's, never a legend's.
 */

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

const stage = (code: string, label: string, rank: number, over = {}) => ({
  id: code, pipeline: 'sales', code, label, rank, isTerminal: false, isLateStage: false, version: 1, status: 'active', ...over,
});
const PIPELINES = [{
  pipeline: 'sales',
  statuses: [stage('FOLLOW_UP', 'Follow-up', 1), stage('PAID_AND_ISSUED', 'Paid and issued', 2, { isTerminal: true })],
}];

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Rosa Damayanti',
  contact: { phone: '+6281211002200', email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], closedThisMonth: false, lastEditedBy: null,
  remarks: null, nextActionDate: '2099-11-03', nextActionNote: 'Kopi.', outcome: null, source: 'Referensi dari Desi',
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null,
  age: 42, ageRecordedOn: '2026-11-05', gender: null, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

/** Each lead's own routes: a read with its history, and a patch answered as the server would — the body over the row. */
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
  } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};
const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => ({ call: `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')}`, body: JSON.parse(String(c.init.body ?? '{}')) }));
const openSheet = async (name = 'Ibu Rosa Damayanti') => {
  await userEvent.click(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('button', { name }));
  return within(await screen.findByRole('dialog', { name }));
};
const details = (sheet: ReturnType<typeof within>) => within(sheet.getByRole('group', { name: 'Details' }));

afterEach(() => vi.unstubAllGlobals());

describe('P19.11-T3 AC-5 Detail: labelled fields, in the brief’s order', () => {
  it('P19.11-T3 AC-5 Nama, WhatsApp, Email, Jenis kelamin — each with a visible label, in that order', async () => {
    render(360, [lead()]);
    const sheet = await openSheet();
    const group = sheet.getByRole('group', { name: 'Details' });
    const labels = [...group.querySelectorAll('label, p[id$="-gender-label"]')].map((el) => el.textContent);
    expect(labels).toEqual(['Name', 'WhatsApp', 'Email', 'Gender']);
    const box = details(sheet);
    expect(box.getByLabelText('Name')).toHaveValue('Ibu Rosa Damayanti');
    // The fixed +62, then the national digits of the stored number: one field with the number at the top.
    const phone = box.getByLabelText('WhatsApp');
    expect(phone).toHaveAttribute('type', 'tel');
    expect(phone).toHaveValue('81211002200');
    expect(phone.closest('[data-phone-field]')).toHaveTextContent('+62');
    expect(box.getByLabelText('Email')).toHaveValue('');
    expect(box.getByLabelText('Email')).not.toHaveAttribute('placeholder');
    expect(box.getByRole('radiogroup', { name: 'Gender' })).toBeInTheDocument();
  });

  it('P19.11-T3 AC-5 Jenis kelamin is two options and empty by default', async () => {
    render(360, [lead()]);
    const box = details(await openSheet());
    const options = within(box.getByRole('radiogroup', { name: 'Gender' })).getAllByRole('radio');
    expect(options.map((o) => [o.textContent, o.getAttribute('aria-checked')])).toEqual([['Male', 'false'], ['Female', 'false']]);
  });

  it('P19.11-T3 AC-5 Umur and Sumber lead are gone from the sheet, and a save leaves both as stored', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet();
    expect(sheet.queryByLabelText('Age at next birthday')).not.toBeInTheDocument();
    expect(sheet.queryByLabelText('Where they came from')).not.toBeInTheDocument();
    expect(sheet.queryByPlaceholderText('e.g. Referral from Desi')).not.toBeInTheDocument();
    expect(sheet.queryByDisplayValue('Referensi dari Desi')).not.toBeInTheDocument();
    await userEvent.type(details(sheet).getByLabelText('Email'), 'rosa@contoh.com');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).not.toHaveProperty('age');
    expect(writes(stub.calls)[0].body).not.toHaveProperty('source');
  });

  it('P19.11-T3 AC-5 Nama is required: an empty or too-short name says so under the box, takes the focus, and nothing is saved', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet();
    const name = details(sheet).getByLabelText('Name');
    expect(name).toBeRequired();
    await userEvent.clear(name);
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(details(sheet).getByText('A lead’s name must be at least 2 characters.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('A lead’s name must be at least 2 characters.');
    expect(name).toHaveFocus();
    await userEvent.type(name, 'R');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(writes(stub.calls)).toEqual([]);
  });

  it.each([['0813-2200-3300'], ['6281322003300'], ['+62 813 2200 3300']])(
    'P19.11-T3 AC-5 WhatsApp typed as %j is saved as +6281322003300, the email beside it unchanged',
    async (typed) => {
      const stub = render(360, [lead({ contact: { phone: '+6281211002200', email: 'rosa@contoh.com' } })]);
      const sheet = await openSheet();
      const phone = details(sheet).getByLabelText('WhatsApp');
      await userEvent.clear(phone);
      await userEvent.type(phone, typed);
      await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(writes(stub.calls)).toEqual([{
        call: 'PATCH /leads/l1', body: { contact: { phone: '+6281322003300', email: 'rosa@contoh.com' }, version: 2 },
      }]));
    },
  );

  it('P19.11-T3 AC-5 a WhatsApp that is not a number says so under the field and nothing is saved; emptied, it clears', async () => {
    const stub = render(360, [lead()]);
    const sheet = await openSheet();
    const phone = details(sheet).getByLabelText('WhatsApp');
    await userEvent.clear(phone);
    await userEvent.type(phone, '0812');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAccessibleDescription('Enter 9 to 13 digits after +62.');
    expect(phone).toHaveFocus();
    expect(writes(stub.calls)).toEqual([]);
    await userEvent.clear(phone);
    expect(phone).not.toHaveAttribute('aria-invalid');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([
      { call: 'PATCH /leads/l1', body: { contact: { phone: null, email: null }, version: 2 } },
    ]));
  });

  it('P19.11-T3 AC-5 a number saved before the rule shows as saved and goes back untouched when only the email changes', async () => {
    const stub = render(360, [lead({ contact: { phone: '0812', email: null } })]);
    const sheet = await openSheet();
    expect(details(sheet).getByLabelText('WhatsApp')).toHaveValue('0812');
    await userEvent.type(details(sheet).getByLabelText('Email'), 'rosa@contoh.com');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([
      { call: 'PATCH /leads/l1', body: { contact: { phone: '0812', email: 'rosa@contoh.com' }, version: 2 } },
    ]));
  });

  it('P19.11-T3 AC-5 Email is checked only when filled: a part address says so, an empty one is fine', async () => {
    const stub = render(360, [lead({ contact: { phone: '+6281211002200', email: 'rosa@contoh.com' } })]);
    const sheet = await openSheet();
    const email = details(sheet).getByLabelText('Email');
    await userEvent.clear(email);
    await userEvent.type(email, 'rosa@contoh');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(email).toHaveAccessibleDescription('Write a whole email address, like name@example.com.');
    expect(email).toHaveFocus();
    expect(writes(stub.calls)).toEqual([]);
    await userEvent.clear(email);
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toEqual([
      { call: 'PATCH /leads/l1', body: { contact: { phone: '+6281211002200', email: null }, version: 2 } },
    ]));
  });

  it('P19.11-T3 AC-5 a new lead sends the WhatsApp as +62…, the name at the top where the sheet opens', async () => {
    atWidth(360);
    const created = lead({ id: 'l9', name: 'Pak Joko', statusCode: null, version: 1 });
    const stub = stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
      '/kpm/org-levels': { body: [] },
      'outcome=': { body: page([]) },
      'POST /leads': { status: 201, body: created },
    } as Parameters<typeof stubFetch>[0]);
    renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Add lead' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    expect(sheet.getByLabelText('Name')).toHaveFocus();
    await userEvent.type(sheet.getByLabelText('Name'), 'Pak Joko');
    await userEvent.type(details(sheet).getByLabelText('WhatsApp'), '0813 2200 3300');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)[0]).toMatchObject({
      call: 'POST /leads', body: { name: 'Pak Joko', contact: { phone: '+6281322003300', email: null } },
    }));
  });
});

describe('P19.11-T3 AC-5 one number, two places: the top and Detail’s WhatsApp follow each other', () => {
  it('P19.11-T3 AC-5 a number saved from the pencil at the top lands in Detail’s WhatsApp', async () => {
    render(1280, [lead()]);
    const pane = within(await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' }));
    await userEvent.click(pane.getByRole('button', { name: /^WhatsApp number/ }));
    const asked = within(await screen.findByRole('dialog', { name: 'Enter WhatsApp number' }));
    const field = asked.getByLabelText('WhatsApp number');
    await userEvent.clear(field);
    await userEvent.type(field, '0813 2200 3300');
    await userEvent.click(asked.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(details(pane).getByLabelText('WhatsApp')).toHaveValue('81322003300'));
    // Nothing left to save: the field follows the saved number, it is not a change of the reader's.
    expect(pane.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('P19.11-T3 AC-5 a number saved from Detail shows at the top, and a rename names the pane and the list', async () => {
    const stub = render(1280, [lead()]);
    const pane = within(await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' }));
    const phone = details(pane).getByLabelText('WhatsApp');
    await userEvent.clear(phone);
    await userEvent.type(phone, '081322003300');
    const name = details(pane).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ibu Rosa D.');
    await userEvent.click(pane.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub.calls)).toHaveLength(1));
    expect(writes(stub.calls)[0].body).toEqual({ name: 'Ibu Rosa D.', contact: { phone: '+6281322003300', email: null }, version: 2 });
    const renamed = within(await screen.findByRole('region', { name: 'Ibu Rosa D.' }));
    expect(renamed.getByRole('button', { name: /^WhatsApp number/ })).toHaveTextContent('+6281322003300');
    expect(within(screen.getByRole('list', { name: 'Your leads' })).getByRole('button', { name: 'Ibu Rosa D.' })).toBeInTheDocument();
  });
});

describe('P19.11-T3 AC-4 Hasil: Aktif setelah status … out of sight, still Tandai berhasil’s description', () => {
  it('P19.11-T3 AC-4 the helper is not visible; the held button keeps it as its description and stays held', async () => {
    render(360, [lead()]);
    const sheet = await openSheet();
    const won = sheet.getByRole('button', { name: 'Mark successful' });
    expect(won).toBeDisabled();
    expect(won).toHaveAccessibleDescription('Active after status Paid and issued');
    const helper = document.getElementById(won.getAttribute('aria-describedby')!)!;
    expect(helper).toHaveClass('sr-only');
    expect(helper).not.toHaveClass('text-muted');
    // At the final stage it is enabled, as before.
    expect(sheet.getByRole('button', { name: 'Mark not successful' })).toBeEnabled();
  });

  it('P19.11-T3 AC-4 in Indonesian the description is the same words, Aktif setelah status …', async () => {
    atWidth(360);
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
      '/kpm/org-levels': { body: [] },
      'outcome=won': { body: page([]) },
      'outcome=lost': { body: page([]) },
      'outcome=open': { body: page([lead()]) },
      '/leads/l1': { body: { ...lead(), history: [] } },
    } as Parameters<typeof stubFetch>[0]);
    renderInIndonesian(<AgentLayout><LeadsPage /></AgentLayout>, { me: AGENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Ibu Rosa Damayanti' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Rosa Damayanti' }));
    expect(sheet.getByRole('button', { name: 'Tandai berhasil' })).toHaveAccessibleDescription('Aktif setelah status Paid and issued');
    // Detail's labels, as the brief writes them.
    const group = within(sheet.getByRole('group', { name: 'Detail' }));
    for (const label of ['Nama', 'WhatsApp', 'Email']) expect(group.getByLabelText(label)).toBeInTheDocument();
    expect(group.getByRole('radiogroup', { name: 'Jenis kelamin' })).toBeInTheDocument();
  });
});

describe('P19.11-T3 AC-3 the › in the pane’s head', () => {
  it('P19.11-T3 AC-3 the pane’s head draws the card’s tag line: type › stage, the › hidden from a screen reader', async () => {
    render(1280, [lead()]);
    const pane = await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' });
    const heading = within(pane).getByRole('heading', { name: 'Ibu Rosa Damayanti' });
    const separator = heading.parentElement!.querySelector('[data-pill-separator]')!;
    expect(separator).toHaveAttribute('aria-hidden', 'true');
    expect(separator.closest('[data-lead-stage]')).toHaveTextContent('›Follow-up');
    expect(separator.closest('[data-lead-stage]')!.parentElement).toHaveTextContent(/^Sales›Follow-up$/);
  });
});

describe('P19.11-T3 AC-9 one section gap', () => {
  it('P19.11-T3 AC-9 every section is a box with the same top gap, its label with none of its own and the same gap to its field', async () => {
    render(360, [lead()]);
    const sheet = await openSheet();
    await sheet.findByRole('heading', { name: 'History' });
    const sections = [...document.querySelectorAll('[data-lead-sheet] [data-lead-section]')];
    expect(sections.map((s) => s.getAttribute('data-lead-section')))
      .toEqual(['type', 'status', 'next-action', 'remarks', 'outcome', 'details', 'history']);
    for (const section of sections) {
      expect(section).toHaveClass('mt-4');
      const label = section.firstElementChild!;
      expect(['LEGEND', 'LABEL', 'P', 'H3']).toContain(label.tagName);
      // The gap is the box's: a legend ignores its own top margin, so no label carries one.
      expect([...label.classList].filter((c) => /^mt-/.test(c))).toEqual([]);
      expect(label).toHaveClass('mb-1.5');
    }
  });

  it('P19.11-T3 AC-9 Tindakan berikutnya under the Potensi card takes the same gap as every other section', async () => {
    render(360, [lead()]);
    const sheet = await openSheet();
    const next = sheet.getByRole('group', { name: 'Next action' });
    expect(next).toHaveAttribute('data-lead-section', 'next-action');
    expect(next).toHaveClass('mt-4');
    expect(next.previousElementSibling!.querySelector('[role="switch"]')).not.toBeNull();
  });
});
