import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The console's two queues** (P18.98-T6): *Pending KPM requests* (`/admin/kpm-requests`; `functional/kpm-requests.md`,
 * *The module's own strings*) and *Leaders past the limit* (`/admin/leader-limit-requests`; ADR-0157 §3,
 * `functional/tenant-provisioning.md`): pending first as cards, approved or declined inline, the decided list below.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's —
 * *Setujui · Tolak* (§B.1), *Menyetujui…* (§B.2), *Menunggu · Disetujui · Ditolak* (§B.3), *Alasan* for *Why?*, *Diajukan
 * oleh*, *Perubahan* (§B.10), *KPM* for an office (§B.9). **Kept** (§A): the titles, *KPM*, *KPM Owner*, *Owner*,
 * *Superadmin*, *AgencyBoost*, *leader* and *leaders* (§B.0 rule 8). *Pending* is a tab elsewhere and a status here
 * (`KEPT_ELSEWHERE`), as is *Office*. **Typed content stays as typed**: a branch, a company, people's names and emails,
 * a note, a reason; what a promotion asks for is `lib/leader-limit-requests.ts`' (`requestedChange`, `leader-limit.tsx`).
 *
 * @moved app/(admin)/admin/kpm-requests/
 * @moved app/(admin)/admin/leader-limit-requests/
 */
const en = {
  /** What both queues share. */
  approve: 'Approve',
  approving: 'Approving…',
  decline: 'Decline',
  whyNot: 'Why not?',
  sentBack: 'Sent back to whoever asked',
  decided: 'Already decided',
  status: {
    pending: 'Pending', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled',
  },

  /** *Pending KPM requests* (`Superadmin.html:322-333`). */
  kpm: {
    title: kept('Pending KPM Requests'),
    subtitle: 'New registrations, awaiting Superadmin sign-off',
    loading: 'Loading registrations…',
    empty: 'Nobody is waiting for an office.',
    /** `name` drawn bold by the page. */
    meta: ({ company, name, email }: { company: string; name: ReactNode; email: string }) => (
      <>{company} · asked by {name} (proposed KPM Owner) · {email}</>
    ),
    code: 'KPM code',
    approvingMeans: ({ name }: { name: string }) => `Approving creates the office and makes ${name} its Owner.`,
    caption: 'Decided registrations',
    columns: { name: 'KPM name', company: 'Company', requestedBy: 'Requested by', status: 'Status' },
    proposedOwner: ({ name }: { name: string }) => `${name} (proposed KPM Owner)`,
  },

  /** *Leaders past the limit* (ADR-0157 §3). */
  limit: {
    title: kept('Leaders past the limit'),
    subtitle: "Offices asking to add a leader beyond their limit, awaiting AgencyBoost's approval",
    loading: 'Loading requests…',
    empty: 'No office is waiting to add a leader past its limit.',
    office: ({ code, branch }: { code: string; branch: string }) => `KPM ${code} · ${branch}`,
    /** `name` drawn bold by the page; `count` *13 / 10*. */
    meta: ({ office, name, count }: { office: string; name: ReactNode; count: string }) => (
      <>{office} · asked by {name} · leaders {count}</>
    ),
    approvingMeans: ({ count }: { count: string }) =>
      `Approving makes the change now, past the limit: the office's leaders become ${count}. The limit does not change.`,
    caption: 'Decided requests',
    columns: { member: 'Member', office: 'Office', change: 'Change', requestedBy: 'Requested by', status: 'Status' },
  },
};

const id: MessagesOf<typeof en> = {
  approve: 'Setujui',
  approving: 'Menyetujui…',
  decline: 'Tolak',
  whyNot: 'Alasan',
  sentBack: 'Dikirim kembali ke pemohon',
  decided: 'Sudah diputuskan',
  status: {
    pending: 'Menunggu', approved: 'Disetujui', declined: 'Ditolak', cancelled: 'Dibatalkan',
  },

  kpm: {
    title: kept('Pending KPM Requests'),
    subtitle: `Pendaftaran baru, menunggu persetujuan ${kept('Superadmin')}`,
    loading: 'Memuat pendaftaran…',
    empty: `Tidak ada yang sedang menunggu ${kept('KPM')}.`,
    meta: ({ company, name, email }) => (
      <>{company} · diajukan oleh {name} (calon {kept('KPM Owner')}) · {email}</>
    ),
    code: `Kode ${kept('KPM')}`,
    approvingMeans: ({ name }) =>
      `Menyetujui akan membuat ${kept('KPM')} ini dan menjadikan ${name} sebagai ${kept('Owner')}-nya.`,
    caption: 'Pendaftaran yang sudah diputuskan',
    columns: { name: `Nama ${kept('KPM')}`, company: 'Perusahaan', requestedBy: 'Diajukan oleh', status: 'Status' },
    proposedOwner: ({ name }) => `${name} (calon ${kept('KPM Owner')})`,
  },

  limit: {
    title: kept('Leaders past the limit'),
    subtitle: `${kept('KPM')} yang meminta menambah ${kept('leader')} melewati batasnya, menunggu persetujuan ${kept('AgencyBoost')}`,
    loading: 'Memuat permintaan…',
    empty: `Tidak ada ${kept('KPM')} yang menunggu untuk menambah ${kept('leader')} melewati batasnya.`,
    office: ({ code, branch }) => `${kept('KPM')} ${code} · ${branch}`,
    meta: ({ office, name, count }) => <>{office} · diajukan oleh {name} · {kept('leaders')} {count}</>,
    approvingMeans: ({ count }) =>
      `Menyetujui akan langsung menjalankan perubahan ini, melewati batas: jumlah ${kept('leaders')} ${kept('KPM')} menjadi ${count}. Batasnya tidak berubah.`,
    caption: 'Permintaan yang sudah diputuskan',
    columns: { member: 'Anggota', office: kept('KPM'), change: 'Perubahan', requestedBy: 'Diajukan oleh', status: 'Status' },
  },
};

export const adminRequestsMessages = defineMessages({ en, id });
