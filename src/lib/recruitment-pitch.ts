import { api } from './api-client';
import { formatNumber } from './format';
import type { SignedUpload } from './tenant-config';

/**
 * The office's recruitment pitch documents (P17-T4 to P17-T6, D-slots, D-replace, D-agent-view,
 * D-settings; ADR-0177): the four the readiness counts, then *Company Profile* and *Agency Profile*,
 * optional.
 *
 * **Every slot's title, whether it is required, its checklist and the checklist's labels are the
 * server's** (the domain constants, `Recruitment_Section.html:626-661`), so nothing here names a slot but
 * its code's type. A slot's state is the server's too, by the one completion rule it states once, and so
 * are the banner's counts, over the required alone; this module draws them.
 */

export type PitchSlotCode = 'opportunity' | 'proof' | 'faq' | 'howtojoin' | 'company' | 'agency';

/** `missing` no file; `complete` every item ticked; `partial` one open; `uploaded` a file, no checklist. */
export type PitchSlotState = 'missing' | 'complete' | 'partial' | 'uploaded';

export interface PitchFile {
  name: string;
  bytes: number;
  /** `YYYY-MM-DD`, a day of the office's calendar the server resolved. */
  uploadedOn: string;
}

export interface PitchChecklistItem {
  code: string;
  label: string;
  ticked: boolean;
}

export interface PitchSlot {
  slot: PitchSlotCode;
  title: string;
  line: string;
  /** `false` for an optional document: tagged *Optional*, never *Missing*, counted in no figure of the banner. */
  required: boolean;
  state: PitchSlotState;
  file: PitchFile | null;
  /** `[]` for a slot with none. Who ticked is never sent. */
  checklist: PitchChecklistItem[];
  /** The file's version, `0` when never written. A tick names it, so one made against a file replaced since is refused. */
  version: number;
}

/** The banner's counts — the server's, over the required slots alone (ADR-0177 §3). */
export interface PitchSummary {
  /** `complete` or `uploaded`. */
  done: number;
  total: number;
  missing: number;
  /** `partial`. */
  unconfirmed: number;
}

export interface PitchMaterialsView {
  slots: PitchSlot[];
  summary: PitchSummary;
}

export interface PitchDocumentLink {
  url: string;
  expiresAt: string;
}

/** The six slots, their states and the counts: the agents' tab and the office's page read the same. */
export const readPitchMaterials = () => api<PitchMaterialsView>('/recruitment/pitch-materials');

/** A link signed for 300 seconds, asked for when *View PDF* is pressed and never held. */
export const pitchDocumentUrl = (slot: PitchSlotCode) =>
  api<PitchDocumentLink>(`/recruitment/pitch-materials/${encodeURIComponent(slot)}/url`);

/** A signature for one PDF, into the office's own folder the server picks. */
export const requestPitchUpload = (body: { filename: string; mimeType: string; bytes: number }) =>
  api<SignedUpload>('/kpm/settings/recruitment-pitch/uploads', { method: 'POST', body });

/**
 * Attach the uploaded file to a slot, or replace the one it holds. The server confirms the bytes
 * against storage, and **clears every tick of the slot in the same write**.
 */
export const attachPitchDocument = (slot: PitchSlotCode, storageKey: string) =>
  api<PitchSlot>(`/kpm/settings/recruitment-pitch/${encodeURIComponent(slot)}`, {
    method: 'PUT', body: { storageKey },
  });

/** Tick or untick one item, pinned to the file it was made against (`409 VERSION_CONFLICT` otherwise). */
export const setPitchConfirmation = (
  slot: PitchSlotCode, item: string, ticked: boolean, version: number,
) => api<PitchSlot>(
  `/kpm/settings/recruitment-pitch/${encodeURIComponent(slot)}/confirmations/${encodeURIComponent(item)}`,
  { method: 'PUT', body: { ticked, version } },
);

/**
 * The largest PDF the API signs, so a file is refused here **before** it is sent.
 *
 * Mirrors `ASSET_LIMITS.MAX_BYTES` (25 MB), which no response carries; the server checks again,
 * before it signs and against what storage reports (ADR-0040), so this is a courtesy to somebody's
 * data allowance and never the control.
 */
export const PDF_MAX_BYTES = 25 * 1024 * 1024;

/** The smallest size written in KB: anything smaller reads {@link UNDER_A_KILOBYTE} (I-521). */
const KILOBYTE = 1024;

/** A file smaller than a kilobyte, written as what it is rather than rounded up to `1 KB` (ADR-0177 §4). */
export const UNDER_A_KILOBYTE = '< 1 KB';

