import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import TrainingSettingsPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/kpm/settings/training',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'training_settings:read'],
});
/** A core leader holds the Owner's Pengaturan (ADR-0268): the same screen. */
const CORE_LEADER = makeMe({ ...OWNER, membership: { ...OWNER.membership!, isKpmOwner: false, isCoreLeader: true } as never });
/** A support session reads an office's configuration and writes none of it. */
const READER = makeMe({ ...OWNER, permissions: ['tenant_config:read', 'training_settings:read'] });
/** A field member: no Pengaturan at all. */
const AGENT = makeMe({ ...OWNER, permissions: ['tenant_config:read'] });

const moduleRow = (over: Record<string, unknown>) => ({
  id: 'm-x', code: 'X', skillCode: 'PROSPECTING', title: 'X', publishState: 'published', displayOrder: 1, version: 1,
  status: 'active', material: 'none', materialItem: null, completion: { done: 0, started: 0, of: 30 }, ...over,
});

const TREE = [
  {
    id: 'c-sales', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
    skills: [
      {
        id: 's-prospecting', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting', description: null,
        displayOrder: 1, version: 2, status: 'active',
        modules: [
          moduleRow({
            id: 'm-list', code: 'PROSPECT_LIST', title: 'Membangun daftar prospek', version: 4, material: 'company',
            materialItem: { label: 'Prospek_list.pdf', kind: 'file', mimeType: 'application/pdf' },
            completion: { done: 24, started: 26, of: 30 },
          }),
          moduleRow({ id: 'm-cold', code: 'COLD_APPROACH', title: 'Cold approach script', displayOrder: 2 }),
          moduleRow({ id: 'm-draft', code: 'DRAFT_ONE', title: 'Script baru', publishState: 'draft', displayOrder: 3 }),
        ],
      },
      {
        id: 's-closing', code: 'CLOSING', categoryCode: 'SALES', label: 'Closing', description: null,
        displayOrder: 2, version: 1, status: 'active',
        modules: [moduleRow({ id: 'm-close', code: 'CLOSING_TECHNIQUES', skillCode: 'CLOSING', title: 'Teknik closing' })],
      },
    ],
  },
  { id: 'c-product', code: 'PRODUCT', label: 'Product', description: null, displayOrder: 2, version: 1, status: 'active', skills: [] },
  {
    id: 'c-old', code: 'OLD', label: 'Old ways', description: null, displayOrder: 3, version: 3, status: 'archived',
    skills: [],
  },
];

const PUBLISH_STATE = { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null };
const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

function render(me = OWNER, extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/kpm/settings/training': { body: TREE },
    '/kpm/settings/publish-state': { body: PUBLISH_STATE },
    '/kpm/settings/changes': { body: { training: [], version: 2 } },
    ...extra,
  } as never);
  renderWithSession(<TrainingSettingsPage />, { me });
  return stub;
}

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
const batch = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => c.url.endsWith('/kpm/settings/changes')).map((c) => JSON.parse(String(c.init.body)).ops);

