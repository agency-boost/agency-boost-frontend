import { cn } from '@/lib/cn';
import { NavIcon, NAV_ICON_NAMES, type NavIconName } from './nav-icon';

/**
 * **The one line-icon set, beyond the nav's** (UI V1, UI-102: *everywhere else the UI uses the one line-icon set*; no
 * emoji as icons). The glyphs the shared components draw that the nav has no use for — a phone, a chevron, an ⓘ, a
 * link, a calendar with a plus — in the nav's own manner: the same 24×24 box, the same 1.7 stroke, round joins,
 * `currentColor`. A name the nav already has is drawn by `NavIcon`, so WhatsApp, ⚡, ✕, the person and the
 * magnifier are one drawing wherever they appear.
 */
const PATHS = {
  /** Call (UI-081): a handset, never the 📞 emoji. */
  phone: <path d="M5 4h3.5l1.6 4.2-2.1 1.4a11 11 0 0 0 6.4 6.4l1.4-2.1L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />,
  /** ⌄ — a tree's toggle closed, a picker's list. */
  chevronDown: <path d="m6 9 6 6 6-6" />,
  /** ⌃ — a tree's toggle open. */
  chevronUp: <path d="m6 15 6-6 6 6" />,
  /** › — a tappable row (D-09). */
  chevronRight: <path d="m9 6 6 6-6 6" />,
  /** ⓘ — an explanation behind a tap. */
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6v.4" /></>,
  /** A lead action's link back to its lead (UI-061). */
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  /** *Isi tindakan* / *Jadwalkan 1:1* (UI-062, UI-027). */
  calendarPlus: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></>,
  /** ✓ */
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  /** − and + (UI-016). */
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  /** ⋯ — a row's menu (UI-024, UI-083). */
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
  /** ✎ — a date that can be changed (UI-027). */
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  /** ‹ — the day before (UI-106's date pill). */
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  /** A bin — the lead sheet's *Hapus* (UI-105), never the 🗑 emoji. */
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></>,
  /** Filter and sort (UI-105's round button beside the search). */
  adjust: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  /** 🔒 → a line lock: the coachee's *Capability mapping* tab, the leader's alone (UI-029). */
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  /** An alert in a circle: *Finalkan*'s refusal above the button (UI-060). */
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.2v.3" /></>,
  /** ▶ → a line play: *Mulai sesi coaching* (UI-032). */
  play: <path d="M8 5.5v13l10-6.5z" />,
  /** ✓ in a circle: the *Difinalkan* strip (UI-060). */
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  /** ⬇ → a line download: *Unduh sebagai PDF*. */
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></>,
  /** ⟳ — how fresh a figure is: the Unit Dashboard's *Last updated* (UI-028). */
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  /** A trip (UI-104 point 8): a plane, never the ✈️ emoji. */
  plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  /** ↶ — put the automatic figure back: Goal Settings' *Pakai otomatis* (P19.8-T5, MOB UI-190). */
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  /** The Pengaturan hub's rows (P19.21-T2; the mockup's Tabler glyphs): Lead statuses ⇉, Capability Mapping's stairs, Tampilan KPM's palette. */
  arrowsRight: <><path d="M21 17H3" /><path d="m18 4 3 3-3 3" /><path d="m18 20 3-3-3-3" /><path d="M21 7H3" /></>,
  stairs: <path d="M22 5h-5v5h-5v5H7v5H2" />,
  palette: <><path d="M12 21a9 9 0 0 1 0-18c4.97 0 9 3.58 9 8 0 1.06-.47 2.08-1.32 2.83-.84.75-1.99 1.17-3.18 1.17H14a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21" /><circle cx="8.5" cy="10.5" r="1" /><circle cx="12.5" cy="7.5" r="1" /><circle cx="16.5" cy="10.5" r="1" /></>,
  /** A picture — *Tampilan KPM*'s logo, square logo and mascot rows (P19.21-T4 AC-2). */
  photo: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.5" /><path d="m4 16 4.5-4.5a2 2 0 0 1 2.8 0L16 16" /><path d="m14 14 1.5-1.5a2 2 0 0 1 2.8 0L20 14" /></>,
  /** *Aa* — *Tampilan KPM*'s *Nama sistem* row (P19.21-T4 AC-1). */
  letterCase: <><path d="M3 19 7.5 6 12 19" /><path d="M4.6 14.5h5.8" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M21 12v7" /></>,
  /** A phone's status bar, in *Tampilan KPM*'s live preview (P19.21-T4 AC-2). */
  wifi: <><path d="M5 10.5a10 10 0 0 1 14 0" /><path d="M8 13.5a5.5 5.5 0 0 1 8 0" /><path d="M12 17h.01" /></>,
  battery: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3" /><path d="M6 11v3M9 11v3M12 11v3" /></>,
  /** Tabler's `ti-folder`: a training category's square in Pengaturan › Training (P19.25-T4 AC-1). */
  folder: <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />,
  /** Tabler's `ti-file-text`: a training module's row (P19.25-T4 AC-1). */
  fileText: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9h1M9 13h6M9 17h6" /></>,
  /** Tabler's `ti-paperclip`: the file a module's row names beside *Ganti* (P19.25-T4 AC-2). */
  paperclip: <path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />,
} as const;

export type LineIconName = keyof typeof PATHS | NavIconName;

const isNav = (name: LineIconName): name is NavIconName => (NAV_ICON_NAMES as string[]).includes(name);

/** A glyph, hidden from assistive technology: the control it sits in carries the name. */
export function LineIcon({ name, className }: { name: LineIconName; className?: string }) {
  if (isNav(name) && !(name in PATHS)) return <NavIcon name={name} className={cn('h-5 w-5 shrink-0', className)} />;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5 shrink-0', className)}
    >
      {PATHS[name as keyof typeof PATHS]}
    </svg>
  );
}
