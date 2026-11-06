import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { ScriptReviewState } from '@/lib/tenant-config';

/** Words with an element among them — a count in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** The seven fields of a product's attack plan an office may rewrite, in the override modal's order. */
type ScriptField = 'goodFit' | 'opening' | 'benefits' | 'fullScript' | 'objections' | 'nextAction';

/**
 * **Settings › Products** (`/kpm/settings/products`, P5-T5, P5-T10, P17-T9; P18.10-T4, settings-products): what an office
 * sells from its company's catalog — the shelf, a product's own words (its name, its description, the seven fields of
 * its attack plan, its three documents) — and *Script approvals*, the office's own gate on them. The frame and the shared
 * controls (*Save*, *Cancel*, the publish bar) are `settings.ts`'; a document's PDF upload is `recruitment-pitch.ts`'; a
 * product's channel (*Conventional*, *Syariah*) is `product-catalog.ts`' (`channelLabel`), as the agents' catalog says it.
 *
 * **English is the source** of the keys, the screen's words as built (`KPM_Owner.html:1700-1800`, `:2397-2404`, and the
 * module's own); the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it lacked in the glossary
 * for approval's §B.10. The attack plan's seven labels are the plan's own blocks (`plan.ts`, `product-catalog.ts`), so the
 * office edits under the words its agents read. **Kept English** (§A): the title and the tabs (*Products*, *Script
 * approvals*), *Attack Plan*, *Documents* (§A.3), *script* (§A.6), *KPM*. *Office* is *KPM* (§B.9). **Content stays as
 * typed** (ADR-0179 §5; §C1, §C3): the company's name, a product's name, its description and script, a document's slot
 * label and file name, a reason for sending a script back. A product's category on its badge is the server's code.
 *
 * @moved app/(tenant)/kpm/settings/products/
 */
