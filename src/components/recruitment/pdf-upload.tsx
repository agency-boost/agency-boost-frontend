'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { recruitmentPitchMessages } from '@/i18n/messages/recruitment-pitch';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { formatFileSize, PDF_MAX_BYTES } from '@/lib/recruitment-pitch';
import { signedUploadForm, type SignedUpload } from '@/lib/tenant-config';

const PDF = 'application/pdf';

/*
 * The control's own words (D-copy): none of OD-39's six words — the catalogue's since P18.98-T4
 * (`messages/recruitment-pitch.ts`: `uploading`, `tooLarge`, `notPdf`, `sendFailed`), the sizes in the reader's figures.
 */

/**
 * A refusal this control made, shaped like one the server makes. `requestId` is empty because no
 * request was made: the file was refused before it cost anybody their data allowance.
 */
const refusal = (code: string, message: string): ApiError => ({ code, message, requestId: '' });

export interface PdfUploadState {
  /** Opens the file picker. */
  choose: () => void;
  /** The hidden picker; render it once, anywhere beside the button. */
  picker: ReactNode;
  /** The file being sent, while it is. */
  uploading: string | null;
  error: ApiError | null;
  busy: boolean;
}

/**
 * One PDF, from the picker to the record that holds it: **check → sign → send → attach**.
 *
 * The same three steps the training upload takes (`module-content.tsx`): the size and the type are
 * refused here, in the reader's own words, **before anything is sent**; the API signs an upload into
 * the office's own folder; the browser sends the bytes straight to storage, so they never transit the
 * API; and `attach` hands the storage key to the route that records it, which confirms against storage
 * what actually landed (ADR-0040). Nothing is attached when any step fails.
 *
 * Shared by the pitch cards (P17-T5) and the products page's document rows (P17-T9), which differ only
 * in what they sign with and what they attach to. A hook rather than one component because the two
 * place the button and its messages differently: a card's button sits in its actions row and its
 * messages under it, a product row's in its own column.
 */
export function usePdfUpload<T>({
  sign,
  attach,
  onAttached,
}: {
  sign: (body: { filename: string; mimeType: string; bytes: number }) => Promise<SignedUpload>;
  attach: (storageKey: string, file: File) => Promise<T>;
  onAttached: (result: T) => void;
}): PdfUploadState {
  const t = useMessages(recruitmentPitchMessages);
  const figures = useFigureLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setError(null);

    // Some desktops report no type at all for a PDF: its name decides then, and storage still checks
    // what actually arrived before anything is attached (ADR-0040).
    if (file.type !== PDF && !(file.type === '' && /\.pdf$/i.test(file.name))) {
      setError(refusal('ASSET_TYPE_NOT_ALLOWED', t.notPdf({ name: file.name })));
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setError(refusal('ASSET_TOO_LARGE', t.tooLarge({
        name: file.name,
        size: formatFileSize(file.size, figures),
        max: formatNumber(PDF_MAX_BYTES / 1024 / 1024, {}, figures),
      })));
      return;
    }

    setUploading(file.name);
    try {
      const signed = await sign({ filename: file.name, mimeType: PDF, bytes: file.size });
      let sent: Response;
      try {
        sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, file) });
      } catch {
        sent = { ok: false } as Response;
      }
      if (!sent.ok) {
        setError(refusal('UPLOAD_FAILED', t.sendFailed({ name: file.name })));
        return;
      }
      onAttached(await attach(signed.storageKey, file));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setUploading(null);
    }
  };

  return {
    choose: () => {
      setError(null);
      input.current?.click();
    },
    picker: (
      <input
        ref={input}
        type="file"
        accept={`${PDF},.pdf`}
        hidden
        tabIndex={-1}
        data-pdf-picker=""
        onChange={(e) => void send(e.target.files?.[0])}
      />
    ),
    uploading,
    error,
    busy: uploading !== null,
  };
}

/** What the upload is doing, or why it stopped: under the control it belongs to. */
export function PdfUploadNotice({ state, className }: { state: PdfUploadState; className?: string }) {
  const t = useMessages(recruitmentPitchMessages);
  if (!state.uploading && !state.error) return null;
  return (
    <div className={className}>
      {state.uploading && (
        <p role="status" className="m-0 text-base text-muted">{t.uploading({ name: state.uploading })}</p>
      )}
      {state.error && <ErrorBanner {...state.error} />}
    </div>
  );
}
