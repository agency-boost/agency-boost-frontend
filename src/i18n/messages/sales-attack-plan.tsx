import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Sales Attack Plan** (P18.98-T4, field selling; `functional/sales-tools.md`, *The module's own strings*):
 * `/attack-plan` — the customer brief's three questions and their chips, the plan's summary, its pill, the notes on a
 * product outside the brief's bands or in run-off, the alternatives' line, the catalog's deep link's banner, and the
 * states the prototype lacks; `lib/product-catalog.ts`' words for a brief (`needLabel`, `budgetLabel`, `resultTag`,
 * `fitNote`, `moreLine`).
 *
 * **English is the source** of the keys, the prototype's words verbatim (`Overall.html:3786-3866`, `:9527-9869`; D-copy)
 * and the module's own; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it lacked in the
 * glossary for approval's §B.10 — *gambaran nasabah* for the customer brief, *kebutuhan* for a need, *rentang usia*,
 * *anggaran premi*, *Sekaligus* for *Lump-sum*, *Cocok* and *Cek kecocokan* for the verdicts. The brief's eight needs are
 * ours, so they are Indonesian; the catalog's categories that share three of their names (*Health*, *Critical illness*,
 * *Education*) stay English there as §A.3's tabs (`KEPT_ELSEWHERE`). **Kept English** (§A): *Sales Attack Plan*, *Attack
 * Plan* (the plan's step and its button name it, in ID mode as the tab spells it), *Product Catalog*, *Script*. **Content
 * stays as typed** (ADR-0179 §5; §C3): the product's name, tagline and script, an alternative's name.
 *
 * **A message never writes a figure** (P18.98-T3): a budget band's sums are written by `budgetLabel` in the figures'
 * language (*Rp 500 rb–Rp 2 jt*, *IDR 500K–IDR 2M*), and a count is passed in.
 *
 * @moved components/attack-plan.tsx
 * @moved app/(agent)/attack-plan/
 */

/** A run of words drawn bold. */
type Strong = (words: string) => ReactNode;

/** Which of the brief's bands the shown product is outside: the server's, in its order (`outside`). */
type Outside = readonly ('age' | 'budget')[];

const en = {
  title: kept('Sales Attack Plan'),
  /** The step pills (`:3788-3792`); the first also names the brief's summary for a screen reader. */
  stepBrief: 'Customer brief',
  stepPlan: 'Attack plan',
  /** The brief's three questions (`:3801-3836`), and *Lump-sum*'s own group after them (P18.95-T6 AC-3; UI-030). */
  primaryNeed: 'Primary need',
  ageBand: 'Age band',
  budget: 'Monthly premium budget',
  lumpSumGroup: 'Or pay once',
  /** The brief's eight needs, by the domain constants' codes (`PRODUCT_NEED_LABELS`, pinned by `product-catalog.spec.ts`). */
  needs: {
    'life-protection': 'Life protection',
    health: 'Health',
    ci: 'Critical illness',
    accident: 'Accident-only',
    education: 'Education',
    investment: 'Investment',
    retirement: 'Retirement income',
    legacy: 'Legacy / inheritance',
  },
  /** Band 7, the single payment: its chip, its summary. */
  lumpSum: 'Lump-sum',
  /** Beside *Build attack plan* until the brief is complete (`:9557-9561`). */
  pickAll: 'Pick a need, age band, and budget to continue.',
  build: 'Build attack plan',
  loading: 'Building your attack plan…',

  /** The catalog's deep link (`:9858-9866`): the banner, *Product Catalog* in bold, and its action. */
  banner: ({ strong }: { strong: Strong }) => (
    <>
      Opened from the {strong(kept('Product Catalog'))} — no customer profile set yet, so fit isn&apos;t checked.
    </>
  ),
  addProfile: 'Add age & budget',

  /** The brief's summary (`:3857-3861`): each label with its space, before the answer. */
  needIs: 'Need: ',
  ageIs: 'Age: ',
  budgetIs: 'Budget: ',
  /** The result's pill (`:9660-9667`): the verdict in words; *In run-off* is the catalog's (`product-catalog.ts`). */
  goodFit: 'Good fit',
  checkFit: 'Check fit',
  fromCatalog: 'From catalog',
  /** The fit note (`:9669-9675`): the bands the product is outside, in the server's order. */
  fitNote: ({ outside }: { outside: Outside }) =>
    `Outside the typical ${outside.map((band) => (band === 'age' ? 'age band' : 'budget band')).join(' and ')} for this `
    + 'product — still workable, but check eligibility and premium sizing before quoting.',
  /** A run-off product's note on the plan page (`:9676`). */
  runOff: 'This product is in run-off and not actively issued to new applicants. No active sales script — shown for '
    + 'reference against existing policyholders only.',
  /** The alternatives' line (`:9696-9700`), and the count past the four drawn. */
  alsoMatches: 'Also matches this need — tap to switch the plan above:',
  more: ({ n }: { n: number }) => `${n} more also match. Open the Product Catalog to browse the full shelf.`,
  noMatch: 'No active product matches this need. Try a different need in the brief.',
};

const id: MessagesOf<typeof en> = {
  title: kept('Sales Attack Plan'),
  stepBrief: 'Gambaran nasabah',
  // The plan's name, as §A.3's tab writes it.
  stepPlan: kept('Attack Plan'),
  primaryNeed: 'Kebutuhan utama',
  ageBand: 'Rentang usia',
  budget: 'Anggaran premi bulanan',
  lumpSumGroup: 'Atau bayar sekali',
  needs: {
    'life-protection': 'Perlindungan jiwa',
    health: 'Kesehatan',
    ci: 'Penyakit kritis',
    accident: 'Khusus kecelakaan',
    education: 'Pendidikan',
    investment: 'Investasi',
    retirement: 'Dana pensiun',
    legacy: 'Warisan',
  },
  lumpSum: 'Sekaligus',
  pickAll: 'Pilih kebutuhan, rentang usia, dan anggaran untuk melanjutkan.',
  build: `Susun ${kept('Attack Plan')}`,
  loading: `Menyusun ${kept('Attack Plan')} Anda…`,

  banner: ({ strong }) => (
    <>
      Dibuka dari {strong(kept('Product Catalog'))} — gambaran nasabah belum diisi, jadi kecocokan tidak dicek.
    </>
  ),
  addProfile: 'Tambah usia & anggaran',

  needIs: 'Kebutuhan: ',
  ageIs: 'Usia: ',
  budgetIs: 'Anggaran: ',
  goodFit: 'Cocok',
  checkFit: 'Cek kecocokan',
  fromCatalog: 'Dari katalog',
  fitNote: ({ outside }) =>
    `Di luar ${outside.map((band) => (band === 'age' ? 'rentang usia' : 'rentang anggaran')).join(' dan ')} yang umum `
    + 'untuk produk ini — masih memungkinkan, tetapi periksa kelayakan dan besaran premi sebelum membuat penawaran.',
  runOff: `Produk ini tidak dijual lagi dan tidak lagi diterbitkan untuk pemohon baru. Tidak ada ${kept('script')} `
    + 'penjualan aktif — ditampilkan hanya sebagai referensi untuk pemegang polis yang sudah ada.',
  alsoMatches: 'Juga sesuai dengan kebutuhan ini — ketuk untuk mengganti rencana di atas:',
  more: ({ n }) => `${n} produk lain juga sesuai. Buka ${kept('Product Catalog')} untuk melihat seluruh etalase.`,
  noMatch: 'Tidak ada produk aktif yang sesuai dengan kebutuhan ini. Coba kebutuhan lain di gambaran nasabah.',
};

export const salesAttackPlanMessages = defineMessages({ en, id });
