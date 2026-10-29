import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The words a ratio's figure is written with** (P18.98-T4): `lib/ratio-format.ts`' and `lib/ratio-balance.ts`'
 * word constants — what a unit is called where an Owner chooses one, *points* beside a balance's figure, a balance's
 * *Side A* and *Side B*, and the advice an off-balance reading gives. Every screen that writes a ratio reads them: the
 * office's Ratio benchmarks, the field's Ratio tab, a coaching session, the Unit Dashboard, the Company template.
 *
 * **A message never writes a figure** (P18.98-T3): the functions write it in the figures' language and hand it in,
 * and take the words' language beside it — English when a caller passes none, so a screen not moved yet reads as it
 * did. *Points* is §B.7's *poin*; *Side* is *Sisi* (for approval, the glossary for approval's §B.10). A section's name,
 * which names a side, is the office's, shown as typed (ADR-0179 §5).
 *
 * @moved lib/ratio-format.ts
 * @moved lib/ratio-balance.ts
 */
const en = {
  /** What each unit is called where an Owner chooses one; `example` is a figure written in it. */
  unit: {
    percent: ({ example }: { example: string }) => `A percentage — ${example}`,
    decimal: ({ example }: { example: string }) => `A number — ${example}`,
  },
  /** The unit's words beside an input, for a band. */
  pointsEitherSide: 'points either side',
  /** A band's benchmark, its figure written: *±30 points*. */
  band: ({ value }: { value: string }) => `±${value} points`,
  /** A balance's lean, whole: *24 points*, *1 point*. */
  lean: ({ value, one }: { value: string; one: boolean }) => (one ? `${value} point` : `${value} points`),
  /** A lean written to its tenth, where the whole would cross the band: *30,4 points*. */
  leanExact: ({ value }: { value: string }) => `${value} points`,
  /** A side with no one section to name it. */
  sideA: 'Side A',
  sideB: 'Side B',
  /**
   * What an off-balance reading tells the reader to do: the side there is too much of, and the band to come back into.
   * `section` is whether the side is named by a section, which English lower-cases in the sentence — *too much selling*.
   */
  tooMuch: ({ side, section, low, high }: { side: string; section: boolean; low: string; high: string }) =>
    `Too much ${section ? side.toLowerCase() : side} — aim for ${low}–${high}`,
};

const id: MessagesOf<typeof en> = {
  unit: {
    percent: ({ example }) => `Persentase — ${example}`,
    decimal: ({ example }) => `Angka — ${example}`,
  },
  pointsEitherSide: 'poin ke kedua arah',
  band: ({ value }) => `±${value} poin`,
  lean: ({ value }) => `${value} poin`,
  leanExact: ({ value }) => `${value} poin`,
  sideA: 'Sisi A',
  sideB: 'Sisi B',
  // The section's name as the office typed it (ADR-0179 §5): Indonesian writes it as it is.
  tooMuch: ({ side, low, high }) => `Terlalu banyak ${side} — jaga di ${low}–${high}`,
};

export const ratioWordMessages = defineMessages({ en, id });