const en = {
  title: kept('Products'),
  tabs: { products: kept('Products'), approvals: kept('Script approvals') },
  tabsLabel: 'Product sections',
  subtitle: ({ company }: { company: string }) =>
    `What your office sells from ${company}’s catalog, and the words you sell it with.`,
  /** The company's name before Branch info answers: the screen draws nothing that needs it until it has. */
  yourCompany: 'your company',

  /** The shelf. */
  noProducts: ({ company }: { company: string }) => `${company} has no products on its catalog yet.`,
  /** The shelf's one grey sentence, in the client's words (P18.9-T4 AC-6). */
  shelfNote: 'Your changes apply to this office only.',
  /** The shelf's count, as built (*1 products* included); `selling` is drawn bold; `withdrawn` null when none is. */
  shelfCount: ({ n, selling, withdrawn, company }: {
    n: number; selling: ReactNode; withdrawn: number | null; company: string;
  }) => words(
    `${n} products · `,
    selling,
    ' your agents can sell',
    withdrawn === null ? null : ` · ${withdrawn} withdrawn by ${company}`,
  ),
  callsIt: ({ company, name }: { company: string; name: string }) => `${company} calls it ${name}`,
  withdrawnBy: ({ company }: { company: string }) => `Withdrawn by ${company}`,
  review: {
    pending: 'Waiting for your approval',
    approved: 'Approved',
    rejected: 'Sent back',
  } satisfies Record<Exclude<ScriptReviewState, 'none'>, string>,
  reviewButton: 'Review',
  reviewName: ({ name }: { name: string }) => `Review ${name}`,
  /** The shelf on a phone (P19.2-T3 AC-3; UI-141, `kpm-owner-mobile` 7): its search and its chips. */
  search: 'Search products',
  noMatch: 'No product matches.',
  chips: { label: 'Filter products', all: 'All', pending: 'Waiting', rejected: 'Sent back' },
  agentsSellIt: 'Agents sell it',
  agentsSellItFor: ({ name }: { name: string }) => `Agents sell it, ${name}`,
  customize: 'Customize',
  close: 'Close',

  /** *Script approvals* (P5-T10, ADR-0037): the office's own gate. */
  ownCheck: 'This is your office’s own check, not a review by anybody else.',
  ownCheckLine: ({ company }: { company: string }) =>
    `Nobody at ${company} and nobody on the platform looks at these. What it gives you is that no half-finished script `
    + 'reaches your agents, and that every script they read carries a name and a time.',
  untilApproved: ({ company }: { company: string }) =>
    `Until you approve one, your agents keep reading whatever they read today — the last version your office approved, `
    + `or ${company}’s own words. Each row below says which.`,
  nothingWaiting: 'Nothing is waiting on you. A script comes here when somebody in your office rewrites one.',
  sentBack: ({ reason }: { reason: string }) => `Sent back: ${reason}`,
  sentBackLabel: 'Sent back:',
  readingEarlier: 'Your agents are reading an earlier version your office approved.',
  readingCompany: ({ company }: { company: string }) => `Your agents are reading ${company}’s words until this is approved.`,
  approve: 'Approve',
  sendBack: 'Send back',
  whySendBack: 'Why are you sending it back?',
  whySendBackHint: 'Required — somebody has to act on it, and “no” on its own is not something anybody can act on.',
  sendItBack: 'Send it back',

  /** A product opened. */
  codeReason: ({ company }: { company: string }) => `Your company’s. Every office of ${company} uses the same one.`,
  officeName: 'What your office calls it',
  yoursCalls: ({ company, name }: { company: string; name: string }) => `Yours. ${company} calls it ${name}.`,
  following: ({ company }: { company: string }) => `Following ${company}.`,
  yours: 'Yours.',
  saveName: 'Save the name',
  useCompanyName: ({ company }: { company: string }) => `Use ${company}’s name`,
  useCompanys: ({ company }: { company: string }) => `Use ${company}’s`,
  /** The prototype's own label, guidance folded into it (`KPM_Owner.html:1781`; parity L-20). */
  description: 'Short description (shown to agents)',
  attackPlan: 'The attack plan',
  attackPlanLine: ({ company }: { company: string }) =>
    `Starts from ${company}’s script — anything you change is saved for this office only, and your agents keep reading `
    + 'the approved words until you approve the new ones.',
  /** The seven the override modal names, numbered as it numbers them (`KPM_Owner.html:1785-1791`). */
  script: {
    goodFit: '0 · Good fit for',
    opening: '1 · Opening line',
    benefits: '2 · Lead with these benefits',
    fullScript: '3 · Full script — how to narrate it',
    // The cards since P19.4-T4 (ADR-0209 §9): the whole list is the office's or the company's.
    objections: '4 · If they push back',
    nextAction: '5 · Next action',
  } satisfies Record<ScriptField, string>,
  /** A rider under its base (P19.4-T4 AC-8; the riders spec's rule 6): no switch of its own. */
  ridersUnder: 'Riders sold with it',
  riderChip: kept('Rider'),
  riderFollows: ({ on }: { on: boolean }): string => (on
    ? 'Sold with its base products — it has no switch of its own.'
    : 'Not sold: none of its base products is. It has no switch of its own.'),
  documents: kept('Documents'),
  uploadedByOffice: ({ file }: { file: string }) => `Uploaded by your office — ${file}`,
  fromCatalog: ({ company }: { company: string }) => `From ${company}’s catalog`,
  noDocument: 'Nobody has attached one yet.',
  open: 'Open',
  /** A document's upload (P17-T9), named for its slot; the slot's label is the server's. */
  replace: 'Replace',
  upload: '+ Upload',
  replaceName: ({ label }: { label: string }) => `Replace ${label}`,
  uploadName: ({ label }: { label: string }) => `Upload ${label}`,
  /**
   * **The proposal's FAQ and plan highlights, the office's own** (P19.7-T1 AC-3; ADR-0225 §5; the proposal spec's
   * decision 6): held for approval with the script, as every sentence an agent repeats to a client is.
   */
  proposalLine: ({ company }: { company: string }) =>
    `What agents read beside a proposal starts from ${company}’s. Anything you change waits for your approval with the `
    + 'script.',
  saveFaq: 'Save questions and answers',
  planHighlights: 'Plan highlights',
  planHighlight: ({ plan, n, part }: { plan: string; n: number; part: 'label' | 'value' }) =>
    `${plan}, highlight ${n}, ${part === 'label' ? 'label' : 'value'}`,
  popularPlan: 'Most chosen',
  addHighlight: ({ plan }: { plan: string }) => `+ Add a highlight to ${plan}`,
  removeHighlight: ({ plan, n }: { plan: string; n: number }) => `Remove ${plan}’s highlight ${n}`,
  saveHighlights: 'Save plan highlights',
  /** The approval queue's lines for the two (P19.7-T1 AC-3). */
  faqToApprove: 'Questions and answers',
  highlightsToApprove: ({ plan }: { plan: string }) => `Highlights of ${plan}`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Products'),
  tabs: { products: kept('Products'), approvals: kept('Script approvals') },
  tabsLabel: 'Bagian produk',
  subtitle: ({ company }) =>
    `Yang dijual ${kept('KPM')} Anda dari katalog ${company}, dan kata-kata yang Anda pakai untuk menjualnya.`,
  yourCompany: 'perusahaan Anda',

  noProducts: ({ company }) => `${company} belum punya produk di katalognya.`,
  shelfNote: `Perubahan Anda hanya berlaku untuk ${kept('KPM')} ini.`,
  shelfCount: ({ n, selling, withdrawn, company }) => words(
    `${n} produk · `,
    selling,
    ' dapat dijual agent Anda',
    withdrawn === null ? null : ` · ${withdrawn} ditarik oleh ${company}`,
  ),
  callsIt: ({ company, name }) => `${company} menyebutnya ${name}`,
  withdrawnBy: ({ company }) => `Ditarik oleh ${company}`,
  review: {
    pending: 'Menunggu persetujuan Anda',
    approved: 'Disetujui',
    rejected: 'Dikembalikan',
  },
  reviewButton: 'Tinjau',
  reviewName: ({ name }) => `Tinjau ${name}`,
  search: 'Cari produk',
  noMatch: 'Tidak ada produk yang cocok.',
  chips: { label: 'Saring produk', all: 'Semua', pending: 'Menunggu', rejected: 'Dikembalikan' },
  agentsSellIt: 'Agent menjualnya',
  agentsSellItFor: ({ name }) => `Agent menjualnya, ${name}`,
  customize: 'Sesuaikan',
  close: 'Tutup',

  ownCheck: `Ini pemeriksaan ${kept('KPM')} Anda sendiri, bukan tinjauan oleh pihak lain.`,
  ownCheckLine: ({ company }) =>
    `Tidak ada seorang pun di ${company} maupun di platform yang memeriksanya. Manfaatnya bagi Anda: tidak ada `
    + `${kept('script')} setengah jadi yang sampai ke agent Anda, dan setiap ${kept('script')} yang mereka baca `
    + 'mencantumkan nama dan waktu.',
  untilApproved: ({ company }) =>
    'Sampai Anda menyetujui salah satunya, agent Anda tetap membaca apa yang mereka baca hari ini — versi terakhir yang '
    + `disetujui ${kept('KPM')} Anda, atau kata-kata ${company} sendiri. Setiap baris di bawah menyebutkan yang mana.`,
  nothingWaiting: `Tidak ada yang menunggu Anda. ${kept('Script')} masuk ke sini saat seseorang di ${kept('KPM')} Anda `
    + 'menulis ulang salah satunya.',
  sentBack: ({ reason }) => `Dikembalikan: ${reason}`,
  sentBackLabel: 'Dikembalikan:',
  readingEarlier: `Agent Anda membaca versi sebelumnya yang disetujui ${kept('KPM')} Anda.`,
  readingCompany: ({ company }) => `Agent Anda membaca kata-kata ${company} sampai ini disetujui.`,
  approve: 'Setujui',
  sendBack: 'Kembalikan',
  whySendBack: 'Mengapa Anda mengembalikannya?',
  whySendBackHint: 'Wajib diisi — seseorang harus menindaklanjutinya, dan “tidak” saja bukan sesuatu yang bisa '
    + 'ditindaklanjuti.',
  sendItBack: `Kembalikan ${kept('script')} ini`,

  codeReason: ({ company }) => `Milik perusahaan Anda. Setiap ${kept('KPM')} di ${company} memakai kode yang sama.`,
  officeName: `Nama yang dipakai ${kept('KPM')} Anda`,
  yoursCalls: ({ company, name }) => `Milik Anda. ${company} menyebutnya ${name}.`,
  following: ({ company }) => `Mengikuti ${company}.`,
  yours: 'Milik Anda.',
  saveName: 'Simpan nama',
  useCompanyName: ({ company }) => `Gunakan nama dari ${company}`,
  useCompanys: ({ company }) => `Gunakan milik ${company}`,
  description: 'Deskripsi singkat (ditampilkan ke agent)',
  attackPlan: kept('Attack Plan'),
  attackPlanLine: ({ company }) =>
    `Dimulai dari ${kept('script')} ${company} — apa pun yang Anda ubah hanya disimpan untuk ${kept('KPM')} ini, dan agent `
    + 'Anda tetap membaca kata-kata yang sudah disetujui sampai Anda menyetujui yang baru.',
  // The plan's own blocks, as the agents read them (`plan.ts`; `product-catalog.ts`' *Script lengkap*).
  script: {
    goodFit: '0 · Cocok untuk',
    opening: '1 · Kalimat pembuka',
    benefits: '2 · Tekankan manfaat berikut',
    fullScript: `3 · ${kept('Script')} lengkap — cara menyampaikannya`,
    objections: '4 · Jika ada keberatan',
    nextAction: '5 · Tindakan berikutnya',
  },
  ridersUnder: `${kept('Rider')} yang ikut dijual`,
  riderChip: kept('Rider'),
  riderFollows: ({ on }) => (on
    ? 'Dijual bersama produk dasarnya — tidak punya tombol sendiri.'
    : 'Tidak dijual: tidak ada produk dasarnya yang dijual. Tidak punya tombol sendiri.'),
  documents: kept('Documents'),
  uploadedByOffice: ({ file }) => `Diunggah oleh ${kept('KPM')} Anda — ${file}`,
  fromCatalog: ({ company }) => `Dari katalog ${company}`,
  noDocument: 'Belum ada yang melampirkan dokumen.',
  open: 'Buka',
  replace: 'Ganti',
  upload: '+ Unggah',
  replaceName: ({ label }) => `Ganti ${label}`,
  uploadName: ({ label }) => `Unggah ${label}`,
  proposalLine: ({ company }) =>
    `Yang dibaca agent di samping proposal dimulai dari milik ${company}. Apa pun yang Anda ubah menunggu persetujuan Anda `
    + `bersama ${kept('script')}.`,
  saveFaq: 'Simpan tanya-jawab',
  planHighlights: 'Angka utama plan',
  planHighlight: ({ plan, n, part }) => `${plan}, angka utama ${n}, ${part === 'label' ? 'label' : 'nilai'}`,
  popularPlan: 'Paling banyak dipilih',
  addHighlight: ({ plan }) => `+ Tambah angka utama ${plan}`,
  removeHighlight: ({ plan, n }) => `Hapus angka utama ${n} ${plan}`,
  saveHighlights: 'Simpan angka utama plan',
  faqToApprove: 'Tanya-jawab',
  highlightsToApprove: ({ plan }) => `Angka utama ${plan}`,
};

export const settingsProductsMessages = defineMessages({ en, id });
