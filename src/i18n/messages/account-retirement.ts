import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Hapus akun*** (P19.31-T2; ADR-0289; glossary *Hapus akun*): the danger item in Anggota's member sheet ⋯ and beside
 * *Masukkan* on *Menunggu*, and its confirmation (`components/admin/retire-account-dialog.tsx`). **The Indonesian is the
 * source**: the item is the phase file's *Hapus akun*, the toast the lead's *"Akun <nama> dihapus."*; the rest is ours, in
 * the console's idiom (parity I-1325 to I-1328). The English is ours.
 *
 * @moved components/admin/retire-account-dialog.tsx
 */
const en = {
  item: 'Delete account',
  title: 'Delete account',
  loading: 'Reading what this account holds…',
  ends: 'What ends',
  endsLogin: ({ email }: { email: string }) => `The login: ${email} and its password no longer sign in.`,
  endsMembership: ({ kpm, code }: { kpm: string; code: string }) => `Membership in ${kpm} (KPM ${code}): removed from the KPM.`,
  stays: 'What stays',
  staysHistory: ({ n }: { n: number }) => `Their history in ${n} ${n === 1 ? 'KPM' : 'KPMs'} — activity, leads, coaching and the rest — stays, with their name.`,
  staysNone: 'Nothing else: they are in no KPM.',
  free: 'Their email and agent code can be used again for a new account.',
  reason: 'Reason',
  reasonHint: 'Kept in the audit log.',
  typeName: ({ name }: { name: string }) => `Type “${name}” to confirm`,
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Delete account',
  deleting: 'Deleting…',
  /** The toast once it is done (the lead's words). */
  done: ({ name }: { name: string }) => `Account ${name} deleted.`,
  /** The ⋯ beside *Masukkan* on *Menunggu*'s *Belum ada KPM*: its accessible name. */
  more: ({ name }: { name: string }) => `More for ${name}`,
};

const id: MessagesOf<typeof en> = {
  item: 'Hapus akun',
  title: 'Hapus akun',
  loading: 'Membaca isi akun ini…',
  ends: 'Yang berakhir',
  endsLogin: ({ email }) => `Login: ${email} dan password-nya tidak bisa dipakai masuk lagi.`,
  endsMembership: ({ kpm, code }) => `Keanggotaan di ${kpm} (${kept('KPM')} ${code}): dikeluarkan dari ${kept('KPM')}.`,
  stays: 'Yang tetap',
  staysHistory: ({ n }) => `Riwayatnya di ${n} ${kept('KPM')} — aktivitas, lead, coaching, dan lainnya — tetap tersimpan, dengan namanya.`,
  staysNone: `Tidak ada yang lain: dia belum masuk ${kept('KPM')} mana pun.`,
  free: 'Email dan kode agennya bisa dipakai lagi untuk akun baru.',
  reason: 'Alasan',
  reasonHint: 'Disimpan di audit log.',
  typeName: ({ name }) => `Ketik “${name}” untuk memastikan`,
  cancel: 'Batal',
  close: 'Tutup',
  confirm: 'Hapus akun',
  deleting: 'Menghapus…',
  done: ({ name }) => `Akun ${name} dihapus.`,
  more: ({ name }) => `Lainnya untuk ${name}`,
};

export const accountRetirementMessages = defineMessages({ en, id });
