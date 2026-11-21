import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The console's *Platform*** — `/admin/platform/*` (P19.23-T6; ADR-0279; the Super Admin mockups' frames f52–f55): the
 * four sections' tab row, *Tim Super Admin*, *Pengaturan platform* and *Pengumuman*. The audit log's words are
 * `admin-audit.ts`'s.
 *
 * **The Indonesian is the mockups' copy, verbatim** (*Tim Super Admin*, *Tambah Super Admin*, *Hanya tim AgencyBoost*,
 * *Kunci AI untuk membaca file*, *•••• tersimpan*, *Nomor WhatsApp pengirim*, *Tampilan bawaan*, *Kepada*, *Semua owner*,
 * *Pilih perusahaan / KPM*, *Pratinjau*, *Kirim ke 8 owner*); the English is the source the catalogue keeps. **Kept**
 * (§A): *Super Admin*, *KPM*, *AgencyBoost*, *Audit log*.
 */
const en = {
  title: kept('Platform'),
  /** The tab row's name (a `nav`), and on a phone the dropdown's. */
  sections: 'Platform sections',
  tabs: {
    audit: kept('Audit log'),
    team: `${kept('Super Admin')} team`,
    settings: 'Platform settings',
    announcements: 'Announcements',
  },
  loading: 'Loading…',
  failed: 'This could not be loaded.',
  retry: 'Try again',
  cancel: 'Cancel',

  team: {
    caption: `${kept('Super Admin')}s`,
    you: 'You',
    revoke: 'Revoke',
    add: `Add ${kept('Super Admin')}`,
    note: `${kept('AgencyBoost')} staff only`,
    status: { invited: 'Invited', deactivated: 'Deactivated' },
    addTitle: `Add ${kept('Super Admin')}`,
    email: 'Email',
    addHint: `An existing account whose email is verified, and that is in no ${kept('KPM')}.`,
    addConfirm: 'Add',
    added: ({ name }: { name: string }) => `${name} is now a ${kept('Super Admin')}`,
    revokeTitle: ({ name }: { name: string }) => `Revoke ${name}’s ${kept('Super Admin')} role?`,
    revokeBody: `They keep their login and lose every ${kept('Super Admin')} power at their next step. Recorded in the audit log.`,
    revokeConfirm: 'Revoke',
    revoked: ({ name }: { name: string }) => `${name} is no longer a ${kept('Super Admin')}`,
    revokeOf: ({ name }: { name: string }) => `Revoke ${name}`,
  },

  settings: {
    aiKey: 'AI key for reading files',
    aiSet: '•••• stored',
    aiNotSet: 'Not set',
    whatsapp: 'WhatsApp sender number',
    defaultLook: 'Default look',
    defaultLookValue: ({ name }: { name: string }) => `${name} · navy & orange`,
    premium: 'Premium tables',
    premiumValue: 'Upload per company in Companies & templates',
    save: 'Save',
    saved: 'Saved',
  },

  announcements: {
    to: 'To',
    owners: 'All owners',
    members: 'Every member',
    selected: `Choose companies / ${kept('KPM')}s`,
    message: 'Message',
    counter: ({ n, max }: { n: number; max: number }) => `${n}/${max}`,
    preview: 'Preview',
    sendTo: ({ n, who }: { n: number; who: 'owners' | 'members' }) => (who === 'owners'
      ? `Send to ${n} ${n === 1 ? 'owner' : 'owners'}`
      : `Send to ${n} ${n === 1 ? 'member' : 'members'}`),
    send: 'Send',
    counting: 'Counting…',
    chooseTitle: `Choose companies and ${kept('KPM')}s`,
    companies: 'Companies',
    kpms: kept('KPM'),
    chosen: ({ n }: { n: number }) => `${n} chosen`,
    done: 'Done',
    previewTitle: 'Preview',
    previewInbox: `In each person’s notifications`,
    previewHeading: `Announcement from ${kept('AgencyBoost')}`,
    previewReach: ({ n }: { n: number }) => `Reaches ${n} ${n === 1 ? 'person' : 'people'}, each once. Test accounts are not sent to.`,
    close: 'Close',
    sent: ({ n }: { n: number }) => `Sent to ${n} ${n === 1 ? 'person' : 'people'}`,
    sentList: 'Sent',
    emptySent: 'Nothing sent yet.',
    sentLine: ({ who, n, by }: { who: string; n: number; by: string }) => `${who} · ${n} ${n === 1 ? 'person' : 'people'} · ${by}`,
    audienceWords: { owners: 'All owners', members: 'Every member', selected: 'Chosen' },
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Platform'),
  sections: 'Bagian platform',
  tabs: {
    audit: kept('Audit log'),
    team: `Tim ${kept('Super Admin')}`,
    settings: 'Pengaturan platform',
    announcements: 'Pengumuman',
  },
  loading: 'Memuat…',
  failed: 'Gagal memuat.',
  retry: 'Coba lagi',
  cancel: 'Batal',

  team: {
    caption: kept('Super Admin'),
    you: 'Anda',
    revoke: 'Cabut',
    add: `Tambah ${kept('Super Admin')}`,
    note: `Hanya tim ${kept('AgencyBoost')}`,
    status: { invited: 'Diundang', deactivated: 'Nonaktif' },
    addTitle: `Tambah ${kept('Super Admin')}`,
    email: 'Email',
    addHint: `Akun yang sudah ada, emailnya sudah diverifikasi, dan tidak menjadi anggota ${kept('KPM')} mana pun.`,
    addConfirm: 'Tambahkan',
    added: ({ name }) => `${name} sekarang ${kept('Super Admin')}`,
    revokeTitle: ({ name }) => `Cabut peran ${kept('Super Admin')} ${name}?`,
    revokeBody: `Login tetap ada; semua akses ${kept('Super Admin')} hilang pada langkah berikutnya. Tercatat di audit log.`,
    revokeConfirm: 'Cabut',
    revoked: ({ name }) => `${name} bukan lagi ${kept('Super Admin')}`,
    revokeOf: ({ name }) => `Cabut ${name}`,
  },

  settings: {
    aiKey: 'Kunci AI untuk membaca file',
    aiSet: '•••• tersimpan',
    aiNotSet: 'Belum diatur',
    whatsapp: 'Nomor WhatsApp pengirim',
    defaultLook: 'Tampilan bawaan',
    defaultLookValue: ({ name }) => `${name} · navy & orange`,
    premium: 'Tabel premi',
    premiumValue: 'Unggah per perusahaan di Perusahaan & template',
    save: 'Simpan',
    saved: 'Tersimpan',
  },

  announcements: {
    to: 'Kepada',
    owners: 'Semua owner',
    members: 'Semua anggota',
    selected: `Pilih perusahaan / ${kept('KPM')}`,
    message: 'Pesan',
    counter: ({ n, max }) => `${n}/${max}`,
    preview: 'Pratinjau',
    sendTo: ({ n, who }) => (who === 'owners' ? `Kirim ke ${n} owner` : `Kirim ke ${n} anggota`),
    send: 'Kirim',
    counting: 'Menghitung…',
    chooseTitle: `Pilih perusahaan dan ${kept('KPM')}`,
    companies: 'Perusahaan',
    kpms: kept('KPM'),
    chosen: ({ n }) => `${n} dipilih`,
    done: 'Selesai',
    previewTitle: 'Pratinjau',
    previewInbox: 'Di notifikasi setiap orang',
    previewHeading: `Pengumuman dari ${kept('AgencyBoost')}`,
    previewReach: ({ n }) => `Sampai ke ${n} orang, masing-masing sekali. Akun tes tidak dikirimi.`,
    close: 'Tutup',
    sent: ({ n }) => `Terkirim ke ${n} orang`,
    sentList: 'Terkirim',
    emptySent: 'Belum ada pengumuman terkirim.',
    sentLine: ({ who, n, by }) => `${who} · ${n} orang · ${by}`,
    audienceWords: { owners: 'Semua owner', members: 'Semua anggota', selected: 'Pilihan' },
  },
};

export const adminPlatformMessages = defineMessages({ en, id });
