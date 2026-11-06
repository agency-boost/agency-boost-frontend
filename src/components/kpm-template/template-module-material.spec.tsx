import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { SUPER_ADMIN } from '@test/kpm-template-fixtures';
import { materialCount, TemplateModuleMaterialDialog } from './template-module-material';

const BASE = '/admin/companies/c1/templates/t1/training';
const SIGNED = {
  uploadUrl: 'https://storage.googleapis.com/bucket/', storageKey: 'dev/company/c1/templates/t1/training/01', signature: 's',
  expiresAt: '2026-11-05T03:10:00Z', fields: { key: 'dev/company/c1/templates/t1/training/01', 'Content-Type': 'application/pdf' },
};
const MODULE = {
  code: 'PROSPECT_LIST', title: 'Daftar prospek',
  content: { links: [{ id: 'l1', label: 'Bacaan', url: 'https://example.com/bacaan' }] },
};

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

function render(extra: Parameters<typeof stubFetch>[0] = {}, beforeSave = vi.fn(async () => true)) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const stub = stubFetch({
    [`POST ${BASE}/uploads/confirm`]: { body: { storageKey: SIGNED.storageKey, mimeType: 'application/pdf', bytes: 2048 } },
    [`POST ${BASE}/uploads`]: { body: SIGNED },
    'https://storage.googleapis.com/bucket/': { status: 204, body: null },
    [`PUT ${BASE}/modules/PROSPECT_LIST/content`]: { body: { kind: 'training_taxonomy', status: 'draft', revision: 5, payload: {} } },
    ...extra,
  });
  renderWithSession(
    <TemplateModuleMaterialDialog
      open companyId="c1" templateId="t1" module={MODULE} revision={4}
      beforeSave={beforeSave} onSaved={onSaved} onClose={onClose}
    />,
    { me: SUPER_ADMIN },
  );
  return { stub, onSaved, onClose, beforeSave };
}

