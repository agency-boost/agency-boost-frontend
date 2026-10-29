import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **A section's *Summary tile*, refused** (ADR-0064, OD-101; P18.98-T4): what `lib/summary-tiles.ts` says when a typed
 * tile name cannot be kept, and the server's two tile refusals in the reader's words — on the office's *Activity
 * types* screen and the Super Admin's Company template, which pass the reader's language (`planSummaryTile`,
 * `tileRefusal`). A tile's name and a section's are the office's, shown as typed (ADR-0179 §5).
 *
 * *Tile* is *kotak*, as the field is *Kotak ringkasan* (for approval, the glossary for approval's §B.10).
 *
 * @moved lib/summary-tiles.ts
 */
const en = {
  /** Said when a section with a tile of its own is given another name for it. */
  ownTile: 'A section with a tile of its own shows its own name. Rename the section to change it, or type the '
    + 'tile name of another section to count them together.',
  /** `CONFIG_SUMMARY_GROUP_CODE_TAKEN`: the code the reader typed for a section is a shared tile's. */
  codeTaken: ({ code, label }: { code: string; label: string }) =>
    `${code} is already the code of the summary tile “${label}”. Give the section another code.`,
  /** `CONFIG_SUMMARY_GROUP_LABEL_MISMATCH`: one tile, the labels its sections give it. */
  twoNames: ({ labels }: { labels: readonly string[] }) => {
    const named = labels.length > 1
      ? `${labels.slice(0, -1).map((l) => `“${l}”`).join(', ')} and “${labels.at(-1)}”`
      : 'two names';
    return `One summary tile, two names: ${named}. Give every section in it the same tile name.`;
  },
};

const id: MessagesOf<typeof en> = {
  ownTile: 'Bagian dengan kotak sendiri menampilkan namanya sendiri. Ganti nama bagian untuk mengubahnya, atau ketik '
    + 'nama kotak bagian lain untuk menghitung keduanya bersama.',
  codeTaken: ({ code, label }) => `${code} sudah menjadi kode kotak ringkasan “${label}”. Beri bagian ini kode lain.`,
  twoNames: ({ labels }) => {
    const named = labels.length > 1
      ? `${labels.slice(0, -1).map((l) => `“${l}”`).join(', ')} dan “${labels.at(-1)}”`
      : 'dua nama';
    return `Satu kotak ringkasan, dua nama: ${named}. Beri setiap bagian di dalamnya nama kotak yang sama.`;
  },
};

export const summaryTileMessages = defineMessages({ en, id });
