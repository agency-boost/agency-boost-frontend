'use client';

/**
 * **Save a file the API answered** (ADR-0184): a template workbook or CSV, fetched with the access token by `apiBlob`.
 *
 * A link straight to the API cannot carry the token, which lives in memory only, so the bytes are fetched first and
 * handed to the browser here: an object URL, a click on an `<a download>` that is never in the page, and the URL let go
 * once the click has been taken. Nothing is kept.
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  // After the click has been taken: revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
