import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, type Language } from '@/i18n/language';
import { recruitmentPitchMessages } from '@/i18n/messages/recruitment-pitch';
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
  /**
   * What storage holds (P19.6-T2): `application/pdf`, or `text/html` — a page drawn only in the sandboxed window, never
   * opened in a tab (ADR-0217 §4). The API always sends it; optional so a fixture that is about something else need not.
   */
  mimeType?: string;
}

/** **A material given as a link** (P19.21-T3 AC-6, ADR-0274): the `https://` address and the day it was set. */
export interface PitchLink {
  url: string;
  /** `YYYY-MM-DD`, a day of the office's calendar the server resolved. */
  addedOn: string;
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
  /**
   * The material given as a link, where the office gave one instead of a file (P19.21-T3 AC-6). The API always sends
   * it; optional so a fixture that is about something else need not — absent reads as no link.
   */
  link?: PitchLink | null;
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
  /**
   * **The same over all six, no split** (P19.21-T3 AC-6, ADR-0274): *Pengaturan › Recruitment pitch*'s *"2/6 materi
   * siap"*. Optional for a fixture that is about something else.
   */
  all?: { ready: number; total: number; missing: number; unconfirmed: number };
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

/**
 * **A link in place of a file** (P19.21-T3 AC-6, ADR-0274): an `https://` address; the server clears the slot's ticks in
 * the same write, as an attach does, and refuses anything else (`400 VALIDATION_FAILED`).
 */
export const setPitchLink = (slot: PitchSlotCode, url: string) =>
  api<PitchSlot>(`/kpm/settings/recruitment-pitch/${encodeURIComponent(slot)}/link`, { method: 'PUT', body: { url } });

/**
 * **What a pitch material may be** (P19.21-T3 AC-6, ADR-0274; backend `PITCH_MATERIAL_MIME_TYPES`): each type the API
 * signs, by the extensions a picker offers and a desktop with no type reports. A mirror the server checks again, before
 * it signs and against what storage holds (ADR-0040); pinned by `recruitment-pitch.spec.ts`.
 */
export const PITCH_FILE_TYPES: readonly { mimeType: string; extensions: readonly string[] }[] = [
  { mimeType: 'application/pdf', extensions: ['pdf'] },
  { mimeType: 'text/html', extensions: ['html', 'htm'] },
  { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['pptx'] },
  { mimeType: 'application/vnd.ms-powerpoint', extensions: ['ppt'] },
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },
  { mimeType: 'application/msword', extensions: ['doc'] },
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { mimeType: 'image/png', extensions: ['png'] },
  { mimeType: 'image/webp', extensions: ['webp'] },
  { mimeType: 'video/mp4', extensions: ['mp4'] },
  { mimeType: 'video/webm', extensions: ['webm'] },
  { mimeType: 'video/quicktime', extensions: ['mov'] },
];

/** A picker's `accept` for a pitch material: every type and every extension. */
export const PITCH_ACCEPT = PITCH_FILE_TYPES.flatMap((t) => [t.mimeType, ...t.extensions.map((e) => `.${e}`)]).join(',');

/**
 * **The type a chosen file is sent as, or `null` when it is no pitch format** (P19.21-T3 AC-6): its own type where the
 * browser reports one of the list, else the one its extension names — a desktop often reports none for a `.pptx`.
 */
export function pitchFileType(file: { type: string; name: string }): string | null {
  if (PITCH_FILE_TYPES.some((t) => t.mimeType === file.type)) return file.type;
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return PITCH_FILE_TYPES.find((t) => extension && t.extensions.includes(extension))?.mimeType ?? null;
}

/**
 * **How an agent's tap opens a material** (P19.21-T3 AC-6, ADR-0274): a link in a new tab; an HTML page in the sandboxed
 * window (ADR-0217 §4); PowerPoint and Word download (storage serves them as attachments, named by their type); a PDF,
 * an image and a video open in a new tab, as a PDF always did.
 */
