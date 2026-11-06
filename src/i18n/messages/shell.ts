import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The shells' own words** — the catalogue's first module (P18.10-T1; the approved glossary's §B.1, §B.2, §B.3 and
 * §B.8). The frame every signed-in screen sits in: the sidebar, the title row, the tab bar and the *Lainnya* sheet
 * (`components/app-shell.tsx`, `field-nav.tsx`, `field-more-sheet.tsx`), the account menu (`sidebar-user-menu.tsx`),
 * the bell (`notification-bell.tsx`), **the one shell for every role** (`shell.tsx`, P19.2-T1; ADR-0197 — the office's
 * `tenant-shell.tsx` and the platform's `admin-shell.tsx` are gone) and **the view switcher** (`lib/views.ts`, ADR-0198).
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
 * @moved lib/views.ts
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
  /** The account menu's trigger where it names no view (for approval, §B.10). */
  account: 'Account',
  /** A control's name with its count, *Notifications, 3 unread*; the name alone at none (for approval, §B.10). */
  withUnread: ({ name, unread }: { name: string; unread: number }) => (unread > 0 ? `${name}, ${unread} unread` : name),
  /** The account menu (§A.2's sentence title; §B.1, §B.2). */
  yourAccount: 'Your account',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  /**
   * **The view switcher** (P19.2-T1 AC-5; UI-169 item 2; ADR-0198 §3), in the avatar menu on every page. Its words are
   * UI-169's: *Akun saya*, *KPM Owner*, *Superadmin* — in English *My account* — and the Admin's *KPM Admin*, the role's
   * own name (proposed in §B.10 as *KPM Admin · <nama KPM>*, O-8). The roles are kept English; the office's name follows
   * the entry as the office typed it (`· <nama KPM>`). `views` names the list for a screen reader (§B.10 *View* →
   * *Tampilan*); `viewMenu` is the avatar's name for a person with more than one view, the active one in it.
   * *Open agent view / Owner view / Admin view* (ADR-0114) went with P19.2-T1 (UI-147, UI-169 item 3; ADR-0197 §8).
   */
  views: 'Views',
  viewSelf: 'My account',
  viewKpmOwner: kept('KPM Owner'),
  viewKpmAdmin: kept('KPM Admin'),
  viewSuperAdmin: kept('Superadmin'),
  viewMenu: ({ view }: { view: string }) => `Your account: ${view}`,
  /**
   * ***Tambah akun*** (P19.2-T1 AC-8; UI-169 item 5; ADR-0199 §1, §5): after the views, for an Owner, an Admin or a Super
   * Admin with no linked login yet — UI-169's own words, *Add account* in English (ADR-0198 §3).
   */
  addAccount: 'Add account',
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
     * **The office view's groups after *KPM*** (P19.2-T1 AC-6; UI-147; ADR-0198 §2): *Pengaturan* — an Indonesian word,
     * translated, as the field's — and *People*, the console's kept heading (§A.1). Then **the Super Admin's**, the
     * laptop sidebar's groups unchanged (UI-127; the report's *Don't change* for `/admin`), kept English until the owner
     * supplies their Indonesian (UI-130, O-8).
     */
    pengaturan: 'Settings', people: kept('People'),
    companies: kept('Companies'), kpms: kept('KPMs'), platformAdmin: kept('Platform admin'), reporting: kept('Reporting'),
  },
  /**
   * **The Super Admin's menu and bar** (P19.2-T1 AC-9, AC-12; UI-127, UI-130; ADR-0197 §3, §6): every label a key here.
   * The bar's five are UI-127's, the owner's of 2 November — *Overview · KPMs · Perusahaan · Analytics* and *Lainnya* —
   * and the items are the laptop sidebar's, unchanged. Their Indonesian is the owner's (O-8): until they supply or approve
   * it, an item reads its kept English in both languages, and `shell-views.spec.tsx` lists the keys still waiting.
   */
  admin: {
    overview: kept('Overview'),
    manageCompanies: kept('Manage companies'),
    orgRoleLadder: kept('Org role ladder'),
    allKpms: kept('All KPMs'),
    allMembers: kept('All members'),
    pendingKpmRequests: kept('Pending KPM requests'),
    leadersPastTheLimit: kept('Leaders past the limit'),
    billing: kept('Billing & subscription'),
    tenantAdmins: kept('KPM Owners & Admins'),
    audit: kept('Audit / role change log'),
    crossPlatformAnalytics: kept('Cross-platform analytics'),
    barKpms: kept('KPMs'),
    barCompanies: 'Companies',
    barAnalytics: kept('Analytics'),
  },
  more: 'More',
  /** P19.5-T4 (C-R2): the *Saya* tile, every field role's, and the words a dot adds to a name while a survey waits. */
  surveys: 'Surveys',
  /** P19.6-T1 (ADR-0218 §1; §B7's *Pengaturan → Tampilan KPM*): the office's branding page, in *Pengaturan*. */
  branding: 'KPM branding',
  surveyWaiting: ', a survey needs filling',
  closeSheet: 'Close',
  changePhoto: 'Change photo',
  yourProfile: 'Your profile',
  /**
   * ***📘 Panduan*** (P19.6-T5 AC-1, AC-7; ADR-0219 §5; the guide spec): the sidebar's last item, the account menu's item
   * between *Your account* and *Sign out*, and *Lainnya*'s line above *Sign out*. The item's name is the reader's; the
   * guide it opens is in Bahasa whatever the language (acceptance 5). It opens in a new tab, which a screen reader is told:
   * `opensInNewTab` follows `guide` in the link's accessible name (`aria-label`), never in its text.
   */
  guide: 'Guide',
  opensInNewTab: ' (opens in a new tab)',
};

