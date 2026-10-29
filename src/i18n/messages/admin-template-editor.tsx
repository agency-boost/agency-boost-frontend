import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a word in bold, a metric's name — as one message, in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** A word in bold inside a sentence, wrapped by the caller. */
type Strong = (words: string) => ReactNode;

/**
 * **The Company template's editors** (`components/template-editor.tsx`, P4-T8 onwards; P18.98-T6, area "admin-template";
 * `functional/tenant-config.md`, *The module's own strings*): one per kind of preset a new office is copied from — the
 * activity taxonomy with its *Activity binding*, the two lead ladders, the ratios, the training tree, the activation
 * checklist, the event types, the carrier rules and the capability ladder — and the two pieces every one of them
 * shares: a row read as text until *Edit*, and *Add …* under a list.
 *
 * **What the office's own screens already say is theirs, and read from there** (the brief of P18.98-T6): the controls
 * every settings screen shares (*Save*, *Cancel*, *Edit*, *Remove*, *Name*, *Description* …, `settings.ts`), a
 * section's *Summary tile* (`settings-activity-types.ts`), the lead ladder's badges (`settings-lead-statuses.ts`), a
 * ratio's benchmark and formula words (`settings-ratio-benchmarks.ts`, and a unit's name `ratio-words.ts`), what a
 * checklist item completes from (`settings-checklist.ts`), the capability ladder's *Milestones* and a grid for somebody
 * with a downline (`settings-capability.ts`), and the link badges *Auto* and *Ticked by hand* (`activation.ts`, through
 * `autoBadge` and `byHandBadge`). Here is only what a template says and an office's screen does not.
 *
 * **English is the source**, every word as it was; the Indonesian the approved glossary's, with the API's words for the
 * same things (P18.98-T5's rows of §B.10: a template is a ***templat***, a rule an ***aturan***, a comparator a
 * ***pembanding***, a tier a ***tingkat***, a promotion path a ***jalur promosi***, a standing a ***hasil campaign***), and
 * what it lacked proposed in the glossary for approval's §B.10. **Kept English** (§A): the tabs a sentence names, the
 * three features an item may complete from (§A.2), *Maintenance of Contract* and *Promotion paths* (§A.3), *KPM* (§B.9),
 * *goal*, *pipeline*, *ratio*, *skill*, *event*, *campaign* (§A.6). **Content stays as typed** (ADR-0179 §5): every
 * section, type, stage, ratio, category, skill, module, aspect, item, event type, rule, milestone, stage, grid and reward
 * a template holds, a module's title, a code. **A message never writes a figure** (P18.98-T3): a threshold, a benchmark
 * and a unit's example are written in the reader's figures and handed in.
 *
 * @moved components/template-editor.tsx
 */
