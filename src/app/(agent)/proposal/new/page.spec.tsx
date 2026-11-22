import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { EMPTY_DETAILS, lead, proposal, RINA, ROSA, SHELL, VIEWING_RINA, WULAN } from '@test/proposal-fixtures';
import NewProposalPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/proposal/new',
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const page = (rows = [ROSA, WULAN]) => ({ body: { rows, total: rows.length, page: 1, pageSize: 50 } });

function show(routes: Routes = {}, me = RINA, search = '') {
  nav.search = search;
  const stub = stubFetch({
    ...SHELL,
    'GET /leads?': page(),
    'POST /proposals': { status: 201, body: proposal({ id: 'p-new' }) },
    ...routes,
  });
  renderInLayout(AgentLayout, <NewProposalPage />, { me });
  return stub;
}

const body = (calls: { url: string; init: RequestInit }[], method: string, fragment: string) =>
  calls.filter((c) => c.init.method === method && c.url.includes(fragment)).map((c) => JSON.parse(String(c.init.body)));

/**
 * **`/proposal/new`, step 1 *Untuk siapa?*** (P19.14-T1 AC-1 to AC-6; ADR-0254; the 11 Nov spec's *Step 1*): the
 * reader's own leads searched, *+ Lead baru* under the box, the client box under the chosen lead — the age with its
 * helper, the gender, the collapsed details — prefilled from the lead's earlier proposal, and **nothing written to the
 * lead**: *Lanjut* creates the draft with the client.
 */
