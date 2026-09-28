/**
 * The sidebar's glyph set.
 *
 * **Why the nav has icons at all.** The rail collapses to 56px, and a column of unlabelled
 * dots is a column of nothing — the icon is what keeps a reader oriented once the words are
 * gone. It earns its place at full width too: a scannable shape beside a label is found faster
 * than a label alone.
 *
 * **One flat registry, not a component per item.** Every glyph is the same 24×24 box, the same
 * 1.7 stroke and the same round joins, so they sit on one optical baseline; a set assembled
 * per screen drifts within a week. `currentColor` throughout, so the active, muted and upcoming
 * states are the link's to decide and not the icon's.
 *
 * Adding a nav item without an icon is caught by `role-shell.spec.tsx`, not by eye.
 */
const PATHS: Record<string, React.ReactNode> = {
  /** Overview — the four panes of a dashboard. */
  gauge: <><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  /** A company. */
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10" /><path d="M8 7h3M8 11h3M8 15h3M2 21h20" /></>,
  /** One office of a company. */
  office: <><path d="M3 21V9l7-5 7 5v12" /><path d="M9 21v-5h4v5" /><path d="M2 21h20M17 13h4v8" /></>,
  /** A ladder of rungs — the org levels, and the capability stages. */
  ladder: <><path d="M7 3v18M17 3v18" /><path d="M7 7h10M7 12h10M7 17h10" /></>,
  /** Add one. */
  plusSquare: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  /** Things waiting to be decided. */
  inbox: <><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /></>,
  /** Who may do what. */
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8.3-8 9-4.5-.7-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  /** What already happened. */
  history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4.5l3 1.8" /></>,
  /** Numbers, read. */
  chart: <><path d="M3 3v18h18" /><path d="M7 15v3M12 10v8M17 6v12" /></>,
  /** Numbers, trending. */
  chartUp: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /><path d="M19 8h-3M19 8v3" /></>,
  /** A file arriving. */
  upload: <><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" /></>,
  /** Said to a room. */
  megaphone: <><path d="M3 11v2a1 1 0 0 0 1 1h3l7 5V5L7 10H4a1 1 0 0 0-1 1z" /><path d="M18 9a4 4 0 0 1 0 6" /></>,
  /** What somebody did today. */
  activity: <path d="M3 12h4l3 7 4-14 3 7h4" />,
  /** A pipeline, narrowing. */
  funnel: <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
  /** A list somebody ticks. */
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 11 1.5 1.5L14 9M9 16h6" /></>,
  /** Learning. */
  graduation: <><path d="m2 8 10-4 10 4-10 4z" /><path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>,
  /** A date. */
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  /** Something to win. */
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /><path d="M12 14v3M9 21h6M10 17h4" /></>,
  /** The office's own knobs. */
  sliders: <><path d="M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3" /><path d="M2 14h6M9 8h6M16 16h6" /></>,
  /** People. */
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 5M18 20a6.4 6.4 0 0 0-2-4.6" /></>,
  /** A person joining. */
  userPlus: <><circle cx="10" cy="8" r="3.4" /><path d="M3 20a7 7 0 0 1 14 0" /><path d="M19 7v6M16 10h6" /></>,
  /** Who reports to whom. */
  tree: <><rect x="9" y="3" width="6" height="4" rx="1" /><rect x="2" y="16" width="6" height="4" rx="1" /><rect x="16" y="16" width="6" height="4" rx="1" /><path d="M12 7v4M5 16v-2h14v2M12 11v3" /></>,
  /** What somebody is aiming at. */
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  /** One person's own page. */
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  /** A conversation. */
  chat: <><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 12.5h5" /></>,
  /** Working out where to go. */
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  /** A shelf of products. */
  box: <><path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" /><path d="m3 8.5 9 4.5 9-4.5M12 13v7" /></>,
  /** A marker planted ahead — *Your sales activity targets* (`Overall.html:3141`). */
  flag: <><path d="M5 21V4" /><path d="M5 4h13l-3.5 4L18 12H5" /></>,
  /** A burst of energy — *Activity pulse* (`Overall.html:3187`). */
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
};

export type NavIconName = keyof typeof PATHS;

/** Every name the registry defines, for the spec that proves no nav item is missing one. */
export const NAV_ICON_NAMES = Object.keys(PATHS) as NavIconName[];

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-[18px] w-[18px] shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}
