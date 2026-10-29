import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The hierarchy, drawn** (P18.98-T4, people and forum; `functional/org-hierarchy.md`, *The tree*): the office's
 * *Org Tree* (`/people/org-tree`) and the tree itself (`components/org-tree/org-tree.tsx`), which a leader's *Group
 * tree* draws too — its counts, its legend, the reader's leader, its layers, a leader's unit, and the control that
 * opens and closes it, on the canvas and in a phone's list.
 *
 * **English is the source**, the prototype's sentence for a unit included (`Group_Overview.html:219-228`). The
 * Indonesian is the approved glossary's (*Belum ada yang melapor kepada Anda.*, §B.5; *office* is *KPM*, §B.9).
 * **Kept** (§A): the page's title, the rungs' names (the company's ladder's), *leader*, *unit*, *downline*. A person is
 * *dia*; the reader is *Anda* (§B.0).
 *
 * @moved app/(tenant)/people/org-tree/page.tsx
 * @moved components/org-tree/
 */
const en = {
  /** The office's page. */
  subtitle: 'Every AB in this KPM and their full downline',
  loading: 'Loading the office tree…',
  empty: 'This office has no members yet. People appear here once they have joined and been placed under a leader.',
  /** More than one tree: the office root and anybody left unassigned. */
  roots: ({ n }: { n: number }) =>
    `${n} people report to nobody. That is the office root plus anyone left unassigned — each starts a tree of their own here.`,
  /** The tree's head: whom it holds, by rung — each rung by its badge's name. */
  nobody: 'Nobody reports to you yet.',
  counts: ({ total, ab, aab, agent }: { total: number; ab: string; aab: string; agent: string }) =>
    `${total} below you · ${ab} · ${aab} · ${agent}`,
  yourLeader: 'Your leader',
  layer: ({ n }: { n: number }) => `Layer ${n}`,
  /** The reader's own card, in capitals. */
  you: 'YOU',
  show: ({ name }: { name: string }) => `Show who reports to ${name}`,
  hide: ({ name }: { name: string }) => `Hide who reports to ${name}`,
  /** Under the canvas: the people a closed unit holds. */
  closed: ({ n }: { n: number }) =>
    `${n} ${n === 1 ? 'person is' : 'people are'} inside a closed unit. Units below layer 2 start closed, so a large office opens legibly.`,
  /** A leader's own unit, *"3 direct agents, 2 AAB"*: the agents' part, the prototype's words. */
  directAgents: ({ n }: { n: number }) => `${n} direct agent${n > 1 ? 's' : ''}`,
};

const id: MessagesOf<typeof en> = {
  subtitle: `Setiap ${kept('AB')} di ${kept('KPM')} ini beserta seluruh ${kept('downline')}-nya`,
  loading: `Memuat pohon ${kept('KPM')}…`,
  empty: `${kept('KPM')} ini belum punya anggota. Orang muncul di sini setelah bergabung dan ditempatkan di bawah seorang ${kept('leader')}.`,
  roots: ({ n }) =>
    `${n} orang tidak melapor kepada siapa pun. Itu adalah puncak ${kept('KPM')} ditambah siapa pun yang belum ditempatkan — masing-masing memulai pohonnya sendiri di sini.`,
  nobody: 'Belum ada yang melapor kepada Anda.',
  counts: ({ total, ab, aab, agent }) => `${total} di bawah Anda · ${ab} · ${aab} · ${agent}`,
  yourLeader: `${kept('Leader')} Anda`,
  layer: ({ n }) => `Lapisan ${n}`,
  you: 'ANDA',
  show: ({ name }) => `Tampilkan yang melapor kepada ${name}`,
  hide: ({ name }) => `Sembunyikan yang melapor kepada ${name}`,
  closed: ({ n }) =>
    `${n} orang ada di dalam ${kept('unit')} yang tertutup. ${kept('Unit')} di bawah lapisan 2 dimulai dalam keadaan tertutup, agar ${kept('KPM')} yang besar tetap mudah dibaca.`,
  directAgents: ({ n }) => `${n} agen langsung`,
};

export const orgTreeMessages = defineMessages({ en, id });