describe('/proposal/new, step 1 Untuk siapa (P19.14-T1)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    try { window.sessionStorage.clear(); } catch { /* jsdom always has it */ }
  });
  afterEach(() => vi.unstubAllGlobals());

  const chooseWulan = async () => userEvent.click(await screen.findByRole('button', { name: /Ibu Wulan Sari/ }));

  it('P19.14-T1 AC-1 the step pills read 1 Untuk siapa · 2 Produk — the PDF is no step — on step 1; Kembali goes to Riwayat', async () => {
    show();
    const steps = await screen.findByRole('list', { name: 'Steps' });
    const items = within(steps).getAllByRole('listitem');
    expect(items.map((s) => s.textContent)).toEqual(['11 Who for', '22 Products']);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal');
    expect(screen.queryByRole('navigation', { name: 'Sales tools' })).not.toBeInTheDocument();
  });

  it('P19.14-T1 AC-2 searches the reader’s own Sales leads, most recent first, on the server', async () => {
    const { calls } = show();
    await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ });
    const url = calls.find((c) => c.url.includes('/leads?'))!.url;
    expect(url).toMatch(/owner=mem-rina/);
    expect(url).toMatch(/type=sales/);
    expect(url).toMatch(/sort=dateRegistered/);
    expect(url).toMatch(/dir=desc/);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your leads' }), 'Wulan');
    await waitFor(() => expect(calls.some((c) => c.url.includes('search=Wulan'))).toBe(true));
  });

  it('P19.14-T1 AC-2 with no exact match, + Lead baru "{text}" sits directly under the box; an exact name offers none', async () => {
    show();
    await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ });
    const box = screen.getByRole('searchbox', { name: 'Search your leads' });
    await userEvent.type(box, 'Pak Budi');
    const add = await screen.findByRole('button', { name: '+ New lead “Pak Budi”' });
    // Directly under the box: the box's next element, before any lead.
    expect(box.closest('div')!.nextElementSibling).toBe(add);
    await userEvent.clear(box);
    await userEvent.type(box, 'Ibu Wulan Sari');
    await waitFor(() => expect(screen.queryByRole('button', { name: /New lead/ })).not.toBeInTheDocument());
  });

  it('P19.14-T1 AC-2 + Lead baru saves the name and the phone as a Sales lead, moves it to the first stage, and chooses it', async () => {
    const created = lead({ id: 'l-new', name: 'Pak Budi', version: 1, proposals: null });
    const { calls } = show({
      'POST /leads': { status: 201, body: created },
      'PATCH /leads/l-new/status': { body: { ...created, statusCode: 'NOT_YET_APPROACHED', version: 2 } },
    });
    await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your leads' }), 'Pak Budi');
    await userEvent.click(await screen.findByRole('button', { name: '+ New lead “Pak Budi”' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Pak Budi');
    await userEvent.type(screen.getByRole('textbox', { name: 'Phone (optional)' }), '0812 1100 2200');
    await userEvent.click(screen.getByRole('button', { name: 'Save the lead' }));
    expect(await screen.findByText('Lead saved in Leads')).toBeInTheDocument();
    expect(body(calls, 'POST', '/leads')).toEqual([{ name: 'Pak Budi', type: 'sales', contact: { phone: '+6281211002200', email: null } }]);
    expect(body(calls, 'PATCH', '/leads/l-new/status')).toEqual([{ statusCode: 'NOT_YET_APPROACHED', version: 1 }]);
    expect(document.querySelector('[data-chosen-lead="l-new"]')).not.toBeNull();
    // The client box opens empty: a new lead has no earlier proposal.
    expect(screen.getByRole('textbox', { name: 'Age at next birthday' })).toHaveValue('');
  });

  it('P19.14-T1 AC-2 a phone that is not one is said under the field, and nothing is saved', async () => {
    const { calls } = show();
    await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your leads' }), 'Pak Budi');
    await userEvent.click(await screen.findByRole('button', { name: '+ New lead “Pak Budi”' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Phone (optional)' }), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save the lead' }));
    expect(screen.getByText('Enter 9 to 13 digits after +62.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('P19.14-T1 AC-3 under the chosen lead: the age with − / + and its helper, Laki-laki / Perempuan, details collapsed', async () => {
    show();
    await chooseWulan();
    const box = document.querySelector('[data-client-box]') as HTMLElement;
    const age = within(box).getByRole('textbox', { name: 'Age at next birthday' });
    expect(age).toHaveAttribute('inputMode', 'numeric');
    expect(age).toHaveAccessibleDescription('Born May 1991 → now 35 → enter 36');
    expect(within(box).getByRole('button', { name: 'One year less' })).toBeInTheDocument();
    expect(within(box).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Male', 'Female']);
    expect(within(box).queryByRole('slider')).not.toBeInTheDocument();
    const toggle = within(box).getByRole('button', { name: '+ Client details (optional)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-client-details]')).toBeNull();
    await userEvent.click(toggle);
    const details = document.querySelector('[data-client-details]') as HTMLElement;
    expect(within(details).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Single', 'Married', 'Hospital costs', 'Income during critical illness', 'Family benefit', 'Education fund',
      'Future / retirement fund', 'Other',
    ]);
    expect(within(details).getByRole('textbox', { name: 'Dependants' })).toHaveAttribute('placeholder', 'e.g. Wife, 2 children');
    expect(within(details).getByRole('textbox', { name: 'Occupation' })).toBeInTheDocument();
    expect(within(details).getByRole('textbox', { name: 'City' })).toBeInTheDocument();
    await userEvent.click(within(details).getByRole('button', { name: 'Other' }));
    expect(within(details).getByRole('textbox', { name: 'What else was discussed' })).toBeInTheDocument();
  });

  it('P19.14-T1 AC-3, AC-4 Lanjut needs the age and the gender, then creates the draft with the client — nothing written to the lead', async () => {
    const { calls } = show();
    await chooseWulan();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription('Enter the age and the gender to continue.');
    await userEvent.type(screen.getByRole('textbox', { name: 'Age at next birthday' }), '36');
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Female' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Client details (optional)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Married' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), ' Bandung ');
    await userEvent.click(screen.getByRole('button', { name: 'Education fund' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hospital costs' }));
    await userEvent.click(next);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/proposal/p-new?step=2'));
    expect(body(calls, 'POST', '/proposals')).toEqual([{
      leadId: 'l-wulan',
      client: { age: 36, gender: 'female', details: { ...EMPTY_DETAILS, status: 'married', city: 'Bandung', needs: ['HOSPITAL', 'EDUCATION'] } },
    }]);
    // AC-4: no lead write at all.
    expect(calls.some((c) => c.url.includes('/leads') && c.init.method && c.init.method !== 'GET')).toBe(false);
  });

  it('P19.14-T1 AC-5 a lead with an earlier proposal starts from its client — the age the server moved up', async () => {
    const { calls } = show();
    await userEvent.click(await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ }));
    expect(screen.getByRole('textbox', { name: 'Age at next birthday' })).toHaveValue('43');
    expect(screen.getByRole('radio', { name: 'Female' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    expect(body(calls, 'POST', '/proposals')[0].client).toEqual({
      age: 43, gender: 'female', details: { ...EMPTY_DETAILS, city: 'Bandung', needs: ['HOSPITAL'] },
    });
  });

  it('P19.14-T1 AC-2 a proposal started from a lead skips the pick: ?leadId= is chosen, Ganti opens the search', async () => {
    show({ 'GET /leads/l-rosa': { body: ROSA } }, RINA, 'leadId=l-rosa');
    await waitFor(() => expect(document.querySelector('[data-chosen-lead="l-rosa"]')).not.toBeNull());
    expect(screen.queryByRole('searchbox', { name: 'Search your leads' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('searchbox', { name: 'Search your leads' })).toBeInTheDocument();
  });

  it('P19.14-T1 AC-2 nothing is stored until Lanjut: the fields live in the tab', async () => {
    const { calls } = show();
    await chooseWulan();
    await userEvent.type(screen.getByRole('textbox', { name: 'Age at next birthday' }), '36');
    expect(calls.some((c) => c.init.method && c.init.method !== 'GET')).toBe(false);
    expect(JSON.parse(window.sessionStorage.getItem('ab.proposal.step1') ?? '{}')).toMatchObject({ leadId: 'l-wulan', age: '36' });
  });

  it('P19.14-T1 AC-1 Lanjut is the main action, a floating pill above the tab bar', async () => {
    show();
    await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ });
    expect(screen.getByRole('button', { name: 'Next' }).closest('[data-floating-bar]')).not.toBeNull();
  });

  it('P19.14-T1 AC-6 a view-only session makes nothing: no lead is chosen, Lanjut stays disabled', async () => {
    show({}, VIEWING_RINA);
    expect(await screen.findByRole('button', { name: /Ibu Rosa Damayanti/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