describe('P19.25-T4 Pengaturan › Training as one tree', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('P19.25-T4 AC-1 draws one tree, no Categories / Skills / Modules tabs: Kategori › Skill › Modul with its counts', async () => {
    render();
    await screen.findByText('Sales');
    expect(screen.queryByRole('navigation', { name: 'Training sections' })).toBeNull();
    expect(screen.getByText('Category › Skill › Module')).toBeInTheDocument();
    expect(within(rowOf('Sales')).getByText('2 skills · 4 modules')).toBeInTheDocument();
    expect(within(rowOf('Product')).getByText('0 skills · 0 modules')).toBeInTheDocument();
    expect(within(rowOf('Prospecting')).getByText('3 modules')).toBeInTheDocument();
    // Archived rows wait for *Show archived*.
    expect(screen.queryByText('Old ways')).toBeNull();
    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(within(rowOf('Old ways')).getByText('Archived')).toBeInTheDocument();
  });

  it('P19.25-T4 AC-1 opens on the first category and its first skill; a tap on a row opens and closes it', async () => {
    render();
    await screen.findByText('Membangun daftar prospek');
    const sales = screen.getByRole('button', { name: 'Open or close Sales' });
    expect(sales).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Open or close Closing' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Teknik closing')).toBeNull();
    // The row itself, not only its chevron (the brief: *tap to open/close*).
    await userEvent.click(screen.getByText('Closing'));
    expect(screen.getByText('Teknik closing')).toBeInTheDocument();
    await userEvent.click(sales);
    expect(sales).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Membangun daftar prospek')).toBeNull();
  });

  it('P19.25-T4 AC-2 a module reads "n of 30 done" or nobody yet, its file with Replace, or Upload material', async () => {
    render();
    await screen.findByText('Membangun daftar prospek');
    const list = rowOf('Membangun daftar prospek');
    expect(within(list).getByText('24 of 30 done')).toBeInTheDocument();
    expect(within(list).getByText('Prospek_list.pdf')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Replace the material of Membangun daftar prospek' })).toHaveTextContent('Replace');
    const cold = rowOf('Cold approach script');
    expect(within(cold).getByText('Nobody has started yet')).toBeInTheDocument();
    expect(within(cold).getByRole('button', { name: 'Upload material to Cold approach script' })).toHaveTextContent('Upload material');
    // A draft says so: agents are not offered it.
    expect(within(rowOf('Script baru')).getByText('Draft')).toBeInTheDocument();
    await clean();
  });

  it('P19.25-T4 AC-2 the pencil renames, its code shown and never sent; the batch names the version read', async () => {
    const stub = render();
    await screen.findByText('Sales');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Prospecting' }));
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Code PROSPECTING: permanent.');
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Mencari prospek');
    await userEvent.type(screen.getByLabelText('Short description'), 'Seratus nama');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(batch(stub.calls)).toHaveLength(1));
    expect(batch(stub.calls)[0]).toEqual([{
      op: 'trainingSkill.update', id: 's-prospecting', expectedVersion: 2, body: { label: 'Mencari prospek', description: 'Seratus nama' },
    }]);
  });

  it('P19.25-T4 AC-2 a skill’s pencil can also move it to another category, its modules with it (kept from the Skills tab)', async () => {
    const stub = render();
    await screen.findByText('Sales');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Closing' }));
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription('Its modules move with it.');
    // Archived categories are not offered.
    expect(within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sales', 'Product']);
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'PRODUCT');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(batch(stub.calls)).toHaveLength(1));
    expect(batch(stub.calls)[0]).toEqual([{
      op: 'trainingSkill.update', id: 's-closing', expectedVersion: 1, body: { label: 'Closing', categoryCode: 'PRODUCT' },
    }]);
  });

  it('P19.25-T4 AC-2 ⋯ archives a category, and on a module opens its material and details', async () => {
    const stub = render();
    await screen.findByText('Sales');
    await userEvent.click(screen.getByRole('button', { name: 'More for Sales' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Archive/ }));
    await waitFor(() => expect(batch(stub.calls)).toHaveLength(1));
    expect(batch(stub.calls)[0]).toEqual([{ op: 'trainingCategory.archive', id: 'c-sales', expectedVersion: 1 }]);

    await userEvent.click(screen.getByRole('button', { name: 'More for Membangun daftar prospek' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Material and details' }));
    expect(push).toHaveBeenCalledWith('/kpm/settings/training/m-list');
  });

  it('P19.25-T4 AC-2 + Add module under a skill: its name, a code from it, offered at the next publish', async () => {
    const stub = render();
    await screen.findByText('Membangun daftar prospek');
    await userEvent.click(screen.getByRole('button', { name: 'Add module' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Teknik minta referensi');
    expect(screen.getByLabelText('Code')).toHaveValue('TEKNIK_MINTA_REFERENSI');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(batch(stub.calls)).toHaveLength(1));
    expect(batch(stub.calls)[0]).toEqual([{
      op: 'trainingModule.create',
      body: { code: 'TEKNIK_MINTA_REFERENSI', skillCode: 'PROSPECTING', title: 'Teknik minta referensi', publishState: 'published' },
    }]);
  });

  it('P19.25-T4 AC-1 + Add category refuses a code already taken, archived ones included', async () => {
    render();
    await screen.findByText('Sales');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Old');
    expect(screen.getByRole('alert')).toHaveTextContent('This office already has a category with this code.');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('P19.25-T4 AC-2 Upload material on the row: sign, send, confirm, then save the file as the module’s material', async () => {
    const stub = render(OWNER, {
      'POST /kpm/settings/training/uploads': { status: 201, body: { uploadUrl: 'https://storage.test/up', storageKey: 'k1', fields: {} } },
      'https://storage.test/up': { status: 204 },
      'POST /kpm/settings/training/uploads/confirm': {
        status: 201, body: { storageKey: 'k1', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes: 9 },
      },
      'GET /kpm/settings/training/modules/COLD_APPROACH/content': {
        body: { moduleCode: 'COLD_APPROACH', title: 'Cold approach script', overridden: false, content: { files: [], videos: [], links: [] }, companyContent: { files: [], videos: [], links: [] } },
      },
      'PUT /kpm/settings/training/modules/COLD_APPROACH/content': { body: {} },
    });
    await screen.findByText('Cold approach script');
    await userEvent.click(screen.getByRole('button', { name: 'Upload material to Cold approach script' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain('.pptx');
    fireEvent.change(input, { target: { files: [new File(['deck'], 'Cold_script.pptx', { type: '' })] } });
    await screen.findByText('Cold approach script: material saved. Agents see it now.');
    const put = stub.calls.find((c) => c.init.method === 'PUT');
    expect(JSON.parse(String(put!.init.body))).toEqual({
      files: [{ id: '', label: 'Cold_script.pptx', storageKey: 'k1', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes: 9 }],
      videos: [],
      links: [],
    });
  });

  it('P19.25-T4 AC-2 refuses a file that is no material before anything is sent', async () => {
    const stub = render();
    await screen.findByText('Cold approach script');
    await userEvent.click(screen.getByRole('button', { name: 'Upload material to Cold approach script' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'setup.exe', { type: 'application/x-msdownload' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('“setup.exe” is not a kind of file this product accepts.');
    expect(stub.calls.some((c) => c.url.includes('/uploads'))).toBe(false);
  });

  it('P19.25-T4 AC-1 a core leader holds the same screen', async () => {
    render(CORE_LEADER);
    await screen.findByText('Sales');
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  it('P19.25-T4 AC-1 a reader without write sees the tree and its figures, and no pencil, ⋯, upload or add', async () => {
    render(READER);
    await screen.findByText('24 of 30 done');
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^More for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Upload material to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('P19.25-T4 AC-1 a field member is refused the page, and nothing is read', async () => {
    const stub = render(AGENT);
    expect(await screen.findByText(/permission|izin|access/i)).toBeInTheDocument();
    expect(stub.calls.some((c) => c.url.endsWith('/kpm/settings/training'))).toBe(false);
  });

  it('P19.25-T4 AC-1 says when the catalog cannot be read', async () => {
    render(OWNER, { '/kpm/settings/training': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something broke.', requestId: 'r1' } } } });
    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
  });

  it('P19.25-T4 AC-1 says when there is no category yet', async () => {
    render(OWNER, { '/kpm/settings/training': { body: [] } });
    expect(await screen.findByText('No training categories yet.')).toBeInTheDocument();
  });

  it('P19.25-T4 AC-1 every control is 44px at 390', async () => {
    atWidth(390);
    render();
    await screen.findByText('Membangun daftar prospek');
    expect(smallTargets(document.body, 390)).toEqual([]);
  });
});