const en = {
  /** A row read as text until *Edit* (P4-T24): its code's reason while it is edited. */
  codeReason: 'Permanent. Everything that refers to this row refers to its code.',

  /**
   * ***Add …* under a list, and its refusal of a code the template already uses** — one per kind of row, so each language
   * names the row in its own words.
   */
  add: {
    section: { open: 'Add a section', clash: 'This template already has a section with this code.' },
    activityType: { open: 'Add an activity type', clash: 'This template already has an activity type with this code.' },
    salesStage: { open: 'Add a sales stage', clash: 'This template already has a sales stage with this code.' },
    recruitmentStage: {
      open: 'Add a recruitment stage', clash: 'This template already has a recruitment stage with this code.',
    },
    ratio: { open: 'Add a ratio', clash: 'This template already has a ratio with this code.' },
    category: { open: 'Add a category', clash: 'This template already has a category with this code.' },
    skill: { open: 'Add a skill', clash: 'This template already has a skill with this code.' },
    module: { open: 'Add a module', clash: 'This template already has a module with this code.' },
    aspect: { open: 'Add an aspect', clash: 'This template already has an aspect with this code.' },
    item: { open: 'Add an item', clash: 'This template already has an item with this code.' },
    eventType: { open: 'Add an event type', clash: 'This template already has an event type with this code.' },
    productionClubRule: {
      open: 'Add a production clubs rule', clash: 'This template already has a production clubs rule with this code.',
    },
    mocRule: {
      open: 'Add a maintenance of contract rule',
      clash: 'This template already has a maintenance of contract rule with this code.',
    },
    promotionPathRule: {
      open: 'Add a promotion paths rule', clash: 'This template already has a promotion paths rule with this code.',
    },
    milestone: { open: 'Add a milestone', clash: 'This template already has a milestone with this code.' },
    stage: { open: 'Add a stage', clash: 'This template already has a stage with this code.' },
    grid: { open: 'Add a grid', clash: 'This template already has a grid with this code.' },
  },
  /** A new row's code: filled in from its name where the list suggests one (P5-T1). */
  codeHintSuggested: 'Filled in from the name. Permanent once published.',
  codeHint: 'Permanent once published.',
  /** A module's name field. */
  title: 'Title',

  /** *Activity types* (P4-T8): the toolbar's count. */
  taxonomyCount: ({ types, sections }: { types: number; sections: number }) =>
    `${types} activity ${types === 1 ? 'type' : 'types'} across ${sections} ${sections === 1 ? 'section' : 'sections'}`,

  /** The template's *Activity binding* (ADR-0163 §3), under the sections. */
  binding: {
    title: 'Activity binding',
    edit: 'Edit binding',
    set: 'Which activities the summary and the goal plan count at each stage, in every office made from this template.',
    notSet: 'Not set: offices made from this template count the platform’s default activities.',
    done: 'Done',
  },

  /** A lead ladder (P4-T8): its count, and the stage that closes it. */
  pipeline: {
    count: ({ n }: { n: number }) =>
      `${n} ${n === 1 ? 'status' : 'statuses'} — order determines the pipeline stage sequence.`,
    makeClose: 'Make this close it',
  },

  /** The ratios (P4-T22, P4-T25). `percent` and `decimal` are a unit's examples, written in the reader's figures. */
  ratios: {
    typedAsShown: ({ percent, decimal }: { percent: string; decimal: string }) =>
      `Typed the way it is shown — 15 for ${percent} as a percentage, ${decimal} as a number.`,
    /** A side with nothing to offer yet: `codes` the codes it holds, joined, or empty. */
    formulaEmpty: ({ codes }: { codes: string }) =>
      `${codes || 'Nothing yet.'} — add activity types on the Activity types tab first.`,
    /** What a template's ratio is for; `next` is bold. */
    startsFrom: ({ strong }: { strong: Strong }) => words(
      'This is what every new office of this company starts from, and what a comparison across offices is computed '
        + 'with. An office may change its own copy afterwards (ADR-0024) — its screen says so when it has, and the '
        + 'comparison still uses this. Changing it here changes what the ',
      strong('next'),
      ' office starts from; offices already created keep the copy they were built with.',
    ),
  },

  /** The training tree (P5-T1): its three lists. */
  training: {
    categories: ({ n }: { n: number }) => `${n} ${n === 1 ? 'category' : 'categories'}`,
    categoryHint: 'Optional. Agents read it under the category.',
    noCategories: 'No training categories yet.',
    categoryEditHint: "Optional. Shown under the name on the agent's training screen.",
    removeSkillsFirst: 'Remove its skills first.',
    empty: 'Empty',
    /** A category's badge: its skills, and the published modules under them. */
    categoryBadge: ({ skills, modules }: { skills: number; modules: number }) =>
      `${skills} ${skills === 1 ? 'skill' : 'skills'} · ${modules} ${modules === 1 ? 'module' : 'modules'} published`,
    category: 'Category',
    categoryFirst: 'Add a category first — a skill always sits in one.',
    noSkills: 'No skills for this category yet.',
    modulesMove: 'Its modules move with it.',
    removeModulesFirst: 'Remove its modules first.',
    modules: ({ n }: { n: number }) => `${n} ${n === 1 ? 'module' : 'modules'}`,
    skill: kept('Skill'),
    allSkills: 'All skills',
    chooseSkill: 'Choose a skill to add a module to it.',
    noModules: 'No modules for this category/skill yet.',
    publishState: 'Publish state',
    publishStateHint: 'Whether an office made from this template offers it to agents.',
    draft: 'Draft',
    published: 'Published',
  },

  /** The activation checklist (P5-T3): its count, and what a link does. */
  checklist: {
    count: ({ items, aspects }: { items: number; aspects: number }) =>
      `${items} ${items === 1 ? 'item' : 'items'} across ${aspects} ${aspects === 1 ? 'aspect' : 'aspects'}`,
    noAspects: 'No aspects yet.',
    /** *Remove*'s tooltip on an aspect: its items go with it. */
    removesAspect: ({ name, n }: { name: string; n: number }) =>
      `Removes ${name} and its ${n} ${n === 1 ? 'item' : 'items'}.`,
    /** What a link does, in the prototype's sense (`KPM_Owner.html:1528`). */
    linkHint: 'A linked item will complete on its own when the agent does that action.',
  },

  /** The event types (P5-T9 AC-4). */
  events: {
    count: ({ n }: { n: number }) => `${n} ${n === 1 ? 'type' : 'types'} every new office of this company starts with`,
    none: 'No types yet. An office with none has nothing to file an event under, so publishing an empty list is refused.',
    emoji: 'Emoji',
    emojiAddHint: 'Optional. One character.',
    emojiHint: 'Optional. One character, for the list.',
    descriptionHint: 'Optional. Shown under the name on the office’s own settings screen.',
    color: 'Color',
    colorHint: 'Optional. Pick one, or paste a colour your company already uses.',
  },

  /** The carrier rules (ADR-0026, ADR-0034, P5-T9 AC-4). */
  rules: {
    /** The three kinds, in the order a Super Admin thinks about them. */
    kinds: {
      production_club: { label: 'Production clubs', blurb: 'Annual recognition tiers.' },
      moc: { label: kept('Maintenance of Contract'), blurb: 'What a contract has to keep meeting.' },
      promotion_path: { label: kept('Promotion paths'), blurb: 'What a promotion asks for.' },
    },
    comparators: {
      gte: 'at least (≥)',
      gt: 'more than (>)',
      lte: 'at most (≤)',
      lt: 'less than (<)',
      eq: 'exactly (=)',
    },
    /** A metric the registry does not define: the console's *Soon*, and the Owner's words for it (P10.1-T2). */
    notMeasured: 'Not measured yet',
    soon: 'Soon',
    notMeasuredSpoken: ', not measured yet,',
    lead: 'These are the insurer’s own rules, and every office of this company reads them.',
    detail: 'An office cannot edit or delete one. Publishing here reaches the offices that already exist, not only the '
      + 'ones created afterwards — so a threshold you change today is the one every standing is measured against '
      + 'tomorrow.',
    count: ({ n }: { n: number }) => `${n} ${n === 1 ? 'rule' : 'rules'}`,
    rank: 'Rank',
    rankHint: 'The order the tiers are climbed in. Two rules at one rank is refused.',
    rankAddHint: 'The order the tiers are climbed in.',
    reward: 'Reward',
    rewardHint: 'Optional. What qualifying earns.',
    removeTip: 'Removing it here retires it on publish. Standings that qualified under it stay readable.',
    rankBadge: ({ n }: { n: number }) => `Rank ${n}`,
    /** A group of criteria: after the first, how it joins the one before (`join`, bold), then how its own combine. */
    group: ({ join, mode, strong }: { join: 'and' | 'or' | null; mode: 'all' | 'any'; strong: (words: string) => ReactNode }) =>
      words(join === null ? null : strong(join === 'or' ? 'or ' : 'and '), mode === 'any' ? 'any one of these' : 'all of these'),
    metric: 'Metric',
    comparison: 'Comparison',
    value: 'Value',
    /** `sum` is Rp 1.200.000.000, written in the reader's figures; the digits after it are what is typed. */
    moneyInSen: ({ sum }: { sum: string }) => `Money is in sen — ${sum} is 120000000000.`,
    /** A criterion in words: the metric's name, the comparator, the threshold in the reader's figures. */
    criterion: ({ metric, comparator, value }: { metric: ReactNode; comparator: string; value: string }) =>
      words(metric, ' ', comparator, ' ', value),
  },

  /** The capability ladder (P5-T8): its milestones, its stages and the grids. */
  capability: {
    /** A stage requiring a milestone nobody defines, by its code. */
    undefinedMilestone: ({ code }: { code: string }) => `${code} — no milestone defines this`,
    milestonesLead: 'What a stage is reached by.',
    milestones: ({ n }: { n: number }) => `${n} ${n === 1 ? 'milestone' : 'milestones'}`,
    milestoneRemoveTip: 'A stage that requires it will be refused at publish until you change that too.',
    stages: 'Stages',
    stagesLead: 'Seniority is the rank, not the position on this page.',
    stageCount: ({ n }: { n: number }) => `${n} ${n === 1 ? 'stage' : 'stages'}`,
    stageRankAddHint: 'How senior the stage is. Two stages at one rank is refused.',
    stageRankHint: 'How senior the stage is. Two stages at one rank is refused at publish.',
    reachedBy: 'Reached by',
    milestoneFirst: 'Add a milestone first — a stage requiring none is one everybody is already on.',
    whoItAppliesTo: 'Who it applies to',
    everybody: 'Everybody',
  },
};

