import {
  confirmTrainingUpload,
  requestTrainingUpload,
  signedUploadForm,
  type ContentFile,
  type ModuleContent,
  type ModuleContentView,
  type TrainingCategoryRow,
  type TrainingModuleRow,
  type TrainingSkillRow,
} from '@/lib/tenant-config';

/** A category without the skills the read nests in it. */
export type TrainingCategory = Omit<TrainingCategoryRow, 'skills'>;
/** A skill without the modules the read nests in it. */
export type TrainingSkill = Omit<TrainingSkillRow, 'modules'>;
export type TrainingModule = TrainingModuleRow;

/** The read's tree as three lists — a module's page finds its skill and category in them. */
export function flattenTraining(tree: TrainingCategoryRow[]) {
  const categories: TrainingCategory[] = tree.map(({ skills: _skills, ...category }) => category);
  const skills: TrainingSkill[] = tree.flatMap((category) =>
    category.skills.map(({ modules: _modules, ...skill }) => skill));
  const modules: TrainingModule[] = tree.flatMap((category) =>
    category.skills.flatMap((skill) => skill.modules));
  return { categories, skills, modules };
}

/**
 * Whether a code is taken at one level of this office — **archived rows included**. A code is never reused (invariant
 * §3), and the server refuses one that is; saying so beside the field is kinder than a refusal after *Tambah*.
 */
export function codeTaken(rows: readonly { code: string }[], code: string): boolean {
  const wanted = code.trim().toUpperCase();
  return wanted !== '' && rows.some((r) => r.code.toUpperCase() === wanted);
}

/**
 * **A category's *"n skill · n modul"*, a skill's *"n modul"*** (P19.25-T4 AC-1): what it holds that is not archived —
 * drafts included, because the Owner is shown their own catalog, not what agents are offered.
 */
export function categoryCounts(category: TrainingCategoryRow): { skills: number; modules: number } {
  const skills = category.skills.filter((s) => s.status === 'active');
  return { skills: skills.length, modules: skills.reduce((n, s) => n + liveModules(s), 0) };
}

export const liveModules = (skill: TrainingSkillRow): number => skill.modules.filter((m) => m.status === 'active').length;

/**
 * **What a module's material may be: any format the owner named** (P19.25-T4 AC-2, ADR-0282 §3; backend
 * `TRAINING_FILE_MIME_TYPES`): each type the API signs, by the extensions a picker offers and a desktop with no type
 * reports. A mirror the server checks again — before it signs and against what storage holds (ADR-0040). The template's
 * material takes the same (ADR-0208 §1). Pinned by `training-view.spec.ts` and, against the API's document,
 * `contract.spec.ts`.
 */
export const TRAINING_FILE_TYPES: readonly { mimeType: string; extensions: readonly string[]; video?: true }[] = [
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { mimeType: 'image/png', extensions: ['png'] },
  { mimeType: 'image/webp', extensions: ['webp'] },
  { mimeType: 'application/pdf', extensions: ['pdf'] },
  { mimeType: 'video/mp4', extensions: ['mp4'], video: true },
  { mimeType: 'text/csv', extensions: ['csv'] },
  { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'] },
  { mimeType: 'text/html', extensions: ['html', 'htm'] },
  { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['pptx'] },
  { mimeType: 'application/vnd.ms-powerpoint', extensions: ['ppt'] },
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },
  { mimeType: 'application/msword', extensions: ['doc'] },
  { mimeType: 'video/webm', extensions: ['webm'], video: true },
  { mimeType: 'video/quicktime', extensions: ['mov'], video: true },
];

const acceptOf = (types: typeof TRAINING_FILE_TYPES) =>
  types.flatMap((t) => [t.mimeType, ...t.extensions.map((e) => `.${e}`)]).join(',');

/** *Unggah materi*'s picker: every type and every extension. */
export const TRAINING_ACCEPT = acceptOf(TRAINING_FILE_TYPES);
/** A module page's *File* picker: every type but a video. */
export const TRAINING_FILE_ACCEPT = acceptOf(TRAINING_FILE_TYPES.filter((t) => !t.video));
/** A module page's *Video* picker. */
export const TRAINING_VIDEO_ACCEPT = acceptOf(TRAINING_FILE_TYPES.filter((t) => t.video));

/**
 * **The type a chosen file is sent as, or `null` when it is no material** (P19.25-T4 AC-2): its own type where the browser
 * reports one of the list; **only where it reports none**, the one its extension names — a desktop often reports none
 * for a `.pptx` or an `.html`. A type the browser did report and the list lacks is refused whatever the name says: the
 * name is the uploader's to choose, the media type is not (`module-content.spec.tsx`, *a mis-declared file*).
 */
export function trainingFileType(file: { type: string; name: string }): string | null {
  if (TRAINING_FILE_TYPES.some((t) => t.mimeType === file.type)) return file.type;
  if (file.type !== '') return null;
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return TRAINING_FILE_TYPES.find((t) => extension && t.extensions.includes(extension))?.mimeType ?? null;
}

export const isVideoType = (mimeType: string) => TRAINING_FILE_TYPES.some((t) => t.mimeType === mimeType && t.video);

/**
 * **The module's material once a file is chosen on its row** (P19.25-T4 AC-2, ADR-0282 §2):
 *
 * - *Unggah materi* — the module shows nothing: the file is its material.
 * - *Ganti* on the office's own material — the item the row names (the first file, else video, else link) is replaced by
 *   the file; everything else the office holds stays.
 * - *Ganti* on the template's material — the office's material becomes the file alone. The template's is never copied
 *   (its files are the company's, never attachable as an office's) and never touched: *Urungkan perubahan saya* on the
 *   module's page puts it back (ADR-0208 §3).
 *
 * A video goes under *Video*, anything else under *File*.
 */
export function withUploaded(view: Pick<ModuleContentView, 'content' | 'overridden'>, item: ContentFile): ModuleContent {
  const into = isVideoType(item.mimeType) ? 'videos' : 'files';
  if (!view.overridden) return { files: [], videos: [], links: [], [into]: [item] };
  const next: ModuleContent = {
    files: [...view.content.files], videos: [...view.content.videos], links: [...view.content.links],
  };
  if (next.files.length > 0) next.files.shift();
  else if (next.videos.length > 0) next.videos.shift();
  else if (next.links.length > 0) next.links.shift();
  next[into] = [item, ...next[into]];
  return next;
}

/**
 * **One file from the picker to an item a module can hold** (P5-T2's three steps, ADR-0040): sign an upload into the
 * office's own folder, send the bytes straight to storage, and confirm what landed. The item is attached by saving the
 * module's material; nothing is attached when a step fails.
 */
export async function uploadTrainingFile(file: File, mimeType: string): Promise<ContentFile> {
  const signed = await requestTrainingUpload({ filename: file.name, mimeType, bytes: file.size });
  const sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, file) });
  if (!sent.ok) throw new Error('upload failed');
  const confirmed = await confirmTrainingUpload(signed.storageKey);
  return { id: '', label: file.name, storageKey: confirmed.storageKey, mimeType: confirmed.mimeType, bytes: confirmed.bytes };
}