const id: MessagesOf<typeof en> = {
  mainNav: 'Utama',
  expandSidebar: 'Lebarkan menu samping',
  collapseSidebar: 'Ciutkan menu samping',
  doneSuffix: ' — selesai',
  upcoming: 'Segera hadir',
  soon: 'Segera hadir',
  account: 'Akun',
  withUnread: ({ name, unread }) => (unread > 0 ? `${name}, ${unread} belum dibaca` : name),
  yourAccount: 'Akun Anda',
  signOut: 'Keluar',
  signingOut: 'Sedang keluar…',
  views: 'Tampilan',
  viewSelf: 'Akun saya',
  viewKpmOwner: kept('KPM Owner'),
  viewKpmAdmin: kept('KPM Admin'),
  viewSuperAdmin: kept('Superadmin'),
  viewMenu: ({ view }) => `Akun Anda: ${view}`,
  addAccount: 'Tambah akun',
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
    companies: kept('Companies'), kpms: kept('KPMs'), platformAdmin: kept('Platform admin'), reporting: kept('Reporting'),
  },
  admin: {
    overview: kept('Overview'),
    manageCompanies: kept('Manage companies'),
    orgRoleLadder: kept('Org role ladder'),
    allKpms: kept('All KPMs'),
    allMembers: kept('All members'),
    pendingKpmRequests: kept('Pending KPM requests'),
    leadersPastTheLimit: kept('Leaders past the limit'),
    billing: kept('Billing & subscription'),
    tenantAdmins: kept('KPM Owners & Admins'),
    audit: kept('Audit / role change log'),
    crossPlatformAnalytics: kept('Cross-platform analytics'),
    barKpms: kept('KPMs'),
    barCompanies: 'Perusahaan',
    barAnalytics: kept('Analytics'),
  },
  more: 'Lainnya',
  surveys: 'Survei',
  branding: 'Tampilan KPM',
  surveyWaiting: ', ada survei yang perlu diisi',
  closeSheet: 'Tutup',
  changePhoto: 'Ubah foto',
  yourProfile: 'Profil saya',
  guide: 'Panduan',
  opensInNewTab: ' (membuka tab baru)',
};

export const shellMessages = defineMessages({ en, id });
