import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { proposal, RINA, row, SHELL, VIEWING_RINA } from '@test/proposal-fixtures';
import ProposalPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
const saved = vi.hoisted(() => [] as { blob: Blob; name: string }[]);
vi.mock('@/lib/save-file', () => ({ saveFile: (blob: Blob, name: string) => { saved.push({ blob, name }); } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/proposal',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

function show(routes: Routes = {}, me = RINA) {
  const stub = stubFetch({ ...SHELL, 'GET /proposals?': { body: { rows: [row()], total: 1, page: 1, pageSize: 20 } }, ...routes });
  renderInLayout(AgentLayout, <ProposalPage />, { me });
  return stub;
}

const empty = { body: { rows: [], total: 0, page: 1, pageSize: 20 } };

/**
 * **`/proposal`, *Riwayat*** (P19.7-T2 AC-1, AC-10, AC-14, AC-16; ADR-0221 §5, §8): the reader's own proposals, the Sales
 * tools strip's third tab, *Buat proposal pertama* with nothing saved, open · duplicate · delete.
 */
describe('/proposal, Riwayat (P19.7-T2)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T2 AC-1 sits in Aktivitas → Sales, as the Sales tools strip’s third tab, current here', async () => {
    show();
    await screen.findByText('Ibu Rosa Damayanti');
    const tabs = screen.getByRole('navigation', { name: 'Sales tools' });
    expect(within(tabs).getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href'), l.getAttribute('aria-current')]))
      .toEqual([
        ['Sales Attack Plan', '/attack-plan', null], ['Product Catalog', '/product-catalog', null], ['Proposal', '/proposal', 'page'],
      ]);
    const sales = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Sales' });
    expect(sales).toHaveAttribute('aria-current', 'page');
  });

  it('P19.7-T2 AC-1 with nothing saved: one large button, Buat proposal pertama, and never an error', async () => {
    show({ 'GET /proposals?': empty });
    const first = await screen.findByRole('link', { name: 'Make your first proposal' });
    expect(first).toHaveAttribute('href', '/proposal/new');
    expect(first.className).toMatch(/min-h-14/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('P19.7-T2 AC-10 lists each proposal’s client, date, products with their plan and its status, its own only', async () => {
    const { calls } = show({
      'GET /proposals?': {
        body: {
          rows: [row(), row({ id: 'p-2', client: { name: 'Pak Hendro Gunawan' }, status: 'draft', products: [], date: '2026-11-04' })],
          total: 2, page: 1, pageSize: 20,
        },
      },
    });
    const list = await screen.findByRole('list', { name: 'History' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Ibu Rosa Damayanti');
    expect(first).toHaveTextContent('PRUWell Medical · Gold, PRUCinta');
    expect(within(first).getByText('Done')).toHaveAttribute('data-tone', 'green');
    expect(first).toHaveTextContent(/5 Nov 2026/);
    expect(within(second).getByText('Draft')).toHaveAttribute('data-tone', 'grey');
    expect(within(first).getAllByRole('link')[0]).toHaveAttribute('href', '/proposal/p-1?step=3');
    expect(within(second).getAllByRole('link')[0]).toHaveAttribute('href', '/proposal/p-2?step=2');
    // The reader's own: the list asks no owner — the server answers nobody else's (ADR-0221 §2).
    expect(calls.find((c) => c.url.includes('/proposals?'))!.url).not.toMatch(/owner=/);
  });

  it('P19.7-T2 AC-10 searches over the client and the products on the server', async () => {
    const { calls } = show({ 'GET /proposals?': [{ body: { rows: [row()], total: 1, page: 1, pageSize: 20 } }, empty] });
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search proposals' }), 'Hendro');
    await waitFor(() => expect(calls.some((c) => c.url.includes('search=Hendro'))).toBe(true));
    expect(await screen.findByText('No proposals match “Hendro”.')).toBeInTheDocument();
  });

  it('P19.7-T2 AC-10 duplicates a proposal into a new draft and opens its products', async () => {
    const { calls } = show({
      'POST /proposals/p-1/duplicate': { status: 201, body: { ...proposal({ id: 'p-9' }), droppedProductIds: [] } },
    });
    await screen.findByText('Ibu Rosa Damayanti');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/proposal/p-9?step=2'));
    expect(calls.some((c) => c.url.includes('/proposals/p-1/duplicate') && c.init.method === 'POST')).toBe(true);
  });

  it('P19.7-T2 AC-10 a proposal whose lead was deleted stays under the client’s name, and offers no Duplikat', async () => {
    show({ 'GET /proposals?': { body: { rows: [row({ leadDeleted: true })], total: 1, page: 1, pageSize: 20 } } });
    await screen.findByText('Ibu Rosa Damayanti');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('P19.7-T2 AC-10 deletes (soft) after asking, pinned to the row’s version, and the line goes', async () => {
    const { calls } = show({ 'DELETE /proposals/p-1': { status: 204 } });
    await screen.findByText('Ibu Rosa Damayanti');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const ask = screen.getByRole('dialog', { name: /Delete the proposal for Ibu Rosa Damayanti\?/ });
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Ibu Rosa Damayanti')).not.toBeInTheDocument());
    const call = calls.find((c) => c.init.method === 'DELETE')!;
    expect(call.url).toMatch(/\/proposals\/p-1\?expectedVersion=4$/);
  });

  it('P19.7-T2 AC-16 Buat proposal is the main action, a floating pill above the tab bar', async () => {
    show();
    await screen.findByText('Ibu Rosa Damayanti');
    const make = screen.getByRole('link', { name: 'Make a proposal' });
    expect(make).toHaveAttribute('href', '/proposal/new');
    expect(make.closest('[data-floating-bar]')).not.toBeNull();
  });

  it('P19.7-T2 AC-14 a view-only session reads the list, and is offered no new proposal, no duplicate and no delete', async () => {
    show({}, VIEWING_RINA);
    await screen.findByText('Ibu Rosa Damayanti');
    expect(screen.queryByRole('link', { name: 'Make a proposal' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    // Nor the file: the server refuses it a view-only session (P19.7-T3; Acc. 22).
    expect(screen.queryByRole('menuitem', { name: 'Download again' })).not.toBeInTheDocument();
  });

  describe('Unduh lagi (P19.7-T3; T2 AC-10)', () => {
    beforeEach(() => { saved.length = 0; });

    it('P19.7-T2 AC-10 downloads a Selesai proposal again: the file built now, saved under its name', async () => {
      const file = new Blob(['%PDF-1.3'], { type: 'application/pdf' });
      const { calls } = show({ 'GET /proposals/p-1/pdf': { body: file } });
      await screen.findByText('Ibu Rosa Damayanti');
      await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Download again' }));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toEqual({ blob: file, name: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf' });
      expect(calls.some((c) => new URL(c.url).pathname.endsWith('/proposals/p-1/pdf'))).toBe(true);
      expect(await screen.findByText('PDF downloaded')).toBeInTheDocument();
    });

    it('P19.7-T2 AC-10 offers no download of a Draf: its file is made by Simpan PDF on step 3', async () => {
      show({ 'GET /proposals?': { body: { rows: [row({ status: 'draft' })], total: 1, page: 1, pageSize: 20 } } });
      await screen.findByText('Ibu Rosa Damayanti');
      await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
      expect(screen.queryByRole('menuitem', { name: 'Download again' })).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-10 a refused download says so, and saves nothing', async () => {
      show({ 'GET /proposals/p-1/pdf': { status: 404, body: { error: { code: 'PROPOSAL_NOT_FOUND', message: 'No proposal of yours has that id. It may have been deleted.' } } } });
      await screen.findByText('Ibu Rosa Damayanti');
      await userEvent.click(screen.getByRole('button', { name: 'Actions for the proposal for Ibu Rosa Damayanti' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Download again' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(saved).toEqual([]);
    });
  });
});
