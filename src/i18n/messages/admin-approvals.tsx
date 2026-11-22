import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Persetujuan* — everything waiting for the Super Admin** (P19.23-T3 AC-2; the Super Admin spec of 20 November 2026,
 * §8; ADR-0277): the two tabs, a row of each kind with *Tolak* and *Setujui*, the decided rows with their result, who
 * decided and when, and the two dialogs — *Tolak*'s reason, and *Atur & setujui*'s company, code, *Mulai dari* and
 * *Hapus* for a KPM registration (ADR-0191, ADR-0213 — kept, behind ⋯).
 *
 * **The Indonesian is the mockup's, verbatim** (`superadmin-tablet-stopmotion-2026-11-19`, `saApr`): *Menunggu n · Sudah
 * diputuskan*, *KPM baru · …*, *diajukan … (calon owner)*, *Leader melewati batas · …*, *paket n leader, sekarang m*,
 * *Tolak · Setujui*, *Disetujui · Ditolak*, *"Semua yang perlu persetujuan Super Admin ada di sini"*, *"Siapa yang
 * memutuskan dan kapan · tercatat di audit log"*. **Kept** (§A): *KPM*, *Owner*, *Super Admin*, *leader*. Names,
 * companies, KPM names and reasons stay as typed; what a promotion asks for is `requestedChange`'s.
 *
 * @moved app/(admin)/admin/approvals/
 * @moved components/admin/approval-dialogs.tsx
 */
const en = {
  title: 'Approvals',
  tabs: 'Approvals',
  waiting: ({ n }: { n: number }) => `Waiting ${n}`,
  decided: 'Already decided',
  approve: 'Approve',
  approving: 'Approving…',
  decline: 'Decline',
  /** A KPM registration. */
  kpmTitle: ({ branch }: { branch: string }) => `New ${kept('KPM')} · ${branch}`,
  kpmMeta: ({ company, name, when }: { company: string; name: string; when: string }) =>
    `${company} · asked by ${name} (proposed ${kept('Owner')}) · ${when}`,
  kpmDecidedMeta: ({ company, name }: { company: string; name: string }) => `${company} · asked by ${name}`,
  /** A leader past the plan limit. */
  limitTitle: ({ kpm, company }: { kpm: string; company: string }) =>
    company ? `${kept('Leader')} past the limit · ${kpm} (${company})` : `${kept('Leader')} past the limit · ${kpm}`,
  limitMeta: ({ name, change, limit, used, asker }: { name: string; change: string; limit: string; used: number; asker: string }) =>
    `${name} ${change} · plan ${limit} ${kept('leader')}, now ${used} · asked by ${asker}`,
  limitDecidedMeta: ({ name, change, limit }: { name: string; change: string; limit: string }) =>
    `${name} ${change} · plan ${limit} ${kept('leader')}`,
  noLimit: 'no limit',
  /** When and by whom, after a decided row's facts. */
  decidedBy: ({ date, name }: { date: string; name: string }) => `${date} · ${name}`,
  today: 'today',
  daysAgo: ({ days }: { days: number }) => `${days} ${days === 1 ? 'day' : 'days'} ago`,
  result: { approved: 'Approved', declined: 'Declined', cancelled: 'Withdrawn' },
  waitingNote: `Everything that needs a ${kept('Super Admin')}'s approval is here`,
  decidedNote: 'Who decided and when · recorded in the audit log',
  emptyWaiting: 'Nothing is waiting for approval.',
  emptyDecided: 'Nothing has been decided yet.',
  loading: 'Loading approvals…',
  retry: 'Try again',
  caption: { waiting: 'Requests waiting', decided: 'Decided requests' },
  more: ({ name }: { name: string }) => `More for ${name}`,
  /** ⋯ on a KPM registration. */
  setUp: 'Set up & approve',
  remove: 'Delete request',
  approvedToast: 'Approved.',
  declinedToast: 'Declined.',
  removedToast: 'Request deleted.',

  declineDialog: {
    title: 'Decline',
    reason: 'Reason',
    reasonOptional: 'Reason (optional)',
    hint: 'Sent back to whoever asked.',
    confirm: 'Decline',
    cancel: 'Cancel',
  },
  approveDialog: {
    title: ({ branch }: { branch: string }) => `Approve ${branch}`,
    applicant: 'Proposed owner',
    company: 'Company',
    code: `${kept('KPM')} code (optional)`,
    codeHint: 'Leave it empty: it is made automatically.',
    codeFree: 'Free in this company.',
    codeTaken: ({ office, company }: { office: string; company: string }) => `Already used by ${office} (${company}).`,
    codeShape: 'Four digits, or leave it empty.',
    startFrom: 'Start from',
    startFromHint: `This company has no template yet, so the ${kept('KPM')} starts from a built-in template, or empty.`,
    startEmpty: 'Empty',
    signedUpWith: ({ name, company }: { name: string; company: string }) =>
      `${name} signed up with ${company}. A ${kept('KPM')} takes only its own company's agents: choose ${company}.`,
    noCompany: ({ name }: { name: string }) =>
      `${name}'s account has no company or no agent code, so they cannot own a ${kept('KPM')} yet.`,
    unverified: ({ name }: { name: string }) =>
      `${name} has not verified their email address yet, and only a verified address may own a ${kept('KPM')}.`,
    approvingMeans: ({ name }: { name: string }) =>
      `Approving creates the ${kept('KPM')} and makes ${name} its ${kept('Owner')}.`,
    confirm: `Approve & make ${kept('Owner')}`,
    removeAsk: ({ branch }: { branch: string }) =>
      `Delete the request for ${branch}? It leaves this list and the applicant's screen. Nothing it made is touched.`,
    removeConfirm: 'Delete',
    cancel: 'Cancel',
  },
};

