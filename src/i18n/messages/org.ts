import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The membership's own words** (`lib/org.ts`; P18.98-T4, people and forum; `functional/org-hierarchy.md`): a member's
 * status as its pill says it, and what a role change means, the prototype's sentence (`Overall.html:9043-9045`).
 * Read by the office's *All members* and a member's page, and by a leader's *Add New Agents*, each in its reader's
 * language (`roleChangeExplanation(…, language)`).
 *
 * **English is the source.** The statuses are the approved glossary's §B.3 — *Aktif · Menunggu · Dikeluarkan* — though
 * *Pending* and *Removed* are also *All members*' kept tab names (§A.3; `KEPT_ELSEWHERE`). A person is *dia* whatever
 * their pronoun (§B.0 rule 8). The rungs' names are the company's ladder's, as stored.
 *
 * @moved lib/org.ts
 */
const en = {
  /** The status pill (`StatusPill`'s label). */
  status: { active: 'Active', pending: 'Pending', removed: 'Removed' },
  /** What a role change means for the person (`roleChangeExplanation`): `from` and `to` each rung's badge name. */
  roleChange: {
    /** To their own leader, an Agent made an AAB: they keep reporting to the reader. */
    promoted: ({ name, from, to }: { name: string; from: string; to: string }) =>
      `${name} will change from ${from} to ${to}. They keep reporting to you, and can now recruit and manage their own direct agents.`,
    /** To their own leader, an AAB made an Agent again. */
    demoted: ({ name, from, to }: { name: string; from: string; to: string }) =>
      `${name} will change from ${from} back to ${to}. They keep reporting to you, but will no longer manage their own direct agents.`,
    /** Anybody else, and the office acting on anybody: nobody moves. */
    general: ({ name, from, to }: { name: string; from: string; to: string }) =>
      `${name} will change from ${from} to ${to}. Nobody moves — they keep reporting to whoever they report to now.`,
  },
};

const id: MessagesOf<typeof en> = {
  status: { active: 'Aktif', pending: 'Menunggu', removed: 'Dikeluarkan' },
  roleChange: {
    promoted: ({ name, from, to }) =>
      `${name} akan berubah dari ${from} menjadi ${to}. Dia tetap melapor kepada Anda, dan kini dapat merekrut serta mengelola agen langsungnya sendiri.`,
    demoted: ({ name, from, to }) =>
      `${name} akan kembali dari ${from} menjadi ${to}. Dia tetap melapor kepada Anda, tetapi tidak lagi mengelola agen langsungnya sendiri.`,
    general: ({ name, from, to }) =>
      `${name} akan berubah dari ${from} menjadi ${to}. Tidak ada yang pindah — dia tetap melapor kepada ${kept('leader')} yang sama seperti sekarang.`,
  },
};

export const orgMessages = defineMessages({ en, id });
