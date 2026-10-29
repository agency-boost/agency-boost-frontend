import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a link — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** A level of the office's training catalog, as a refusal or an add panel names it. */
type Level = 'category' | 'skill' | 'module';

/**
 * **Settings › Training** (`/kpm/settings/training`, P5-T1; P18.98-T4, training): the office's categories, skills and
 * modules, each staged until saved; **a module's page** (`/kpm/settings/training/[moduleId]`) with its title, skill and
 * *Published* switch; and **its Files, Videos and Links** (`components/module-content.tsx`, P5-T2). The frame, the bars
 * and the controls every settings screen shares — *Save*, *Edit*, *Archive*, *Restore*, *Undo*, *Show archived*, *Code*,
 * *Name*, a staged row's mark, *Save changes* — are `settings.ts`'.
 *
 * **English is the source** of the keys, the screens' words as built (`KPM_Owner.html:1565-1638`, and the module's own);
 * the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it lacked in the glossary for approval's
 * §B.10. **Kept English** (§A): the title and the tabs (*Training*, *Categories*, *Skills*, *Modules*), *Skill* as a
 * field's name, *skill* in a sentence (§B.10 *grid skill*), *KPM*; *module* is *modul* in a sentence (§A.6's own
 * alternative; §B.10 *Modul Training*) and *training* *pelatihan* (§B.10). *Office* is *KPM* (§B.9). **Content stays as
 * typed** (ADR-0179 §5): a category's, a skill's and a module's name, a description, a file's or a link's name, the
 * company's name. The examples a code field shows are identifiers, the same in both languages, and are not here.
 *
 * @moved app/(tenant)/kpm/settings/training/
 * @moved components/module-content.tsx
 * @moved lib/training-view.ts
 */