/**
 * `2,4 MB`, as the prototype writes a file's size (`:768`) with `id-ID`'s comma (ADR-0167 §1); a small file in KB
 * rather than `0,0 MB`; and **a file under 1 KB as `< 1 KB`** (ADR-0177 §4, P18.97-T5 AC-4; parity I-521), where it
 * read `1 KB` — the seed's one-page demonstration PDFs, which looked like placeholders. The size is the one storage
 * reported, which the server serves; nothing here rounds it up. The one size formatter: the training modules'
 * files use it too.
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= KILOBYTE * KILOBYTE) return `${formatNumber(bytes / KILOBYTE / KILOBYTE, { decimals: 1 })} MB`;
  if (bytes < KILOBYTE) return UNDER_A_KILOBYTE;
  return `${formatNumber(Math.round(bytes / KILOBYTE))} KB`;
}

/** The pitch's words, verbatim (`Recruitment_Section.html:681-818`; D-copy) but where a dated line says otherwise. */
export const PITCH_COPY = {
  settingsTitle: 'Recruitment pitch',
  missing: 'Missing',
  complete: 'Complete',
  uploaded: 'Uploaded',
  /**
   * **A file whose checklist is not finished** (`partial`), on both pages and for every reader — the client's words
   * (UI-029; ADR-0177 §1, P18.97-T5 AC-1; parity I-519), where the office read *"{n}/{m} confirmed"* (`:688`) and
   * agents *Uploaded* (`:696`). The checklist's own boxes still show which items are ticked.
   */
  needsConfirmation: 'Uploaded · needs confirmation',
  /** The tag on an optional document — *Company Profile*, *Agency Profile* (UI-042; ADR-0177 §2; parity I-520). */
  optional: 'Optional',
  /**
   * The client's words at every size (P18.95-T7 AC-1, grey text row 12; ADR-0167 §7) — under a required card's
   * *Missing*, and on an empty optional card, which never reads *Missing* (ADR-0177 §2).
   */
  noFile: 'Not uploaded yet',
  updated: (size: string, day: string) => `${size} · updated ${day}`,
  fileIcon: 'PDF',
  checklist: 'Confirm this PDF actually includes',
  viewPdf: 'View PDF',
  replace: 'Replace',
  uploadPdf: 'Upload PDF',
  ring: (done: number, total: number) => `${done}/${total}`,
  completeTitle: 'Recruitment Pitch is complete',
  completeLine: (total: number) =>
    `All ${total} documents are uploaded and fully confirmed — ready to show or send to a candidate.`,
  incompleteTitle: 'Recruitment Pitch is incomplete',
  /**
   * **The incomplete banner's line, in the client's words at every size** (P18.95-T7 AC-1, grey text row 11; ADR-0167
   * §7): *"2 missing, 1 needs checking."*, where it read *"2 not uploaded, 1 uploaded but not fully confirmed — not
   * yet ready to rely on for candidates."* The counts are the server's, as before.
   */
  notUploaded: (n: number) => `${n} missing`,
  notConfirmed: (n: number) => `${n} needs checking`,
  /** The two counts as one sentence: *2 missing, 1 needs checking.* — either alone where the other is none. */
  incompleteLine: (parts: readonly string[]) => `${parts.join(', ')}.`,
} as const;

/**
 * The words this module writes itself (D-copy): the Fills, the refusals, the accessible names. None
 * of OD-39's six words, no phase, no permission code.
 */
export const PITCH_OWN_COPY = {
  loading: 'Loading the pitch documents…',
  readFailed: 'Could not read the pitch documents.',
  tryAgain: 'Try again',
  /** The ring's name: the figure alone says nothing to somebody who cannot see the ring. */
  ringName: (done: number, total: number) => `${done} of ${total} documents complete`,
  viewName: (title: string) => `${PITCH_COPY.viewPdf}, ${title} — opens in a new tab`,
  uploadName: (title: string) => `${PITCH_COPY.uploadPdf}, ${title}`,
  replaceName: (title: string) => `${PITCH_COPY.replace}, ${title}`,
  opening: 'Opening…',
  linkFailed: 'Could not open this PDF.',
  tickFailed: 'Could not save that tick.',
  /** A tick refused with `409`: the file it was made against has been replaced since. */
  replacedSince:
    'This PDF was replaced while the page was open, so its ticks were cleared. Check the new file, then tick again.',
  /**
   * Said to assistive technology alone when a file is attached (`sr-only`): the new name and the
   * cleared boxes show at once on screen, and are silent to somebody who cannot see them change.
   */
  attached: (name: string, cleared: boolean) =>
    `“${name}” attached.${cleared ? ' Its ticks are cleared.' : ''}`,
} as const;
