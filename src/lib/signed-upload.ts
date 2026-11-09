/**
 * **A signed upload, and the one form it is sent as** (ADR-0040, ADR-0153): every upload in the app — a module's
 * material, a product's PDF, a recruitment pitch, the branding images, the profile photo. In a module of its own, which
 * `tenant-config.ts` re-exports, because the profile and the branding client need these two and none of the office's
 * configuration client (the bundle, 2026-11-06; `performance-and-scale.md`).
 */

export interface SignedUpload {
  uploadUrl: string;
  storageKey: string;
  signature: string;
  expiresAt: string;
  /**
   * Every multipart field storage needs beside the file, named and valued exactly as the server signed
   * them. The browser appends each one and knows nothing about which vendor it is talking to: the
   * server owns that, and a vendor change is a server change (ADR-0153 replaced one vendor's fields
   * with a GCS V4 signed POST policy's — `key`, `Content-Type`, `policy`, `x-goog-algorithm`,
   * `x-goog-credential`, `x-goog-date` and `x-goog-signature` — without this file learning a name).
   *
   * Required, as `openapi.json` documents it: every server since Phase 17 sends it, and a form built
   * without it is one storage refuses.
   */
  fields: Record<string, string>;
}

/**
 * **The one form a signed upload is sent as**, for every upload in the app: every field the server
 * signed, in the order it sent them, then the file **last**. Last is not a style: a signed POST policy
 * reads the form up to `file` and ignores whatever follows, so a field appended after the file is one
 * storage never sees and a policy condition the upload then fails.
 *
 * There is no fallback for an answer without `fields` (Phase 18.4, ADR-0153). The one there was rebuilt
 * the previous vendor's two fields from `storageKey` and `signature`, which the current one refuses;
 * an answer without them is a contract break to fix on the server, not a case to paper over here.
 *
 * Storage answers a successful POST with **204 No Content**, which `Response.ok` already counts as
 * success; the callers read the status and never the body.
 */
export function signedUploadForm(signed: SignedUpload, file: Blob): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(signed.fields)) form.append(name, value);
  form.append('file', file);
  return form;
}
