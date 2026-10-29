import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a version in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **The Super Admin's Company template screen** (`/admin/companies/[companyId]/template`, P4-T8, ADR-0018, ADR-0115;
 * P18.98-T6, area "admin-template"; `functional/tenant-config.md`, *The module's own strings*): the screen's frame — its
 * line, the way back, the tab row's name and the tooltips of the tabs every template shares, the question before an
 * unsaved draft is discarded, the publish card and the fallback for a kind with no editor — and the controls around a
 * company's named templates: the picker (`template-picker.tsx`), *New template*, *Rename*, *Make default*, *Archive*,
 * *Import from another company* (`import-template-dialog.tsx`), *Save as template* from an office's page
 * (`save-as-template-dialog.tsx`, with `lib/templates.ts`' sentence once it has made one), and the office's *Activity
 * binding* card (`activity-binding-card.tsx`). The two last are drawn on `/admin/tenants/[kpmId]`, whose own words are
 * another area's.
 *
 * **English is the source**, every word as it was. The Indonesian is the approved glossary's (OD-237; §B.0's voice):
 * *Simpan · Batal · Ganti nama · Arsipkan* (§B.1), *Menyimpan… · Mengimpor…* (§B.2), *Diarsipkan · Draf* (§B.3), *Nama*
 * (§B.4), and the words the API's own refusals already use for the same things (P18.98-T5's rows of §B.10): a template is
 * a ***templat***, its default the ***default***, an activity binding a ***pengaitan aktivitas***, the role ladder the
 * ***susunan jenjang***; what it lacked is proposed in the glossary for approval's §B.10. **Kept English** (§A): the
 * title and every tab (§A.2, §A.3), *KPM* and *Owner* (§A.5; *office* is *KPM*, §B.9), *Template library*, *AgencyBoost*,
 * *Playbook*, *recruitment*, *goal* and *coaching* (§A.6). **Content stays as typed** (ADR-0179 §5): a template's name, a
 * company's name, an office's code; the API's sentences (a refusal, what *Save as template* left out) are shown as sent.
 *
 * @moved app/(admin)/admin/companies/[companyId]/template/
 * @moved components/template-picker.tsx
 * @moved components/import-template-dialog.tsx
 * @moved components/save-as-template-dialog.tsx
 * @moved components/activity-binding-card.tsx
 * @moved lib/templates.ts
 */
