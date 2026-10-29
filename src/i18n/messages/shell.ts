import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The shells' own words** — the catalogue's first module (P18.98-T1; the approved glossary's §B.1, §B.2, §B.3 and
 * §B.8). The frame every signed-in screen sits in: the sidebar and the phone's bar and drawer
 * (`components/app-shell.tsx`), the account menu (`sidebar-user-menu.tsx`), the bell (`notification-bell.tsx`), the
 * three shells (`agent-shell.tsx`, `tenant-shell.tsx`, `admin-shell.tsx`) and the view switch (`lib/landing.ts`).
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
 * @moved components/tenant-shell.tsx
 * @moved components/admin-shell.tsx
 * @moved lib/landing.ts
 * @moved lib/profile-line.ts
 */
const en = {
  /** The bar's ☰, on a phone (§B.1). */
  openMenu: 'Open menu',
  /** The drawer's ✕ (§B.1). */
  closeMenu: 'Close menu',
  /** The drawer, a dialog, by its name (§B.1). */
  menu: 'Menu',
  /** The nav's landmark, in the sidebar and in the drawer (for approval, §B.10). */
  mainNav: 'Main',
  /** The rail's toggle (§B.1). */
  expandSidebar: 'Expand the sidebar',
  collapseSidebar: 'Collapse the sidebar',
  /** Said after a nav item's own name when its amber check is drawn: *Your 90-day activation — complete* (§B.8). */
  doneSuffix: ' — complete',
  /** The pill on a nav item with nothing behind it yet: the office console's word, and the other two's (§B.3). */
  upcoming: 'Upcoming',
  soon: 'Soon',
  /** The phone's avatar, by what it opens (§B.8); with nothing to count, the account alone (for approval, §B.10). */
  accountAndNotifications: 'Account and notifications',
  account: 'Account',
  /** A control's name with its count, *Notifications, 3 unread*; the name alone at none (for approval, §B.10). */
  withUnread: ({ name, unread }: { name: string; unread: number }) => (unread > 0 ? `${name}, ${unread} unread` : name),
  /** The account menu (§A.2's sentence title; §B.1, §B.2). */
  yourAccount: 'Your account',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  /** The view switch, for an Owner or an Admin (§B.1; ADR-0114). */
  openAgentView: 'Open agent view',
  openOwnerView: 'Open Owner view',
  openAdminView: 'Open Admin view',
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
};

const id: MessagesOf<typeof en> = {
  openMenu: 'Buka menu',
  closeMenu: 'Tutup menu',
  menu: 'Menu',
  mainNav: 'Utama',
  expandSidebar: 'Lebarkan menu samping',
  collapseSidebar: 'Ciutkan menu samping',
  doneSuffix: ' — selesai',
  upcoming: 'Segera hadir',
  soon: 'Segera hadir',
  accountAndNotifications: 'Akun dan notifikasi',
  account: 'Akun',
  withUnread: ({ name, unread }) => (unread > 0 ? `${name}, ${unread} belum dibaca` : name),
  yourAccount: 'Akun Anda',
  signOut: 'Keluar',
  signingOut: 'Sedang keluar…',
  openAgentView: `Buka tampilan ${kept('Agent')}`,
  openOwnerView: `Buka tampilan ${kept('Owner')}`,
  openAdminView: `Buka tampilan ${kept('Admin')}`,
  signedIn: 'Sudah masuk',
  noOfficeYet: `Belum punya ${kept('KPM')}`,
  takingYouToYourWork: 'Membuka halaman kerja Anda…',
  markAllRead: 'Tandai semua sudah dibaca',
  tryAgain: 'Coba lagi',
  loadingNotifications: 'Memuat notifikasi Anda…',
  seeAllNotifications: 'Lihat semua notifikasi',
};

export const shellMessages = defineMessages({ en, id });
