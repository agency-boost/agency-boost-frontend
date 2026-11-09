import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The *Contoh* sample and the no-office card** (P19-T4; D-37, UI-159 item 3, UI-166; ADR-0189 §2, §3, §5): what an
 * empty leader page shows under its normal layout — a greyed sample of that layout labelled *Contoh*, with one next
 * step — and what every page that needs a KPM shows somebody who has joined none yet.
 *
 * **The Indonesian is the owner's** where the handover gives it, word for word: *Contoh*, *Belum ada data*, *Daftar ke
 * KPM atau minta leader Anda menerima Anda dulu*, *Cari / Daftar KPM*, *Cari leader*, *Undang agen*. The sample's
 * people are named as what they are — *Agen contoh 1* — never a realistic name (ADR-0189 §3). **Kept** (§A): *KPM*.
 *
 * @moved components/sample-preview.tsx
 * @moved components/no-kpm-yet.tsx
 */
const en = {
  /** The label on the sample, top left. */
  label: 'Example',
  /** What a screen reader hears for the sample, which it does not read row by row. */
  sampleName: 'An example of what this page shows once there is data. Not real data.',
  /** The short grey line on an empty page (D-37). */
  noData: 'No data yet',
  /** A sample person's name: obviously not a person. */
  person: ({ n }: { n: number }) => `Sample agent ${n}`,
  /** A sample leader's name, above sample people. */
  leader: 'Sample leader',
  /** The next step on an empty leader page. */
  next: {
    addFirstAgent: 'Add your first agent',
    inviteAgent: 'Invite an agent',
  },
  /** UI-166 item 1: every page that needs a KPM, for somebody in none. */
  noKpm: {
    line: `Register with a ${kept('KPM')} or ask your leader to accept you first`,
    findKpm: `Find / register a ${kept('KPM')}`,
    findLeader: 'Find a leader',
  },
};

const id: MessagesOf<typeof en> = {
  label: 'Contoh',
  sampleName: 'Contoh tampilan halaman ini setelah ada data. Bukan data sebenarnya.',
  noData: 'Belum ada data',
  person: ({ n }) => `Agen contoh ${n}`,
  leader: 'Leader contoh',
  next: {
    addFirstAgent: 'Tambah agent pertama',
    inviteAgent: 'Undang agen',
  },
  noKpm: {
    line: `Daftar ke ${kept('KPM')} atau minta leader Anda menerima Anda dulu`,
    findKpm: `Cari / Daftar ${kept('KPM')}`,
    findLeader: 'Cari leader',
  },
};

export const samplePreviewMessages = defineMessages({ en, id });
