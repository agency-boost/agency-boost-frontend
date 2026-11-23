import { api, apiBlob } from './api-client';

/**
 * ***Unduh akun & password (PDF)*** (P19.30-T1, T2; ADR-0288): the KPM's accounts not yet their people's own, each with a
 * fresh temporary password, in one PDF. The server lists them, issues the passwords, names the file and builds it; the
 * screen asks how many first, then has it made, then saves it — it computes nothing. `member:issue_temporary_password`: a KPM's
 * Owners and the Super Admin inside the KPM, never a KPM Admin.
 *
 * Both calls name the KPM the reader is in — an Owner's own, or the one the Super Admin has entered (`X-Kpm-Id`, sent by
 * `api-client` on every non-`/admin` route) — and `membershipIds` narrows them to those memberships: *Import people*'s
 * own PDF, for the accounts its commit made.
 */
const body = (membershipIds?: readonly string[]) => (membershipIds ? { membershipIds: [...membershipIds] } : {});

/** `POST /members/temporary-passwords/preview`'s answer. */
export interface TemporaryPasswordsPreview {
  /** How many the PDF would list now; `0`: nobody. */
  count: number;
  kpmName: string;
  /** What the download is saved as: `Akun-password-{KPM}-{YYYY-MM-DD}.pdf`. */
  fileName: string;
}

/** **`POST /members/temporary-passwords/preview`** — how many the PDF would list now. Issues nothing. */
export const previewTemporaryPasswords = (membershipIds?: readonly string[]) =>
  api<TemporaryPasswordsPreview>('/members/temporary-passwords/preview', { method: 'POST', body: body(membershipIds) });

/**
 * **`POST /members/temporary-passwords`** — issues the passwords and answers the PDF, which the dialog **keeps** and saves
 * on the reader's own click (`saveFile`, *Unduh PDF*; the P19.30 browser walk). Every older PDF stops working for the
 * people in this one.
 */
export const issueTemporaryPasswords = (membershipIds?: readonly string[]): Promise<Blob> =>
  apiBlob('/members/temporary-passwords', { method: 'POST', body: body(membershipIds) });
