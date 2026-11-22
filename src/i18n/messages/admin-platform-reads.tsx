import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's reads across KPMs** (P19.4-T3; ADR-0207; SA UI-010, SA UI-018; the setup spec's A2): *Akun
 * terdaftar* (P19.12-T2, ADR-0245) and the company's *KPM & data*. *Retired 2026-11-20 (P19.23; ADR-0277):* *All
 * members*' old rows, the KPM comparison, *Lihat sebagai KPM*, the old KPM page's tabs and the old KPM list's words.
 *
 * **The Indonesian is the flow report's and the setup spec's, verbatim where they give it** (*"Belum ada anggota. Anggota
 * muncul di sini setelah KPM mengimpor orang."*, *"Belum ada KPM di platform."*, *Belum pernah*, *Hanya lihat*, *"Kunjungan
 * ini tercatat di Audit log"*, *Keluar*, *Lengkap · Belum · —*, *Riwayat unggahan*, *"Belum cukup KPM pembanding"*).
 *
 * @moved app/(admin)/admin/companies/[companyId]/kpms/
 * @moved components/admin/platform-accounts.tsx
 */

const en = {
  /**
   * ***Akun terdaftar*** (P19.12-T2 AC-2; ADR-0245 §1; the client's message of 11 November 2026, item 2): every registered
   * account, a KPM or none.
   */
  accounts: {
    caption: 'Every registered account',
    search: 'Search by name or email',
    searchHint: 'At least two characters.',
    kpm: kept('KPM'),
    any: 'All',
    kpmChoice: { none: 'No KPM', some: 'Has a KPM' },
    columns: {
      name: 'Name', company: 'Company', registered: 'Registered', email: 'Email', lastSignIn: 'Last signed in', kpm: kept('KPM'),
    },
    verified: 'Verified',
    unverified: 'Not verified',
    never: 'Never',
    noKpm: 'No KPM yet',
    kpms: ({ n }: { n: number }) => `${n} ${kept('KPM')}`,
    /** The *n KPM* link's name: its words first (WCAG 2.5.3), then whose and where it goes — the other tab. */
    openKpms: ({ n, name }: { n: number; name: string }) => `${n} ${kept('KPM')} · ${name}, in KPM members`,
    empty: 'No accounts yet.',
    noMatch: 'No account matches these filters.',
    loading: 'Loading the accounts',
    retry: 'Try again',
    total: ({ n }: { n: number }) => `${n} ${n === 1 ? 'account' : 'accounts'}`,
  },
  kpmData: {
    tab: 'KPMs and data',
    rowKpm: ({ code }: { code: string }) => `KPM ${code}`,
    tiles: {
      kpms: kept('KPM'),
      activeOwners: ({ n }: { n: number }) => `${n} active ${n === 1 ? 'owner' : 'owners'}`,
      members: 'Members',
      notSignedIn: ({ n }: { n: number }) => `${n} not yet in the app`,
      complete: ({ month }: { month: string }) => `${month} data complete`,
      of: ({ n, of }: { n: number; of: number }) => `${n} of ${of}`,
      needsThree: ({ n }: { n: number }) => `Comparing KPMs needs at least ${n}`,
      enough: 'Enough to compare',
    },
    heading: ({ month }: { month: string }) => `All KPMs · ${month}`,
    rowHint: 'Open a row to see its KPM.',
    columns: {
      kpm: kept('KPM'), manpower: kept('Manpower'), maa: 'Active agents (MAA)', ape: 'APE YTD', recruitment: 'Recruitment YTD',
      data: ({ month }: { month: string }) => `Data ${month}`, peers: 'Peers',
    },
    data: { complete: 'Complete', missing: 'Missing' },
    peers: {
      notEnough: ({ n, of }: { n: number; of: number }) => `Not enough peer KPMs (${n} of ${of})`,
      enough: ({ n }: { n: number }) => `${n} peer KPMs`,
      notCounted: 'Not counted',
    },
    empty: 'This company has no KPM yet.',
    loading: 'Loading the KPMs',
    retry: 'Try again',
    month: 'Month',
  },
};

const id: MessagesOf<typeof en> = {
  accounts: {
    caption: 'Semua akun terdaftar',
    search: 'Cari nama atau email',
    searchHint: 'Minimal dua karakter.',
    kpm: kept('KPM'),
    any: 'Semua',
    kpmChoice: { none: `Tanpa ${kept('KPM')}`, some: `Punya ${kept('KPM')}` },
    columns: {
      name: 'Nama', company: 'Perusahaan', registered: 'Terdaftar', email: 'Email', lastSignIn: 'Terakhir masuk', kpm: kept('KPM'),
    },
    verified: 'Terverifikasi',
    unverified: 'Belum diverifikasi',
    never: 'Belum pernah',
    noKpm: `Belum punya ${kept('KPM')}`,
    kpms: ({ n }) => `${n} ${kept('KPM')}`,
    openKpms: ({ n, name }) => `${n} ${kept('KPM')} · ${name}, di Anggota ${kept('KPM')}`,
    empty: 'Belum ada akun.',
    noMatch: 'Tidak ada akun yang cocok dengan filter ini.',
    loading: 'Memuat akun',
    retry: 'Coba lagi',
    total: ({ n }) => `${n} akun`,
  },
  kpmData: {
    tab: `${kept('KPM')} & data`,
    rowKpm: ({ code }) => `${kept('KPM')} ${code}`,
    tiles: {
      kpms: kept('KPM'),
      activeOwners: ({ n }) => `${n} pemilik aktif`,
      members: 'Anggota',
      notSignedIn: ({ n }) => `${n} belum masuk aplikasi`,
      complete: ({ month }) => `Data ${month} lengkap`,
      of: ({ n, of }) => `${n} dari ${of}`,
      needsThree: ({ n }) => `Perbandingan antar-${kept('KPM')} butuh minimal ${n}`,
      enough: 'Cukup untuk perbandingan',
    },
    heading: ({ month }) => `Semua ${kept('KPM')} · ${month}`,
    rowHint: `Ketuk baris untuk membuka ${kept('KPM')}.`,
    columns: {
      kpm: kept('KPM'), manpower: kept('Manpower'), maa: 'Agen aktif (MAA)', ape: `APE ${kept('YTD')}`,
      recruitment: `Rekrutmen ${kept('YTD')}`, data: ({ month }) => `Data ${month}`, peers: 'Pembanding',
    },
    data: { complete: 'Lengkap', missing: 'Belum' },
    peers: {
      notEnough: ({ n, of }) => `Belum cukup ${kept('KPM')} pembanding (${n} dari ${of})`,
      enough: ({ n }) => `${n} ${kept('KPM')} pembanding`,
      notCounted: 'Tidak dihitung',
    },
    empty: `Perusahaan ini belum punya ${kept('KPM')}.`,
    loading: `Memuat ${kept('KPM')}`,
    retry: 'Coba lagi',
    month: 'Bulan',
  },
};

export const adminPlatformReadsMessages = defineMessages({ en, id });