const id: MessagesOf<typeof en> = {
  codeReason: 'Permanen. Semua yang merujuk ke baris ini merujuk ke kodenya.',

  add: {
    section: { open: 'Tambah bagian', clash: 'Templat ini sudah punya bagian dengan kode ini.' },
    activityType: { open: 'Tambah jenis aktivitas', clash: 'Templat ini sudah punya jenis aktivitas dengan kode ini.' },
    salesStage: {
      open: `Tambah tahap ${kept('Sales')}`, clash: `Templat ini sudah punya tahap ${kept('Sales')} dengan kode ini.`,
    },
    recruitmentStage: {
      open: `Tambah tahap ${kept('Recruitment')}`,
      clash: `Templat ini sudah punya tahap ${kept('Recruitment')} dengan kode ini.`,
    },
    ratio: { open: `Tambah ${kept('ratio')}`, clash: `Templat ini sudah punya ${kept('ratio')} dengan kode ini.` },
    category: { open: 'Tambah kategori', clash: 'Templat ini sudah punya kategori dengan kode ini.' },
    skill: { open: `Tambah ${kept('skill')}`, clash: `Templat ini sudah punya ${kept('skill')} dengan kode ini.` },
    module: { open: 'Tambah modul', clash: 'Templat ini sudah punya modul dengan kode ini.' },
    aspect: { open: 'Tambah aspek', clash: 'Templat ini sudah punya aspek dengan kode ini.' },
    item: { open: 'Tambah item', clash: 'Templat ini sudah punya item dengan kode ini.' },
    eventType: {
      open: `Tambah jenis ${kept('event')}`, clash: `Templat ini sudah punya jenis ${kept('event')} dengan kode ini.`,
    },
    productionClubRule: {
      open: 'Tambah aturan klub produksi', clash: 'Templat ini sudah punya aturan klub produksi dengan kode ini.',
    },
    mocRule: {
      open: `Tambah aturan ${kept('Maintenance of Contract')}`,
      clash: `Templat ini sudah punya aturan ${kept('Maintenance of Contract')} dengan kode ini.`,
    },
    promotionPathRule: {
      open: 'Tambah aturan jalur promosi', clash: 'Templat ini sudah punya aturan jalur promosi dengan kode ini.',
    },
    milestone: { open: 'Tambah milestone', clash: 'Templat ini sudah punya milestone dengan kode ini.' },
    stage: { open: 'Tambah tahap', clash: 'Templat ini sudah punya tahap dengan kode ini.' },
    grid: { open: 'Tambah grid', clash: 'Templat ini sudah punya grid dengan kode ini.' },
  },
  codeHintSuggested: 'Diisi dari nama. Permanen setelah diterbitkan.',
  codeHint: 'Permanen setelah diterbitkan.',
  title: 'Judul',

  // One form for one and many (§B.0 rule 8).
  taxonomyCount: ({ types, sections }) => `${types} jenis aktivitas di ${sections} bagian`,

  binding: {
    title: 'Pengaitan aktivitas',
    edit: 'Ubah pengaitan',
    set: `Aktivitas mana yang dihitung ringkasan dan rencana ${kept('goal')} di setiap tahap, di setiap ${kept('KPM')} `
      + 'yang dibuat dari templat ini.',
    notSet: `Belum diatur: ${kept('KPM')} yang dibuat dari templat ini menghitung aktivitas default platform.`,
    done: 'Selesai',
  },

  pipeline: {
    count: ({ n }) => `${n} status — urutannya menentukan alur tahap dalam ${kept('pipeline')}.`,
    makeClose: `Jadikan penutup ${kept('pipeline')}`,
  },

  ratios: {
    typedAsShown: ({ percent, decimal }) =>
      `Ketik seperti yang ditampilkan — 15 untuk ${percent} sebagai persentase, ${decimal} sebagai angka.`,
    formulaEmpty: ({ codes }) =>
      `${codes || 'Belum ada.'} — tambahkan jenis aktivitas di tab ${kept('Activity types')} terlebih dahulu.`,
    startsFrom: ({ strong }) => words(
      `Inilah yang menjadi awal setiap ${kept('KPM')} baru perusahaan ini, dan dasar perhitungan perbandingan `
        + `antar-${kept('KPM')}. ${kept('KPM')} boleh mengubah salinannya sendiri sesudahnya (ADR-0024) — layarnya akan `
        + 'menyebutkannya jika sudah diubah, dan perbandingan tetap memakai yang ini. Mengubahnya di sini mengubah awal '
        + `${kept('KPM')} `,
      strong('berikutnya'),
      `; ${kept('KPM')} yang sudah dibuat tetap memakai salinan yang menjadi dasarnya.`,
    ),
  },

  training: {
    categories: ({ n }) => `${n} kategori`,
    categoryHint: 'Opsional. Agent membacanya di bawah kategori.',
    // As Settings › Training says the same (`training-settings.tsx`).
    noCategories: `Belum ada kategori ${kept('Training')}.`,
    categoryEditHint: 'Opsional. Ditampilkan di bawah nama di layar pelatihan agent.',
    removeSkillsFirst: `Hapus ${kept('skill')}-nya terlebih dahulu.`,
    empty: 'Kosong',
    // A kept noun keeps its English plural; *modul* has one form (§B.0 rule 8).
    categoryBadge: ({ skills, modules }) =>
      `${skills} ${skills === 1 ? kept('skill') : kept('skills')} · ${modules} modul diterbitkan`,
    category: 'Kategori',
    categoryFirst: `Tambahkan kategori terlebih dahulu — setiap ${kept('skill')} selalu berada di satu kategori.`,
    noSkills: `Belum ada ${kept('skill')} untuk kategori ini.`,
    modulesMove: 'Modulnya ikut pindah.',
    removeModulesFirst: 'Hapus modulnya terlebih dahulu.',
    modules: ({ n }) => `${n} modul`,
    skill: kept('Skill'),
    // As Settings › Training's filter writes it (§B.10, training).
    allSkills: `Semua ${kept('skill')}`,
    chooseSkill: `Pilih ${kept('skill')} untuk menambahkan modul ke dalamnya.`,
    noModules: `Belum ada modul untuk kategori/${kept('skill')} ini.`,
    publishState: 'Status terbit',
    publishStateHint: `Apakah ${kept('KPM')} yang dibuat dari templat ini menawarkannya kepada agent.`,
    draft: 'Draf',
    published: 'Diterbitkan',
  },

  checklist: {
    count: ({ items, aspects }) => `${items} item di ${aspects} aspek`,
    noAspects: 'Belum ada aspek.',
    removesAspect: ({ name, n }) => `Menghapus ${name} beserta ${n} itemnya.`,
    linkHint: 'Item yang tertaut akan selesai dengan sendirinya saat agent melakukan tindakan itu.',
  },

  events: {
    count: ({ n }) => `${n} jenis yang menjadi awal setiap ${kept('KPM')} baru perusahaan ini`,
    none: `Belum ada jenis. ${kept('KPM')} tanpa jenis tidak punya tempat untuk mengelompokkan ${kept('event')}, jadi `
      + 'menerbitkan daftar kosong ditolak.',
    // A loanword Indonesian already uses (§B.0 rule 5; `SAME_IN_INDONESIAN`).
    emoji: 'Emoji',
    emojiAddHint: 'Opsional. Satu karakter.',
    emojiHint: 'Opsional. Satu karakter, untuk daftar.',
    descriptionHint: `Opsional. Ditampilkan di bawah nama di layar pengaturan ${kept('KPM')} itu sendiri.`,
    color: 'Warna',
    colorHint: 'Opsional. Pilih satu, atau tempel warna yang sudah dipakai perusahaan Anda.',
  },

  rules: {
    kinds: {
      production_club: { label: 'Klub produksi', blurb: 'Tingkat penghargaan tahunan.' },
      moc: { label: kept('Maintenance of Contract'), blurb: 'Syarat yang harus terus dipenuhi sebuah kontrak.' },
      promotion_path: { label: kept('Promotion paths'), blurb: 'Yang diminta sebuah promosi.' },
    },
    // A campaign's requirement in words, as the API writes it (P18.98-T5's row of §B.10).
    comparators: {
      gte: 'minimal (≥)',
      gt: 'lebih dari (>)',
      lte: 'maksimal (≤)',
      lt: 'kurang dari (<)',
      eq: 'tepat (=)',
    },
    notMeasured: 'Belum diukur',
    soon: 'Segera hadir',
    notMeasuredSpoken: ', belum diukur,',
    lead: `Ini aturan milik perusahaan asuransi sendiri, dan setiap ${kept('KPM')} perusahaan ini membacanya.`,
    detail: `${kept('KPM')} tidak dapat mengubah atau menghapusnya. Menerbitkan di sini sampai ke ${kept('KPM')} yang sudah `
      + 'ada, bukan hanya yang dibuat sesudahnya — jadi ambang batas yang Anda ubah hari ini menjadi ukuran setiap hasil '
      + `${kept('campaign')} besok.`,
    count: ({ n }) => `${n} aturan`,
    rank: 'Peringkat',
    rankHint: 'Urutan tingkat yang didaki. Dua aturan di peringkat yang sama ditolak.',
    rankAddHint: 'Urutan tingkat yang didaki.',
    reward: 'Hadiah',
    rewardHint: 'Opsional. Yang didapat jika memenuhi syarat.',
    removeTip: 'Menghapusnya di sini akan menonaktifkannya saat diterbitkan. Hasil '
      + `${kept('campaign')} yang memenuhi syarat berdasarkan aturan ini tetap dapat dibaca.`,
    rankBadge: ({ n }) => `Peringkat ${n}`,
    group: ({ join, mode, strong }) =>
      words(join === null ? null : strong(join === 'or' ? 'atau ' : 'dan '), mode === 'any' ? 'salah satu dari ini' : 'semua ini'),
    metric: 'Metrik',
    // As Settings › Campaigns' own field names it (§B.10, events and campaigns).
    comparison: 'Perbandingan',
    value: 'Nilai',
    moneyInSen: ({ sum }) => `Uang dalam sen — ${sum} adalah 120000000000.`,
    criterion: ({ metric, comparator, value }) => words(metric, ' ', comparator, ' ', value),
  },

  capability: {
    undefinedMilestone: ({ code }) => `${code} — tidak ada milestone yang mendefinisikannya`,
    milestonesLead: 'Cara sebuah tahap dicapai.',
    milestones: ({ n }) => `${n} milestone`,
    milestoneRemoveTip: 'Tahap yang memerlukannya akan ditolak saat diterbitkan sampai Anda mengubahnya juga.',
    stages: 'Tahap',
    stagesLead: 'Senioritas ditentukan oleh peringkat, bukan oleh posisi di halaman ini.',
    stageCount: ({ n }) => `${n} tahap`,
    stageRankAddHint: 'Seberapa senior tahap ini. Dua tahap di peringkat yang sama ditolak.',
    stageRankHint: 'Seberapa senior tahap ini. Dua tahap di peringkat yang sama ditolak saat diterbitkan.',
    reachedBy: 'Dicapai dengan',
    milestoneFirst: 'Tambahkan milestone terlebih dahulu — tahap yang tidak memerlukan milestone adalah tahap yang sudah '
      + 'dicapai semua orang.',
    whoItAppliesTo: 'Berlaku untuk siapa',
    everybody: 'Semua orang',
  },
};

export const adminTemplateEditorMessages = defineMessages({ en, id });