/** **A template module's material** (P19.4-T1 AC-1; ADR-0208 §1; the 11-03 handover's §B6 *Expected 1*). */
describe('P19.4-T1 a template module’s material', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T1 AC-1 uploads a file as the company’s, confirms it, adds a link, and saves the whole into the draft, pinned', async () => {
    const { stub, onSaved, beforeSave } = render();
    const dialog = within(screen.getByRole('dialog', { name: 'Material: Daftar prospek' }));
    expect(dialog.getByText('Bacaan')).toBeInTheDocument();
    await userEvent.upload(dialog.getByLabelText('Add to Files'), new File(['%PDF'], 'Modul.pdf', { type: 'application/pdf' }));
    expect(await dialog.findByText('Modul.pdf')).toBeInTheDocument();
    const signRequest = stub.calls.find((c) => c.url.endsWith('/training/uploads'))!;
    expect(JSON.parse(String(signRequest.init.body))).toEqual({ filename: 'Modul.pdf', mimeType: 'application/pdf', bytes: 4 });
    expect(stub.calls.some((c) => c.url.endsWith('/uploads/confirm'))).toBe(true);

    await userEvent.type(dialog.getByLabelText('Link name'), 'Video panjang');
    await userEvent.type(dialog.getByLabelText('Address'), 'https://youtu.be/x');
    await userEvent.click(dialog.getByRole('button', { name: 'Add link' }));
    await clean();
    await userEvent.click(dialog.getByRole('button', { name: 'Save material' }));

    expect(beforeSave).toHaveBeenCalled();
    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toEqual({
      files: [{ id: '', label: 'Modul.pdf', storageKey: SIGNED.storageKey, mimeType: 'application/pdf', bytes: 2048 }],
      videos: [],
      links: [{ id: 'l1', label: 'Bacaan', url: 'https://example.com/bacaan' }, { id: '', label: 'Video panjang', url: 'https://youtu.be/x' }],
      expectedRevision: 4,
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 }));
  });

  it('P19.4-T1 AC-1 refuses a file over 25 MB and one it does not take, before anything is uploaded', async () => {
    const { stub } = render();
    const big = new File(['x'], 'besar.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText('Add to Files'), big);
    expect(await screen.findByRole('alert')).toHaveTextContent('besar.pdf');
    await userEvent.upload(screen.getByLabelText('Add to Videos'), new File(['x'], 'klip.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('klip.pdf');
    expect(stub.calls.some((c) => c.url.includes('/uploads'))).toBe(false);
  });

  it('P19.4-T1 AC-1 sends nothing when the section’s own save is refused first, and says a refusal of its own', async () => {
    const { stub } = render({}, vi.fn(async () => false));
    await userEvent.click(screen.getByRole('button', { name: 'Save material' }));
    expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('P19.4-T1 AC-1 shows the server’s refusal of a stale save', async () => {
    render({
      [`PUT ${BASE}/modules/PROSPECT_LIST/content`]: {
        status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Someone else saved this section after you opened it.', requestId: 'r' } },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save material' }));
    expect(await screen.findByText('Someone else saved this section after you opened it.')).toBeInTheDocument();
  });

  it('P19.4-T1 AC-5 counts a module’s items: files, videos and links', () => {
    expect(materialCount(undefined)).toBe(0);
    expect(materialCount({ links: [{ id: 'a', label: 'a', url: 'https://a' }], files: [] })).toBe(1);
  });

  it('P19.4-T1 AC-1 in Indonesian', () => {
    stubFetch({});
    renderInIndonesian(
      <TemplateModuleMaterialDialog
        open companyId="c1" templateId="t1" module={MODULE} revision={1}
        beforeSave={async () => true} onSaved={() => undefined} onClose={() => undefined}
      />,
      { me: SUPER_ADMIN },
    );
    const dialog = within(screen.getByRole('dialog', { name: 'Materi: Daftar prospek' }));
    expect(dialog.getByRole('button', { name: 'Simpan materi' })).toBeInTheDocument();
    expect(dialog.getByLabelText('Tambahkan ke File')).toBeInTheDocument();
    expect(dialog.getByText(/Setiap KPM yang dibuat dari template ini menampilkan materi ini/)).toBeInTheDocument();
  });
});

/**
 * **An HTML lesson in the template's material** (P19.6-T2, ADR-0217 §1, §4): the Super Admin uploads one as the company's,
 * signed as `text/html`, and previews it with *Open* in the sandboxed window — the only file this dialog opens.
 */
describe('P19.6-T2 an HTML lesson in a template module’s material', () => {
  const LESSON_URL = 'https://storage.googleapis.com/bucket/dev/company/c1/templates/t1/training/01?X-Goog-Signature=abc';
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P19.6-T2 AC-1 uploads an HTML lesson as text/html, and previews it in the sandboxed window, never a tab', async () => {
    const open = vi.spyOn(window, 'open');
    const { stub } = render({
      [`POST ${BASE}/uploads/confirm`]: { body: { storageKey: SIGNED.storageKey, mimeType: 'text/html', bytes: 48_000 } },
      [`GET ${BASE}/files/url`]: { body: { url: LESSON_URL } },
    });
    const dialog = within(screen.getByRole('dialog', { name: 'Material: Daftar prospek' }));
    expect(dialog.getByLabelText('Add to Files').getAttribute('accept')).toBe('.pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,text/html,.html,.htm');
    await userEvent.upload(dialog.getByLabelText('Add to Files'), new File(['<!doctype html>'], 'Pelajaran 01.html', { type: 'text/html' }));
    expect(await dialog.findByText('Pelajaran 01.html')).toBeInTheDocument();
    const signRequest = stub.calls.find((c) => c.url.endsWith('/training/uploads'))!;
    expect(JSON.parse(String(signRequest.init.body))).toMatchObject({ filename: 'Pelajaran 01.html', mimeType: 'text/html' });

    await userEvent.click(dialog.getByRole('button', { name: 'Open' }));
    const frame = await screen.findByTitle('Pelajaran 01.html');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(new URL(frame.getAttribute('src')!).origin).toBe('https://storage.googleapis.com');
    expect(stub.calls.some((c) => c.url.includes(`${BASE}/files/url?storageKey=${encodeURIComponent(SIGNED.storageKey)}`))).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('P19.6-T2 AC-6 a PDF in the same list has no Open, as before', async () => {
    render();
    const dialog = within(screen.getByRole('dialog', { name: 'Material: Daftar prospek' }));
    await userEvent.upload(dialog.getByLabelText('Add to Files'), new File(['%PDF'], 'Modul.pdf', { type: 'application/pdf' }));
    expect(await dialog.findByText('Modul.pdf')).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Open' })).toBeNull();
  });
});
