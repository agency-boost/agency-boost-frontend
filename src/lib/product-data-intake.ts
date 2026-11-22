'use client';

import { api, apiBlob } from './api-client';

/**
 * ***Unggah file* and *Ilustrasi*** (P19.15-T2, T3; ADR-0259): the uploads read by Claude, their *Yang kami pahami* cards
 * and question cards, and a product's official illustrations condensed into the PDF's detail blocks. Every route refuses
 * on its own — who may read, who may manage, which company — so what a screen hides is never the control.
 */

export type IntakeStatus = 'reading' | 'needs_answers' | 'ready' | 'applied' | 'rejected' | 'failed';
export type IntakeItemKind =
  | 'premium_table' | 'product_rules' | 'illustration' | 'new_product' | 'withdrawn_product' | 'field_change' | 'percent_change';
export type IntakeItemStatus = 'needs_answers' | 'ready' | 'applied' | 'rejected';
export type IntakeQuestionKind =
  | 'product' | 'company' | 'column' | 'date' | 'unknown_product' | 'type_number' | 'approve_rule' | 'text' | 'choice';

export interface IntakeFile {
  index: number;
  name: string;
  kind: 'xlsx' | 'csv' | 'pdf' | 'image' | 'docx';
  bytes: number;
  status: 'reading' | 'read' | 'failed';
  /** Why it failed, as a code the screen words. */
  failure: string | null;
  items: number;
  /** The original is kept, so a source links to it. */
  kept: boolean;
}

export interface Intake {
  id: string;
  companyId: string | null;
  companyName: string | null;
  status: IntakeStatus;
  failure: string | null;
  files: IntakeFile[];
  uploadedBy: string;
  uploadedByName: string | null;
  createdAt: string;
  readAt: string | null;
  items: number;
  /** Questions still to answer, over every card. */
  open: number;
}

export interface IntakeList { aiReading: boolean; intakes: Intake[] }

export interface IntakeSource {
  file: number;
  fileName: string;
  page: number | null;
  sheet: string | null;
  cell: string | null;
  quote: string | null;
}

export interface IntakeDiffRow {
  key: string;
  label: string;
  old: string | null;
  new: string | null;
  certain: boolean;
  source: IntakeSource;
}

export interface IntakeChoice { value: string; label: string }

export interface IntakeQuestion {
  id: string;
  kind: IntakeQuestionKind;
  text: string;
  choices: IntakeChoice[];
  about: string | null;
  when: { question: string; answer: string } | null;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  /** Still to answer. */
  open: boolean;
  /** Asked at all: a follow-up waits on another answer. */
  asked: boolean;
}