const en = {
  /** The screen's head (P4-T8): its title is §A.2's, the way back the companies list. */
  title: kept('Company template'),
  subtitle: 'What every new office of this company starts life with.',
  backToCompanies: 'Back to companies',
  /** The tab row's name, for a screen reader: every tab is §A.3's, kept. */
  sections: 'Template sections',
  /** The tooltip of a tab every template shares (ADR-0115 §7). */
  shared: {
    campaigns: 'Campaigns are the company’s, shared by every template.',
    products: 'Products are the company’s, shared by every template.',
    recruitment: 'The recruitment playbook is the company’s, shared by every template.',
  },
  /** Asked before another tab or template discards a draft (P4-T21); `label` a tab's name or a template's. */
  pending: {
    unsaved: 'You have edits here that are not saved.',
    discards: ({ label }: { label: string }) => `Opening ${label} discards them — a draft lives on one tab at a time.`,
    discardAndOpen: ({ label }: { label: string }) => `Discard and open ${label}`,
    stay: 'Stay here',
  },
  /** The publish card: what an office made from the template starts with, and who is behind. */
  publish: {
    nothingRules: 'Nothing is published yet. Publishing applies these rules to every office of the company.',
    nothingLadder: ({ name }: { name: string }) =>
      `Nothing is published yet, so an office made from ${name} starts with AgencyBoost’s standard capability ladder.`,
    nothingNone: ({ name }: { name: string }) =>
      `Nothing is published yet, so an office made from ${name} starts with none of it.`,
    /** A version as the card names it, in bold. */
    version: ({ n }: { n: number }) => `version ${n}`,
    /** `name` the template's, or `null` for the carrier rules, which every template shares; `version` bold. */
    published: ({ name, version, draft }: { name: string | null; version: ReactNode; draft: number | null }) => words(
      `New offices made from ${name ?? 'any template'} start from `,
      version,
      '.',
      draft === null ? null : ` You have unpublished changes, which will become version ${draft}.`,
    ),
    behind: ({ n }: { n: number }) =>
      (n === 1 ? '1 office is running something older.' : `${n} offices are running something older.`),
    unrecorded: ({ n }: { n: number }) => (n === 1
      ? '1 office was created before the version of this template it started from was recorded, so whether it is '
        + 'current is not known.'
      : `${n} offices were created before the version of this template they started from was recorded, so whether `
        + 'they are current is not known.'),
    unchanged: 'Publishing does not change them — an office owns its own copy from the day it is created.',
    /** Why *Save draft* and *Publish* are held on an archived template. */
    archivedKept: 'An archived template is kept as it is.',
  },
  /** A kind the screen has no editor for. */
  noEditor: 'This preset has no editor yet. It is stored and copied into new offices exactly as it is.',

  /** The picker (P13.2-T6): the company's templates, the default marked, and the offices the one shown answers for. */
  picker: {
    template: 'Template',
    /** A template's option, the default marked: the name as typed. */
    withDefault: ({ name }: { name: string }) => `${name} · Default`,
    archived: 'Archived',
    offices: ({ n, archived }: { n: number; archived: boolean }) =>
      `${archived ? 'Archived · ' : ''}${n === 1 ? '1 office' : `${n} offices`}`,
    newTemplate: 'New template',
    importTemplate: 'Import from another company',
    actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
    rename: 'Rename',
    makeDefault: 'Make default',
    archive: 'Archive',
    /** Why *Make default* and *Archive* are held. */
    isDefault: 'It is the default.',
    archivedNotDefault: 'An archived template cannot be the default.',
    defaultNotArchived: 'The default cannot be archived. Make another template the default first.',
    isArchived: 'It is archived.',
    /** The two questions (F-72). */
    makeDefaultQuestion: ({ name }: { name: string }) => `Make ${name} the default? KPM requests approved from now on `
      + 'start from it, and it is offered first when an office is created. Offices that already exist do not change.',
    archiveQuestion: ({ name }: { name: string }) => `Archive ${name}? It stays readable, and offices made from it keep `
      + 'everything, but it is no longer offered when an office is created.',
    archiveTemplate: 'Archive template',
    /** *New template* and *Rename*. */
    newTitle: 'New template',
    newLead: 'A new template of this company. It is not the default until you make it so.',
    create: 'Create template',
    renameTitle: 'Rename template',
    startWith: 'Start with',
    empty: 'Empty',
    emptyHint: 'Nothing in any section. An office made from it starts with the three activity types the goal plan '
      + 'counts and AgencyBoost’s standard capability ladder, and nothing else.',
    defaults: 'AgencyBoost defaults',
    defaultsHint: 'Every section as AgencyBoost ships it, each published as version 1.',
    copyOf: ({ name }: { name: string }) => `Copy of ${name}`,
    copyHint: 'Each section as it is published now, as version 1. Unpublished drafts are not copied, and later changes '
      + 'to either never reach the other.',
  },

  /** The three dialogs' shared controls and their name field. */
  name: 'Name',
  nameMissing: 'Give the template a name.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  company: 'Company',
  loadingCompanies: 'Loading companies…',

  /** *Import from another company* (P13.2-T7). */
  importing: {
    title: 'Import from another company',
    lead: 'A copy of one of its templates becomes a new template of this company. Later changes on either side never '
      + 'reach the other.',
    importing: 'Importing…',
    submit: 'Import template',
    noOtherCompany: 'There is no other company to import from.',
    chooseCompany: 'Choose a company',
    loadingTemplates: 'Loading its templates…',
    /** `company` the chosen company's name as stored, or `null` while it is not known. */
    noActive: ({ company }: { company: string | null }) => `${company ?? 'That company'} has no active template to import.`,
    template: 'Template',
  },

  /** *Save as template*, from an office's page (P13.2-T7 AC-7). */
  saveAs: {
    title: 'Save as template',
    /** `code` the office's code. */
    lead: ({ code }: { code: string }) => `What KPM ${code}’s agents read now becomes a new template: its published `
      + 'settings, never unpublished edits or anything archived. No member, log or lead is copied.',
    submit: 'Save template',
    companyHint: 'Into another company, every training file is copied, and every role the settings name must be on its '
      + 'ladder.',
    /** What the office page says once one is made (`savedTemplateSentence`): the names as stored, the reasons the API's. */
    saved: ({ name, company }: { name: string; company: string }) => `Saved as ${name}, a template of ${company}.`,
    leftOut: ({ n, reasons }: { n: number; reasons: string }) =>
      `Left out or changed, because ${n === 1 ? 'it names' : 'they name'} something archived: ${reasons}`,
  },

  /** The office's *Activity binding* card (ADR-0163 §3), on `/admin/tenants/[kpmId]`. */
  binding: {
    title: 'Activity binding',
    lead: 'Which activities the summary, the goal plan and coaching count at each stage. To replace an activity, add '
      + 'the new one beside the old: what was logged against the old one keeps counting.',
    save: 'Save binding',
    saved: 'Saved. The summary counts it from now.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Company template'),
  subtitle: `Yang menjadi awal setiap ${kept('KPM')} baru perusahaan ini.`,
  backToCompanies: 'Kembali ke daftar perusahaan',
  sections: 'Bagian templat',
  shared: {
    campaigns: `${kept('Campaigns')} adalah milik perusahaan, dipakai bersama oleh setiap templat.`,
    products: `${kept('Products')} adalah milik perusahaan, dipakai bersama oleh setiap templat.`,
    recruitment: `${kept('Playbook')} ${kept('recruitment')} adalah milik perusahaan, dipakai bersama oleh setiap templat.`,
  },
  pending: {
    unsaved: 'Ada perubahan di sini yang belum disimpan.',
    discards: ({ label }) => `Membuka ${label} akan membuang perubahan itu — draf hanya ada di satu tab pada satu waktu.`,
    discardAndOpen: ({ label }) => `Buang dan buka ${label}`,
    stay: 'Tetap di sini',
  },
  publish: {
    nothingRules: `Belum ada yang diterbitkan. Menerbitkan akan menerapkan aturan ini ke setiap ${kept('KPM')} `
      + 'perusahaan ini.',
    nothingLadder: ({ name }) => `Belum ada yang diterbitkan, jadi ${kept('KPM')} yang dibuat dari ${name} dimulai dengan `
      + `${kept('Ladder')} kapabilitas standar ${kept('AgencyBoost')}.`,
    nothingNone: ({ name }) => `Belum ada yang diterbitkan, jadi ${kept('KPM')} yang dibuat dari ${name} dimulai tanpa `
      + 'isi bagian ini.',
    version: ({ n }) => `versi ${n}`,
    published: ({ name, version, draft }) => words(
      `${kept('KPM')} baru yang dibuat dari ${name ?? 'templat mana pun'} dimulai dari `,
      version,
      '.',
      draft === null ? null : ` Anda punya perubahan yang belum diterbitkan, yang akan menjadi versi ${draft}.`,
    ),
    // One form for one and many (§B.0 rule 8).
    behind: ({ n }) => `${n} ${kept('KPM')} menjalankan versi yang lebih lama.`,
    unrecorded: ({ n }) => `${n} ${kept('KPM')} dibuat sebelum versi templat yang menjadi awalnya tercatat, jadi tidak `
      + 'diketahui apakah sudah mutakhir.',
    unchanged: `Menerbitkan tidak mengubahnya — setiap ${kept('KPM')} memiliki salinannya sendiri sejak hari dibuat.`,
    archivedKept: 'Templat yang diarsipkan disimpan apa adanya.',
  },
  noEditor: `Pengaturan awal ini belum punya editor. Pengaturan ini disimpan dan disalin ke ${kept('KPM')} baru persis `
    + 'apa adanya.',

  picker: {
    template: 'Templat',
    // *Default*: the loanword the API's refusals use for a company's default template (*templat default*).
    withDefault: ({ name }) => `${name} · Default`,
    archived: 'Diarsipkan',
    offices: ({ n, archived }) => `${archived ? 'Diarsipkan · ' : ''}${n} ${kept('KPM')}`,
    newTemplate: 'Templat baru',
    importTemplate: 'Impor dari perusahaan lain',
    actionsFor: ({ name }) => `Aksi untuk ${name}`,
    rename: 'Ganti nama',
    makeDefault: 'Jadikan default',
    archive: 'Arsipkan',
    isDefault: 'Templat ini sudah menjadi default.',
    archivedNotDefault: 'Templat yang diarsipkan tidak dapat menjadi default.',
    defaultNotArchived: 'Templat default tidak dapat diarsipkan. Jadikan templat lain sebagai default terlebih dahulu.',
    isArchived: 'Templat ini sudah diarsipkan.',
    makeDefaultQuestion: ({ name }) => `Jadikan ${name} sebagai default? Permintaan ${kept('KPM')} yang disetujui mulai `
      + `sekarang akan berawal dari templat ini, dan templat ini ditawarkan pertama kali saat ${kept('KPM')} dibuat. `
      + `${kept('KPM')} yang sudah ada tidak berubah.`,
    archiveQuestion: ({ name }) => `Arsipkan ${name}? Templat ini tetap dapat dibaca, dan ${kept('KPM')} yang dibuat `
      + `darinya tetap menyimpan semuanya, tetapi templat ini tidak lagi ditawarkan saat ${kept('KPM')} dibuat.`,
    archiveTemplate: 'Arsipkan templat',
    newTitle: 'Templat baru',
    newLead: 'Templat baru perusahaan ini. Templat ini belum menjadi default sampai Anda menjadikannya default.',
    create: 'Buat templat',
    renameTitle: 'Ganti nama templat',
    startWith: 'Mulai dengan',
    empty: 'Kosong',
    emptyHint: `Tidak ada isi di bagian mana pun. ${kept('KPM')} yang dibuat darinya dimulai dengan tiga jenis aktivitas `
      + `yang dihitung rencana ${kept('goal')} dan ${kept('Ladder')} kapabilitas standar ${kept('AgencyBoost')}, dan `
      + 'tidak ada yang lain.',
    defaults: `Pengaturan default ${kept('AgencyBoost')}`,
    defaultsHint: `Setiap bagian sebagaimana disediakan ${kept('AgencyBoost')}, masing-masing diterbitkan sebagai versi 1.`,
    copyOf: ({ name }) => `Salinan ${name}`,
    copyHint: 'Setiap bagian sebagaimana diterbitkan sekarang, sebagai versi 1. Draf yang belum diterbitkan tidak '
      + 'disalin, dan perubahan berikutnya pada salah satunya tidak pernah sampai ke yang lain.',
  },

  name: 'Nama',
  nameMissing: 'Beri nama templat ini.',
  save: 'Simpan',
  saving: 'Menyimpan…',
  cancel: 'Batal',
  company: 'Perusahaan',
  loadingCompanies: 'Memuat daftar perusahaan…',

  importing: {
    title: 'Impor dari perusahaan lain',
    lead: 'Salinan salah satu templatnya menjadi templat baru perusahaan ini. Perubahan berikutnya di salah satu sisi '
      + 'tidak pernah sampai ke sisi lain.',
    importing: 'Mengimpor…',
    submit: 'Impor templat',
    noOtherCompany: 'Tidak ada perusahaan lain yang dapat dijadikan sumber impor.',
    chooseCompany: 'Pilih perusahaan',
    loadingTemplates: 'Memuat templatnya…',
    noActive: ({ company }) => `${company ?? 'Perusahaan itu'} tidak memiliki templat aktif untuk diimpor.`,
    template: 'Templat',
  },

  saveAs: {
    title: 'Simpan sebagai templat',
    lead: ({ code }) => `Yang dibaca agent ${kept('KPM')} ${code} sekarang menjadi templat baru: pengaturannya yang sudah `
      + 'diterbitkan, tidak pernah perubahan yang belum diterbitkan atau apa pun yang diarsipkan. Tidak ada anggota, '
      + `catatan aktivitas, atau ${kept('lead')} yang disalin.`,
    submit: 'Simpan templat',
    companyHint: 'Ke perusahaan lain, setiap file pelatihan disalin, dan setiap peran yang disebut pengaturan ini harus '
      + 'ada di susunan jenjangnya.',
    saved: ({ name, company }) => `Tersimpan sebagai ${name}, templat milik ${company}.`,
    // One form for one and many (§B.0 rule 8).
    leftOut: ({ reasons }) => `Tidak disertakan atau diubah, karena menyebut sesuatu yang diarsipkan: ${reasons}`,
  },

  binding: {
    title: 'Pengaitan aktivitas',
    lead: `Aktivitas mana yang dihitung ringkasan, rencana ${kept('goal')}, dan ${kept('coaching')} di setiap tahap. Untuk `
      + 'mengganti aktivitas, tambahkan yang baru di samping yang lama: yang sudah tercatat pada aktivitas lama tetap '
      + 'dihitung.',
    save: 'Simpan pengaitan',
    saved: 'Tersimpan. Ringkasan menghitungnya mulai sekarang.',
  },
};

export const adminTemplateMessages = defineMessages({ en, id });
