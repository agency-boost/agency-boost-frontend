import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ANUGERAH, CATALOG, CERAH, client, conflict, EMPTY_DETAILS, itemOf, lead, MEDICAL, PCB, product, proposal, RINA,
  ROSA, serverError, SHELL, VIEWING_RINA,
} from '@test/proposal-fixtures';
import type { Proposal } from '@/lib/proposals';
import ProposalStepsPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), search: 'step=2' }));
/** `pdf.js` is the browser's: here a file of two pages whose words are known (P19.7-T3). */
const pdf = vi.hoisted(() => ({
  opened: [] as ArrayBuffer[],
  open: vi.fn(),
  saved: [] as { blob: Blob; name: string }[],
}));
vi.mock('@/lib/pdf-pages', () => ({
  openPdf: async (bytes: ArrayBuffer) => {
    pdf.opened.push(bytes);
    pdf.open(bytes);
    return {
      pages: 2,
      draw: async (n: number, _canvas: HTMLCanvasElement, cssWidth: number) => ({
        cssWidth, cssHeight: cssWidth * 1.414, text: n === 1 ? 'Proposal untuk Bapak/Ibu Ibu Rosa Damayanti' : 'Rincian',
      }),
      close: () => {},
    };
  },
}));
vi.mock('@/lib/save-file', () => ({ saveFile: (blob: Blob, name: string) => { pdf.saved.push({ blob, name }); } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/proposal/p-1',
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({ proposalId: 'p-1' }),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const catalogOf = (products = CATALOG) => ({ body: { products } });

function show(p: Proposal, routes: Routes = {}, { me = RINA, step = 2 }: { me?: typeof RINA; step?: 1 | 2 | 'pdf' | 3 } = {}) {
  nav.search = `step=${step}`;
  const stub = stubFetch({
    ...SHELL,
    'GET /proposals/p-1': { body: p },
    'GET /proposals/catalog': catalogOf(),
    ...routes,
  });
  renderInLayout(AgentLayout, <ProposalStepsPage params={routeParams({ proposalId: 'p-1' })} />, { me });
  return stub;
}

const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => ({
    method: c.init.method,
    path: new URL(c.url).pathname.replace(/^\/api\/v1/, '') + new URL(c.url).search,
    body: c.init.body ? JSON.parse(String(c.init.body)) : undefined,
  }));

const medical = itemOf(MEDICAL, { itemId: 'i-med', plan: 'Gold' });
const cerah = itemOf(CERAH, { itemId: 'i-cerah' });
const panel = (code: string) => document.querySelector(`[data-proposal-item="${code}"]`) as HTMLElement;
/** A product's panel once it is drawn. */
const drawn = (code: string) => waitFor(() => {
  const el = panel(code);
  if (!el) throw new Error(`no panel for ${code}`);
  return el;
});
const chips = () => screen.getByRole('list', { name: 'Products' });

/**
 * **`/proposal/[proposalId]`, a stored proposal** (P19.14-T1 AC-1, AC-5, AC-6; P19.14-T2 AC-1 to AC-6; ADR-0254,
 * ADR-0255): step 1 with the proposal's own client, step 2 *Produk* — the client's line, the search, the category chips,
 * the products greyed out of age, each product's card with its *Tertanggung*, fields, *Masa bayar*, *Merokok?*, *Cara
 * bayar* and amounts — every change saved, pinned.
 */
describe('/proposal/[proposalId] (P19.14)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  describe('the flow (P19.14-T1 AC-1)', () => {
    it('P19.14-T1 AC-1 step 2 is the second pill; Kembali to step 1; Lihat proposal opens the result once a product has a premium', async () => {
      const typed = { ...medical, premium: { amountMinor: 45_000_000, currency: 'IDR' as const } };
      show(proposal({ items: [typed] }));
      const steps = await screen.findByRole('list', { name: 'Steps' });
      expect(within(steps).getAllByRole('listitem')).toHaveLength(2);
      expect(within(steps).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal/p-1?step=1');
      const see = await screen.findByRole('button', { name: 'See the proposal' });
      expect(see.closest('[data-floating-bar]')).not.toBeNull();
      await userEvent.click(see);
      expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=pdf');
    });

    it('P19.14-T1 AC-1 Lihat proposal waits for a premium, and says why', async () => {
      show(proposal({ items: [medical] }));
      const see = await screen.findByRole('button', { name: 'See the proposal' });
      expect(see).toBeDisabled();
      expect(see).toHaveAccessibleDescription('Enter a premium to see the proposal.');
    });

    it('P19.14-T2 AC-1 every change saves the draft, each write pinned to the version the last one answered', async () => {
      const added = proposal({ version: 5, items: [medical] });
      const { calls } = show(proposal(), {
        'POST /proposals/p-1/items': { status: 201, body: added },
        'PATCH /proposals/p-1/items/i-med': { body: { ...added, version: 6 } },
      });
      await userEvent.click(await within(await waitFor(chips)).findByRole('button', { name: /PRUWell Medical/ }));
      await drawn('PRUWELL_MEDICAL');
      await userEvent.click(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Silver' }));
      await waitFor(() => expect(writes(calls)).toHaveLength(2));
      expect(writes(calls)).toEqual([
        { method: 'POST', path: '/proposals/p-1/items', body: { expectedVersion: 4, productId: 'prod-medical' } },
        { method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { fieldValues: { plan: 'Silver' }, expectedVersion: 5 } },
      ]);
    });

    it('P19.14-T2 AC-3 a typed premium is saved, in minor units, as it is typed and on leaving the box', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-med': { body: { ...p, version: 5 } } });
      const box = await screen.findByRole('textbox', { name: 'Premium per month' });
      expect(box).toHaveAttribute('inputMode', 'numeric');
      await userEvent.type(box, '450000');
      await userEvent.tab();
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { premium: { amountMinor: 45_000_000 }, expectedVersion: 4 } },
      ]));
    });

    it('P19.7-T2 AC-2 a 409 is news: the proposal is read again and the screen says it changed on another device', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, {
        'GET /proposals/p-1': [{ body: p }, { body: { ...p, version: 7 } }],
        'PATCH /proposals/p-1/items/i-med': conflict,
      });
      await userEvent.click(await within(await drawn('PRUWELL_MEDICAL')).findByRole('button', { name: 'Silver' }));
      expect(await screen.findByText('This proposal was changed on another device.')).toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/proposals/p-1') && !c.url.includes('items') && (c.init.method ?? 'GET') === 'GET'))
        .toHaveLength(2);
    });

    it('P19.7-T2 AC-2 a failed save keeps what was typed and offers Coba lagi, which sends it again', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-med': [serverError, { body: { ...p, version: 5 } }] });
      const box = await screen.findByRole('textbox', { name: 'Premium per month' });
      await userEvent.type(box, '450000');
      await userEvent.tab();
      expect(await screen.findByText('Not saved yet. Try again.')).toBeInTheDocument();
      expect(box).toHaveValue('450000');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(writes(calls)).toHaveLength(2));
      expect(writes(calls)[1].body).toEqual({ premium: { amountMinor: 45_000_000 }, expectedVersion: 4 });
    });

    it('P19.7-T2 AC-13 another member’s proposal is the API’s 404, shown as the step’s error', async () => {
      show(proposal(), {
        'GET /proposals/p-1': { status: 404, body: { error: { code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found.', requestId: 'r-1' } } },
      });
      expect(await screen.findByRole('alert')).toHaveTextContent('Proposal not found.');
    });
  });

  describe('step 1 on a stored proposal (P19.14-T1 AC-3, AC-5)', () => {
    it('P19.14-T1 AC-3 starts from the proposal’s own client; a new age asks before taking products out, then writes the client', async () => {
      const p = proposal({ items: [itemOf(PCB, { itemId: 'i-pcb' })] });
      const { calls } = show(p, {
        'GET /leads/l-rosa': { body: ROSA },
        'GET /proposals/catalog': ({ url }) => (url.includes('age=61') ? catalogOf([{ ...PCB, outOfAge: true }]) : catalogOf()),
        'PATCH /proposals/p-1': { body: { ...p, version: 5, client: client({ age: 61 }), items: [], removedItemIds: ['i-pcb'] } },
      }, { step: 1 });
      const age = await screen.findByRole('textbox', { name: 'Age at next birthday' });
      // The proposal's own 42, never the lead's prefill of 43.
      expect(age).toHaveValue('42');
      await userEvent.clear(age);
      await userEvent.type(age, '61');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      const ask = await screen.findByRole('dialog', { name: '1 product is not available at this age and will be removed.' });
      await userEvent.click(within(ask).getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2'));
      expect(writes(calls)).toEqual([{
        method: 'PATCH', path: '/proposals/p-1', body: { client: { age: 61, gender: 'female', details: EMPTY_DETAILS }, expectedVersion: 4 },
      }]);
    });

    it('P19.14-T1 AC-3 the same lead and client, unchanged, writes nothing: a finished proposal stays Selesai', async () => {
      const { calls } = show(proposal({ status: 'done' }), { 'GET /leads/l-rosa': { body: ROSA } }, { step: 1 });
      await screen.findByRole('textbox', { name: 'Age at next birthday' });
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2'));
      expect(writes(calls)).toEqual([]);
    });

    it('P19.14-T1 AC-3 another lead takes its name: the write carries the lead and the client', async () => {
      const other = lead({ id: 'l-dimas', name: 'Mas Dimas' });
      const p = proposal();
      const { calls } = show(p, {
        'GET /leads/l-rosa': { body: ROSA },
        'GET /leads?': { body: { rows: [ROSA, other], total: 2, page: 1, pageSize: 50 } },
        'PATCH /proposals/p-1': { body: { ...p, version: 5, leadId: 'l-dimas', removedItemIds: [] } },
      }, { step: 1 });
      await userEvent.click(await screen.findByRole('button', { name: 'Change' }));
      await userEvent.click(await screen.findByRole('button', { name: /Mas Dimas/ }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Age at next birthday' }), '22');
      await userEvent.click(screen.getByRole('radio', { name: 'Male' }));
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2'));
      expect(writes(calls)).toEqual([{
        method: 'PATCH', path: '/proposals/p-1',
        body: { leadId: 'l-dimas', client: { age: 22, gender: 'male', details: EMPTY_DETAILS }, expectedVersion: 4 },
      }]);
    });
  });

  describe('step 2, the products (P19.14-T2 AC-1, AC-2, AC-6)', () => {
    it('P19.14-T2 AC-2 opens with the client’s line, which taps back to step 1', async () => {
      show(proposal());
      const line = await screen.findByRole('link', { name: /Ibu Rosa Damayanti · 42 yrs · Female · in Leads/ });
      expect(line).toHaveAttribute('href', '/proposal/p-1?step=1');
    });

    it('P19.14-T2 AC-1 no Konvensional / Syariah switch and no proposal-wide Cara bayar; one catalogue for the client’s age', async () => {
      const { calls } = show(proposal());
      await waitFor(chips);
      expect(screen.queryByRole('group', { name: /Conventional|Syariah/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Payment frequency' })).not.toBeInTheDocument();
      expect(calls.find((c) => c.url.includes('/proposals/catalog'))!.url).toMatch(/catalog\?age=42$/);
      // A syariah product is a product of its own, beside the conventional ones.
      expect(within(chips()).getByRole('button', { name: /PRU Anugerah Syariah/ })).toBeEnabled();
    });

    it('P19.14-T2 AC-2 a search box and chips by category narrow the products; a tick marks one added', async () => {
      show(proposal({ items: [medical] }));
      const group = await screen.findByRole('group', { name: 'Categories' });
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'KESEHATAN', 'DANA PENDIDIKAN', 'JIWA', 'PENYAKIT KRITIS']);
      expect(within(chips()).getByRole('button', { name: /PRUWell Medical/ })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(within(group).getByRole('button', { name: 'JIWA' }));
      expect(within(chips()).getAllByRole('button').map((b) => b.getAttribute('data-product-chip'))).toEqual(['PRUCINTA', 'PRUANUGERAH_SYARIAH', 'PRUSENJA']);
      await userEvent.click(within(group).getByRole('button', { name: 'All' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'cerah');
      expect(within(chips()).getAllByRole('button').map((b) => b.getAttribute('data-product-chip'))).toEqual(['PRUCERAH']);
    });

    it('P19.14-T2 AC-2 a product the client’s age cannot enter is greyed with its range, and cannot be added', async () => {
      const { calls } = show(proposal());
      const senja = await within(await waitFor(chips)).findByRole('button', { name: /PRUSenja/ });
      expect(senja).toBeDisabled();
      expect(senja).toHaveTextContent('Age 42 outside the limit (50–70)');
      expect(senja).toHaveAccessibleDescription('Age 42 outside the limit (50–70)');
      expect(writes(calls)).toEqual([]);
    });

    it('P19.14-T2 AC-2 a second tap on an added product removes it', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'DELETE /proposals/p-1/items/i-med': { body: { ...p, version: 5, items: [] } } });
      await userEvent.click(await within(await waitFor(chips)).findByRole('button', { name: /PRUWell Medical/ }));
      await waitFor(() => expect(panel('PRUWELL_MEDICAL')).toBeNull());
      expect(writes(calls)).toEqual([{ method: 'DELETE', path: '/proposals/p-1/items/i-med?expectedVersion=4', body: undefined }]);
    });

    it('P19.14-T2 AC-6 a KPM with nothing to offer: Belum ada produk — minta Owner menambahkannya, never an error', async () => {
      show(proposal(), { 'GET /proposals/catalog': catalogOf([]) });
      expect(await screen.findByText('No products yet — ask the Owner to add them')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-6 a sixth product cannot be added: the others are disabled, and say why', async () => {
      const five = ['A', 'B', 'C', 'D', 'E'].map((x) => itemOf(product({ productId: `prod-${x}`, code: `P_${x}`, name: `Produk ${x}` }), { itemId: `i-${x}` }));
      show(proposal({ items: five }));
      await screen.findByText('At most 5 products in one proposal.');
      for (const name of ['PRUWell Medical', 'PRUCerah', 'PRUCinta']) {
        expect(within(chips()).getByRole('button', { name: new RegExp(name) })).toBeDisabled();
      }
    });
  });

  describe('a product’s card (P19.14-T2 AC-3, AC-4)', () => {
    it('P19.14-T2 AC-3 the card: category, name and ✕; Tertanggung by the client’s first name, Pasangan, Anak, Orang lain', async () => {
      show(proposal({ items: [medical] }));
      const card = await drawn('PRUWELL_MEDICAL');
      expect(card).toHaveTextContent('KESEHATAN');
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('PRUWell Medical · Gold');
      expect(within(card).getByRole('button', { name: 'Remove PRUWell Medical' })).toBeInTheDocument();
      const insured = within(card).getByRole('group', { name: 'Insured' });
      expect(within(insured).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
        .toEqual([['Rosa', 'true'], ['Spouse', 'false'], ['Child', 'false'], ['Someone else', 'false']]);
    });

    it('P19.14-T2 AC-3 an education product insures Anak, asking a name, an age and L / P on one row', async () => {
      const { calls } = show(proposal({ items: [cerah] }), {
        'PATCH /proposals/p-1/items/i-cerah': { body: proposal({ version: 5, items: [cerah] }) },
      });
      const card = await drawn('PRUCERAH');
      expect(within(within(card).getByRole('group', { name: 'Insured' })).getByRole('button', { name: 'Child' })).toHaveAttribute('aria-pressed', 'true');
      const row = card.querySelector('[data-insured-row]') as HTMLElement;
      expect(within(row).getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
      expect(within(row).getByRole('textbox', { name: 'Age' })).toHaveAttribute('inputMode', 'numeric');
      expect(within(row).getAllByRole('radio').map((r) => [r.textContent, r.getAttribute('aria-label')])).toEqual([['M', 'Male'], ['F', 'Female']]);
      await userEvent.click(within(row).getByRole('radio', { name: 'Female' }));
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-cerah', body: { insured: { relation: 'child', gender: 'female' }, expectedVersion: 4 } },
      ]));
    });

    it('P19.14-T2 AC-3 the product’s own fields in order: chips preselected, one option as text, a money field with its quick amounts', async () => {
      show(proposal({ items: [medical, cerah] }));
      const med = await drawn('PRUWELL_MEDICAL');
      expect([...med.querySelectorAll('[data-field]')].map((f) => f.getAttribute('data-field'))).toEqual(['plan', 'wilayah', 'kamar', 'masa']);
      expect(within(within(med).getByRole('group', { name: 'Plan' })).getByRole('button', { name: 'Gold' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(med).getByText('1 tempat tidur').tagName).toBe('P');
      expect(within(med).getByText('Dilindungi sampai usia 88').tagName).toBe('P');
      // A manual product has no sum assured: the premium alone.
      expect(within(med).queryByRole('textbox', { name: 'Sum assured' })).not.toBeInTheDocument();
      const money = within(panel('PRUCERAH')).getByRole('textbox', { name: 'Penarikan per bulan' });
      expect(money).toHaveAttribute('inputMode', 'numeric');
      expect(within(panel('PRUCERAH')).getAllByRole('button').filter((b) => /100|250/.test(b.textContent ?? ''))).toHaveLength(2);
    });

    it('P19.14-T2 AC-3 a derived plan is text, marked automatic, and never chosen', async () => {
      const derived = product({
        productId: 'prod-d', code: 'DERIVED', name: 'PRUWell Derived',
        fields: [
          { ...MEDICAL.fields[1] },
          { key: 'plan', label: 'Plan', labelSyariah: null, type: 'derived', options: [{ label: 'Bronze A', years: null, currency: null }], default: null, quickAmounts: [], minMinor: null, showOnPdf: true, showOnSummary: true, paymentYears: false, plan: true, currency: false },
        ],
      });
      show(proposal({ items: [itemOf(derived, { itemId: 'i-d', plan: 'Bronze A', fieldValues: { wilayah: 'Indonesia', plan: 'Bronze A' } })] }), {
        'GET /proposals/catalog': catalogOf([derived]),
      });
      const card = await drawn('DERIVED');
      const plan = card.querySelector('[data-field="plan"]') as HTMLElement;
      expect(plan).toHaveTextContent('Bronze A');
      expect(within(plan).getByText('automatic')).toBeInTheDocument();
      expect(within(plan).queryByRole('button')).not.toBeInTheDocument();
    });

    it('P19.14-T2 AC-4 Masa bayar: a term the age does not allow is crossed out and disabled; a tap writes the term', async () => {
      const p = proposal({ client: client({ age: 55 }), items: [itemOf(PCB, { itemId: 'i-pcb' })] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-pcb': { body: { ...p, version: 5 } } });
      const card = await drawn('PRUCRITICAL_BENEFIT_88');
      const terms = within(card).getByRole('group', { name: 'Payment term' });
      expect(within(terms).getAllByRole('button').map((b) => b.textContent)).toEqual(['5 tahun', '10 tahun', '15 tahun', 'Sekali bayar']);
      const fifteen = within(terms).getByRole('button', { name: '15 tahun, Not available above age 50' });
      expect(fifteen).toBeDisabled();
      expect(fifteen.className).toMatch(/line-through/);
      expect(within(terms).getByRole('button', { name: '10 tahun' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(within(terms).getByRole('button', { name: '5 tahun' }));
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-pcb', body: { payTerm: 'y5', expectedVersion: 4 } },
      ]));
    });

    it('P19.14-T2 AC-4 when the server moves the term — the age passed its limit — the card says so in one line', async () => {
      const before = proposal({ items: [itemOf(PCB, { itemId: 'i-pcb', payTerm: 'y15' })] });
      const after = proposal({ version: 5, client: client({ age: 55 }), items: [itemOf(PCB, { itemId: 'i-pcb', payTerm: 'y10' })] });
      show(before, { 'GET /proposals/p-1': [{ body: before }, { body: after }], 'PATCH /proposals/p-1/items/i-pcb': conflict });
      const card = await drawn('PRUCRITICAL_BENEFIT_88');
      // Another device changed the client's age: the proposal is read again, its term moved by the server.
      await userEvent.click(within(card).getByRole('button', { name: '5 tahun' }));
      expect(await screen.findByText('15 tahun is not available at age 55 — changed to 10 tahun.')).toBeInTheDocument();
    });

    it('P19.14-T2 AC-4 Merokok? only on a smoker-rated product, Tidak by default', async () => {
      const p = proposal({ items: [medical, itemOf(PCB, { itemId: 'i-pcb' })] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-pcb': { body: { ...p, version: 5 } } });
      const pcb = await drawn('PRUCRITICAL_BENEFIT_88');
      expect(within(panel('PRUWELL_MEDICAL')).queryByRole('group', { name: 'Smoker?' })).not.toBeInTheDocument();
      const smoker = within(pcb).getByRole('group', { name: 'Smoker?' });
      expect(within(smoker).getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(within(smoker).getByRole('button', { name: 'Yes' }));
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-pcb', body: { smoker: true, expectedVersion: 4 } },
      ]));
    });

    it('P19.14-T2 AC-3 Cara bayar per card: only the product’s frequencies, Bulanan chosen; a change empties that premium and says so', async () => {
      const typed = { ...medical, premium: { amountMinor: 45_000_000, currency: 'IDR' as const } };
      const p = proposal({ items: [typed] });
      const after = { ...p, version: 5, items: [{ ...medical, payFrequency: 'annual' as const }] };
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-med': { body: after } });
      const card = await drawn('PRUWELL_MEDICAL');
      const group = within(card).getByRole('group', { name: 'Payment frequency' });
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Monthly', 'Quarterly', 'Half-yearly', 'Annually']);
      expect(within(group).getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(within(group).getByRole('button', { name: 'Annually' }));
      expect(await screen.findByText('Payment frequency changed — enter the premium again.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Premium per year' })).toHaveValue('');
      expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { payFrequency: 'annual', expectedVersion: 4 } }]);
    });

    it('P19.14-T2 AC-3 a single pay term reads Sekali bayar as text, and a product with one frequency its name', async () => {
      const once = itemOf(PCB, { itemId: 'i-pcb', payTerm: 'single', payFrequency: 'single' });
      const annual = product({ productId: 'prod-a', code: 'ANNUAL', name: 'PRU Prosper', frequencies: ['annual'] });
      show(proposal({ items: [once, itemOf(annual, { itemId: 'i-a', payFrequency: 'annual' })] }), {
        'GET /proposals/catalog': catalogOf([PCB, annual]),
      });
      const pcb = await drawn('PRUCRITICAL_BENEFIT_88');
      expect(within(pcb).queryByRole('group', { name: 'Payment frequency' })).not.toBeInTheDocument();
      expect(pcb.querySelector('[data-pay-frequency]')).toHaveTextContent('Single payment');
      expect(within(pcb).getByRole('textbox', { name: 'Single premium' })).toBeInTheDocument();
      expect(panel('ANNUAL').querySelector('[data-pay-frequency]')).toHaveTextContent('Annually');
    });

    it('P19.14-T2 AC-3 an up_premium product shows the sum assured beside the premium; both typed, saved apart', async () => {
      const p = proposal({ items: [itemOf(PCB, { itemId: 'i-pcb' })] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-pcb': { body: { ...p, version: 5 } } });
      const card = await drawn('PRUCRITICAL_BENEFIT_88');
      const amounts = card.querySelector('[data-amounts]') as HTMLElement;
      expect(amounts.className).toMatch(/grid-cols-2/);
      const up = within(amounts).getByRole('textbox', { name: 'Sum assured' });
      expect(within(amounts).getByRole('textbox', { name: 'Premium per month' })).toBeInTheDocument();
      expect(within(card).getByText('See the official illustration')).toBeInTheDocument();
      await userEvent.type(up, '500000000');
      await userEvent.tab();
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-pcb', body: { up: { amountMinor: 50_000_000_000 }, expectedVersion: 4 } },
      ]));
    });

    it('P19.14-T2 AC-1 a syariah product reads Peserta, Kontribusi and Santunan asuransi on its card', async () => {
      show(proposal({ items: [itemOf(ANUGERAH, { itemId: 'i-an' })] }));
      const card = await drawn('PRUANUGERAH_SYARIAH');
      expect(within(card).getByRole('group', { name: 'Participant' })).toBeInTheDocument();
      expect(within(card).getByRole('textbox', { name: 'Contribution per month' })).toBeInTheDocument();
      expect(within(card).getByRole('textbox', { name: 'Insurance benefit' })).toBeInTheDocument();
    });

    it('P19.14-T2 AC-3 the server’s Total dibayar line under the amounts; none without whole years or a premium', async () => {
      const paid = { ...cerah, premium: { amountMinor: 50_000_000, currency: 'IDR' as const }, totalPaid: { amountMinor: 6_000_000_000, years: 10 } };
      show(proposal({ items: [paid, medical] }));
      await drawn('PRUCERAH');
      expect(panel('PRUCERAH').querySelector('[data-total-paid]')).toHaveTextContent(/^Total paid over 10 years: .*60[.,]000[.,]000/);
      expect(panel('PRUWELL_MEDICAL').querySelector('[data-total-paid]')).toBeNull();
    });

    it('P19.7-T2 AC-7 under a base with riders: Bisa ditambah, and nothing is added', async () => {
      show(proposal({ items: [medical] }));
      await waitFor(() => expect(within(panel('PRUWELL_MEDICAL')).getByText('Can be added:')).toBeInTheDocument());
      expect(panel('PRUWELL_MEDICAL')).toHaveTextContent('Can be added: PRUPersonal Accident');
      expect(within(chips()).queryByRole('button', { name: /PRUPersonal Accident/ })).not.toBeInTheDocument();
    });

    it('P19.14-T2 AC-2 ✕ removes the product from the proposal', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'DELETE /proposals/p-1/items/i-med': { body: { ...p, version: 5, items: [] } } });
      await userEvent.click(await within(await drawn('PRUWELL_MEDICAL')).findByRole('button', { name: 'Remove PRUWell Medical' }));
      await waitFor(() => expect(panel('PRUWELL_MEDICAL')).toBeNull());
      expect(writes(calls)).toEqual([{ method: 'DELETE', path: '/proposals/p-1/items/i-med?expectedVersion=4', body: undefined }]);
    });
  });

  describe('Lihat semua plan and Tanya-jawab', () => {
    it('P19.7-T2 AC-8 one card per plan, stacked, cheapest first, Paling banyak dipilih on the owner’s; a tap chooses it', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-med': { body: { ...p, version: 5 } } });
      await userEvent.click(await within(await drawn('PRUWELL_MEDICAL')).findByRole('button', { name: 'See all plans' }));
      const sheet = await screen.findByRole('dialog', { name: 'PRUWell Medical plans' });
      const list = sheet.querySelector('[data-plan-cards]') as HTMLElement;
      expect(list.className).toMatch(/flex-col/);
      expect(sheet.querySelector('table')).toBeNull();
      const plans = within(list).getAllByRole('button');
      expect(plans.map((b) => b.textContent?.split('Kamar')[0])).toEqual(['Bronze', 'Silver', 'GoldMost chosenChosen']);
      expect(within(plans[2]).getByText('Premium: see the official illustration')).toBeInTheDocument();
      await userEvent.click(plans[1]);
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { fieldValues: { plan: 'Silver' }, expectedVersion: 4 } },
      ]));
    });

    it('P19.7-T2 AC-9 Tanya-jawab shows the product’s FAQ to the agent, and is hidden where it has none', async () => {
      show(proposal({ items: [medical, cerah] }));
      await drawn('PRUCERAH');
      expect(within(panel('PRUCERAH')).queryByRole('button', { name: 'Q&A' })).not.toBeInTheDocument();
      await userEvent.click(await within(panel('PRUWELL_MEDICAL')).findByRole('button', { name: 'Q&A' }));
      const sheet = await screen.findByRole('dialog', { name: 'PRUWell Medical — Q&A' });
      expect(sheet).toHaveTextContent('Apakah ada masa tunggu?');
    });
  });

  describe('a view-only session (P19.14-T1 AC-6)', () => {
    it('P19.14-T1 AC-6 the Super Admin opens a proposal and every control is disabled', async () => {
      show(proposal({ items: [medical, itemOf(PCB, { itemId: 'i-pcb' })] }), {}, { me: VIEWING_RINA });
      const premium = (await screen.findAllByRole('textbox', { name: 'Premium per month' }))[0];
      expect(premium).toBeDisabled();
      expect(within(chips()).getByRole('button', { name: /PRUCerah/ })).toBeDisabled();
      expect(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Silver' })).toBeDisabled();
      expect(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Annually' })).toBeDisabled();
      expect(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Remove PRUWell Medical' })).toBeDisabled();
      expect(within(panel('PRUCRITICAL_BENEFIT_88')).getByRole('button', { name: 'Yes' })).toBeDisabled();
      expect(within(panel('PRUCRITICAL_BENEFIT_88')).getByRole('textbox', { name: 'Sum assured' })).toBeDisabled();
    });
  });
});

/**
 * **The result, the PDF** (P19.7-T3 AC-1 to AC-3; *P19.14-T1 AC-1: the result, not a step* — `?step=pdf`, and an
 * address of before, `?step=3`; Acc. 15, 19, 20, 22; ADR-0222 §4, §5): the file's own pages, *Simpan PDF* — *Selesai*
 * first, then the same bytes saved, then the share sheet — *Ubah*, and *Tampilkan total*.
 */
describe('/proposal/[proposalId] the result (P19.7-T3, P19.14-T1)', () => {
  const FILE = new Blob(['%PDF-1.3 the proposal'], { type: 'application/pdf' });
  const medicalDone = itemOf(MEDICAL, { itemId: 'i-med', plan: 'Gold', premium: { amountMinor: 125_000_000, currency: 'IDR' } });
  const ready = (over: Partial<Proposal> = {}) => proposal({ items: [medicalDone], ...over });
  const pdfCalls = (calls: { url: string }[]) => calls.filter((c) => new URL(c.url).pathname.endsWith('/proposals/p-1/pdf'));

  beforeEach(() => {
    nav.push.mockReset();
    pdf.opened.length = 0;
    pdf.saved.length = 0;
    pdf.open.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T3 AC-1 Acc. 15 shows the PDF’s pages themselves: the file the API built, every page drawn', async () => {
    const { calls } = show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 'pdf' });
    expect(await screen.findByRole('heading', { level: 2, name: 'The proposal' })).toBeInTheDocument();
    // The result, not a step: both pills ticked, neither current.
    const steps = screen.getByRole('list', { name: 'Steps' });
    expect(within(steps).queryAllByRole('listitem').filter((li) => li.getAttribute('aria-current'))).toEqual([]);
    const pages = await screen.findByRole('group', { name: 'The proposal’s pages' });
    expect(await within(pages).findByRole('img', { name: 'Page 1 of 2' })).toBeInTheDocument();
    expect(within(pages).getByRole('img', { name: 'Page 2 of 2' })).toBeInTheDocument();
    // The words of each page, for a screen reader.
    await waitFor(() => expect(pages).toHaveTextContent('Proposal untuk Bapak/Ibu Ibu Rosa Damayanti'));
    expect(pdfCalls(calls)).toHaveLength(1);
    expect(pdf.open).toHaveBeenCalledTimes(1);
  });

  it('P19.7-T3 AC-2 Acc. 20 Simpan PDF: Selesai first, then the same bytes saved under the file’s name, fetched once', async () => {
    const done = ready({ status: 'done', version: 5, fileName: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf' });
    const { calls } = show(ready(), {
      'GET /proposals/p-1/pdf': { body: FILE },
      'POST /proposals/p-1/done': { body: done },
    }, { step: 'pdf' });
    const save = await screen.findByRole('button', { name: 'Save PDF' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(pdf.saved).toHaveLength(1));
    expect(writes(calls)).toEqual([{ method: 'POST', path: '/proposals/p-1/done', body: { expectedVersion: 4 } }]);
    expect(pdf.saved[0].name).toBe('Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf');
    // The very blob the step drew: nothing fetched a second time.
    expect(pdf.saved[0].blob).toBe(FILE);
    expect(pdfCalls(calls)).toHaveLength(1);
  });

  it('P19.7-T3 AC-2 opens the phone’s share sheet with the same file where it has one; a cancel is silent', async () => {
    const share = vi.fn(async () => { throw new DOMException('cancelled', 'AbortError'); });
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { canShare: () => true, share }));
    show(ready(), {
      'GET /proposals/p-1/pdf': { body: FILE },
      'POST /proposals/p-1/done': { body: ready({ status: 'done', version: 5 }) },
    }, { step: 'pdf' });
    const save = await screen.findByRole('button', { name: 'Save PDF' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files }] = share.mock.calls[0] as unknown as [{ files: File[] }];
    expect([files[0].name, files[0].type]).toEqual(['Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf', 'application/pdf']);
    expect(pdf.saved).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('P19.7-T3 AC-2 a refused Simpan PDF saves nothing and says what is missing', async () => {
    show(ready(), {
      'GET /proposals/p-1/pdf': { body: FILE },
      'POST /proposals/p-1/done': {
        status: 422,
        body: { error: { code: 'PROPOSAL_INCOMPLETE', message: 'Fill in what is still empty before saving the PDF.', details: { items: [] } } },
      },
    }, { step: 'pdf' });
    const save = await screen.findByRole('button', { name: 'Save PDF' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    expect(await screen.findByText('Fill in what is still empty before saving the PDF.')).toBeInTheDocument();
    expect(pdf.saved).toEqual([]);
  });

  it('P19.14-T1 AC-1 Tampilkan total is one switch, off by default: a change is saved, then the pages fetched again', async () => {
    const { calls } = show(ready(), {
      'GET /proposals/p-1/pdf': { body: FILE },
      'PATCH /proposals/p-1': { body: { ...ready({ showTotal: true, version: 5 }), removedItemIds: [] } },
    }, { step: 'pdf' });
    const toggle = await screen.findByRole('switch', { name: 'Show total' });
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(pdfCalls(calls)).toHaveLength(1));
    await userEvent.click(toggle);
    await waitFor(() => expect(pdfCalls(calls)).toHaveLength(2));
    expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/proposals/p-1', body: { showTotal: true, expectedVersion: 4 } }]);
    expect(screen.getByRole('switch', { name: 'Show total' })).toBeChecked();
  });

  it('P19.7-T3 AC-2 Ubah goes back to step 2, and Kembali too', async () => {
    show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 'pdf' });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal/p-1?step=2');
  });

  it('P19.7-T3 AC-3 Acc. 19 offers no send button, no WhatsApp and no link to the proposal', async () => {
    show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 'pdf' });
    await screen.findByRole('img', { name: 'Page 1 of 2' });
    const step = document.querySelector('[data-proposal-pdf]') as HTMLElement;
    expect(within(step).queryAllByRole('link')).toEqual([]);
    expect(within(step).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Save PDF']);
    expect(document.body.innerHTML).not.toMatch(/wa\.me|whatsapp|mailto:|Kirim|Send/i);
  });

  it('P19.7-T2 AC-14 Acc. 22 in a view-only session draws no page, fetches no file, and Simpan PDF is disabled with the reason', async () => {
    const { calls } = show(ready(), {}, { step: 'pdf', me: VIEWING_RINA });
    const reason = await screen.findByText('The PDF preview is not available in a view-only session.');
    const save = screen.getByRole('button', { name: 'Save PDF' });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('aria-describedby', reason.id);
    expect(screen.getByRole('switch', { name: 'Show total' })).toBeDisabled();
    expect(pdfCalls(calls)).toEqual([]);
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('P19.7-T3 AC-1 a file that did not arrive says so, and Coba lagi asks again', async () => {
    const { calls } = show(ready(), { 'GET /proposals/p-1/pdf': [serverError, { body: FILE }] }, { step: 'pdf' });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: 'Page 1 of 2' })).toBeInTheDocument();
    expect(pdfCalls(calls)).toHaveLength(2);
  });

  it('P19.14-T1 AC-1 an address saved before — ?step=3 — still opens the result', async () => {
    show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 3 });
    expect(await screen.findByRole('switch', { name: 'Show total' })).toBeInTheDocument();
  });
});
