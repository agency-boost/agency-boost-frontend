import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a control's name in bold — as one message, its parts in the language's order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **Settings › Ratio benchmarks** (`/kpm/settings/ratio-benchmarks`, P4-T2; P18.98-T4): what each ratio counts, and
 * what counts as on track. The frame and the controls every settings screen shares are `settings.ts`'; a unit's name,
 * *points* and *Side A* / *Side B* are `ratio-words.ts`'. **A message never writes a figure**: a benchmark, a band and
 * a unit's example are written in the reader's figures and handed in (P18.98-T3).
 *
 * **Content, shown as typed** (ADR-0179 §5): a ratio's name, an activity type's label, a section's name, a rung's label.
 * **Kept English** (§A): the title and the tabs (§A.1, §A.3), *ratio* and *benchmark* (§A.6), *KPM* (§A.5). *On track*
 * is §B.3's *Sesuai target*. *Formula*, *even split* and *published copy* are *rumus*, *pembagian rata* and *salinan
 * yang diterbitkan*; *Hide* is *Sembunyikan* (for approval, the glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/ratio-benchmarks/
 */
const en = {
  subtitle: 'What each ratio counts, and what counts as on track.',
  /** The prototype's own hint: every ratio is computed over the last 30 days, fixed (ADR-0022). */
  window: 'Calculated on the last 30 days of activity.',

  /** The published copy, beside the working one. `publish` is the bar's button, bold. */
  hidePublished: 'Hide what agents see',
  showPublished: 'See what agents see now',
  publishedTitle: 'What agents see now',
  publishedLead: ({ publish }: { publish: ReactNode }) =>
    words('The published copy. It changes only when you press ', publish, ' — not when you save.'),
  nothingPublished: 'Nothing is published for this office yet.',
  /** Between a published ratio's name and its benchmark. */
  publishedWithin: ' — on track within ',
  publishedAtOrAbove: ' — on track at or above ',

  /** Adding a ratio of the office's own. */
  addRatio: 'Add a ratio',
  addLead: 'Yours entirely — count whatever this office needs to watch. It will not appear in any comparison with '
    + 'other offices, because nothing outside this office knows what it measures.',
  kind: 'Kind',
  kindRatio: 'Ratio (A ÷ B)',
  kindBalance: 'Balance (A vs B)',
  codeHint: 'Never changes once saved.',
  /** A division's two lists. A balance's are `ratio-words.ts`' *Side A* and *Side B*. */
  counts: 'Counts',
  outOf: 'Out of',
  withinEitherSide: 'Within, either side',
  atOrAbove: 'On track at or above',
  asPercentage: 'As a percentage — type 15 for 15%.',
  shownAs: 'Shown as',
  addTheRatio: 'Add the ratio',

  noRatios: 'No ratios yet',
  allArchived: 'Every ratio is archived',

  /** Where a ratio came from, under its name. */
  fromStandard: 'Provisioned with your company’s standard. Everything on it is yours to change, the formula included — '
    + 'and if you change what it counts, this card says so.',
  ownRatio: 'Your office’s own — the name, what it counts, the benchmark and who it applies to are all yours. It is '
    + 'compared with nobody outside this office, which is what makes that safe.',
  /** A ratio moved away from its company's standard (ADR-0024): what it was set up as, by its types' names. */
  notStandard: 'This is not your company’s standard any more.',
  setUpAs: ({ numerator, denominator }: { numerator: string; denominator: string }) =>
    `It was set up as ${numerator} ÷ ${denominator}. Your office is measured by what is below. A comparison with other `
    + 'offices still uses the standard, so the two figures can differ.',

  scopeHint: 'Tick none to ask everyone. Anybody on a rung you leave unticked will not see this ratio at all.',

  /** The benchmark's field, while a ratio is edited. */
  percentHint: 'On track at or above this, as a percentage — 15 means 15%.',
  atOrAboveHint: 'On track at or above this.',
  /** Before a ratio's benchmark, on its card. */
  onTrackWithin: 'On track within ',
  onTrackAtOrAbove: 'On track at or above ',

  /** How agents read a balance, under its two sides; `low` and `high` are the band's edges, written. */
  balanceRead: ({ low, high }: { low: string; high: string }) =>
    `Agents see each side’s share of the two — on track while each side is between ${low} and ${high}.`,
  /** A band's hint, live: the points typed, read as the shares they allow. */
  bandHintEmpty: 'Percentage points either side of an even split.',
  bandHint: ({ low, high }: { low: string; high: string }) =>
    `Percentage points either side of an even split: each side between ${low} and ${high}.`,
};

const id: MessagesOf<typeof en> = {
  subtitle: `Yang dihitung setiap ${kept('ratio')}, dan apa yang dianggap sesuai target.`,
  window: 'Dihitung dari aktivitas 30 hari terakhir.',

  hidePublished: 'Sembunyikan yang dilihat agent',
  showPublished: 'Lihat yang dilihat agent sekarang',
  publishedTitle: 'Yang dilihat agent sekarang',
  publishedLead: ({ publish }) =>
    words('Salinan yang diterbitkan. Salinan ini hanya berubah saat Anda menekan ', publish, ' — bukan saat Anda menyimpan.'),
  nothingPublished: `Belum ada yang diterbitkan untuk ${kept('KPM')} ini.`,
  publishedWithin: ' — sesuai target jika dalam ',
  publishedAtOrAbove: ' — sesuai target jika minimal ',

  addRatio: `Tambah ${kept('ratio')}`,
  addLead: `Sepenuhnya milik Anda — hitung apa pun yang perlu dipantau ${kept('KPM')} ini. ${kept('Ratio')} ini tidak `
    + `akan muncul di perbandingan apa pun dengan ${kept('KPM')} lain, karena tidak ada yang di luar ${kept('KPM')} ini `
    + 'tahu apa yang diukurnya.',
  kind: 'Jenis',
  kindRatio: `${kept('Ratio')} (A dibagi B)`,
  kindBalance: 'Keseimbangan (A dibanding B)',
  codeHint: 'Tidak pernah berubah setelah disimpan.',
  counts: 'Yang dihitung',
  outOf: 'Dari',
  withinEitherSide: 'Dalam batas, ke kedua arah',
  atOrAbove: 'Sesuai target jika minimal',
  asPercentage: 'Dalam persentase — ketik 15 untuk 15%.',
  shownAs: 'Ditampilkan sebagai',
  addTheRatio: `Tambah ${kept('ratio')} ini`,

  noRatios: `Belum ada ${kept('ratio')}`,
  allArchived: `Semua ${kept('ratio')} diarsipkan`,

  fromStandard: 'Disediakan dengan standar perusahaan Anda. Semuanya boleh Anda ubah, termasuk rumusnya — dan jika Anda '
    + 'mengubah yang dihitungnya, kartu ini menyebutkannya.',
  ownRatio: `Milik ${kept('KPM')} Anda sendiri — nama, yang dihitung, ${kept('benchmark')}, dan untuk siapa ${kept('ratio')} `
    + `ini berlaku sepenuhnya milik Anda. ${kept('Ratio')} ini tidak dibandingkan dengan siapa pun di luar ${kept('KPM')} `
    + 'ini, itulah yang membuatnya aman.',
  notStandard: 'Ini bukan lagi standar perusahaan Anda.',
  setUpAs: ({ numerator, denominator }) =>
    `Awalnya diatur sebagai ${numerator} ÷ ${denominator}. ${kept('KPM')} Anda diukur dengan yang ada di bawah ini. `
    + `Perbandingan dengan ${kept('KPM')} lain tetap memakai standar, jadi kedua angkanya bisa berbeda.`,

  scopeHint: 'Biarkan semua tanpa centang agar berlaku untuk semua orang. Siapa pun di jenjang yang tidak Anda centang '
    + `tidak akan melihat ${kept('ratio')} ini sama sekali.`,

  percentHint: 'Sesuai target jika minimal angka ini, dalam persentase — 15 berarti 15%.',
  atOrAboveHint: 'Sesuai target jika minimal angka ini.',
  onTrackWithin: 'Sesuai target jika dalam ',
  onTrackAtOrAbove: 'Sesuai target jika minimal ',

  balanceRead: ({ low, high }) =>
    `Agent melihat porsi setiap sisi dari keduanya — sesuai target selama setiap sisi berada di antara ${low} dan ${high}.`,
  bandHintEmpty: 'Poin persentase ke kedua arah dari pembagian rata.',
  bandHint: ({ low, high }) => `Poin persentase ke kedua arah dari pembagian rata: setiap sisi antara ${low} dan ${high}.`,
};

export const ratioBenchmarksMessages = defineMessages({ en, id });
