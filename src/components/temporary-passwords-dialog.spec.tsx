import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { TemporaryPasswordsDialog } from './temporary-passwords-dialog';

const saveFile = vi.fn();
vi.mock('@/lib/save-file', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }));

/**
 * ***Akun & password*** **— the confirmation, then the file** (P19.30-T1 AC-6, T2 AC-2; ADR-0288 §2, §4): how many the PDF
 * lists, that an older PDF stops working for them, that each chooses their own password at first sign-in — then *Buat PDF*,
 * which issues and holds the file, and *Unduh PDF*, which saves that same file in the click (the 2026-11-23 browser walk).
 * Nobody to list: it says so, with nothing to make. English is this spec's; the app reads Indonesian by default.
 */
const PREVIEW = { count: 110, kpmName: 'PruDynamic', fileName: 'Akun-password-PruDynamic-2026-11-22.pdf' };
const routes = (preview: unknown = { body: PREVIEW }) => ({
  'POST /members/temporary-passwords/preview': preview,
  'POST /members/temporary-passwords': { body: new Blob(['%PDF-1.3']) },
});

beforeEach(() => saveFile.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('P19.30-T1 the Akun & password confirmation', () => {
  it('P19.30-T1 AC-6 says how many it lists, that older PDFs stop working, and that each chooses their own password', async () => {
    const { calls } = stubFetch(routes() as never);
    renderWithSession(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    const box = screen.getByRole('dialog', { name: 'Accounts & passwords' });
    expect(await within(box).findByText(
      'The PDF lists 110 people who do not use their own password yet, each with a new temporary password.',
    )).toBeInTheDocument();
    expect(box).toHaveTextContent('Any PDF downloaded before stops working for them.');
    expect(box).toHaveTextContent('Each must choose their own password the first time they sign in.');
    expect(box).toHaveAccessibleDescription('PruDynamic');
    // Step 1 offered; nothing to download before the file is made.
    expect(within(box).getByRole('button', { name: 'Make PDF' })).toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'Download PDF' })).toBeNull();
    // Counting issues nothing: one call, the preview, with no memberships named.
    expect(calls.map((c) => c.url.replace(/^.*\/api\/v1/, ''))).toEqual(['/members/temporary-passwords/preview']);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({});
  });

  it('P19.30-T1 AC-6 Make PDF issues once and holds the file; Download PDF saves that same file in the click, again and again', async () => {
    const onClose = vi.fn();
    const onReady = vi.fn();
    const { calls } = stubFetch(routes() as never);
    renderWithSession(<TemporaryPasswordsDialog onClose={onClose} onReady={onReady} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF' }));
    const box = screen.getByRole('dialog', { name: 'Accounts & passwords' });
    expect(await within(box).findByText('The PDF with 110 accounts is ready. Its passwords work from now on.')).toBeInTheDocument();
    expect(box).toHaveTextContent('Download PDF saves this same file as often as you need.');
    // The toast says it is ready — not that anything was downloaded.
    expect(await screen.findByText('The PDF is ready: 110 accounts. Download it now.')).toBeInTheDocument();
    expect(onReady).toHaveBeenCalledWith(110);
    expect(saveFile).not.toHaveBeenCalled();
    const issued = () => calls.filter((c) => c.url.endsWith('/members/temporary-passwords'));
    expect(issued()).toHaveLength(1);
    expect(issued()[0].init.method).toBe('POST');

    // Saved in the click itself, synchronously: no await between the press and the save.
    const download = within(box).getByRole('button', { name: 'Download PDF' });
    download.click();
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [file, name] = saveFile.mock.calls[0] as [Blob, string];
    expect(name).toBe('Akun-password-PruDynamic-2026-11-22.pdf');
    expect(file).toBeInstanceOf(Blob);
    expect(file.size).toBe('%PDF-1.3'.length);
    // Again: the same file, nothing issued again.
    await userEvent.click(download);
    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(saveFile.mock.calls[1][0]).toBe(file);
    expect(issued()).toHaveLength(1);
    // Done closes it.
    await userEvent.click(within(box).getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('P19.30-T2 AC-2 narrowed to the memberships given, in both calls', async () => {
    const { calls } = stubFetch(routes() as never);
    renderWithSession(<TemporaryPasswordsDialog membershipIds={['m-1', 'm-2']} onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(saveFile).toHaveBeenCalled();
    for (const call of calls) expect(JSON.parse(String(call.init.body))).toEqual({ membershipIds: ['m-1', 'm-2'] });
  });

  it('P19.30-T1 AC-6 nobody left to list: it says so, and offers no download', async () => {
    const { calls } = stubFetch(routes({ body: { ...PREVIEW, count: 0 } }) as never);
    const onClose = vi.fn();
    renderWithSession(<TemporaryPasswordsDialog onClose={onClose} />);
    expect(await screen.findByText('Everybody already uses their own password. There is nobody to put in the PDF.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull();
    // The footer's Close, and the ✕ in the head.
    const closes = screen.getAllByRole('button', { name: 'Close' });
    await userEvent.click(closes[closes.length - 1]);
    expect(onClose).toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('P19.30-T1 AC-3 a refusal is said in the dialog, in the reader’s words, and offers no download', async () => {
    stubFetch(routes({ status: 403, body: { error: { code: 'PERM_OWNER_ONLY', message: 'Only the KPM’s owner can do this.', requestId: 'r1' } } }) as never);
    renderWithSession(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('Only the KPM’s owner can do this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make PDF' })).toBeNull();
  });

  it('P19.30-T1 AC-6 in Indonesian', async () => {
    stubFetch(routes() as never);
    renderInIndonesian(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    const box = screen.getByRole('dialog', { name: 'Akun & password' });
    expect(await within(box).findByText(
      'PDF ini memuat 110 orang yang belum memakai password sendiri, masing-masing dengan password sementara baru.',
    )).toBeInTheDocument();
    expect(box).toHaveTextContent('PDF yang diunduh sebelumnya tidak berlaku lagi untuk mereka.');
    expect(box).toHaveTextContent('Saat pertama masuk, setiap orang wajib membuat password sendiri.');
    await userEvent.click(within(box).getByRole('button', { name: 'Buat PDF' }));
    expect(await within(box).findByText('PDF berisi 110 akun sudah siap. Password di dalamnya berlaku mulai sekarang.')).toBeInTheDocument();
    expect(await screen.findByText('PDF siap: 110 akun. Unduh sekarang.')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Unduh PDF' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Selesai' })).toBeInTheDocument();
  });

  it('P19.30-T1 AC-6 a refusal when making the PDF is said in the dialog, and nothing is held to download', async () => {
    stubFetch({
      'POST /members/temporary-passwords/preview': { body: PREVIEW },
      'POST /members/temporary-passwords': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Everybody already uses their own password, so there is nobody to list in the PDF.', requestId: 'r2' } } },
    } as never);
    renderWithSession(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF' }));
    expect(await screen.findByText('Everybody already uses their own password, so there is nobody to list in the PDF.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('P19.30-T1 AC-6 has no axe violations, made and empty', async () => {
    stubFetch(routes() as never);
    const { baseElement, unmount } = renderWithSession(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF' }));
    // Colour contrast is jsdom's blind spot (no layout, no computed colour): the tokens are pinned by `a11y.spec.tsx`.
    const rules = { rules: { 'color-contrast': { enabled: false } } };
    await screen.findByRole('button', { name: 'Download PDF' });
    expect((await axe(baseElement, rules)).violations ?? []).toEqual([]);
    unmount();
    stubFetch(routes({ body: { ...PREVIEW, count: 0 } }) as never);
    const empty = renderWithSession(<TemporaryPasswordsDialog onClose={vi.fn()} />);
    await screen.findByText(/nobody to put in the PDF/);
    expect((await axe(empty.baseElement, rules)).violations ?? []).toEqual([]);
  });
});
