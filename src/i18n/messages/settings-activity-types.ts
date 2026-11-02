import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Settings › Activity types** (`/kpm/settings/activity-types`, P4-T1; P18.98-T4): what an office counts, a card per
 * section with its types numbered under it. The frame, the bars and the controls every settings screen shares —
 * *Save*, *Rename*, *Applies to*, *Show archived* — are `settings.ts`'.
 *
 * **Content, shown as typed** (ADR-0179 §5): a section's name and description, an activity type's label and
 * description, a rung's label, a tile's name. **Kept English** (§A): the title and the tabs (§A.1, §A.3), *Log
 * Activity* (a tab), the three cascade stages a bound type counts as (§A.6), *ratio* and *goal* (§A.6), *Super Admin*
 * (§A.5). *Section* is *bagian*, *rung* *jenjang* and *tile* *kotak* (for approval, the glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/activity-types/
 */
const en = {
  subtitle: 'What this office counts. Agents see these on Log Activity, in this order.',
  /** The toolbar's count, the prototype's `config-toolbar` sentence: the active types, over the sections drawn. */
  count: ({ types, sections }: { types: number; sections: number }) =>
    `${types} activity types across ${sections} categories`,
  addSection: 'Add a section',
  addSectionLead: 'A heading on the agent’s Log Activity screen, with its own activity types under it. You choose who it '
    + 'applies to after it exists.',
  permanentOnceSaved: 'Permanent once saved.',
  addTheSection: 'Add the section',
  none: 'No activity types yet',
  /** Under a section's rungs, while they are being ticked. */
  scopeHint: 'Tick none to ask everyone. Everything in this section is hidden from anybody on a rung you leave unticked.',
  /** The section's tile on the agents' strip (ADR-0064): one field in the rename. */
  summaryTile: 'Summary tile',
  summaryTileHint: 'Sections with the same tile are counted together. Empty gives it a tile of its own.',
  archiveSection: 'Archive the section',
  restoreSection: 'Restore the section',
  /** What archiving a section does, said beside its control: inline from 1024px, in the ⋮ below it. */
  archiveSectionHint: 'Archives the section and everything in it.',
  /** Why a type's code cannot change, in its edit. */
  codeReason: 'Every activity logged, every ratio and every goal points at it.',
  descriptionHint: "Optional. Shown under the name on the agent's screen.",
  /** The chip on a bound type: the cascade stage it counts as (P18.97-T4 AC-1), and its tooltip. */
  countsAs: ({ stage }: { stage: string }) => `Counts as: ${stage}`,
  countsAsTip: ({ stage }: { stage: string }) =>
    `The summary and the goal plan count this as ${stage}. A Super Admin changes which activities count.`,
  typeCodeHint: 'Permanent. Ratios and goals bind to it.',
  /** The button under a section's types. */
  addTo: ({ name }: { name: string }) => `Add to ${name}`,
};

const id: MessagesOf<typeof en> = {
  subtitle: `Yang dihitung ${kept('KPM')} ini. Agent melihatnya di ${kept('Log Activity')}, dengan urutan ini.`,
  count: ({ types, sections }) => `${types} jenis aktivitas di ${sections} kategori`,
  addSection: 'Tambah bagian',
  addSectionLead: `Judul di layar ${kept('Log Activity')} milik agent, dengan jenis aktivitasnya sendiri di bawahnya. `
    + 'Anda memilih untuk siapa bagian ini berlaku setelah bagian ini dibuat.',
  permanentOnceSaved: 'Permanen setelah disimpan.',
  addTheSection: 'Tambah bagian ini',
  none: 'Belum ada jenis aktivitas',
  scopeHint: 'Biarkan semua tanpa centang agar berlaku untuk semua orang. Semua yang ada di bagian ini disembunyikan '
    + 'dari siapa pun di jenjang yang tidak Anda centang.',
  summaryTile: 'Kotak ringkasan',
  summaryTileHint: 'Bagian dengan kotak yang sama dihitung bersama. Biarkan kosong agar bagian ini punya kotak sendiri.',
  archiveSection: 'Arsipkan bagian',
  restoreSection: 'Pulihkan bagian',
  archiveSectionHint: 'Mengarsipkan bagian ini beserta semua isinya.',
  codeReason: `Setiap aktivitas yang tercatat, setiap ${kept('ratio')}, dan setiap ${kept('goal')} merujuk ke kode ini.`,
  descriptionHint: 'Opsional. Ditampilkan di bawah nama di layar agent.',
  countsAs: ({ stage }) => `Dihitung sebagai: ${stage}`,
  countsAsTip: ({ stage }) =>
    `Ringkasan dan rencana ${kept('goal')} menghitung ini sebagai ${stage}. ${kept('Super Admin')} yang mengubah `
    + 'aktivitas mana yang dihitung.',
  typeCodeHint: `Permanen. Setiap ${kept('ratio')} dan ${kept('goal')} terikat padanya.`,
  addTo: ({ name }) => `Tambah ke ${name}`,
};

export const activityTypesMessages = defineMessages({ en, id });