const en = {
  /** The tabs (§A.3) and the title (§A.1). */
  title: kept('Training'),
  tabs: { categories: kept('Categories'), skills: kept('Skills'), modules: kept('Modules') },
  subtitle: 'Categories, skills, and modules available to this KPM',

  /** A category's badge: what it holds that agents are offered, or *Empty* (`:1576-1581`). */
  categoryBadge: ({ skills, modules }: { skills: number; modules: number }) =>
    `${skills} ${skills === 1 ? 'skill' : 'skills'} · ${modules} ${modules === 1 ? 'module' : 'modules'} published`,
  empty: 'Empty',
  /** A skill's badge: how many modules teach it, drafts included. */
  moduleCount: ({ n }: { n: number }) => `${n} ${n === 1 ? 'module' : 'modules'}`,
  /** A row an archive above is taking; `parent` as the office typed it. */
  archivedWith: ({ parent }: { parent: string }) => `Archived with ${parent} — not saved yet`,
  restoreFirst: ({ name }: { name: string }) => `Restore ${name} first`,

  /** The add panels. */
  addLabel: { category: '+ Add category', skill: '+ Add skill', module: '+ Add module' } satisfies Record<Level, string>,
  addHeading: { category: 'Add a category', skill: 'Add a skill', module: 'Add a module' } satisfies Record<Level, string>,
  addButton: { category: 'Add the category', skill: 'Add the skill', module: 'Add the module' } satisfies Record<Level, string>,
  codeHint: 'Filled in from the name. Permanent once saved.',
  codeTaken: {
    category: 'This office already has a category with this code. Archived ones count — a code is never reused.',
    skill: 'This office already has a skill with this code. Archived ones count — a code is never reused.',
    module: 'This office already has a module with this code. Archived ones count — a code is never reused.',
  } satisfies Record<Level, string>,
  category: 'Category',
  skill: kept('Skill'),
  moduleTitle: 'Title',
  descriptionHint: "Optional. Shown under the name on the agent's training screen.",
  categoryFirst: 'Add a category first, or restore one — a skill always sits in a category.',
  skillFirst: 'Add a skill first, or restore one — a module always teaches a skill.',
  moduleLead: 'A new module starts as a draft, which no agent is offered. Publish it here when it is ready — agents see it '
    + 'once your office next publishes its changes.',
  noSkillsInCategory: 'No skills in this category',
  allSkills: 'All skills',

  /** The lists' empty states. */
  noCategories: 'No training categories yet.',
  noSkills: 'No skills for this category yet.',
  noModules: 'No modules for this category/skill yet.',
  /** Why a code cannot change, in a row's edit. */
  categoryReason: 'Every skill in this category, and every module under them, points at it.',
  skillReason: 'Every module teaching this skill points at it.',
  movesWithIt: 'Its modules move with it.',
  published: 'Published',

  /** Opening a module while edits are staged, which leaving would lose. */
  unsaved: 'You have changes here that are not saved.',
  openingDiscards: ({ title }: { title: string }) =>
    `Opening ${title} discards them. Save them first, or discard them and open it.`,
  discardAndOpen: ({ title }: { title: string }) => `Discard and open ${title}`,
  stayHere: 'Stay here',

  /** A module's page. */
  module: {
    /** The title while nothing is read, and for a module that is not the office's. */
    fallbackTitle: 'Training module',
    notInCatalog: "This module is not in your office's training catalog.",
    back: 'Back to Training',
    archived: 'This module is archived.',
    /** `link` draws the way back to the list, around *Training*. */
    archivedLine: ({ link }: { link: (label: ReactNode) => ReactNode }) => words(
      'No agent is offered it. Bring it back from ',
      link(kept('Training')),
      ' — on Modules, with Show archived on.',
    ),
    publishState: 'Publish state',
    draft: 'Draft',
    noSkillsHint: 'This category has no skills yet. Add one on Training first.',
    noSkills: 'No skills',
    codeReason: 'Permanent. Whatever refers to this module refers to its code, so the title can change and nothing loses '
      + 'track of it.',
    offeredOnPublish: 'Agents are offered it once your office next publishes its changes.',
    aDraft: 'A draft. No agent is offered it.',
    savedToOffice: 'Saved to your office.',
  },

  /** A module's Files, Videos and Links (P5-T2). */
  content: {
    readFailed: ({ why }: { why: string }) => `Could not read this module’s content. ${why}`,
    tryAgain: 'Try again',
    tooLarge: ({ name, size }: { name: string; size: string }) =>
      `Files must be 25 MB or smaller. “${name}” is ${size}. Something longer belongs under Links.`,
    notAccepted: ({ name }: { name: string }) => `“${name}” is not a kind of file this product accepts.`,
    files: 'Files',
    videos: 'Videos',
    links: 'Links',
    filesHint: 'Up to 25 MB each. PDFs, images and spreadsheets.',
    videosHint: 'Up to 25 MB each, mp4. Anything longer belongs under Links — a long video is a download an agent on '
      + 'mobile data cannot afford.',
    linkCount: ({ n }: { n: number }) => `${n} ${n === 1 ? 'link' : 'links'}`,
    nothingHere: 'Nothing here yet.',
    open: 'Open',
    addTo: ({ heading }: { heading: string }) => `Add to ${heading}`,
    ownMaterial: 'This office has its own material for this module.',
    ownMaterialLine: 'Your agents see what is below. Your company’s material is untouched, and no other office of your '
      + 'company is affected.',
    putsBack: ({ files, links }: { files: number; links: number }) =>
      `Puts back your company’s ${files} file(s) and ${links} link(s).`,
    useCompanyAgain: 'Use my company’s material again',
    companyMaterial: 'This is your company’s material.',
    companyMaterialLine: 'Every office of your company starts with it. The moment you add or remove something here, this '
      + 'module becomes your office’s own — and you can always go back.',
    uploading: ({ name }: { name: string }) => `Uploading ${name}…`,
    linkName: 'Link name',
    address: 'Address',
    addressHint: 'Must start with https://',
    addLink: 'Add link',
    saveContent: 'Save content',
    undoEdits: 'Undo my edits',
    notSavedYet: 'Not saved yet — a file you added is uploaded, but this module does not use it until you save.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Training'),
  tabs: { categories: kept('Categories'), skills: kept('Skills'), modules: kept('Modules') },
  subtitle: `Kategori, ${kept('skill')}, dan modul yang tersedia untuk ${kept('KPM')} ini`,

  // A kept noun keeps its English plural, an Indonesian one has one form (§B.0 rule 8).
  categoryBadge: ({ skills, modules }) =>
    `${skills} ${skills === 1 ? kept('skill') : kept('skills')} · ${modules} modul diterbitkan`,
  empty: 'Kosong',
  moduleCount: ({ n }) => `${n} modul`,
  archivedWith: ({ parent }) => `Diarsipkan bersama ${parent} — belum disimpan`,
  restoreFirst: ({ name }) => `Pulihkan ${name} terlebih dahulu`,

  addLabel: { category: '+ Tambah kategori', skill: `+ Tambah ${kept('skill')}`, module: '+ Tambah modul' },
  addHeading: { category: 'Tambah kategori', skill: `Tambah ${kept('skill')}`, module: 'Tambah modul' },
  addButton: { category: 'Tambah kategori ini', skill: `Tambah ${kept('skill')} ini`, module: 'Tambah modul ini' },
  codeHint: 'Diisi dari nama. Permanen setelah disimpan.',
  codeTaken: {
    category: `${kept('KPM')} ini sudah punya kategori dengan kode ini. Yang diarsipkan ikut dihitung — kode tidak pernah `
      + 'dipakai ulang.',
    skill: `${kept('KPM')} ini sudah punya ${kept('skill')} dengan kode ini. Yang diarsipkan ikut dihitung — kode tidak `
      + 'pernah dipakai ulang.',
    module: `${kept('KPM')} ini sudah punya modul dengan kode ini. Yang diarsipkan ikut dihitung — kode tidak pernah `
      + 'dipakai ulang.',
  },
  category: 'Kategori',
  skill: kept('Skill'),
  moduleTitle: 'Judul',
  descriptionHint: 'Opsional. Ditampilkan di bawah nama di layar pelatihan agent.',
  categoryFirst: `Tambahkan kategori terlebih dahulu, atau pulihkan salah satunya — ${kept('skill')} selalu berada di `
    + 'dalam kategori.',
  skillFirst: `Tambahkan ${kept('skill')} terlebih dahulu, atau pulihkan salah satunya — modul selalu mengajarkan sebuah `
    + `${kept('skill')}.`,
  moduleLead: 'Modul baru dimulai sebagai draf, yang tidak ditawarkan ke agent mana pun. Terbitkan di sini saat sudah '
    + `siap — agent melihatnya setelah ${kept('KPM')} Anda menerbitkan perubahannya berikutnya.`,
  noSkillsInCategory: `Belum ada ${kept('skill')} di kategori ini`,
  allSkills: `Semua ${kept('skill')}`,

  noCategories: `Belum ada kategori ${kept('Training')}.`,
  noSkills: `Belum ada ${kept('skill')} untuk kategori ini.`,
  noModules: `Belum ada modul untuk kategori/${kept('skill')} ini.`,
  categoryReason: `Setiap ${kept('skill')} di kategori ini, dan setiap modul di bawahnya, merujuk ke kode ini.`,
  skillReason: `Setiap modul yang mengajarkan ${kept('skill')} ini merujuk ke kode ini.`,
  movesWithIt: 'Modulnya ikut pindah.',
  published: 'Diterbitkan',

  unsaved: 'Ada perubahan di sini yang belum disimpan.',
  openingDiscards: ({ title }) =>
    `Membuka ${title} akan membuang perubahan itu. Simpan perubahan itu terlebih dahulu, atau buang lalu buka modulnya.`,
  discardAndOpen: ({ title }) => `Buang dan buka ${title}`,
  stayHere: 'Tetap di sini',

  module: {
    fallbackTitle: `Modul ${kept('Training')}`,
    notInCatalog: `Modul ini tidak ada di katalog pelatihan ${kept('KPM')} Anda.`,
    back: `Kembali ke ${kept('Training')}`,
    archived: 'Modul ini sudah diarsipkan.',
    archivedLine: ({ link }) => words(
      'Tidak ada agent yang ditawari modul ini. Pulihkan dari ',
      link(kept('Training')),
      ` — di ${kept('Modules')}, dengan Tampilkan yang diarsipkan aktif.`,
    ),
    publishState: 'Status terbit',
    draft: 'Draf',
    noSkillsHint: `Kategori ini belum punya ${kept('skill')}. Tambahkan terlebih dahulu di ${kept('Training')}.`,
    noSkills: `Tidak ada ${kept('skill')}`,
    codeReason: 'Permanen. Apa pun yang merujuk ke modul ini merujuk ke kodenya, jadi judulnya boleh berubah tanpa ada '
      + 'yang kehilangan jejak.',
    offeredOnPublish: `Agent ditawari modul ini setelah ${kept('KPM')} Anda menerbitkan perubahannya berikutnya.`,
    aDraft: 'Draf. Tidak ada agent yang ditawari modul ini.',
    savedToOffice: `Tersimpan di ${kept('KPM')} Anda.`,
  },

  content: {
    readFailed: ({ why }) => `Tidak dapat membaca konten modul ini. ${why}`,
    tryAgain: 'Coba lagi',
    tooLarge: ({ name, size }) =>
      `File maksimal 25 MB. “${name}” berukuran ${size}. Yang lebih besar letakkan di Tautan.`,
    notAccepted: ({ name }) => `“${name}” bukan jenis file yang diterima produk ini.`,
    files: 'File',
    videos: 'Video',
    links: 'Tautan',
    filesHint: 'Maksimal 25 MB per file. PDF, gambar, dan spreadsheet.',
    videosHint: 'Maksimal 25 MB per file, mp4. Yang lebih panjang letakkan di Tautan — video panjang adalah unduhan yang '
      + 'terlalu mahal bagi agent yang memakai data seluler.',
    linkCount: ({ n }) => `${n} tautan`,
    nothingHere: 'Belum ada apa pun di sini.',
    open: 'Buka',
    addTo: ({ heading }) => `Tambahkan ke ${heading}`,
    ownMaterial: `${kept('KPM')} ini punya materi sendiri untuk modul ini.`,
    ownMaterialLine: 'Agent Anda melihat yang ada di bawah. Materi perusahaan Anda tidak berubah, dan tidak ada '
      + `${kept('KPM')} lain di perusahaan Anda yang terdampak.`,
    putsBack: ({ files, links }) => `Mengembalikan ${files} file dan ${links} tautan milik perusahaan Anda.`,
    useCompanyAgain: 'Gunakan lagi materi perusahaan saya',
    companyMaterial: 'Ini materi perusahaan Anda.',
    companyMaterialLine: `Setiap ${kept('KPM')} di perusahaan Anda memulai dengan materi ini. Begitu Anda menambah atau `
      + `menghapus sesuatu di sini, modul ini menjadi milik ${kept('KPM')} Anda sendiri — dan Anda selalu bisa kembali.`,
    uploading: ({ name }) => `Mengunggah ${name}…`,
    linkName: 'Nama tautan',
    address: 'Alamat',
    addressHint: 'Harus diawali https://',
    addLink: 'Tambah tautan',
    saveContent: 'Simpan konten',
    undoEdits: 'Urungkan perubahan saya',
    notSavedYet: 'Belum disimpan — file yang Anda tambahkan sudah diunggah, tetapi modul ini belum memakainya sampai '
      + 'Anda menyimpan.',
  },
};

export const trainingSettingsMessages = defineMessages({ en, id });
