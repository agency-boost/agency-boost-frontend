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