export interface IntakeCard {
  id: string;
  companyId: string | null;
  productId: string | null;
  productName: string | null;
  productAsWritten: string | null;
  kind: IntakeItemKind;
  summary: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: IntakeSource;
  diff: IntakeDiffRow[];
  table: { rows: number; columns: { column: string; header: string; meaning: string }[]; gaps: string[]; basis: string | null; currency: string | null } | null;
  percent: { asWritten: string; direction: string; rule: string } | null;
  newProductName: string | null;
  questions: IntakeQuestion[];
  confidence: 'high' | 'low';
  status: IntakeItemStatus;
  appliedRef: { kind: 'rate_table' | 'product' | 'illustration'; id: string } | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface IntakeDetail extends Intake {
  canManage: boolean;
  cards: IntakeCard[];
}

/** A company's recent uploads — or, `null`, every one the Super Admin sees from *Perusahaan*. */
export const readIntakes = (companyId: string | null) =>
  api<IntakeList>(companyId ? `/product-data/companies/${companyId}/intakes` : '/product-data/intakes');

/** **Files uploaded**: answered at once, `reading`; poll `readIntake` until the status moves. */
export function uploadIntake(companyId: string | null, files: readonly File[]): Promise<Intake> {
  const form = new FormData();
  for (const file of files) form.append('files', file, file.name);
  return companyId
    ? api<Intake>(`/product-data/companies/${companyId}/intakes`, { method: 'POST', body: form })
    : api<Intake>('/product-data/intakes', { method: 'POST', body: form });
}

export const readIntake = (intakeId: string) => api<IntakeDetail>(`/product-data/intakes/${intakeId}`);

/** A short-lived link to an original file: what a source opens. */
export const intakeFileLink = (intakeId: string, index: number) =>
  api<{ url: string }>(`/product-data/intakes/${intakeId}/files/${index}`);

export const answerIntakeQuestion = (intakeId: string, itemId: string, questionId: string, answer: string) =>
  api<IntakeCard>(`/product-data/intakes/${intakeId}/items/${itemId}/answers`, { method: 'POST', body: { questionId, answer } });

export const confirmIntakeCard = (intakeId: string, itemId: string) =>
  api<IntakeCard>(`/product-data/intakes/${intakeId}/items/${itemId}/confirm`, { method: 'POST' });

export const rejectIntakeCard = (intakeId: string, itemId: string) =>
  api<IntakeCard>(`/product-data/intakes/${intakeId}/items/${itemId}/reject`, { method: 'POST' });

// ------------------------------------------------------------------------------------------------ Ilustrasi

export type PdfDetailBlockKind = 'manfaat' | 'jadwal' | 'masa' | 'pengecualian' | 'nilai_tunai';
export type IllustrationStatus = 'reading' | 'draft' | 'published' | 'failed';

export interface IllustrationCheck {
  state: 'match' | 'mismatch' | 'unchecked';
  reason: 'differs' | 'name' | 'grammar' | 'few_samples' | null;
  samples: { page: number | null; inputs: Record<string, number>; printedMinor: number; computedMinor: number | null; match: boolean }[];
}

export interface IllustrationRow {
  id: string;
  label: string;
  note: string | null;
  formula: string | null;
  text: string | null;
  page: number | null;
  check: IllustrationCheck | null;
}

export interface IllustrationBlock { block: PdfDetailBlockKind; page: number | null; rows: IllustrationRow[] }

export interface Illustration {
  id: string;
  companyId: string;
  productId: string;
  plan: string | null;
  fileName: string;
  hasFile: boolean;
  illustrationDate: string;
  status: IllustrationStatus;
  failure: string | null;
  blocks: IllustrationBlock[];
  dropped: string[];
  sampleInputs: Record<string, number>;
  formulaNames: string[];
  mismatches: number;
  unchecked: number;
  intakeItemId: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
}

export interface IllustrationList { aiReading: boolean; illustrations: Illustration[] }

export interface PreviewRow { label: string; value: string; block: PdfDetailBlockKind | null; kind: 'value' | 'detail' | 'benefit' | 'cash' }

export interface BoxPreview {
  rows: PreviewRow[];
  withTwo: { kept: number; dropped: PreviewRow[] };
  withMore: { kept: number; dropped: PreviewRow[] };
  missing: string[];
  fits: boolean;
}

/** A row as the editor sends it: its `id` keeps the numbers it is checked against; `null` for a new one. */
export interface RowInput { id: string | null; label: string; note: string | null; formula: string | null; text: string | null }

export const readIllustrations = (companyId: string, productId: string) =>
  api<IllustrationList>(`/product-data/companies/${companyId}/products/${productId}/illustrations`);

/** **An official illustration uploaded**: the PDF, its date and plan; read in the background. */
export function uploadIllustration(companyId: string, productId: string, file: File, illustrationDate: string, plan: string | null): Promise<Illustration> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('illustrationDate', illustrationDate);
  if (plan) form.append('plan', plan);
  return api<Illustration>(`/product-data/companies/${companyId}/products/${productId}/illustrations`, { method: 'POST', body: form });
}

export const readIllustration = (companyId: string, id: string) => api<Illustration>(`/product-data/companies/${companyId}/illustrations/${id}`);

export const saveIllustration = (companyId: string, id: string, blocks: { block: PdfDetailBlockKind; rows: RowInput[] }[]) =>
  api<Illustration>(`/product-data/companies/${companyId}/illustrations/${id}`, { method: 'PATCH', body: { blocks } });

export const previewIllustration = (companyId: string, id: string) =>
  api<BoxPreview>(`/product-data/companies/${companyId}/illustrations/${id}/preview`);

/** The sample proposal's file, as agents would print it. */
export const previewIllustrationPdf = (companyId: string, id: string) =>
  apiBlob(`/product-data/companies/${companyId}/illustrations/${id}/preview.pdf`);

export const illustrationFileLink = (companyId: string, id: string) =>
  api<{ url: string }>(`/product-data/companies/${companyId}/illustrations/${id}/file`);

export const publishIllustration = (companyId: string, id: string) =>
  api<Illustration>(`/product-data/companies/${companyId}/illustrations/${id}/publish`, { method: 'POST' });
