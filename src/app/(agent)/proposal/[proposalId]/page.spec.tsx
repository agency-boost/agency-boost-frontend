import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  CATALOG, CERAH, CINTA, conflict, itemOf, lead, MEDICAL, product, proposal, RINA, ROSA, serverError, SHELL,
  VIEWING_RINA,
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

function show(p: Proposal, routes: Routes = {}, { me = RINA, step = 2 }: { me?: typeof RINA; step?: 1 | 2 | 3 } = {}) {
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
/** The panel's own header button, which opens and closes it. */
const header = (code: string) => panel(code).querySelector('button[aria-expanded]') as HTMLElement;
const cards = () => screen.getByRole('list', { name: 'Products' });

/**
 * **`/proposal/[proposalId]`, the steps of a stored proposal** (P19.7-T2 AC-2, AC-5 to AC-9, AC-14, AC-16; Acc. 7, 10–14,
 * 17, 18, 21; ADR-0221 §3, §9; ADR-0225 §6–§8): every change saved, pinned; the settings; the cards; a product's panel;
 * the plans and the FAQ; the PDF's step as its placeholder.
 */
describe('/proposal/[proposalId] (P19.7-T2)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  describe('the flow (AC-2)', () => {
    it('P19.7-T2 AC-2 the progress bar on step 2, Kembali to step 1, Lanjut to step 3', async () => {
      show(proposal());
      const steps = await screen.findByRole('list', { name: 'Steps' });
      expect(within(steps).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal/p-1?step=1');
      await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
      expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=3');
    });

    it('P19.7-T2 AC-2 every change saves the draft, each write pinned to the version the last one answered', async () => {
      const added = proposal({ version: 5, items: [medical] });
      const { calls } = show(proposal(), {
        'POST /proposals/p-1/items': { status: 201, body: added },
        'PATCH /proposals/p-1/items/i-med': { body: { ...added, version: 6 } },
      });
      await userEvent.click(await screen.findByRole('button', { name: /PRUWell Medical/ }));
      await waitFor(() => expect(panel('PRUWELL_MEDICAL')).not.toBeNull());
      await userEvent.click(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Silver' }));
      await waitFor(() => expect(writes(calls)).toHaveLength(2));
      expect(writes(calls)).toEqual([
        { method: 'POST', path: '/proposals/p-1/items', body: { expectedVersion: 4, productId: 'prod-medical' } },
        { method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { fieldValues: { plan: 'Silver' }, expectedVersion: 5 } },
      ]);
    });

    it('P19.7-T2 AC-2 a typed premium is saved, in minor units, as it is typed and on leaving the box', async () => {
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
      await userEvent.click(within(await drawn('PRUWELL_MEDICAL')).getByRole('button', { name: 'Silver' }));
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
      await waitFor(() => expect(screen.queryByText('Not saved yet. Try again.')).not.toBeInTheDocument());
    });

    it('P19.7-T2 AC-13 another member’s proposal is the API’s 404, shown as the step’s error', async () => {
      show(proposal(), {
        'GET /proposals/p-1': { status: 404, body: { error: { code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found.', requestId: 'r-1' } } },
      });
      expect(await screen.findByRole('alert')).toHaveTextContent('Proposal not found.');
    });
  });

  describe('step 1 on a stored proposal (AC-3)', () => {
    it('P19.7-T2 AC-3 another lead takes the client’s copy again, after asking when its age takes products out', async () => {
      const young = lead({ id: 'l-young', name: 'Mas Dimas', age: 22, gender: 'male' });
      const p = proposal({ items: [medical] });
      const { calls } = show(p, {
        'GET /leads?': { body: { rows: [ROSA, young], total: 2, page: 1, pageSize: 50 } },
        'GET /proposals/catalog': ({ url }) => (url.includes('age=22') ? catalogOf([CINTA]) : catalogOf()),
        'PATCH /proposals/p-1': { body: { ...p, version: 5, leadId: 'l-young', items: [], removedItemIds: ['i-med'] } },
      }, { step: 1 });
      expect(await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ })).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(screen.getByRole('radio', { name: /Mas Dimas/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      const ask = await screen.findByRole('dialog', { name: '1 product is not available for this choice and will be removed.' });
      await userEvent.click(within(ask).getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2'));
      expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/proposals/p-1', body: { leadId: 'l-young', expectedVersion: 4 } }]);
    });

    it('P19.7-T2 AC-3 the same lead, unchanged, writes nothing: a finished proposal stays Selesai', async () => {
      const { calls } = show(proposal({ status: 'done' }), {
        'GET /leads?': { body: { rows: [ROSA], total: 1, page: 1, pageSize: 50 } },
      }, { step: 1 });
      await screen.findByRole('radio', { name: /Ibu Rosa Damayanti/ });
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2'));
      expect(writes(calls)).toEqual([]);
    });
  });

  describe('step 2’s settings (AC-5)', () => {
    it('P19.7-T2 AC-5 Konvensional / Syariah, two large buttons; a switch that keeps every product writes at once', async () => {
      const p = proposal({ items: [itemOf(CINTA, { itemId: 'i-cinta' })] });
      const { calls } = show(p, {
        'GET /proposals/catalog': ({ url }) => (url.includes('syariah') ? catalogOf([CINTA]) : catalogOf()),
        'PATCH /proposals/p-1': { body: { ...p, version: 5, channel: 'syariah', removedItemIds: [] } },
      });
      const group = await screen.findByRole('group', { name: 'Conventional or Syariah' });
      expect(within(group).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
        .toEqual([['Conventional', 'true'], ['Syariah', 'false']]);
      expect(within(group).getByRole('button', { name: 'Syariah' }).className).toMatch(/min-h-14/);
      await userEvent.click(within(group).getByRole('button', { name: 'Syariah' }));
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1', body: { channel: 'syariah', expectedVersion: 4 } },
      ]));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-5 a switch that would take a product out asks first; Batal writes nothing, Lanjut writes', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, {
        'GET /proposals/catalog': ({ url }) => (url.includes('syariah') ? catalogOf([CINTA]) : catalogOf()),
        'PATCH /proposals/p-1': { body: { ...p, version: 5, channel: 'syariah', items: [], removedItemIds: ['i-med'] } },
      });
      const syariah = await screen.findByRole('button', { name: 'Syariah' });
      await userEvent.click(syariah);
      let ask = await screen.findByRole('dialog', { name: '1 product is not available for this choice and will be removed.' });
      await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(writes(calls)).toEqual([]);
      await userEvent.click(syariah);
      ask = await screen.findByRole('dialog', { name: /1 product is not available/ });
      await userEvent.click(within(ask).getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1', body: { channel: 'syariah', expectedVersion: 4 } },
      ]));
    });

    it('P19.7-T2 AC-5 on a Syariah proposal Premi is Kontribusi, and a field takes its syariah label', async () => {
      show(proposal({ channel: 'syariah', items: [cerah] }));
      expect(await screen.findByRole('textbox', { name: 'Contribution per month' })).toBeInTheDocument();
      expect(within(panel('PRUCERAH')).getByText('Penarikan dana per bulan')).toBeInTheDocument();
      expect(within(panel('PRUCERAH')).queryByText('Penarikan per bulan')).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-5 Cara bayar: Bulanan first and chosen; a change relabels the premium and says the premiums are emptied', async () => {
      const p = proposal({ items: [{ ...medical, premium: { amountMinor: 45_000_000, currency: 'IDR' } }] });
      const after = { ...p, version: 5, payFrequency: 'annual' as const, items: [medical], removedItemIds: [] };
      const { calls } = show(p, { 'PATCH /proposals/p-1': { body: after } });
      const group = await screen.findByRole('group', { name: 'Payment frequency' });
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Monthly', 'Quarterly', 'Half-yearly', 'Annually']);
      expect(within(group).getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('textbox', { name: 'Premium per month' })).toHaveValue('450000');
      await userEvent.click(within(group).getByRole('button', { name: 'Annually' }));
      expect(await screen.findByText('Payment frequency changed — enter the premiums again.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Premium per year' })).toHaveValue('');
      expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/proposals/p-1', body: { payFrequency: 'annual', expectedVersion: 4 } }]);
    });
  });

  describe('step 2’s cards (AC-6)', () => {
    it('P19.7-T2 AC-6 the products offered for this channel and age, as large cards with an icon; a tick on one added', async () => {
      const { calls } = show(proposal({ items: [medical] }));
      await waitFor(() => expect(within(cards()).getAllByRole('button')).toHaveLength(3));
      const card = within(cards()).getByRole('button', { name: /PRUWell Medical/ });
      expect(card).toHaveAttribute('aria-pressed', 'true');
      expect(card).toHaveTextContent('KESEHATAN');
      expect(within(card).getByText('Added')).toHaveClass('sr-only');
      expect(card.querySelector('svg')).not.toBeNull();
      expect(within(cards()).getByRole('button', { name: /PRUCerah/ })).toHaveAttribute('aria-pressed', 'false');
      expect(calls.find((c) => c.url.includes('/proposals/catalog'))!.url).toMatch(/channel=conventional&age=42$/);
    });

    it('P19.7-T2 AC-6 a KPM with nothing to offer: Belum ada produk — minta Owner menambahkannya, never an error', async () => {
      show(proposal(), { 'GET /proposals/catalog': catalogOf([]) });
      expect(await screen.findByText('No products yet — ask the Owner to add them')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-6 a sixth product cannot be added: the other cards are disabled, and say why', async () => {
      const five = ['A', 'B', 'C', 'D', 'E'].map((x) => itemOf(product({ productId: `prod-${x}`, code: `P_${x}`, name: `Produk ${x}` }), { itemId: `i-${x}` }));
      show(proposal({ items: five }));
      await screen.findByText('At most 5 products in one proposal.');
      for (const name of ['PRUWell Medical', 'PRUCerah', 'PRUCinta']) {
        expect(within(cards()).getByRole('button', { name: new RegExp(name) })).toBeDisabled();
      }
    });
  });

  describe('a product’s panel (AC-7)', () => {
    it('P19.7-T2 AC-7 Tertanggung first: an education product insures Anak, and asks a name and an age on one line', async () => {
      const { calls } = show(proposal({ items: [cerah] }), {
        'PATCH /proposals/p-1/items/i-cerah': { body: proposal({ version: 5, items: [cerah] }) },
      });
      const insured = await screen.findByRole('group', { name: 'Insured' });
      expect(within(insured).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
        .toEqual([['Client', 'false'], ['Spouse', 'false'], ['Child', 'true'], ['Someone else', 'false']]);
      const name = within(panel('PRUCERAH')).getByRole('textbox', { name: 'Name' });
      const age = within(panel('PRUCERAH')).getByRole('textbox', { name: 'Age' });
      expect(age).toHaveAttribute('inputMode', 'numeric');
      // First in the panel: before the product's own fields.
      expect(insured.compareDocumentPosition(screen.getByRole('group', { name: 'Masa tunggu' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await userEvent.type(name, 'Kirana');
      await userEvent.type(age, '7');
      await userEvent.tab();
      // Each part is saved as it is left; the last write carries both, pinned to the version the one before answered.
      await waitFor(() => expect(writes(calls).at(-1)).toMatchObject({
        method: 'PATCH', path: '/proposals/p-1/items/i-cerah',
        body: { insured: { relation: 'child', name: 'Kirana', age: 7 } },
      }));
    });

    it('P19.7-T2 AC-7 Klien asks nothing more; choosing it saves the relation', async () => {
      const { calls } = show(proposal({ items: [cerah] }), {
        'PATCH /proposals/p-1/items/i-cerah': { body: proposal({ version: 5, items: [{ ...cerah, insured: { relation: 'client', name: null, age: null } }] }) },
      });
      await userEvent.click(within(await screen.findByRole('group', { name: 'Insured' })).getByRole('button', { name: 'Client' }));
      await waitFor(() => expect(within(panel('PRUCERAH')).queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument());
      expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-cerah', body: { insured: { relation: 'client' }, expectedVersion: 4 } },
      ]);
    });

    it('P19.7-T2 AC-7 the product’s own fields in order: chips preselected, one option as text, a money field with its quick amounts', async () => {
      show(proposal({ items: [medical, cerah] }));
      await waitFor(() => expect(panel('PRUCERAH')).not.toBeNull());
      // The last added is open; the other opens on a tap.
      await userEvent.click(header('PRUWELL_MEDICAL'));
      const med = panel('PRUWELL_MEDICAL');
      expect([...med.querySelectorAll('[data-field]')].map((f) => f.getAttribute('data-field'))).toEqual(['plan', 'wilayah', 'kamar', 'masa']);
      expect(within(within(med).getByRole('group', { name: 'Plan' })).getByRole('button', { name: 'Gold' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(within(med).getByRole('group', { name: 'Wilayah' })).getByRole('button', { name: 'Indonesia' })).toHaveAttribute('aria-pressed', 'true');
      // A single option, and a fixed field: plain text, nothing to choose. A health product has no sum assured.
      expect(within(med).getByText('1 tempat tidur').tagName).toBe('P');
      expect(within(med).queryByRole('button', { name: '1 tempat tidur' })).not.toBeInTheDocument();
      expect(within(med).getByText('Dilindungi sampai usia 88').tagName).toBe('P');
      expect(within(med).queryByText(/Uang pertanggungan/)).not.toBeInTheDocument();
      // PRUCerah asks Masa tunggu and Penarikan per bulan; the money field opens the keypad, with its quick amounts.
      await userEvent.click(header('PRUCERAH'));
      const money = within(panel('PRUCERAH')).getByRole('textbox', { name: 'Penarikan per bulan' });
      expect(money).toHaveAttribute('inputMode', 'numeric');
      expect(within(panel('PRUCERAH')).getAllByRole('button').filter((b) => /100|250/.test(b.textContent ?? ''))).toHaveLength(2);
    });

    it('P19.7-T2 AC-7 Premi per {cara bayar} last, with Lihat di ilustrasi resmi, and the server’s Total dibayar line', async () => {
      const paid = { ...cerah, premium: { amountMinor: 50_000_000, currency: 'IDR' as const }, totalPaid: { amountMinor: 6_000_000_000, years: 10 } };
      show(proposal({ items: [paid] }));
      const box = await screen.findByRole('textbox', { name: 'Premium per month' });
      const fields = panel('PRUCERAH').querySelectorAll('[data-field]');
      expect(fields[fields.length - 1].compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(panel('PRUCERAH')).getByText('See the official illustration')).toBeInTheDocument();
      expect(panel('PRUCERAH').querySelector('[data-total-paid]')).toHaveTextContent(/^Total paid over 10 years: .*60\.000\.000|60,000,000/);
    });

    it('P19.7-T2 AC-7 no Total dibayar line where the term is not a whole number of years, or there is no premium yet', async () => {
      show(proposal({ items: [cerah] }));
      await screen.findByRole('textbox', { name: 'Premium per month' });
      expect(panel('PRUCERAH').querySelector('[data-total-paid]')).toBeNull();
    });

    it('P19.7-T2 AC-7 under a base with riders: Bisa ditambah, and nothing is added', async () => {
      show(proposal({ items: [medical] }));
      await waitFor(() => expect(within(panel('PRUWELL_MEDICAL')).getByText('Can be added:')).toBeInTheDocument());
      expect(panel('PRUWELL_MEDICAL')).toHaveTextContent('Can be added: PRUPersonal Accident');
      expect(within(cards()).queryByRole('button', { name: /PRUPersonal Accident/ })).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-7 a product is removed from the proposal by its own button', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'DELETE /proposals/p-1/items/i-med': { body: { ...p, version: 5, items: [] } } });
      await userEvent.click(within(await drawn('PRUWELL_MEDICAL')).getByRole('button', { name: 'Remove PRUWell Medical' }));
      await waitFor(() => expect(panel('PRUWELL_MEDICAL')).toBeNull());
      expect(writes(calls)).toEqual([{ method: 'DELETE', path: '/proposals/p-1/items/i-med?expectedVersion=4', body: undefined }]);
    });
  });

  describe('Lihat semua plan and Tanya-jawab (AC-8, AC-9)', () => {
    it('P19.7-T2 AC-8 one card per plan, stacked, cheapest first, Paling banyak dipilih on the owner’s; a tap chooses it', async () => {
      const p = proposal({ items: [medical] });
      const { calls } = show(p, { 'PATCH /proposals/p-1/items/i-med': { body: { ...p, version: 5 } } });
      await userEvent.click(within(await drawn('PRUWELL_MEDICAL')).getByRole('button', { name: 'See all plans' }));
      const sheet = await screen.findByRole('dialog', { name: 'PRUWell Medical plans' });
      const list = sheet.querySelector('[data-plan-cards]') as HTMLElement;
      expect(list.className).toMatch(/flex-col/);
      expect(sheet.querySelector('table')).toBeNull();
      const plans = within(list).getAllByRole('button');
      expect(plans.map((b) => b.textContent?.split('Kamar')[0])).toEqual(['Bronze', 'Silver', 'GoldMost chosenChosen']);
      expect(within(plans[2]).getByText('Premium: see the official illustration')).toBeInTheDocument();
      expect(plans[2]).toHaveTextContent('Wilayah');
      await userEvent.click(plans[1]);
      await waitFor(() => expect(writes(calls)).toEqual([
        { method: 'PATCH', path: '/proposals/p-1/items/i-med', body: { fieldValues: { plan: 'Silver' }, expectedVersion: 4 } },
      ]));
    });

    it('P19.7-T2 AC-9 Tanya-jawab shows the product’s FAQ to the agent, and is hidden where it has none', async () => {
      show(proposal({ items: [medical, cerah] }));
      await waitFor(() => expect(panel('PRUCERAH')).not.toBeNull());
      expect(within(panel('PRUCERAH')).queryByRole('button', { name: 'Q&A' })).not.toBeInTheDocument();
      await userEvent.click(header('PRUWELL_MEDICAL'));
      await userEvent.click(await within(panel('PRUWELL_MEDICAL')).findByRole('button', { name: 'Q&A' }));
      const sheet = await screen.findByRole('dialog', { name: 'PRUWell Medical — Q&A' });
      expect(sheet).toHaveTextContent('Apakah ada masa tunggu?');
      expect(sheet).toHaveTextContent('Ada, 30 hari untuk sakit biasa.');
    });
  });

  describe('the look, a view-only session and the PDF’s step', () => {
    it('P19.7-T2 AC-16 Lanjut is the main action, a floating pill; selected chips in the selection colour; pill fields', async () => {
      show(proposal({ items: [medical] }));
      const next = await screen.findByRole('button', { name: 'Next' });
      expect(next.closest('[data-floating-bar]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Monthly' }).className).toMatch(/bg-secondary/);
      expect(screen.getByRole('textbox', { name: 'Premium per month' }).parentElement!.className).toMatch(/rounded-pill/);
      // A title row, no dark app bar: the page's own heading.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Proposal$/);
    });

    it('P19.7-T2 AC-14 in a view-only session the Super Admin opens a proposal and every control is disabled', async () => {
      show(proposal({ items: [medical] }), {}, { me: VIEWING_RINA });
      const premium = await screen.findByRole('textbox', { name: 'Premium per month' });
      expect(premium).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Syariah' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Annually' })).toBeDisabled();
      expect(within(cards()).getByRole('button', { name: /PRUCerah/ })).toBeDisabled();
      expect(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Silver' })).toBeDisabled();
      expect(within(panel('PRUWELL_MEDICAL')).getByRole('button', { name: 'Remove PRUWell Medical' })).toBeDisabled();
      // Reading on is not writing: *Lanjut* still walks to the next step.
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

  });
});

/**
 * **Step 3, *Lihat PDF*** (P19.7-T3 AC-1 to AC-3; Acc. 15, 19, 20, 22; ADR-0222 §4, §5): the file's own pages, *Simpan
 * PDF* — *Selesai* first, then the same bytes saved, then the share sheet — *Ubah*, and *Tampilkan total premi*.
 */
describe('/proposal/[proposalId] step 3 (P19.7-T3)', () => {
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
    const { calls } = show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 3 });
    expect(await screen.findByRole('heading', { level: 2, name: 'See the PDF' })).toBeInTheDocument();
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
    }, { step: 3 });
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
    }, { step: 3 });
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
    }, { step: 3 });
    const save = await screen.findByRole('button', { name: 'Save PDF' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    expect(await screen.findByText('Fill in what is still empty before saving the PDF.')).toBeInTheDocument();
    expect(pdf.saved).toEqual([]);
  });

  it('P19.7-T3 AC-2 Tampilkan total premi is one switch, off by default: a change is saved, then the pages fetched again', async () => {
    const { calls } = show(ready(), {
      'GET /proposals/p-1/pdf': { body: FILE },
      'PATCH /proposals/p-1': { body: { ...ready({ showTotal: true, version: 5 }), removedItemIds: [] } },
    }, { step: 3 });
    const toggle = await screen.findByRole('switch', { name: 'Show total premium' });
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(pdfCalls(calls)).toHaveLength(1));
    await userEvent.click(toggle);
    await waitFor(() => expect(pdfCalls(calls)).toHaveLength(2));
    expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/proposals/p-1', body: { showTotal: true, expectedVersion: 4 } }]);
    expect(screen.getByRole('switch', { name: 'Show total premium' })).toBeChecked();
  });

  it('P19.7-T3 AC-2 Ubah goes back to step 2, and Kembali too', async () => {
    show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 3 });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(nav.push).toHaveBeenCalledWith('/proposal/p-1?step=2');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/proposal/p-1?step=2');
  });

  it('P19.7-T3 AC-3 Acc. 19 offers no send button, no WhatsApp and no link to the proposal', async () => {
    show(ready(), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 3 });
    await screen.findByRole('img', { name: 'Page 1 of 2' });
    const step = document.querySelector('[data-proposal-pdf]') as HTMLElement;
    expect(within(step).queryAllByRole('link')).toEqual([]);
    expect(within(step).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Save PDF']);
    expect(document.body.innerHTML).not.toMatch(/wa\.me|whatsapp|mailto:|Kirim|Send/i);
  });

  it('P19.7-T2 AC-14 Acc. 22 in a view-only session draws no page, fetches no file, and Simpan PDF is disabled with the reason', async () => {
    const { calls } = show(ready(), {}, { step: 3, me: VIEWING_RINA });
    const reason = await screen.findByText('The PDF preview is not available in a view-only session.');
    const save = screen.getByRole('button', { name: 'Save PDF' });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('aria-describedby', reason.id);
    expect(screen.getByRole('switch', { name: 'Show total premium' })).toBeDisabled();
    expect(pdfCalls(calls)).toEqual([]);
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('P19.7-T3 AC-1 a file that did not arrive says so, and Coba lagi asks again', async () => {
    const { calls } = show(ready(), { 'GET /proposals/p-1/pdf': [serverError, { body: FILE }] }, { step: 3 });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: 'Page 1 of 2' })).toBeInTheDocument();
    expect(pdfCalls(calls)).toHaveLength(2);
  });

  it('P19.7-T2 AC-5 on a Syariah proposal the switch reads Tampilkan total kontribusi', async () => {
    show(ready({ channel: 'syariah' }), { 'GET /proposals/p-1/pdf': { body: FILE } }, { step: 3 });
    expect(await screen.findByRole('switch', { name: 'Show total contribution' })).toBeInTheDocument();
  });
});
