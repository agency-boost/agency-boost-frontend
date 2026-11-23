'use client';

/**
 * **How long the file's object URL is kept after the click** (the P19.30 browser walk, 2026-11-23): long enough for any
 * browser to have read the whole file. Chrome reads a blob download after the click returns, and a URL revoked first —
 * at `setTimeout(0)`, as it was — left the download `canceled` with 0 bytes, the PDF's and the KPM report's alike.
 */
export const SAVE_FILE_REVOKE_MS = 60_000;

/**
 * **Save a file the API answered** (ADR-0184): a template workbook or CSV, a PDF, fetched with the access token by
 * `apiBlob`.
 *
 * A link straight to the API cannot carry the token, which lives in memory only, so the bytes are fetched first and
 * handed to the browser here: an object URL and an `<a download>`, **put in the page, clicked, and taken out again** — a
 * detached link is not followed by every browser — and the URL let go **a minute later** (`SAVE_FILE_REVOKE_MS`), once
 * the download has long read it. Nothing is kept beyond that.
 *
 * Called inside the reader's own click where it can be (*Akun & password*'s *Unduh PDF* saves the PDF it already holds),
 * so the download is part of the gesture: Safari on an iPhone is strict about a download started after an `await`.
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), SAVE_FILE_REVOKE_MS);
}
