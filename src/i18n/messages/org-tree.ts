import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The KPM's Org tree** (P19.20-T3; ADR-0273 §4; `functional/org-hierarchy.md`, *The Org tree*) — `/people/org-tree`, the
 * Group Tree design (D-05) for the whole KPM at every size, and *Struktur saat ini* on Import people
 * (`components/org-tree/kpm-tree.tsx`).
 *
 * **The Indonesian is the source**: the approved People mockups of 19 November (*Cari agen*, *Buka semua*, *"30 orang · 5
 * AB · 4 AAB · 21 Agent · akun tes tidak dihitung"*, *Anda*, *n langsung*, *n orang*). The English is ours. **Kept**
 * (§A): the page's title, the rungs' names (the company's ladder's), *KPM*, *unit*. The reader is *Anda* (§B.0).
 *
 * @moved app/(tenant)/people/org-tree/page.tsx
 * @moved components/org-tree/
 */
const en = {
  loading: 'Loading the KPM’s tree…',
  empty: 'This KPM has no members yet. People appear here once they have joined and been placed under a leader.',
  search: 'Find an agent',
  openAll: 'Open all',
  closeAll: 'Close all',
  /** *30 orang · 5 AB · 4 AAB · 21 Agent · akun tes tidak dihitung*: each rung by its badge's name, a zero left out. */
  summary: ({ total, parts }: { total: number; parts: string }) =>
    `${total} ${total === 1 ? 'person' : 'people'}${parts ? ` · ${parts}` : ''} · test accounts not counted`,
  you: 'You',
  direct: ({ n }: { n: number }) => `${n} direct`,
  people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
  team: ({ name }: { name: string }) => `${name}’s team`,
  noMatch: 'Nobody in this KPM matches that search.',
  newTag: 'New',
  open: ({ name }: { name: string }) => `Open ${name}`,
};

const id: MessagesOf<typeof en> = {
  loading: `Memuat pohon ${kept('KPM')}…`,
  empty: `${kept('KPM')} ini belum punya anggota. Orang muncul di sini setelah bergabung dan ditempatkan di bawah seorang ${kept('leader')}.`,
  search: 'Cari agen',
  openAll: 'Buka semua',
  closeAll: 'Tutup semua',
  summary: ({ total, parts }) => `${total} orang${parts ? ` · ${parts}` : ''} · akun tes tidak dihitung`,
  you: 'Anda',
  direct: ({ n }) => `${n} langsung`,
  people: ({ n }) => `${n} orang`,
  team: ({ name }) => `Tim ${name}`,
  noMatch: `Tidak ada orang di ${kept('KPM')} ini yang cocok dengan pencarian itu.`,
  newTag: 'Baru',
  open: ({ name }) => `Buka ${name}`,
};

export const orgTreeMessages = defineMessages({ en, id });
