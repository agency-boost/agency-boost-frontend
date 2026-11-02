import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's KPM template** (ADR-0185; ADR-0115, ADR-0164; P18.99-T20; `functional/tenant-config.md`, *The KPM
 * template*): a company's page — its two tabs, *KPM template* and *Company settings* — the card of each of its templates,
 * a template's checklist of six sections with *Publish all* and the offices on an older version, a section's editor with
 * its draft saved as it is made, *New template* with its one *Start from* picker, *Rename*, *Make default*, *Duplicate*
 * and *Archive*; *Save as template* from an office's page (`save-as-template-dialog.tsx`, with `lib/templates.ts`'
 * sentence once it has made one), and the office's *Activity binding* card (`activity-binding-card.tsx`). The two last
 * are drawn on `/admin/tenants/[kpmId]`, whose own words are another area's.
 *
 * **English is the source.** The Indonesian is the approved glossary's (OD-237; §B.0's voice) and ADR-0185's: the
 * product says ***Template KPM*** — the client's and the prototype's word (`Superadmin.html:179`), so a template is a
 * *template* here, not the *template* the screen said before — the platform's library ***Template bawaan AgencyBoost***,
 * and the company's own settings ***Pengaturan perusahaan***; *Simpan · Batal · Ganti nama · Arsipkan* (§B.1),
 * *Menyimpan…* (§B.2), *Diarsipkan · Draf* (§B.3), *Nama* (§B.4); *Default* the loanword the API's refusals use
 * (*template default*). **Kept English** (§A): *KPM* (§A.5), *AgencyBoost*, the section names an Owner's own settings
 * use (§A.3: *Training*, *Capability Mapping*, *Events*, and each part's pill), *Pipeline*, *lead*, *Campaign*,
 * *Playbook*, *recruitment*, *goal*, *coaching* (§A.6). **Content stays as typed** (ADR-0179 §5): a template's name, a
 * company's name, an office's code and branch; the API's sentences (a refusal, what *Save as template* left out) are
 * shown as sent.
 *
 * @moved app/(admin)/admin/companies/[companyId]/
 * @moved components/kpm-template/
 * @moved components/save-as-template-dialog.tsx
 * @moved components/activity-binding-card.tsx
 * @moved lib/templates.ts
 */
const en = {
  /** A company's page (ADR-0185 §2): its way back, and its two tabs. */
  companyPage: {
    back: 'Companies',
    tabs: 'Company pages',
    templates: 'KPM template',
    settings: 'Company settings',
    /** The platform's library, shown by this name wherever it is offered (ADR-0185 §1). */
    library: 'AgencyBoost built-in templates',
    libraryLead: 'Copied when a company or an office is created.',
    /** The library's role ladder, edited on `/admin/org-levels` (ADR-0168 §3). */
    ladder: 'Role ladder',
    /** A company the console cannot find among its companies. */
    unknown: 'Company',
  },

  /** A template's card on the company page (ADR-0185 §2). */
  card: {
    list: 'Templates',
    default: 'Default',
    archived: 'Archived',
    usedBy: ({ n }: { n: number }) => (n === 1 ? 'Used by 1 office' : `Used by ${n} offices`),
    published: ({ n, of }: { n: number; of: number }) => `${n}/${of} sections published`,
    waiting: ({ n }: { n: number }) => (n === 1 ? '1 change not published' : `${n} changes not published`),
    open: 'Open',
    newTemplate: 'New template',
    none: 'This company has no template yet.',
    loading: 'Loading the templates…',
    retry: 'Try again',
  },

  /** The six sections of a template (ADR-0185 §3), in the order an Owner's settings list them. */
  sections: {
    activity: 'Activities & ratios',
    leads: 'Lead pipeline',
    activation: 'Activation checklist',
    training: kept('Training'),
    capability: kept('Capability Mapping'),
    events: kept('Events'),
  },
  /** The two kinds of *Activities & ratios*, as a row's detail names them. */
  parts: {
    activity_taxonomy: 'Activities',
    ratio_set: 'Ratios',
  },
  /** A section's parts, each a pill (§A.3's terms, as the Owner's own screens name them). */
  pills: {
    activityTypes: kept('Activity types'),
    ratios: kept('Ratio benchmarks'),
    sales: kept('Sales'),
    recruitment: kept('Recruitment'),
    categories: kept('Categories'),
    skills: kept('Skills'),
    modules: kept('Modules'),
    ladder: kept('Ladder'),
    tiers: kept('Production club tiers'),
    moc: kept('Maintenance of Contract'),
    promotion: kept('Promotion paths'),
  },

  /** A template's checklist (ADR-0185 §3). */
  checklist: {
    list: 'Template sections',
    unknown: 'This template does not exist in this company.',
    changed: ({ n }: { n: number }) => (n === 1 ? '1 section changed' : `${n} sections changed`),
    noChanges: 'Every change is published.',
    publishAll: ({ n }: { n: number }) => `Publish all (${n})`,
    publishing: 'Publishing…',
    archived: 'Archived: it can be read and copied, not changed.',
    behind: ({ n }: { n: number }) => (n === 1 ? '1 office is on an older version' : `${n} offices are on an older version`),
    /** A row's state, its words on a tinted pill (D-27). */
    state: {
      published: ({ v }: { v: number }) => `Published v${v}`,
      publishedParts: 'Published',
      draft: 'Draft',
      partial: 'Partly published',
      empty: 'Empty',
    },
    /** What a draft row adds: the version an office gets today, or none. */
    draftOver: ({ v }: { v: number | null }) => (v === null ? 'never published' : `v${v} published`),
    /** One kind of a row of two: `Activities v3`, `Ratios empty`. */
    part: ({ name, v }: { name: string; v: number | null }) => (v === null ? `${name} empty` : `${name} v${v}`),
  },

  /** *Publish all* (ADR-0185 §3): the question, and what it did. */
  publishAll: {
    title: 'Publish all changes?',
    lead: 'These sections will be published:',
    note: 'Offices that already exist do not change; only new offices use this version.',
    confirm: 'Publish all',
    published: ({ sections }: { sections: string }) => `Published: ${sections}.`,
    refused: ({ section, message }: { section: string; message: string }) => `${section} was not published: ${message}`,
  },

  /** The offices on an older version (ADR-0185 §4): information only. */
  offices: {
    title: 'Offices on an older version',
    lead: 'Publishing changes no office that already exists.',
    office: ({ code, branch }: { code: string; branch: string }) => `KPM ${code} · ${branch}`,
    behindOn: ({ sections }: { sections: string }) => `Older: ${sections}`,
    unrecorded: ({ n }: { n: number }) => (n === 1
      ? '1 other office was created before its version was recorded.'
      : `${n} other offices were created before their version was recorded.`),
    loading: 'Loading the offices…',
    close: 'Close',
  },

  /** A section's editor (ADR-0185 §3): its draft, saved as it is made, and its own *Publish*. */
  editor: {
    parts: ({ section }: { section: string }) => `${section} parts`,
    stateDraft: ({ next, published }: { next: number; published: number | null }) => (published === null
      ? `Draft v${next}, never published`
      : `Draft v${next} · v${published} published`),
    statePublished: ({ v }: { v: number }) => `Published v${v}`,
    stateEmpty: 'Empty: an office made from this template gets none of it.',
    stateEmptyLadder: 'Empty: an office made from this template gets AgencyBoost’s standard ladder.',
    publish: 'Publish',
    publishing: 'Publishing…',
    nothingToPublish: 'Nothing has changed since the last publish.',
    saveFirst: 'Wait for the draft to be saved.',
    published: 'Published. Offices that already exist do not change.',
    retry: 'Try again',
    archived: 'Archived: read only.',
    unknown: 'This section does not exist.',
    loading: 'Loading the section…',
    /** A kind the screen has no editor for. */
    noEditor: 'This section has no editor yet. It is stored and copied into new offices exactly as it is.',
  },

  /** *Company settings* (ADR-0185 §2): the company's own, read live by its offices. */
  settings: {
    line: 'Applies at once to every office of this company.',
    products: 'Products',
    campaigns: 'Campaigns',
    recruitment: 'Recruitment',
    campaignQuestion: 'Publish these campaign rules? They apply at once to every office of this company, including the '
      + 'ones that already exist.',
    campaignEmpty: 'Nothing is published yet.',
  },

  /** The ⋮ menu of a template, and its two questions (F-72). */
  menu: {
    actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
    rename: 'Rename',
    makeDefault: 'Make default',
    duplicate: 'Duplicate',
    archive: 'Archive',
    /** Why *Make default* and *Archive* are held. */
    isDefault: 'It is the default.',
    archivedNotDefault: 'An archived template cannot be the default.',
    defaultNotArchived: 'The default cannot be archived. Make another template the default first.',
    isArchived: 'It is archived.',
    makeDefaultQuestion: ({ name }: { name: string }) => `Make ${name} the default? New offices start from it unless `
      + 'another is chosen. Offices that already exist do not change.',
    archiveQuestion: ({ name }: { name: string }) => `Archive ${name}? It stays readable, and is no longer offered when `
      + 'an office is created.',
    archiveTemplate: 'Archive template',
    renameTitle: 'Rename template',
  },

  /** *New template* (ADR-0185 §5), and the one *Start from* picker it shares with a new office. */
  create: {
    title: 'New template',
    submit: 'Create template',
    startFrom: 'Start from',
    empty: 'Empty',
    emptyHint: 'Nothing in any section.',
    copyFrom: 'Copy from…',
    copyHint: 'Each section as it is published now. A copy, never a link.',
    source: 'Source template',
    copyName: ({ name }: { name: string }) => `${name} (copy)`,
    archivedOption: ({ name }: { name: string }) => `${name} (archived)`,
    defaultOption: ({ name }: { name: string }) => `${name} · Default`,
    loadingSources: 'Loading the templates…',
    noSource: 'There is no template to copy yet.',
  },

  /** The dialogs' shared controls and their name field. */
  name: 'Name',
  nameMissing: 'Give the template a name.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  company: 'Company',
  loadingCompanies: 'Loading companies…',

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
  companyPage: {
    back: 'Perusahaan',
    tabs: 'Halaman perusahaan',
    templates: `Template ${kept('KPM')}`,
    settings: 'Pengaturan perusahaan',
    library: `Template bawaan ${kept('AgencyBoost')}`,
    libraryLead: `Disalin saat perusahaan atau ${kept('KPM')} baru dibuat.`,
    ladder: 'Susunan jenjang',
    unknown: 'Perusahaan',
  },

  card: {
    list: 'Daftar template',
    // *Default*: the loanword the API's refusals use for a company's default template (*template default*).
    default: 'Default',
    archived: 'Diarsipkan',
    // One form for one and many (§B.0 rule 8).
    usedBy: ({ n }) => `Dipakai ${n} ${kept('KPM')}`,
    published: ({ n, of }) => `${n}/${of} bagian terbit`,
    waiting: ({ n }) => `${n} perubahan belum terbit`,
    open: 'Buka',
    newTemplate: 'Template baru',
    none: 'Perusahaan ini belum punya template.',
    loading: 'Memuat template…',
    retry: 'Coba lagi',
  },

  sections: {
    activity: 'Aktivitas & rasio',
    leads: `${kept('Pipeline')} ${kept('lead')}`,
    activation: 'Checklist aktivasi',
    training: kept('Training'),
    capability: kept('Capability Mapping'),
    events: kept('Events'),
  },
  parts: {
    activity_taxonomy: 'Aktivitas',
    ratio_set: 'Rasio',
  },
  pills: {
    activityTypes: kept('Activity types'),
    ratios: kept('Ratio benchmarks'),
    sales: kept('Sales'),
    recruitment: kept('Recruitment'),
    categories: kept('Categories'),
    skills: kept('Skills'),
    modules: kept('Modules'),
    ladder: kept('Ladder'),
    tiers: kept('Production club tiers'),
    moc: kept('Maintenance of Contract'),
    promotion: kept('Promotion paths'),
  },

  checklist: {
    list: 'Bagian template',
    unknown: 'Template ini tidak ada di perusahaan ini.',
    changed: ({ n }) => `${n} bagian berubah`,
    noChanges: 'Semua perubahan sudah terbit.',
    publishAll: ({ n }) => `Terbitkan semua (${n})`,
    publishing: 'Menerbitkan…',
    archived: 'Diarsipkan: dapat dibaca dan disalin, tidak dapat diubah.',
    behind: ({ n }) => `${n} ${kept('KPM')} memakai versi lama`,
    state: {
      published: ({ v }) => `Terbit v${v}`,
      publishedParts: 'Terbit',
      draft: 'Draf',
      partial: 'Sebagian terbit',
      empty: 'Kosong',
    },
    draftOver: ({ v }) => (v === null ? 'belum pernah terbit' : `v${v} terbit`),
    part: ({ name, v }) => (v === null ? `${name} kosong` : `${name} v${v}`),
  },

  publishAll: {
    title: 'Terbitkan semua perubahan?',
    lead: 'Bagian berikut akan diterbitkan:',
    note: `${kept('KPM')} yang sudah ada tidak berubah; hanya ${kept('KPM')} baru yang memakai versi ini.`,
    confirm: 'Terbitkan semua',
    published: ({ sections }) => `Terbit: ${sections}.`,
    refused: ({ section, message }) => `${section} tidak diterbitkan: ${message}`,
  },

  offices: {
    title: `${kept('KPM')} yang memakai versi lama`,
    lead: `Menerbitkan tidak mengubah ${kept('KPM')} yang sudah ada.`,
    office: ({ code, branch }) => `${kept('KPM')} ${code} · ${branch}`,
    behindOn: ({ sections }) => `Versi lama: ${sections}`,
    unrecorded: ({ n }) => `${n} ${kept('KPM')} lain dibuat sebelum versinya tercatat.`,
    loading: `Memuat ${kept('KPM')}…`,
    close: 'Tutup',
  },

  editor: {
    parts: ({ section }) => `Bagian ${section}`,
    stateDraft: ({ next, published }) => (published === null
      ? `Draf v${next}, belum pernah terbit`
      : `Draf v${next} · v${published} terbit`),
    statePublished: ({ v }) => `Terbit v${v}`,
    stateEmpty: `Kosong: ${kept('KPM')} yang dibuat dari template ini tidak mendapat isinya.`,
    stateEmptyLadder: `Kosong: ${kept('KPM')} yang dibuat dari template ini mendapat ${kept('Ladder')} standar `
      + `${kept('AgencyBoost')}.`,
    publish: 'Terbitkan',
    publishing: 'Menerbitkan…',
    nothingToPublish: 'Belum ada perubahan sejak terakhir terbit.',
    saveFirst: 'Tunggu sampai draf tersimpan.',
    published: `Terbit. ${kept('KPM')} yang sudah ada tidak berubah.`,
    retry: 'Coba lagi',
    archived: 'Diarsipkan: hanya dapat dibaca.',
    unknown: 'Bagian ini tidak ada.',
    loading: 'Memuat bagian…',
    noEditor: `Bagian ini belum punya editor. Isinya disimpan dan disalin ke ${kept('KPM')} baru persis apa adanya.`,
  },

  settings: {
    line: `Berlaku langsung untuk semua ${kept('KPM')} perusahaan ini.`,
    products: 'Produk',
    campaigns: kept('Campaign'),
    recruitment: 'Rekrutmen',
    campaignQuestion: `Terbitkan aturan ${kept('campaign')} ini? Berlaku langsung untuk setiap ${kept('KPM')} perusahaan `
      + 'ini, termasuk yang sudah ada.',
    campaignEmpty: 'Belum ada yang terbit.',
  },

  menu: {
    actionsFor: ({ name }) => `Aksi untuk ${name}`,
    rename: 'Ganti nama',
    makeDefault: 'Jadikan default',
    duplicate: 'Duplikat',
    archive: 'Arsipkan',
    isDefault: 'Template ini sudah menjadi default.',
    archivedNotDefault: 'Template yang diarsipkan tidak dapat menjadi default.',
    defaultNotArchived: 'Template default tidak dapat diarsipkan. Jadikan template lain sebagai default terlebih dahulu.',
    isArchived: 'Template ini sudah diarsipkan.',
    makeDefaultQuestion: ({ name }) => `Jadikan ${name} sebagai default? ${kept('KPM')} baru dimulai darinya kecuali `
      + `dipilih yang lain. ${kept('KPM')} yang sudah ada tidak berubah.`,
    archiveQuestion: ({ name }) => `Arsipkan ${name}? Template ini tetap dapat dibaca, dan tidak lagi ditawarkan saat `
      + `${kept('KPM')} dibuat.`,
    archiveTemplate: 'Arsipkan template',
    renameTitle: 'Ganti nama template',
  },

  create: {
    title: 'Template baru',
    submit: 'Buat template',
    startFrom: 'Mulai dari',
    empty: 'Kosong',
    emptyHint: 'Semua bagian kosong.',
    copyFrom: 'Salin dari…',
    copyHint: 'Setiap bagian sebagaimana terbit sekarang. Salinan, bukan tautan.',
    source: 'Template sumber',
    copyName: ({ name }) => `${name} (salinan)`,
    archivedOption: ({ name }) => `${name} (diarsipkan)`,
    defaultOption: ({ name }) => `${name} · Default`,
    loadingSources: 'Memuat template…',
    noSource: 'Belum ada template untuk disalin.',
  },

  name: 'Nama',
  nameMissing: 'Beri nama template ini.',
  save: 'Simpan',
  saving: 'Menyimpan…',
  cancel: 'Batal',
  company: 'Perusahaan',
  loadingCompanies: 'Memuat daftar perusahaan…',

  saveAs: {
    title: 'Simpan sebagai template',
    lead: ({ code }) => `Yang dibaca agent ${kept('KPM')} ${code} sekarang menjadi template baru: pengaturannya yang sudah `
      + 'diterbitkan, tidak pernah perubahan yang belum diterbitkan atau apa pun yang diarsipkan. Tidak ada anggota, '
      + `catatan aktivitas, atau ${kept('lead')} yang disalin.`,
    submit: 'Simpan template',
    companyHint: 'Ke perusahaan lain, setiap file pelatihan disalin, dan setiap peran yang disebut pengaturan ini harus '
      + 'ada di susunan jenjangnya.',
    saved: ({ name, company }) => `Tersimpan sebagai ${name}, template milik ${company}.`,
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
