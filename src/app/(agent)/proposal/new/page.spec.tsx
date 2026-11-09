import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { lead, proposal, RINA, ROSA, SHELL, VIEWING_RINA, WULAN } from '@test/proposal-fixtures';
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
 * **`/proposal/new`, step 1 with nothing stored** (P19.7-T2 AC-2, AC-3, AC-4, AC-14, AC-16; Acc. 2, 3, 6; ADR-0221 §3,
 * ADR-0224). The reader's own Sales leads, *Klien baru* with three fields, *Umur belum ada* and its card, and *Lanjut*,
 * which saves the lead first and then creates the draft.
 */
describe('/proposal/new, step 1 (P19.7-T2)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    try { window.sessionStorage.clear(); } catch { /* jsdom always has it */ }
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T2 AC-2 the progress bar reads 1 Klien · 2 Produk · 3 PDF, on step 1; Kembali goes back to Riwayat', async () => {
    show();
    const steps = await screen.findByRole('list', { name: 'Steps' });
    const items = within(steps).getAllByRole('listitem');
    expect(items.map((s) => s.textContent)).toEqual(['11 Client', '22 Products', '33 PDF']);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal');
    // The steps carry the bar and *Kembali*, not the Sales tools strip (ADR-0221 §8).
    expect(screen.queryByRole('navigation', { name: 'Sales tools' })).not.toBeInTheDocument();
  });

  it('P19.7-T2 AC-3 lists the reader’s own Sales leads, newest first, searched on the server', async () => {
    const { calls } = show();
    await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    const url = calls.find((c) => c.url.includes('/leads?'))!.url;
    expect(url).toMatch(/owner=mem-rina/);
    expect(url).toMatch(/type=sales/);
    expect(url).toMatch(/sort=dateRegistered/);
    expect(url).toMatch(/dir=desc/);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your Sales leads' }), 'Wulan');
    await waitFor(() => expect(calls.some((c) => c.url.includes('search=Wulan'))).toBe(true));
  });

  it('P19.7-T2 AC-3 Klien baru asks three fields only — Nama, Umur with − / + and the keypad, Laki-laki / Perempuan — no slider, no dropdown', async () => {
    show();
    await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    await userEvent.click(screen.getByRole('button', { name: 'New client' }));
    const form = document.querySelector('[data-new-client]') as HTMLElement;
    expect(within(form).getAllByRole('textbox').map((b) => b.getAttribute('id') ? (document.querySelector(`label[for="${b.id}"]`)?.textContent ?? '') : ''))
      .toEqual(['Name', 'Age at next birthday']);
    const age = within(form).getByRole('textbox', { name: 'Age at next birthday' });
    expect(age).toHaveAttribute('inputMode', 'numeric');
    expect(within(form).getByRole('button', { name: 'One year less' })).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'One year more' })).toBeInTheDocument();
    expect(within(form).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Male', 'Female']);
    expect(within(form).queryByRole('slider')).not.toBeInTheDocument();
    expect(within(form).queryByRole('combobox')).not.toBeInTheDocument();
    expect(form.querySelectorAll('input, select, textarea')).toHaveLength(2);
  });

  it('P19.7-T2 AC-3 a new client is saved as a Sales lead, then the draft is made and step 2 opens in its place', async () => {
    const created = lead({ id: 'l-new', name: 'Pak Budi', age: 36, gender: 'male' });
    const { calls } = show({ 'POST /leads': { status: 201, body: created } });
    await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    await userEvent.click(screen.getByRole('button', { name: 'New client' }));
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Pak Budi');
    await userEvent.type(screen.getByRole('textbox', { name: 'Age at next birthday' }), '36');
    await userEvent.click(screen.getByRole('radio', { name: 'Male' }));
    await userEvent.click(next);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/proposal/p-new?step=2'));
    expect(body(calls, 'POST', '/leads')).toEqual([{ name: 'Pak Budi', type: 'sales', age: 36, gender: 'male' }]);
    expect(body(calls, 'POST', '/proposals')).toEqual([{ leadId: 'l-new' }]);
    const order = calls.filter((c) => c.init.method === 'POST').map((c) => new URL(c.url).pathname.replace(/^\/api\/v1/, ''));
    expect(order).toEqual(['/leads', '/proposals']);
  });

  it('P19.7-T2 AC-3 with no Sales lead at all, Klien baru is already open', async () => {
    show({ 'GET /leads?': page([]) });
    expect(await screen.findByRole('button', { name: 'New client' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-new-client]')).not.toBeNull();
  });

  it('P19.7-T2 AC-3 a lead that already has an age and a gender skips them: Lanjut makes the draft at once', async () => {
    const { calls } = show();
    await userEvent.click(await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ }));
    expect(document.querySelector('[data-missing-card]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/proposal/p-new?step=2'));
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(body(calls, 'POST', '/proposals')).toEqual([{ leadId: 'l-rosa' }]);
  });

  it('P19.7-T2 AC-3 ?leadId= chooses that lead', async () => {
    show({}, RINA, 'leadId=l-rosa');
    const r = await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    expect(r).toHaveAttribute('aria-checked', 'true');
  });

  it('P19.7-T2 AC-3 ?leadId= of a lead past the first page is read, chosen and shown first', async () => {
    const older = lead({ id: 'l-old', name: 'Pak Hendro Gunawan', age: 51, gender: 'male' });
    show({ 'GET /leads/l-old': { body: older } }, RINA, 'leadId=l-old');
    const radios = await screen.findAllByRole('radio');
    await waitFor(() => expect(screen.getByRole('radio', { name: /Pak Hendro Gunawan/ })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getAllByRole('radio')[0]).toHaveAccessibleName(/Pak Hendro Gunawan/);
    expect(radios.length).toBeGreaterThan(0);
  });

  it('P19.7-T2 AC-4 a lead without them carries the amber Umur belum ada; picking it opens the card under the list', async () => {
    show();
    const wulan = await screen.findByRole('radio', { name: /Ibu Wulan Sari/ });
    expect(within(wulan).getByText('No age yet')).toHaveAttribute('data-tone', 'amber');
    expect(within(screen.getByRole('radio', { name: /Ibu Rosa Damayanti/ })).queryByText('No age yet')).not.toBeInTheDocument();
    await userEvent.click(wulan);
    const card = document.querySelector('[data-missing-card]') as HTMLElement;
    expect(card).toHaveTextContent('This lead has no age or gender yet. Fill them in once and they are kept on the lead.');
    // Under the list, on the same screen.
    expect(screen.getByRole('radiogroup', { name: 'Your Sales leads' }).compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('P19.7-T2 AC-4 Lanjut saves both to the lead, pinned, says Umur tersimpan di lead, then makes the draft', async () => {
    const { calls } = show({ 'PATCH /leads/l-wulan': { body: { ...WULAN, age: 51, gender: 'female', version: 4 } } });
    await userEvent.click(await screen.findByRole('radio', { name: /Ibu Wulan Sari/ }));
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Age at next birthday' }), '51');
    await userEvent.click(screen.getByRole('radio', { name: 'Female' }));
    await userEvent.click(next);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/proposal/p-new?step=2'));
    expect(body(calls, 'PATCH', '/leads/l-wulan')).toEqual([{ age: 51, gender: 'female', version: 3 }]);
    expect(body(calls, 'POST', '/proposals')).toEqual([{ leadId: 'l-wulan' }]);
    expect(await screen.findByText('Age saved on the lead')).toBeInTheDocument();
  });

  it('P19.7-T2 AC-2 nothing is stored until Lanjut: the three fields live in the tab', async () => {
    const { calls } = show();
    await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    await userEvent.click(screen.getByRole('button', { name: 'New client' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Pak Budi');
    expect(calls.some((c) => c.init.method && c.init.method !== 'GET')).toBe(false);
    expect(JSON.parse(window.sessionStorage.getItem('ab.proposal.step1') ?? '{}')).toMatchObject({ mode: 'new', name: 'Pak Budi' });
  });

  it('P19.7-T2 AC-16 Lanjut is the main action, a floating pill above the tab bar', async () => {
    show();
    await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
    expect(screen.getByRole('button', { name: 'Next' }).closest('[data-floating-bar]')).not.toBeNull();
  });

  it('P19.7-T2 AC-14 a view-only session makes nothing: Lanjut stays disabled', async () => {
    show({}, VIEWING_RINA);
    await userEvent.click(await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
