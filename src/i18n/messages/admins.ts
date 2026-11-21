import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **KPM admins** — `/people/admins` (P19.20-T4; ADR-0273 §5; `functional/org-hierarchy.md`, *Who decides*): the three
 * tiles that say who can do what, the *Admin KPM* list with *Cabut*, and *Tambah admin*'s people picker.
 *
 * **The Indonesian is the source**: the approved People mockups of 19 November word for word — *KPM Owner* (*Semua di KPM
 * ini, termasuk tambah / cabut admin*), *Admin* (*Sama seperti owner: lihat dan ubah semua, buka semua anggota. Hanya
 * tidak bisa tambah / cabut admin*), *Core leader* (*KPM + Pengaturan seperti owner; People hanya bisa membuka timnya*,
 * *n orang · atur di All members*), *Admin KPM*, *"kode · admin sejak … · diberikan oleh …"*, *Cabut*, *Tambah admin*,
 * *Jadikan admin*, *"Cabut akses admin …? … tetap anggota KPM sebagai …, hanya akses admin yang dicabut."*, *Admin bisa
 * melihat halaman ini; hanya KPM Owner yang bisa tambah / cabut admin*, *Admin = sama seperti owner, kecuali tambah / cabut
 * admin. Akun tes tidak ditampilkan.* The English is ours. **Kept** (§A): the page's title, *KPM*, *KPM Owner*, *Admin*,
 * *Core leader*, *All members*, the roles. Typed content stays as typed.
 *
 * @moved app/(tenant)/people/admins/page.tsx
 */
const en = {
  tiles: {
    owner: kept('KPM Owner'),
    ownerLine: 'Everything in this KPM, adding and revoking admins included',
    admin: kept('Admin'),
    adminLine: 'The same as the owner: sees and changes everything, opens every member. Only cannot add or revoke admins',
    core: kept('Core leader'),
    coreLine: 'KPM + Settings like the owner; in People opens only their team',
    people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
    coreWhere: `set in ${kept('All members')}`,
  },
  listTitle: 'The KPM’s admins',
  add: 'Add admin',
  line: ({ code, since, by }: { code: string; since: string | null; by: string | null }) =>
    [code, since ? `admin since ${since}` : null, by ? `granted by ${by}` : null].filter(Boolean).join(' · '),
  revoke: 'Revoke',
  revokeWhose: ({ name }: { name: string }) => `Revoke ${name}’s admin access`,
  revokeQuestion: ({ name }: { name: string }) => `Revoke ${name}’s admin access?`,
  revokeLine: ({ first, role }: { first: string; role: string }) =>
    `${first} stays a member of the KPM as ${role}; only the admin access is revoked.`,
  readOnly: 'Admins can see this page; only the KPM Owner can add or revoke admins',
  coreNote: 'Core leaders are set in All members (⋯)',
  pickTitle: 'Add admin',
  pickNote: 'Admin = the same as the owner, except adding or revoking admins. Test accounts are not shown.',
  pickAction: 'Make admin',
  picking: 'Saving…',
  empty: 'No admin yet: only the KPM Owner looks after this KPM.',
  loading: 'Loading the KPM admins…',
  caption: 'The KPM’s admins',
};

const id: MessagesOf<typeof en> = {
  tiles: {
    owner: kept('KPM Owner'),
    ownerLine: `Semua di ${kept('KPM')} ini, termasuk tambah / cabut admin`,
    admin: kept('Admin'),
    adminLine: 'Sama seperti owner: lihat dan ubah semua, buka semua anggota. Hanya tidak bisa tambah / cabut admin',
    core: kept('Core leader'),
    coreLine: `${kept('KPM')} + Pengaturan seperti owner; People hanya bisa membuka timnya`,
    people: ({ n }) => `${n} orang`,
    coreWhere: `atur di ${kept('All members')}`,
  },
  listTitle: `Admin ${kept('KPM')}`,
  add: 'Tambah admin',
  line: ({ code, since, by }) =>
    [code, since ? `admin sejak ${since}` : null, by ? `diberikan oleh ${by}` : null].filter(Boolean).join(' · '),
  revoke: 'Cabut',
  revokeWhose: ({ name }) => `Cabut akses admin ${name}`,
  revokeQuestion: ({ name }) => `Cabut akses admin ${name}?`,
  revokeLine: ({ first, role }) => `${first} tetap anggota ${kept('KPM')} sebagai ${role}, hanya akses admin yang dicabut.`,
  readOnly: `Admin bisa melihat halaman ini; hanya ${kept('KPM Owner')} yang bisa tambah / cabut admin`,
  coreNote: `Core leader diatur di ${kept('All members')} (⋯)`,
  pickTitle: 'Tambah admin',
  pickNote: 'Admin = sama seperti owner, kecuali tambah / cabut admin. Akun tes tidak ditampilkan.',
  pickAction: 'Jadikan admin',
  picking: 'Menyimpan…',
  empty: `Belum ada admin: hanya ${kept('KPM Owner')} yang mengelola ${kept('KPM')} ini.`,
  loading: 'Memuat admin KPM…',
  caption: `Admin ${kept('KPM')}`,
};

export const adminsMessages = defineMessages({ en, id });
