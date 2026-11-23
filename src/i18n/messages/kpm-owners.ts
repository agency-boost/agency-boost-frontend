import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A KPM's owners** (P19.27; ADR-0285; F-2 of the 21 November brief): *KPM Owner · n* on the KPM page and on People ›
 * *KPM admins*, the *Tambah owner* sheet, an owner's ⋯ and *Hapus sebagai owner*'s question, the KPM list's card (*Kelola
 * owner*, *+n*) and the phone's ⓘ on *KPM admins*.
 *
 * **The Indonesian is the source**: the stop motion of 22 November (section C, frames 1–10; section D frames 2–4) and the
 * side-by-side mockup's screens 6–9, word for word — *KPM Owner · n*, *＋ Tambah owner*, *Owner sejak …*, *Tambah owner*,
 * *Cari anggota KPM ini*, *Jadikan owner*, *"… jadi owner"*, *Lihat profil*, *Kirim ulang undangan*, *Hapus sebagai
 * owner*, *"Tambah owner lain dulu"*, *"Hapus … sebagai owner?"*, *"… tetap anggota (…)."*, *Batal · Hapus*, *Admin ·
 * n*, *Belum ada admin*, *Core leader · n*, *Atur*, *Kelola owner*. The English is ours. **Kept** (§A): *KPM*, *KPM
 * Owner*, *Admin*, *Core leader*, the roles.
 */
const en = {
  /** *KPM Owner · n* — the section's title. */
  title: ({ n }: { n: string }) => `${kept('KPM Owner')} · ${n}`,
  add: 'Add owner',
  since: ({ month }: { month: string }) => `Owner since ${month}`,
  invited: 'Invited',
  notInvited: 'Not invited yet',
  none: 'No owner yet',
  actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
  menu: {
    profile: 'View profile',
    resend: 'Resend invitation',
    invite: 'Send invitation',
    remove: 'Remove as owner',
    lastOne: 'Add another owner first',
  },
  confirm: {
    question: ({ name }: { name: string }) => `Remove ${name} as owner?`,
    line: ({ name, role }: { name: string; role: string }) => `${name} stays a member (${role}).`,
    remove: 'Remove',
    cancel: 'Cancel',
  },
  sheet: {
    title: 'Add owner',
    search: 'Search this KPM’s members',
    action: 'Make owner',
    busy: 'Saving…',
    empty: 'Nobody else in this KPM yet. Add the person with Add user, Make KPM Owner on.',
    loading: 'Loading the members…',
    done: ({ name }: { name: string }) => `${name} is now an owner`,
  },
  /** The phone's *Admin* and *Core leader* card (UI-214 (21 Nov)). */
  admins: ({ n }: { n: string }) => `${kept('Admin')} · ${n}`,
  noAdmins: 'No admin yet',
  core: ({ n }: { n: string }) => `${kept('Core leader')} · ${n}`,
  /** The KPM list (UI-207, UI-212 (21 Nov)). */
  manage: 'Manage owners',
  more: ({ n }: { n: string }) => `+${n}`,
  moreOwners: ({ n }: { n: string }) => `and ${n} more ${n === '1' ? 'owner' : 'owners'}`,
  /** People › KPM admins on a phone (UI-213 (21 Nov)): the three role descriptions behind ⓘ. */
  about: 'What each role can do',
  /** *Laporan KPM*'s *Kirim ke owner* with several owners (P19.27-T5 AC-1; OD-455). */
  report: {
    pick: 'Send to the owners',
    open: 'WhatsApp',
    openFor: ({ name }: { name: string }) => `Send to ${name} on WhatsApp`,
  },
};

const id: MessagesOf<typeof en> = {
  title: ({ n }) => `${kept('KPM Owner')} · ${n}`,
  add: 'Tambah owner',
  since: ({ month }) => `Owner sejak ${month}`,
  invited: 'Diundang',
  notInvited: 'Belum diundang',
  none: 'Belum ada owner',
  actionsFor: ({ name }) => `Aksi untuk ${name}`,
  menu: {
    profile: 'Lihat profil',
    resend: 'Kirim ulang undangan',
    invite: 'Kirim undangan',
    remove: 'Hapus sebagai owner',
    lastOne: 'Tambah owner lain dulu',
  },
  confirm: {
    question: ({ name }) => `Hapus ${name} sebagai owner?`,
    line: ({ name, role }) => `${name} tetap anggota (${role}).`,
    remove: 'Hapus',
    cancel: 'Batal',
  },
  sheet: {
    title: 'Tambah owner',
    search: 'Cari anggota KPM ini',
    action: 'Jadikan owner',
    busy: 'Menyimpan…',
    empty: 'Belum ada anggota lain di KPM ini. Tambahkan orangnya lewat Tambah user, dengan Jadikan KPM Owner menyala.',
    loading: 'Memuat anggota…',
    done: ({ name }) => `${name} jadi owner`,
  },
  admins: ({ n }) => `${kept('Admin')} · ${n}`,
  noAdmins: 'Belum ada admin',
  core: ({ n }) => `${kept('Core leader')} · ${n}`,
  manage: 'Kelola owner',
  more: ({ n }) => `+${n}`,
  moreOwners: ({ n }) => `dan ${n} owner lain`,
  about: 'Apa yang bisa dilakukan tiap peran',
  report: {
    pick: 'Kirim ke owner',
    open: 'WhatsApp',
    openFor: ({ name }) => `Kirim ke ${name} lewat WhatsApp`,
  },
};

export const kpmOwnersMessages = defineMessages({ en, id });
