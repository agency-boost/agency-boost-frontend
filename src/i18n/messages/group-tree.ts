import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Group tree** — `/group-tree`, a leader's own downline (P18.98-T4, coaching and unit; `functional/org-hierarchy.md`,
 * *Group tree*): the page's title and line, its wait and its empty state. The tree itself, its cards, its layers and its
 * phone's list are the office's *Org Tree*'s (`org-tree.ts`), drawn by the same component.
 *
 * **English is the source**: the nav item's words as the title (P18.95-T9 AC-2) and the module's own line. The
 * Indonesian is the approved glossary's: §B.5's *Belum ada yang melapor kepada Anda.*, *Ketuk*, never *klik*
 * (P18.95-T9 AC-5), *agent* as §B.1's *+ Tambah agent* writes it, *lapisan* as the org tree's *Lapisan {n}*. **Kept**
 * (§A): the title, *Leader*, *downline*, *unit*, *Unit Dashboard*.
 *
 * @moved app/(agent)/group-tree/
 */
const en = {
  title: kept('Group Tree'),
  subtitle: 'Your leader, you, and your full downline, laid out by layer. Tap anyone to open their Unit Dashboard.',
  loading: 'Loading your unit…',
  empty: 'Nobody reports to you yet. Once you add agents to your unit they appear here, with everyone below them.',
};

const id: MessagesOf<typeof en> = {
  title: kept('Group Tree'),
  subtitle: `${kept('Leader')} Anda, Anda sendiri, dan seluruh ${kept('downline')} Anda, disusun per lapisan. Ketuk siapa pun untuk membuka ${kept('Unit Dashboard')}-nya.`,
  loading: `Memuat ${kept('unit')} Anda…`,
  empty: `Belum ada yang melapor kepada Anda. Setelah Anda menambahkan agent ke ${kept('unit')} Anda, mereka muncul di sini, bersama semua orang di bawah mereka.`,
};

export const groupTreeMessages = defineMessages({ en, id });
