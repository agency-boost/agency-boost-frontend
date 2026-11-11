import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Changing who somebody reports to** (P19.12-T4; ADR-0247; `functional/org-hierarchy.md`, *Changing a leader*): the
 * shared leader picker (`components/leader-picker.tsx`) — *Pindahkan ke leader lain* on *Tim Anda*, *Ganti* on the member
 * page's *Melapor ke* — and the line a waiting move leaves on a *Tim Anda* row.
 *
 * **English is the source.** The Indonesian is the approved glossary's: *leader*, *unit*, *Owner* and *Admin* kept (§A.6),
 * a person *dia* (§B.0 rule 8), *Batalkan* (§B.1), *Tersimpan ✓* (§B.2). The two sentences the client wrote in the
 * request of 11 November 2026 are reproduced as written: *{nama} dan {n} orang di bawahnya pindah ke unit {leader}
 * sekarang.* and *Ini dikirim sebagai permintaan ke Owner/Admin. {nama} tetap melapor kepada Anda sampai disetujui.*
 * **Typed content stays as typed**: a name, an agent code, a reason. **A figure is never a message's**: a count is
 * written by the caller in the figures' language and passed in.
 *
 * @moved components/leader-picker.tsx
 */
const en = {
  picker: {
    /** The sheet's title: whom it moves. */
    title: ({ name }: { name: string }) => `Move ${name} to another leader`,
    search: 'Search a leader',
    searchPlaceholder: 'Name or agent code',
    loading: 'Loading leaders…',
    /** A leader's own tree: moved at once. */
    inYourTeam: 'In your team',
    /** Outside a leader's tree: asked of the office. */
    otherLeaders: `Other ${kept('leaders')} · needs the ${kept('Owner')}’s or an ${kept('Admin')}’s approval`,
    /** `n`: written by the caller in the figures' language. */
    unitSize: ({ n, count }: { n: string; count: number }) =>
      count === 0 ? 'nobody under them yet' : count === 1 ? '1 person under them' : `${n} people under them`,
    none: 'There is no leader to move them to.',
    noMatch: 'No leader matches that.',
    /** Moved at once. `n` written by the caller; `count` decides the wording. */
    moveNow: ({ name, n, count, leader }: { name: string; n: string; count: number; leader: string }) =>
      count === 0
        ? `${name} moves to ${leader}’s ${kept('unit')} now.`
        : `${name} and the ${n} ${count === 1 ? 'person' : 'people'} under them move to ${leader}’s ${kept('unit')} now.`,
    /** Asked of the office. */
    asRequest: ({ name }: { name: string }) =>
      `This is sent as a request to the ${kept('Owner')} or an ${kept('Admin')}. ${name} keeps reporting to you until it is approved.`,
    why: 'Why? (optional)',
    // Shown as typed in the move's notices (`inbox-copy.ts`), as a removal's and a role change's reasons are.
    whyHint: 'Shown to the person moved and to both their leaders, and to whoever decides a request.',
    choose: ({ name }: { name: string }) => `Choose ${name}`,
    chooseAnother: 'Choose another leader',
    moveConfirm: 'Move now',
    moving: 'Moving…',
    sendRequest: 'Send request',
    sending: 'Sending…',
    /** The toast once a request is sent. */
    requestSent: 'Request sent ✓',
  },
  team: {
    /** In a *Tim Anda* member's sheet, above *Keluarkan*. */
    moveToAnother: `Move to another ${kept('leader')}`,
    /** A row whose move waits on the office. */
    waiting: ({ to }: { to: string }) => `Waiting for approval to move to ${to}`,
    cancel: 'Cancel',
    cancelling: 'Cancelling…',
    cancelOf: ({ name }: { name: string }) => `Cancel the move of ${name}`,
    cancelled: 'Request cancelled ✓',
  },
};

const id: MessagesOf<typeof en> = {
  picker: {
    title: ({ name }) => `Pindahkan ${name} ke ${kept('leader')} lain`,
    search: `Cari ${kept('leader')}`,
    searchPlaceholder: 'Nama atau kode agen',
    loading: `Memuat ${kept('leader')}…`,
    inYourTeam: 'Di tim Anda',
    otherLeaders: `${kept('Leader')} lain · perlu persetujuan ${kept('Owner')}/${kept('Admin')}`,
    unitSize: ({ n, count }) => (count === 0 ? 'belum ada orang di bawahnya' : `${n} orang di bawahnya`),
    none: `Tidak ada ${kept('leader')} tujuan pemindahan.`,
    noMatch: `Tidak ada ${kept('leader')} yang cocok.`,
    moveNow: ({ name, n, count, leader }) =>
      count === 0
        ? `${name} pindah ke ${kept('unit')} ${leader} sekarang.`
        : `${name} dan ${n} orang di bawahnya pindah ke ${kept('unit')} ${leader} sekarang.`,
    asRequest: ({ name }) =>
      `Ini dikirim sebagai permintaan ke ${kept('Owner')}/${kept('Admin')}. ${name} tetap melapor kepada Anda sampai disetujui.`,
    why: 'Alasan (opsional)',
    whyHint: `Ditampilkan kepada yang dipindah dan kedua ${kept('leader')}-nya, serta kepada yang memutuskan permintaan.`,
    choose: ({ name }) => `Pilih ${name}`,
    chooseAnother: `Pilih ${kept('leader')} lain`,
    moveConfirm: 'Pindahkan sekarang',
    moving: 'Memindahkan…',
    sendRequest: 'Kirim permintaan',
    sending: 'Mengirim…',
    requestSent: 'Permintaan terkirim ✓',
  },
  team: {
    moveToAnother: `Pindahkan ke ${kept('leader')} lain`,
    waiting: ({ to }) => `Menunggu persetujuan pemindahan ke ${to}`,
    cancel: 'Batalkan',
    cancelling: 'Membatalkan…',
    cancelOf: ({ name }) => `Batalkan pemindahan ${name}`,
    cancelled: 'Permintaan dibatalkan ✓',
  },
};

export const leaderChangeMessages = defineMessages({ en, id });
