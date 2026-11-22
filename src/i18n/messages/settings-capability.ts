import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Settings › Capability Mapping** (`/kpm/settings/capability-mapping`, P5-T8; P18.10-T4): the ladder a stage is
 * decided by, its milestones, and the skill grids leaders assess against. The frame and the controls every settings
 * screen shares are `settings.ts`'. The ladder's grey sentence keeps its verdict per size in both languages (P18.9-T4
 * AC-6): shown from 1024px, behind an ⓘ beside the ladder's heading below it.
 *
 * **Content, shown as typed** (ADR-0179 §5): a stage's, a milestone's, a grid's and an item's name. **Kept English**
 * (§A): the title (§A.1), the tabs *Ladder* and *Skills* (§A.3), *skill*, *leader* and *downline* (§A.6). *Stage* is
 * *tahap*, *milestone* *milestone*, *skill grid* *grid skill*, *assessment* *penilaian* and *tick* *centang* (for
 * approval, the glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/capability-mapping/
 */
const en = {
  /**
   * **Two cards side by side** (P19.21-T3 AC-4, ADR-0274; `data-upload-pengaturan-*` frame 18): *Ladder* — the four
   * numbered *tahap*, each with its own milestones as the boxes a leader ticks — and *Skill tracker* — its *kelompok*,
   * each opening to its skills. No automatic rule: a leader ticks each by hand in the agent's profile.
   */
  ladder: kept('Ladder'),
  /** Under *Ladder*: how a stage is decided, in the client's words. */
  ladderNote: 'Stage = the highest stage whose milestones the leader has all ticked',
  skillTracker: kept('Skill tracker'),
  skillTrackerNote: ({ n }: { n: number }) => `Ticked by leaders in an agent’s profile · ${n} ${n === 1 ? 'group' : 'groups'}`,
  /** A kelompok's line. */
  skills: ({ n }: { n: number }) => `${n} ${n === 1 ? 'skill' : 'skills'}`,
  stageNumber: ({ n }: { n: number }) => `Stage ${n}`,
  noStages: 'No stages yet.',
  noGrids: 'No skill groups yet.',
  /** Milestones no stage requires — archived ones restored, or added with none (P19.21-T3 AC-4). */
  unattached: 'Milestones in no stage',
  /** The Super Admin's template editor's milestones card (`template-editor.tsx`) reads this area's words too. */
  milestones: 'Milestones',
  addMilestone: 'Add a milestone',
  addStage: 'Add a stage',
  addSkill: 'Add a skill',
  addGroup: 'Add a group',
  stageName: 'Stage name',
  firstMilestone: 'Its first milestone',
  /** A grid only somebody who leads is assessed against. */
  downlineOnly: 'Only for somebody with a downline',
  renameName: ({ label }: { label: string }) => `Rename ${label}`,
  moreFor: ({ label }: { label: string }) => `More for ${label}`,
  openGroup: ({ label }: { label: string }) => `${label}: show its skills`,
  /** A row's code, under its name while it is renamed: the identity a tick binds to. */
  codeHint: ({ code }: { code: string }) => `Code ${code} — a tick names this, and renaming never moves it.`,
  /** What *Archive* does to an item. */
  archiveTip: 'Keeps it on assessments that already tick it, and offers it on no new one.',
  /** What *Archive* does to a milestone under a stage (P19.21-T3 AC-4). */
  archiveMilestoneTip: 'Takes it out of every stage that requires it; restoring it puts it back.',
  /** Under the two cards (frame 18). */
  footTicks: 'Leaders tick these in an agent’s profile (Capability mapping + Skill tracker)',
  footHow: 'rename · drag to reorder · ⋯ archive',
};

const id: MessagesOf<typeof en> = {
  ladder: kept('Ladder'),
  ladderNote: `Tahap = tahap tertinggi yang semua milestone-nya dicentang ${kept('leader')}`,
  skillTracker: kept('Skill tracker'),
  skillTrackerNote: ({ n }) => `Dicentang ${kept('leader')} di profil agent · ${n} kelompok`,
  skills: ({ n }) => `${n} ${kept('skill')}`,
  stageNumber: ({ n }) => `Tahap ${n}`,
  noStages: 'Belum ada tahap.',
  noGrids: `Belum ada kelompok ${kept('skill')}.`,
  unattached: 'Milestone tanpa tahap',
  milestones: 'Milestone',
  addMilestone: 'Tambah milestone',
  addStage: 'Tambah tahap',
  addSkill: `Tambah ${kept('skill')}`,
  addGroup: 'Tambah kelompok',
  stageName: 'Nama tahap',
  firstMilestone: 'Milestone pertamanya',
  downlineOnly: `Hanya untuk yang memiliki ${kept('downline')}`,
  renameName: ({ label }) => `Ganti nama ${label}`,
  moreFor: ({ label }) => `Lainnya untuk ${label}`,
  openGroup: ({ label }) => `${label}: tampilkan ${kept('skill')}-nya`,
  codeHint: ({ code }) => `Kode ${code} — centang merujuk ke kode ini, dan mengganti nama tidak pernah memindahkannya.`,
  archiveTip: 'Tetap ada di penilaian yang sudah mencentangnya, dan tidak ditawarkan di penilaian baru.',
  archiveMilestoneTip: 'Dikeluarkan dari setiap tahap yang mensyaratkannya; memulihkannya mengembalikannya.',
  footTicks: `${kept('Leader')} mencentang di profil agent (${kept('Capability mapping')} + ${kept('Skill tracker')})`,
  footHow: 'ganti nama · seret untuk urutan · ⋯ arsipkan',
};

export const capabilityMessages = defineMessages({ en, id });