const id: MessagesOf<typeof en> = {
  title: 'Persetujuan',
  tabs: 'Persetujuan',
  waiting: ({ n }) => `Menunggu ${n}`,
  decided: 'Sudah diputuskan',
  approve: 'Setujui',
  approving: 'Menyetujui…',
  decline: 'Tolak',
  kpmTitle: ({ branch }) => `${kept('KPM')} baru · ${branch}`,
  kpmMeta: ({ company, name, when }) => `${company} · diajukan ${name} (calon owner) · ${when}`,
  kpmDecidedMeta: ({ company, name }) => `${company} · diajukan ${name}`,
  limitTitle: ({ kpm, company }) =>
    company ? `${kept('Leader')} melewati batas · ${kpm} (${company})` : `${kept('Leader')} melewati batas · ${kpm}`,
  limitMeta: ({ name, change, limit, used, asker }) =>
    `${name} ${change} · paket ${limit} ${kept('leader')}, sekarang ${used} · diajukan ${asker}`,
  limitDecidedMeta: ({ name, change, limit }) => `${name} ${change} · paket ${limit} ${kept('leader')}`,
  noLimit: 'tanpa batas',
  decidedBy: ({ date, name }) => `${date} · ${name}`,
  today: 'hari ini',
  daysAgo: ({ days }) => `${days} hari lalu`,
  result: { approved: 'Disetujui', declined: 'Ditolak', cancelled: 'Dibatalkan' },
  waitingNote: `Semua yang perlu persetujuan ${kept('Super Admin')} ada di sini`,
  decidedNote: 'Siapa yang memutuskan dan kapan · tercatat di audit log',
  emptyWaiting: 'Tidak ada yang menunggu persetujuan.',
  emptyDecided: 'Belum ada yang diputuskan.',
  loading: 'Memuat persetujuan…',
  retry: 'Coba lagi',
  caption: { waiting: 'Permintaan yang menunggu', decided: 'Permintaan yang sudah diputuskan' },
  more: ({ name }) => `Lainnya untuk ${name}`,
  setUp: 'Atur & setujui',
  remove: 'Hapus permintaan',
  approvedToast: 'Disetujui.',
  declinedToast: 'Ditolak.',
  removedToast: 'Permintaan dihapus.',

  declineDialog: {
    title: 'Tolak',
    reason: 'Alasan',
    reasonOptional: 'Alasan (opsional)',
    hint: 'Dikirim kembali ke pemohon.',
    confirm: 'Tolak',
    cancel: 'Batal',
  },
  approveDialog: {
    title: ({ branch }) => `Setujui ${branch}`,
    applicant: 'Calon owner',
    company: 'Perusahaan',
    code: `Kode ${kept('KPM')} (opsional)`,
    codeHint: 'Kosongkan: dibuat otomatis.',
    codeFree: 'Tersedia di perusahaan ini.',
    codeTaken: ({ office, company }) => `Sudah dipakai oleh ${office} (${company}).`,
    codeShape: 'Empat angka, atau kosongkan.',
    startFrom: 'Mulai dari',
    startFromHint: `Perusahaan ini belum punya template, jadi ${kept('KPM')} dimulai dari template bawaan, atau kosong.`,
    startEmpty: 'Kosong',
    signedUpWith: ({ name, company }) =>
      `${name} mendaftar di ${company}. ${kept('KPM')} hanya menerima agen dari perusahaannya sendiri: pilih ${company}.`,
    noCompany: ({ name }) =>
      `Akun ${name} belum memiliki perusahaan atau kode agen, jadi belum dapat menjadi ${kept('Owner')} ${kept('KPM')}.`,
    unverified: ({ name }) =>
      `${name} belum memverifikasi alamat emailnya, dan hanya alamat yang terverifikasi yang dapat menjadi `
      + `${kept('Owner')} ${kept('KPM')}.`,
    approvingMeans: ({ name }) =>
      `Menyetujui akan membuat ${kept('KPM')} ini dan menjadikan ${name} sebagai ${kept('Owner')}-nya.`,
    confirm: `Setujui & jadikan ${kept('Owner')}`,
    removeAsk: ({ branch }) =>
      `Hapus permintaan untuk ${branch}? Permintaan ini hilang dari daftar ini dan dari layar pemohon. Apa pun yang sudah `
      + 'dibuatnya tidak berubah.',
    removeConfirm: 'Hapus',
    cancel: 'Batal',
  },
};

export const adminApprovalsMessages = defineMessages({ en, id });
