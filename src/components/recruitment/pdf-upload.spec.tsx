import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { PDF_MAX_BYTES } from '@/lib/recruitment-pitch';
import { GCS_UPLOAD_URL, gcsSignedUpload } from '@test/storage-fixtures';
import { PdfUploadNotice, usePdfUpload } from './pdf-upload';

/** A GCS signed POST policy, as the API answers since Phase 18.7 (ADR-0153). */
const SIGNED = gcsSignedUpload('dev/k/products/01A');

type Options = Parameters<typeof usePdfUpload<string>>[0];

function Harness({
  sign = vi.fn(async () => SIGNED),
  attach = vi.fn(async () => 'row'),
  onAttached = vi.fn(),
}: Partial<Options>) {
  const upload = usePdfUpload<string>({ sign, attach, onAttached });
  return (
    <div>
      <button type="button" onClick={upload.choose}>Choose</button>
      {upload.picker}
      <PdfUploadNotice state={upload} />
      <p data-testid="busy">{String(upload.busy)}</p>
    </div>
  );
}

const pdf = (name = 'brochure.pdf', size = 2048) => {
  const f = new File(['%PDF'], name, { type: 'application/pdf' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const input = () => document.querySelector('input[type=file]') as HTMLInputElement;

/**
 * The upload both P17-T5's cards and P17-T9's product rows use: check → sign → send → attach.
 * The screens' specs walk the happy path through each route; this pins the order and every way out.
 */
describe('usePdfUpload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('signs with the file’s facts, sends the bytes to storage, then attaches the key it was given', async () => {
    const order: string[] = [];
    const sign = vi.fn(async () => { order.push('sign'); return SIGNED; });
    const attach = vi.fn(async () => { order.push('attach'); return 'row'; });
    const onAttached = vi.fn();
    // GCS answers a stored object with 204 No Content, and that is a success.
    const send = vi.fn(async () => { order.push('send'); return { ok: true, status: 204 } as Response; });
    vi.stubGlobal('fetch', send);
    render(<Harness sign={sign} attach={attach} onAttached={onAttached} />);

    const file = pdf();
    await userEvent.upload(input(), file);

    await waitFor(() => expect(onAttached).toHaveBeenCalledWith('row'));
    expect(order).toEqual(['sign', 'send', 'attach']);
    expect(sign).toHaveBeenCalledWith({ filename: 'brochure.pdf', mimeType: 'application/pdf', bytes: 2048 });
    expect(send).toHaveBeenCalledWith(GCS_UPLOAD_URL, expect.objectContaining({ method: 'POST' }));
    expect(attach).toHaveBeenCalledWith('dev/k/products/01A', file);
    expect(input().value).toBe('');
  });

  it('takes a file exactly at the bound, and refuses one byte over it', async () => {
    const sign = vi.fn(async () => SIGNED);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    render(<Harness sign={sign} />);

    await userEvent.upload(input(), pdf('over.pdf', PDF_MAX_BYTES + 1));
    expect(await screen.findByText(/“over\.pdf” is 25,0 MB\. A PDF can be 25 MB at most\./)).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();

    await userEvent.upload(input(), pdf('exact.pdf', PDF_MAX_BYTES));
    await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
  });

  it('refuses a file whose name says PDF and whose type does not', async () => {
    const sign = vi.fn(async () => SIGNED);
    render(<Harness sign={sign} />);
    await userEvent.upload(input(), new File(['x'], 'notes.pdf', { type: 'text/plain' }));
    expect(await screen.findByText('“notes.pdf” is not a PDF. Only a PDF can be uploaded here.')).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it('takes a .pdf the browser reports with no type at all, and signs it as a PDF (storage still checks)', async () => {
    const sign = vi.fn(async () => SIGNED);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    render(<Harness sign={sign} />);
    const untyped = new File(['%PDF'], 'Brosur.PDF', { type: '' });
    await userEvent.setup({ applyAccept: false }).upload(input(), untyped);
    await waitFor(() => expect(sign).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Brosur.PDF', mimeType: 'application/pdf' })));
  });

  it('refuses a file with no type whose name is not a PDF', async () => {
    const sign = vi.fn(async () => SIGNED);
    render(<Harness sign={sign} />);
    await userEvent.setup({ applyAccept: false }).upload(input(), new File(['x'], 'notes', { type: '' }));
    expect(await screen.findByText('“notes” is not a PDF. Only a PDF can be uploaded here.')).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it.each([
    ['storage answers with an error', async () => ({ ok: false, status: 400 }) as Response],
    ['the bytes never arrive', async () => { throw new TypeError('Failed to fetch'); }],
  ])('attaches nothing when %s, and says the upload did not finish', async (_case, send) => {
    const attach = vi.fn(async () => 'row');
    vi.stubGlobal('fetch', vi.fn(send));
    render(<Harness attach={attach} />);
    await userEvent.upload(input(), pdf());

    expect(await screen.findByText('“brochure.pdf” did not finish uploading. Check your connection and try again.')).toBeInTheDocument();
    expect(attach).not.toHaveBeenCalled();
    expect(screen.getByTestId('busy')).toHaveTextContent('false');
  });

  it('says what the attach refused, in the server’s words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    const attach = vi.fn(async () => {
      throw new ApiRequestError(400, { code: 'ASSET_TYPE_NOT_ALLOWED', message: 'Storage says this is not a PDF.', requestId: 'r-1' });
    });
    const onAttached = vi.fn();
    render(<Harness attach={attach} onAttached={onAttached} />);
    await userEvent.upload(input(), pdf());

    expect(await screen.findByText('Storage says this is not a PDF.')).toBeInTheDocument();
    expect(screen.getByText(/ASSET_TYPE_NOT_ALLOWED · r-1/)).toBeInTheDocument();
    expect(onAttached).not.toHaveBeenCalled();
  });

  it('clears an earlier refusal when the picker is opened again', async () => {
    render(<Harness />);
    await userEvent.upload(input(), new File(['x'], 'a.png', { type: 'image/png' }), );
    await userEvent.upload(input(), new File(['x'], 'b.pdf', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does nothing when the picker is closed with no file', async () => {
    const sign = vi.fn(async () => SIGNED);
    render(<Harness sign={sign} />);
    await userEvent.upload(input(), []);
    expect(sign).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
