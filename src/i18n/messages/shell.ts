import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The shells' own words** — the catalogue's first module (P18.10-T1; the approved glossary's §B.1, §B.2, §B.3 and
 * §B.8). The frame every signed-in screen sits in: the sidebar, the title row, the tab bar and the *Lainnya* sheet
 * (`components/app-shell.tsx`, `field-nav.tsx`, `field-more-sheet.tsx`), the account menu (`sidebar-user-menu.tsx`),
 * the bell (`notification-bell.tsx`), **the one shell for every role** (`shell.tsx`, P19.2-T1; ADR-0197 — the office's
 * `tenant-shell.tsx` and the platform's `admin-shell.tsx` are gone). The view switcher (ADR-0198) and *Tambah akun*
 * (ADR-0199) went with P19.17-T3 (ADR-0269: one login, one menu), and *📘 Panduan* (ADR-0219) with them.
 *
 * **Not here: the kept-English words** — the nav's group headings and items (§A.1), the consoles' tags and the roles
 * (§A.5), *Notifications* (§A.2) and the product's name. They read the same in both languages, so each shell writes
 * them as `kept('…')` where it draws them.
 *
 * **The modules whose words are all here**, which the gate holds to it (`catalogue-gate.spec.ts`): a word written into
 * one of them fails CI. One `@moved` line per file or directory (`components/training/`), added in the change that moves it.
 *
 * @moved components/app-shell.tsx
 * @moved components/sidebar-user-menu.tsx
 * @moved components/notification-bell.tsx
 * @moved components/agent-shell.tsx
 * @moved components/shell.tsx
 * @moved lib/landing.ts
 * @moved lib/profile-line.ts
 * @moved components/field-nav.tsx
 * @moved components/field-more-sheet.tsx
 * @moved lib/field-nav.ts
 * @moved components/field-chrome.tsx
 * @moved components/page-header.tsx
 * @moved components/unread-badge.tsx
 * @moved components/notification-popover.tsx
 */
const en = {
  /*
   * *Removed 2026-11-05 (P19.2-T1; ADR-0197, ADR-0167 §3 ended):* the consoles' ☰, its drawer and its ✕ — *Open menu*,
   * *Close menu*, *Menu* — and the phone bar's avatar, *Account and notifications*. No shell draws a bar or a drawer.
   */
  /** The nav's landmark, in the sidebar and the tab bar (for approval, §B.10). */
  mainNav: 'Main',
  /** The rail's toggle (§B.1). */
  expandSidebar: 'Expand the sidebar',
  collapseSidebar: 'Collapse the sidebar',
  /** Said after a nav item's own name when its amber check is drawn: *Your 90-day activation — complete* (§B.8). */
  doneSuffix: ' — complete',
  /** The pill on a nav item with nothing behind it yet: the office console's word, and the other two's (§B.3). */
  upcoming: 'Upcoming',
  soon: 'Soon',
  /** A control's name with its count, *Notifications, 3 unread*; the name alone at none (for approval, §B.10). */
  withUnread: ({ name, unread }: { name: string; unread: number }) => (unread > 0 ? `${name}, ${unread} unread` : name),
  /** The account menu (§A.2's sentence title; §B.1, §B.2). */
  yourAccount: 'Your account',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  /** The chip's two lines before the session answers (§B.8). */
  signedIn: 'Signed in',
  noOfficeYet: 'No office yet',
  /** A reader on their way to their own landing (§B.8). */
  takingYouToYourWork: 'Taking you to your work…',
  /** The bell's popover (§B.1, §B.2). */
  markAllRead: 'Mark all read',
  tryAgain: 'Try again',
  loadingNotifications: 'Loading your notifications…',
  seeAllNotifications: 'See all notifications',
  /**
   * **UI V1's field shell** (UI-004, D-13, D-20): the *Lainnya* sheet's group headings — Indonesian words, translated (the
   * destinations in them are kept, `lib/field-nav.ts`) — the bar's fifth tab and the sheet's name, its ✕, the account
   * row's *Ubah foto*, and the title row's avatar by what it opens. Proposed in §B.10, P18.11, where the report gives
   * no English.
   */
  fieldGroups: {
    saya: 'Me', aktivitas: 'Activities', timSaya: 'My team', program: 'Programs', kpm: kept('KPM'),
    /*
     * **The extras' groups after *KPM*** (P19.17-T3 AC-4; ADR-0269): *People*, the console's kept heading (§A.1), and
     * *Pengaturan* — an Indonesian word, translated, as the field's. Then **the Super Admin's**, the laptop sidebar's
     * groups unchanged (UI-127; the report's *Don't change* for `/admin`), kept English until the owner supplies their
     * Indonesian (UI-130, O-8).
     */
    pengaturan: 'Settings', people: kept('People'),
    // P19.23-T1 AC-1 (ADR-0277): the Super Admin's *Lainnya* sheet — *Perusahaan & template · Persetujuan · Platform*.
    console: kept('Super Admin'),
  },
  /**
   * **The Super Admin's console menu** (P19.23-T1 AC-1; ADR-0277 §1; the Super Admin spec §2): the rail's *Dashboard ·
   * KPM · Anggota · Perusahaan · Persetujuan · Langganan* and *Platform*, and the *Lainnya* sheet's *Perusahaan &
   * template* (`companiesTile`). The Indonesian is the mockups'; the English translates it.
   */
  admin: {
    dashboard: 'Dashboard',
    kpm: kept('KPM'),
    members: 'Members',
    companies: 'Companies',
    companiesTile: 'Companies & templates',
    approvals: 'Approvals',
    billing: 'Subscriptions',
    platform: 'Platform',
  },

  more: 'More',
  /** P19.5-T4 (C-R2): the *Saya* tile, every field role's, and the words a dot adds to a name while a survey waits. */
  surveys: 'Surveys',
  /**
   * ***Pengaturan***, one item (P19.17-T3 AC-4; ADR-0269 §4; the brief's part B: *the 11 sidebar items become one menu
   * item "Pengaturan"*): the sidebar's pinned item, and its *Lainnya* tile, *Pengaturan KPM* (`lainnya-owner-mobile`).
   */
  settings: 'Settings',
  settingsTile: 'KPM settings',
  /**
   * **The extras' tag** (P19.17-T3 AC-5, AC-7; part E): the laptop's small orange *Owner* beside *KPM*, *PEOPLE* and
   * *Pengaturan*, for the Owner, the Admins and the core leaders alike; the *Lainnya* sheet's *KPM Owner* (the Owner and
   * the Admins) or *Core leader* beside a group's heading. Kept-English roles (§A.5).
   */
  ownerTag: kept('Owner'),
  sheetTags: { owner: kept('KPM Owner'), coreLeader: kept('Core leader') },
  surveyWaiting: ', a survey needs filling',
  closeSheet: 'Close',
  changePhoto: 'Change photo',
  yourProfile: 'Your profile',
};

const id: MessagesOf<typeof en> = {
  mainNav: 'Utama',
  expandSidebar: 'Lebarkan menu samping',
  collapseSidebar: 'Ciutkan menu samping',
  doneSuffix: ' — selesai',
  upcoming: 'Segera hadir',
  soon: 'Segera hadir',
  withUnread: ({ name, unread }) => (unread > 0 ? `${name}, ${unread} belum dibaca` : name),
  yourAccount: 'Akun Anda',
  signOut: 'Keluar',
  signingOut: 'Sedang keluar…',
  signedIn: 'Sudah masuk',
  noOfficeYet: `Belum punya ${kept('KPM')}`,
  takingYouToYourWork: 'Membuka halaman kerja Anda…',
  markAllRead: 'Tandai semua sudah dibaca',
  tryAgain: 'Coba lagi',
  loadingNotifications: 'Memuat notifikasi Anda…',
  seeAllNotifications: 'Lihat semua notifikasi',
  fieldGroups: {
    saya: 'Saya', aktivitas: 'Aktivitas', timSaya: 'Tim saya', program: 'Program', kpm: kept('KPM'),
    pengaturan: 'Pengaturan', people: kept('People'),
    console: kept('Super Admin'),
  },
  admin: {
    dashboard: 'Dashboard',
    kpm: kept('KPM'),
    members: 'Anggota',
    companies: 'Perusahaan',
    companiesTile: 'Perusahaan & template',
    approvals: 'Persetujuan',
    billing: 'Langganan',
    platform: 'Platform',
  },

  more: 'Lainnya',
  surveys: 'Survei',
  settings: 'Pengaturan',
  settingsTile: 'Pengaturan KPM',
  ownerTag: kept('Owner'),
  sheetTags: { owner: kept('KPM Owner'), coreLeader: kept('Core leader') },
  surveyWaiting: ', ada survei yang perlu diisi',
  closeSheet: 'Tutup',
  changePhoto: 'Ubah foto',
  yourProfile: 'Profil saya',
};

export const shellMessages = defineMessages({ en, id });
