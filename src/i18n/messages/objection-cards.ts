import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **A product's objection cards, edited** (`components/objection-cards.tsx`; P19.4-T4 AC-1, the 11-03 handover's B1-1;
 * ADR-0209 §9; the glossary's *Objection card*, *Keberatan*): the cards under *4 · If they push back* on the company's
 * *Produk* tab and on an office's *Settings › Products* — each card's two sides, *"+ Tambah keberatan"* and the remove.
 * Each side is named as the agents' push-back box names it (*They say:* · *You say:*; `plan.ts`), numbered.
 *
 * @moved components/objection-cards.tsx
 */
const en = {
  objection: ({ n }: { n: number }) => `Objection ${n} — they say`,
  answer: ({ n }: { n: number }) => `Objection ${n} — you say`,
  add: '+ Add objection',
  remove: ({ n }: { n: number }) => `Remove objection ${n}`,
  full: ({ max }: { max: number }) => `A product holds at most ${max} objections.`,
  none: 'No objection yet.',
};

const id: MessagesOf<typeof en> = {
  // *They* is one customer, so *dia* (§B.0 rule 8), as the plan's *Jika ada keberatan — dia berkata*.
  objection: ({ n }) => `Keberatan ${n} — dia berkata`,
  answer: ({ n }) => `Keberatan ${n} — Anda menjawab`,
  // The handover's own words (B1-1): *"+ Tambah keberatan"*.
  add: '+ Tambah keberatan',
  remove: ({ n }) => `Hapus keberatan ${n}`,
  full: ({ max }) => `Satu produk paling banyak ${max} keberatan.`,
  none: 'Belum ada keberatan.',
};

export const objectionCardsMessages = defineMessages({ en, id });
