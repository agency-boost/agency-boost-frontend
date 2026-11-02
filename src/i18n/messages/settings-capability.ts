import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Settings › Capability Mapping** (`/kpm/settings/capability-mapping`, P5-T8; P18.98-T4): the ladder a stage is
 * decided by, its milestones, and the skill grids leaders assess against. The frame and the controls every settings
 * screen shares are `settings.ts`'. The ladder's grey sentence keeps its verdict per size in both languages (P18.97-T4
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
  subtitle: 'The ladder and the skill grids your leaders assess people against.',
  /** Grey text: how a stage is decided. *ⓘ · ⓘ · Show.* */
  ladderNote: 'A person’s stage = highest stage with all milestones ticked.',
  /** The ladder's card, under the *Ladder* tab. */
  theLadder: 'The ladder',
  noStages: 'No stages yet.',
  /** A stage's badge: the milestones it takes. */
  needs: ({ n }: { n: number }) => `Needs ${n} ${n === 1 ? 'milestone' : 'milestones'}`,
  milestones: 'Milestones',
  addMilestone: 'Add a milestone',
  noMilestones: 'No milestones yet.',
  noGrids: 'No skill grids yet.',
  /** A grid only somebody who leads is assessed against. */
  downlineOnly: 'Only for somebody with a downline',
  addItem: 'Add an item',
  /** A row's code, under its name while it is renamed: the identity a tick binds to. */
  codeHint: ({ code }: { code: string }) => `Code ${code} — a tick names this, and renaming never moves it.`,
  /** What *Archive* does to an item. */
  archiveTip: 'Keeps it on assessments that already tick it, and offers it on no new one.',
  addCodeHint: 'Chosen once. Never reused.',
};

const id: MessagesOf<typeof en> = {
  subtitle: `${kept('Ladder')} dan grid ${kept('skill')} yang menjadi acuan ${kept('leader')} Anda saat menilai `
    + 'seseorang.',
  ladderNote: 'Tahap seseorang = tahap tertinggi yang semua milestone-nya sudah dicentang.',
  theLadder: kept('Ladder'),
  noStages: 'Belum ada tahap.',
  needs: ({ n }) => `Perlu ${n} milestone`,
  milestones: 'Milestone',
  addMilestone: 'Tambah milestone',
  noMilestones: 'Belum ada milestone.',
  noGrids: `Belum ada grid ${kept('skill')}.`,
  downlineOnly: `Hanya untuk yang memiliki ${kept('downline')}`,
  addItem: 'Tambah item',
  codeHint: ({ code }) => `Kode ${code} — centang merujuk ke kode ini, dan mengganti nama tidak pernah memindahkannya.`,
  archiveTip: 'Tetap ada di penilaian yang sudah mencentangnya, dan tidak ditawarkan di penilaian baru.',
  addCodeHint: 'Dipilih sekali. Tidak pernah dipakai ulang.',
};

export const capabilityMessages = defineMessages({ en, id });
