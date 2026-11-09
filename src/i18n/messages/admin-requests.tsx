import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The console's two queues** (P18.10-T6): *Pending KPM requests* (`/admin/kpm-requests`; `functional/kpm-requests.md`,
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
    /**
     * The applicant, as the card names them (P19-T3 AC-1, UI-168 card 1): `name` drawn bold by the page; `phone` as they
     * gave it, or nothing; `date` the day they asked, in the figures' language.
     */
    meta: ({ name, email, phone, date }: { name: ReactNode; email: string; phone: string | null; date: string }) => (
      <>asked by {name} (proposed KPM Owner) · {email}{phone ? ` · ${phone}` : ''} · {date}</>
    ),
    code: 'KPM code',
    approvingMeans: ({ name }: { name: string }) => `Approving creates the office and makes ${name} its Owner.`,
    caption: 'Decided registrations',
    columns: { name: 'KPM name', company: 'Company', requestedBy: 'Requested by', status: 'Status' },
    proposedOwner: ({ name }: { name: string }) => `${name} (proposed KPM Owner)`,
    /** P19-T3 (ADR-0191 §2–§5): the card's company picker, the code checked as typed, one-step approval, *Hapus*. */
    company: 'Company',
    signedUpWith: ({ name, company }: { name: string; company: string }) =>
      `${name} signed up with ${company}. An office takes only its own company's agents: choose ${company}.`,
    noCompany: ({ name }: { name: string }) =>
      `${name}'s account has no company or no agent code, so they cannot own an office yet.`,
    unverified: ({ name }: { name: string }) =>
      `${name} has not verified their email address yet, and only a verified address may own an office.`,
    codeFree: 'Free in this company.',
    codeTaken: ({ office, company }: { office: string; company: string }) => `Already used by ${office} (${company}).`,
    approveAndOwn: 'Approve & make Owner',
    /**
     * *Mulai dari* (ADR-0213 §3): offered only when the company chosen has no template yet — the built-in templates and
     * *Kosong*, the built-in default chosen.
     */
    startFrom: 'Start from',
    startFromHint: 'This company has no template yet, so the office starts from a built-in template, or empty.',
    startEmpty: 'Empty',
    remove: 'Delete',
    removeAsk: ({ branch }: { branch: string }) =>
      `Delete the request for ${branch}? It leaves this list and the applicant's screen. Nothing it made is touched.`,
    made: ({ code }: { code: string }) => `KPM ${code}`,
    madeDeleted: ({ code }: { code: string }) => `KPM ${code} (deleted)`,
    decidedOn: ({ date }: { date: string }) => `Decided ${date}`,
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
    /** A decided request's row below 1024px (P19.2-T2 AC-1; UI-126): *KPM 0603 · Tangerang Branch · Agent → AAB · asked by Hendra*. */
    rowMeta: ({ office, change, name }: { office: string; change: string; name: string }) => `${office} · ${change} · asked by ${name}`,
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
    meta: ({ name, email, phone, date }) => (
      <>diajukan oleh {name} (calon {kept('KPM Owner')}) · {email}{phone ? ` · ${phone}` : ''} · {date}</>
    ),
    code: `Kode ${kept('KPM')}`,
    approvingMeans: ({ name }) =>
      `Menyetujui akan membuat ${kept('KPM')} ini dan menjadikan ${name} sebagai ${kept('Owner')}-nya.`,
    caption: 'Pendaftaran yang sudah diputuskan',
    columns: { name: `Nama ${kept('KPM')}`, company: 'Perusahaan', requestedBy: 'Diajukan oleh', status: 'Status' },
    proposedOwner: ({ name }) => `${name} (calon ${kept('KPM Owner')})`,
    company: 'Perusahaan',
    signedUpWith: ({ name, company }) =>
      `${name} mendaftar di ${company}. ${kept('KPM')} hanya menerima agen dari perusahaannya sendiri: pilih ${company}.`,
    noCompany: ({ name }) =>
      `Akun ${name} belum memiliki perusahaan atau kode agen, jadi belum dapat menjadi ${kept('Owner')} ${kept('KPM')}.`,
    unverified: ({ name }) =>
      `${name} belum memverifikasi alamat emailnya, dan hanya alamat yang terverifikasi yang dapat menjadi `
      + `${kept('Owner')} ${kept('KPM')}.`,
    codeFree: 'Tersedia di perusahaan ini.',
    codeTaken: ({ office, company }) => `Sudah dipakai oleh ${office} (${company}).`,
    approveAndOwn: `Setujui & jadikan ${kept('Owner')}`,
    startFrom: 'Mulai dari',
    startFromHint: `Perusahaan ini belum punya template, jadi ${kept('KPM')} dimulai dari template bawaan, atau kosong.`,
    startEmpty: 'Kosong',
    remove: 'Hapus',
    removeAsk: ({ branch }) =>
      `Hapus permintaan untuk ${branch}? Permintaan ini hilang dari daftar ini dan dari layar pemohon. Apa pun yang sudah `
      + 'dibuatnya tidak berubah.',
    made: ({ code }) => `${kept('KPM')} ${code}`,
    madeDeleted: ({ code }) => `${kept('KPM')} ${code} (dihapus)`,
    decidedOn: ({ date }) => `Diputuskan ${date}`,
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
    rowMeta: ({ office, change, name }) => `${office} · ${change} · diajukan oleh ${name}`,
  },
};

export const adminRequestsMessages = defineMessages({ en, id });
