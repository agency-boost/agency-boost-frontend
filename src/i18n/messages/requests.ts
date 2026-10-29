import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Deciding who joins and who moves** (P18.98-T4, people and forum; `functional/org-hierarchy.md`, *Deciding*,
 * *Transfers*, *The request inbox on `/new-hires`*): the request inbox (`components/request-inbox.tsx` — *Pending
 * Requests*, *Review requests* on `/new-hires`), the join date an approval asks for, which *All members* › *Pending*
 * asks for too, and the office's transfer requests (`components/transfer-requests.tsx`).
 *
 * **English is the source.** The Indonesian is the approved glossary's: *Setujui · Tolak · Batal* (§B.1), *Tanggal
 * bergabung* (§B.4), *Pemindahan disetujui ✓* (§B.2), *leader* and *unit* kept (§A.6). A person is *dia* (§B.0 rule 8).
 * **Typed content stays as typed**: a name, a reason, the name a leader typed. **A figure is never a message's**: the
 * day is written by the caller in the figures' language and passed in.
 *
 * @moved components/request-inbox.tsx
 * @moved components/transfer-requests.tsx
 */
const en = {
  inbox: {
    empty: 'No pending requests right now.',
    loading: 'Loading requests…',
    /** Who passed the request on to the reader. */
    sentBy: ({ name }: { name: string }) => `Sent to you by ${name}.`,
    approve: 'Approve',
    approving: 'Approving…',
    decline: 'Decline',
    declining: 'Declining…',
    cancel: 'Cancel',
    /** Declining asks why, which they are sent. */
    why: 'Why?',
    whyHint: 'Sent to them. Saying nothing leaves them guessing what to do instead.',
    whyExample: 'Not in my patch — try Sari',
    /** Where an agent is added: the leader's own unit, or one of their AABs'. */
    addTo: 'Add to',
    myUnit: 'My own unit',
    ownUnitOf: ({ name }: { name: string }) => `${name}'s own unit`,
    unitOf: ({ name, size }: { name: string; size: number }) => `${name}'s unit (${size})`,
  },
  /** The join date an approval asks for (ADR-0169, ADR-0170 §5): the inbox's and *All members* › *Pending*'s. */
  joinDate: 'Join date',
  joinDateHint: 'The day they joined. Today unless they joined earlier.',
  /** `today` written in the figures' language. */
  lateDate: ({ today }: { today: string }) => `The join date cannot be after today, ${today}.`,
  /** The office's transfer requests (ADR-0170 §4): ours, no prototype draws a transfer. */
  transfers: {
    heading: 'Transfer requests',
    line: 'A leader added somebody who reports to another leader. Approving moves them, and everybody under them, with their history.',
    caption: 'Transfer requests, oldest first',
    columns: { who: 'Who', move: 'Move', askedBy: 'Asked by', actions: 'Actions' },
    move: ({ from, to }: { from: string | null; to: string }) => (from ? `From ${from}’s unit to ${to}’s` : `To ${to}’s unit`),
    /** The name the leader typed, where it is not the account's. */
    typedAs: ({ name }: { name: string }) => `Added as ${name}`,
    approve: 'Approve',
    decline: 'Decline',
    cancel: 'Cancel',
    why: 'Why?',
    whyHint: 'Sent to the leader who asked.',
    confirm: ({ name, to }: { name: string; to: string }) => `Move ${name} to ${to}’s unit? Everybody under them moves too.`,
    confirmLabel: 'Approve transfer',
    approved: ({ name, to }: { name: string; to: string }) => `Transfer approved ✓ — ${name} is in ${to}’s unit now.`,
    declined: 'Transfer declined ✓',
  },
};

const id: MessagesOf<typeof en> = {
  inbox: {
    empty: 'Tidak ada permintaan yang menunggu saat ini.',
    loading: 'Memuat permintaan…',
    sentBy: ({ name }) => `Dikirim kepada Anda oleh ${name}.`,
    approve: 'Setujui',
    approving: 'Menyetujui…',
    decline: 'Tolak',
    declining: 'Menolak…',
    cancel: 'Batal',
    why: 'Alasan',
    whyHint: 'Dikirim kepadanya. Tanpa alasan, dia harus menebak apa yang sebaiknya dilakukan.',
    whyExample: 'Bukan wilayah saya — coba ke Sari',
    addTo: 'Tambahkan ke',
    myUnit: `${kept('Unit')} saya sendiri`,
    ownUnitOf: ({ name }) => `${kept('Unit')} ${name} sendiri`,
    unitOf: ({ name, size }) => `${kept('Unit')} ${name} (${size})`,
  },
  joinDate: 'Tanggal bergabung',
  joinDateHint: 'Hari dia bergabung. Hari ini, kecuali dia bergabung lebih awal.',
  lateDate: ({ today }) => `Tanggal bergabung tidak boleh setelah hari ini, ${today}.`,
  transfers: {
    heading: 'Permintaan pemindahan',
    line: `Seorang ${kept('leader')} menambahkan orang yang melapor kepada ${kept('leader')} lain. Menyetujuinya akan memindahkan dia, beserta semua orang di bawahnya, bersama riwayatnya.`,
    caption: 'Permintaan pemindahan, terlama dulu',
    columns: { who: 'Siapa', move: 'Pemindahan', askedBy: 'Diajukan oleh', actions: 'Aksi' },
    move: ({ from, to }) => (from ? `Dari ${kept('unit')} ${from} ke ${kept('unit')} ${to}` : `Ke ${kept('unit')} ${to}`),
    typedAs: ({ name }) => `Ditambahkan sebagai ${name}`,
    approve: 'Setujui',
    decline: 'Tolak',
    cancel: 'Batal',
    why: 'Alasan',
    whyHint: `Dikirim kepada ${kept('leader')} yang mengajukan.`,
    confirm: ({ name, to }) => `Pindahkan ${name} ke ${kept('unit')} ${to}? Semua orang di bawahnya ikut pindah.`,
    confirmLabel: 'Setujui pemindahan',
    approved: ({ name, to }) => `Pemindahan disetujui ✓ — ${name} sekarang di ${kept('unit')} ${to}.`,
    declined: 'Pemindahan ditolak ✓',
  },
};

export const requestsMessages = defineMessages({ en, id });