export type PitchOpening = 'link' | 'sandboxed' | 'download' | 'tab';
export function pitchOpening(slot: Pick<PitchSlot, 'file' | 'link'>): PitchOpening | null {
  if (slot.link) return 'link';
  const type = slot.file?.mimeType ?? null;
  if (!slot.file) return null;
  if (type === 'text/html') return 'sandboxed';
  if (type && /officedocument|msword|ms-powerpoint/.test(type)) return 'download';
  return 'tab';
}

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
 * rather than `0,0 MB`; and **a file under 1 KB as `< 1 KB`** (ADR-0177 §4, P18.9-T5 AC-4; parity I-521), where it
 * read `1 KB` — the seed's one-page demonstration PDFs, which looked like placeholders. The size is the one storage
 * reported, which the server serves; nothing here rounds it up. The one size formatter: the training modules'
 * files use it too. In the reader's `language` (P18.10-T4): `2.4 MB` in English, Indonesian when none is passed; *MB*
 * and *KB* are the same in both.
 */
export function formatFileSize(bytes: number, language: Language = DEFAULT_LANGUAGE): string {
  if (bytes >= KILOBYTE * KILOBYTE) return `${formatNumber(bytes / KILOBYTE / KILOBYTE, { decimals: 1 }, language)} MB`;
  if (bytes < KILOBYTE) return UNDER_A_KILOBYTE;
  return `${formatNumber(Math.round(bytes / KILOBYTE), {}, language)} KB`;
}

/** The ring's figure, *2/4*: done over the required total, the server's counts, the same in both languages. */
export const pitchRing = (done: number, total: number) => `${done}/${total}`;

/** The pitch's words in English: the catalogue's source (`messages/recruitment-pitch.ts`), which a screen reads in the
 * reader's language with `useMessages(recruitmentPitchMessages)` (P18.10-T4). */
const EN = recruitmentPitchMessages.en;

/**
 * **The pitch's words, in English** (`Recruitment_Section.html:681-818`; D-copy) — for code with no reader to ask, as
 * the screens' words were before P18.10-T4 moved them into the catalogue, where they are written once. *Uploaded ·
 * needs confirmation* is the client's (UI-029; ADR-0177 §1, P18.9-T5 AC-1; parity I-519), *Optional* the tag on
 * *Company Profile* and *Agency Profile* (UI-042; ADR-0177 §2; I-520), *Not uploaded yet* and the incomplete line the
 * client's at every size (P18.7-T7 AC-1, grey text rows 11 and 12).
 */
export const PITCH_COPY = {
  settingsTitle: kept('Recruitment pitch'),
  missing: EN.missing,
  complete: EN.complete,
  uploaded: EN.uploaded,
  needsConfirmation: EN.needsConfirmation,
  optional: EN.optional,
  noFile: EN.noFile,
  updated: (size: string, day: string) => EN.updated({ size, day }),
  fileIcon: EN.fileIcon,
  checklist: EN.checklist,
  viewPdf: EN.viewPdf,
  replace: EN.replace,
  uploadPdf: EN.uploadPdf,
  ring: pitchRing,
  completeTitle: EN.completeTitle,
  completeLine: (total: number) => EN.completeLine({ total }),
  incompleteTitle: EN.incompleteTitle,
  notUploaded: (n: number) => EN.missingCount({ n }),
  notConfirmed: (n: number) => EN.needsChecking({ n }),
  /** The two counts as one sentence: *2 missing, 1 needs checking.* — either alone where the other is none. */
  incompleteLine: (parts: readonly string[]) => EN.incompleteLine({ parts }),
} as const;

/**
 * The words this module writes itself (D-copy), in English: the Fills, the refusals, the accessible names. None
 * of OD-39's six words, no phase, no permission code.
 */
export const PITCH_OWN_COPY = {
  loading: EN.loading,
  readFailed: EN.readFailed,
  tryAgain: EN.tryAgain,
  ringName: (done: number, total: number) => EN.ringName({ done, total }),
  viewName: (title: string) => EN.viewName({ title }),
  uploadName: (title: string) => EN.uploadName({ title }),
  replaceName: (title: string) => EN.replaceName({ title }),
  opening: EN.opening,
  linkFailed: EN.linkFailed,
  tickFailed: EN.tickFailed,
  replacedSince: EN.replacedSince,
  attached: (name: string, cleared: boolean) => EN.attached({ name, cleared }),
} as const;
