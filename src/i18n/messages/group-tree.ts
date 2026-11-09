import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Group tree** — `/group-tree`, a leader's own downline (P18.10-T4, coaching and unit; `functional/org-hierarchy.md`,
 * *Group tree*): the page's title and line, its wait and its empty state. The tree itself, its cards, its layers and its
 * phone's list are the office's *Org Tree*'s (`org-tree.ts`), drawn by the same component.
 *
 * **English is the source**: the nav item's words as the title (P18.7-T9 AC-2) and the module's own line. The
 * Indonesian is the approved glossary's: §B.5's *Belum ada yang melapor kepada Anda.*, *Ketuk*, never *klik*
 * (P18.7-T9 AC-5), *agent* as §B.1's *+ Tambah agent* writes it, *lapisan* as the org tree's *Lapisan {n}*. **Kept**
 * (§A): the title, *Leader*, *downline*, *unit*, *Unit Dashboard*.
 *
 * @moved app/(agent)/group-tree/
 */
const en = {
  title: kept('Group Tree'),
  subtitle: 'Your leader, you, and your full downline, laid out by layer. Tap anyone to open their Unit Dashboard.',
  loading: 'Loading your unit…',
  empty: 'Nobody reports to you yet. Once you add agents to your unit they appear here, with everyone below them.',
  /*
   * UI V1 (2026-10-30; UI-058, UI-059, UI-072 to UI-075): the tree as rows. *Cari agen*, the summary with no zero, the
   * reader's *Anda*, the upline's *Leader Anda*, the desktop's four columns — the report's words (Appendix A).
   */
  /**
   * The title row's search pill (UI-059): it filters this tree by name or agent code. Not the sidebar's kept *Search
   * agent*, which opens a person: the report writes this one *Cari agen*.
   */
  search: 'Find an agent',
  /** Nothing in the tree matches what was typed. */
  noMatch: 'No agent in your tree matches that search.',
  /** *11 below you · 3 AAB · 8 Agent* — each rung's count, zero ones left out (UI-074). */
  below: ({ total, parts }: { total: number; parts: string }) => (parts ? `${total} below you · ${parts}` : `${total} below you`),
  /** The reader's own row (UI-059), never cut short (UI-075). */
  you: 'You',
  /** The upline's line, *AB · Your leader*. */
  yourLeader: 'Your leader',
  /** The desktop's columns (UI-058). */
  columns: { name: 'Name', role: 'Role', direct: 'Direct reports', today: 'Today' },
  /** A team's list, for a screen reader: *Sari Puspita's team*. */
  team: ({ name }: { name: string }) => `${name}’s team`,
  /** A desktop's *Langsung* when there are none: a dot, read as this. */
  noneDirect: 'None',
  /**
   * **A leader's Group Tree, read-only** (P19.3-T3; UI-152: *"as that leader sees them"*), `/group-tree/[membershipId]`:
   * the title names whose; the summary counts below them; the not-found state when the leader is outside the reader's
   * reach, gone, or another office's.
   */
  titleOf: ({ name }: { name: string }) => `${kept('Group Tree')} · ${name}`,
  belowThem: ({ total, parts }: { total: number; parts: string }) => (parts ? `${total} below them · ${parts}` : `${total} below them`),
  emptyOf: 'Nobody reports to this leader yet.',
  /** The upline card on a leader's tree: *Leader Sari*, where the reader's own reads *Your leader*. */
  leaderOf: ({ name }: { name: string }) => `${name}’s ${kept('leader')}`,
  notFoundTitle: 'This Group Tree is not one you can open.',
  notFoundLine: 'The leader may have left, or be outside the people you can see.',
  back: 'Back to KPM Analytics',
};

const id: MessagesOf<typeof en> = {
  title: kept('Group Tree'),
  subtitle: `${kept('Leader')} Anda, Anda sendiri, dan seluruh ${kept('downline')} Anda, disusun per lapisan. Ketuk siapa pun untuk membuka ${kept('Unit Dashboard')}-nya.`,
  loading: `Memuat ${kept('unit')} Anda…`,
  empty: `Belum ada yang melapor kepada Anda. Setelah Anda menambahkan agent ke ${kept('unit')} Anda, mereka muncul di sini, bersama semua orang di bawah mereka.`,
  search: 'Cari agen',
  noMatch: 'Tidak ada agen di pohon Anda yang cocok dengan pencarian itu.',
  below: ({ total, parts }) => (parts ? `${total} di bawah Anda · ${parts}` : `${total} di bawah Anda`),
  you: 'Anda',
  yourLeader: `${kept('Leader')} Anda`,
  columns: { name: 'Nama', role: 'Peran', direct: 'Langsung', today: 'Hari ini' },
  team: ({ name }) => `Tim ${name}`,
  noneDirect: 'Tidak ada',
  titleOf: ({ name }) => `${kept('Group Tree')} · ${name}`,
  belowThem: ({ total, parts }) => (parts ? `${total} di bawahnya · ${parts}` : `${total} di bawahnya`),
  emptyOf: 'Belum ada yang melapor kepada leader ini.',
  leaderOf: ({ name }) => `${kept('Leader')} ${name}`,
  notFoundTitle: `${kept('Group Tree')} ini tidak dapat Anda buka.`,
  notFoundLine: 'Leader-nya mungkin sudah keluar, atau di luar orang yang dapat Anda lihat.',
  back: `Kembali ke ${kept('KPM Analytics')}`,
};

export const groupTreeMessages = defineMessages({ en, id });
