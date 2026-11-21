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
  /**
   * A week with things in it — the member's own *Calendar* (P12-T2 AC-1). Not `calendar`, which is the
   * office's *Event list*: two items in one sidebar do not wear one icon.
   */
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M7 14h4M7 17.5h7M14 14h3" /></>,
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
  /** A chat on WhatsApp: a round bubble with a handset in it — the leads table's link (P18.5-T7). */
  whatsapp: <><path d="M3.5 20.5l1.4-4.1A8.6 8.6 0 1 1 8.3 19.3z" /><path d="M9.2 8.6c-.3 2.6 2.6 5.6 5.4 5.5l.9-1.5-1.8-1-.8.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.8-1-1.8z" /></>,
  /** Working out where to go. */
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  /** A shelf of products. */
  box: <><path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" /><path d="m3 8.5 9 4.5 9-4.5M12 13v7" /></>,
  /** A marker planted ahead — *Your sales activity targets* (`Overall.html:3141`). */
  flag: <><path d="M5 21V4" /><path d="M5 4h13l-3.5 4L18 12H5" /></>,
  /** A burst of energy — *Activity pulse* (`Overall.html:3187`). */
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
  /** Ideas radiating out — *What to do next* (`Overall.html:3231`). */
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  /** A line going up — *How you can improve your performance* (`Overall.html:3245`). */
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  /** Somebody to go and see — *Leads that need you* (`Overall.html:3213`). */
  pin: <><path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></>,
  /** A torn-off slip with lines on it — *Billing & subscription*, the quote tool (ADR-0111). */
  receipt: <><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  /*
   * UI V1 (UI-004, D-13, D-20): the tab bar's and the *Lainnya* sheet's line icons, in this registry's stroke.
   */
  /** Home — the centre tab. */
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  /** Activity — a list with ticks. */
  checklist: <><path d="m4 6 1.5 1.5L8 5" /><path d="m4 12 1.5 1.5L8 11" /><path d="m4 18 1.5 1.5L8 17" /><path d="M11 6h9M11 12h9M11 18h9" /></>,
  /** Unit — a bar chart. */
  barChart: <><path d="M4 20h16" /><rect x="5" y="11" width="3.5" height="7" rx="1" /><rect x="10.25" y="6" width="3.5" height="12" rx="1" /><rect x="15.5" y="9" width="3.5" height="9" rx="1" /></>,
  /** Lainnya — a grid of four. */
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  /** Search agent — a magnifier. */
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  /** Personal Summary — a report with a line chart. */
  report: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 15 3-3 2 2 3-4" /><path d="M8 7h5" /></>,
  /** A star over three heads (P19.13-T3, UI-199). */
  star:<><path d="M12 2.5l2 4.2 4.6.7-3.3 3.2.8 4.6L12 13l-4.1 2.2.8-4.6-3.3-3.2 4.6-.7z" /><circle cx="6" cy="19" r="2" /><circle cx="12" cy="19.5" r="2" /><circle cx="18" cy="19" r="2" /></>,
  usersGroup: <><circle cx="12" cy="8" r="3" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="5" cy="10" r="2" /><path d="M2 18a3.5 3.5 0 0 1 4-3.4" /><circle cx="19" cy="10" r="2" /><path d="M22 18a3.5 3.5 0 0 0-4-3.4" /></>,
  /** Keluar — a door and an arrow out. */
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>,
  /** Ubah foto — a camera. */
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  /** ✕ — close. */
  close: <path d="M6 6l12 12M18 6 6 18" />,
  /** The bell, on a page's title row (Home's). */
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  /**
   * A page with a folded corner and two lines — the proposal (P19.7-T2; ADR-0221 §6, §7, §8): the lead card's pill,
   * *Buat proposal*, and the Unit Dashboard's count on a phone.
   */
  document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,

  /*
   * **The menu's icons: Tabler's outline set** (P19.17-T3 AC-5; ADR-0269 §5; the brief's part E, `DESIGN-RULES.md`: *Icons:
   * Tabler outline icons, one set everywhere*). Every menu item — the sidebar, the rail and its group icons, the tab bar
   * and the *Lainnya* tiles — names one of these, as the approved mockups' `ti ti-<name>` does. The paths are Tabler
   * Icons 3.19.0 (`@tabler/icons/icons/outline/<name>.svg`, MIT, © Paweł Kuna), copied as drawn: no package, 24 × 24,
   * stroke 2 (`NavIcon` gives a `ti-` name Tabler's own stroke). Keyed `ti-<name>`, the webfont's class, so a mockup's
   * icon is found here by its name.
   */
  'ti-activity': <path d="M3 12h4l3 8l4 -16l3 8h4" />,
  'ti-address-book': <><path d="M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z" /><path d="M10 16h6" /><path d="M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M4 8h3" /><path d="M4 12h3" /><path d="M4 16h3" /></>,
  'ti-building-skyscraper': <><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /><path d="M9 9l0 .01" /><path d="M9 12l0 .01" /><path d="M9 15l0 .01" /><path d="M9 18l0 .01" /></>,
  'ti-calendar-event': <><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /><path d="M8 15h2v2h-2z" /></>,
  'ti-calendar': <><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></>,
  'ti-chart-bar': <><path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 20h14" /></>,
  'ti-chart-dots': <><path d="M3 3v18h18" /><path d="M9 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M19 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M10.16 10.62l2.34 2.88" /><path d="M15.088 13.328l2.837 -4.586" /></>,
  'ti-chevron-down': <path d="M6 9l6 6l6 -6" />,
  'ti-clipboard-check': <><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M9 14l2 2l4 -4" /></>,
  'ti-clipboard-list': <><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M9 12l.01 0" /><path d="M13 12l2 0" /><path d="M9 16l.01 0" /><path d="M13 16l2 0" /></>,
  'ti-compass': <><path d="M8 16l2 -6l6 -2l-2 6l-6 2" /><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 3l0 2" /><path d="M12 19l0 2" /><path d="M3 12l2 0" /><path d="M19 12l2 0" /></>,
  'ti-file-import': <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 13v-8a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5.5m-9.5 -2h7m-3 -3l3 3l-3 3" /></>,
  'ti-hierarchy-2': <><path d="M10 3h4v4h-4z" /><path d="M3 17h4v4h-4z" /><path d="M17 17h4v4h-4z" /><path d="M7 17l5 -4l5 4" /><path d="M12 7l0 6" /></>,
  'ti-home': <><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></>,
  'ti-layout-dashboard': <><path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" /><path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" /></>,
  'ti-layout-grid': <><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></>,
  'ti-list-check': <><path d="M3.5 5.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 11.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 17.5l1.5 1.5l2.5 -2.5" /><path d="M11 6l9 0" /><path d="M11 12l9 0" /><path d="M11 18l9 0" /></>,
  'ti-logout': <><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></>,
  'ti-messages': <><path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10" /><path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2" /></>,
  'ti-presentation': <><path d="M3 4l18 0" /><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" /><path d="M12 16l0 4" /><path d="M9 20l6 0" /><path d="M8 12l3 -3l2 2l3 -3" /></>,
  'ti-report': <><path d="M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697" /><path d="M18 14v4h4" /><path d="M18 11v-4a2 2 0 0 0 -2 -2h-2" /><path d="M8 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M8 11h4" /><path d="M8 15h3" /></>,
  'ti-school': <><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></>,
  'ti-search': <><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></>,
  'ti-settings': <><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></>,
  'ti-sitemap': <><path d="M3 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M15 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1" /><path d="M12 9l0 3" /></>,
  'ti-target': <><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></>,
  'ti-trophy': <><path d="M8 21l8 0" /><path d="M12 17l0 4" /><path d="M7 4l10 0" /><path d="M17 4v8a5 5 0 0 1 -10 0v-8" /><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></>,
  'ti-upload': <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></>,
  'ti-user-circle': <><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" /></>,
  'ti-user-plus': <><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /></>,
  'ti-user-search': <><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h1.5" /><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M20.2 20.2l1.8 1.8" /></>,
  'ti-user-shield': <><path d="M6 21v-2a4 4 0 0 1 4 -4h2" /><path d="M22 16c0 4 -2.5 6 -3.5 6s-3.5 -2 -3.5 -6c1 0 2.5 -.5 3.5 -1.5c1 1 2.5 1.5 3.5 1.5z" /><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /></>,
  'ti-users-group': <><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></>,
  'ti-users': <><path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></>,
  'ti-x': <><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></>,
  /*
   * P19.23-T1, T2 (ADR-0277): the Super Admin console's rail and pages — the mockups' Tabler names
   * (`superadmin-tablet-stopmotion-2026-11-19`).
   */
  'ti-building': <><path d="M3 21l18 0" /><path d="M9 8l1 0" /><path d="M9 12l1 0" /><path d="M9 16l1 0" /><path d="M14 8l1 0" /><path d="M14 12l1 0" /><path d="M14 16l1 0" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /></>,
  'ti-briefcase': <><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" /><path d="M12 12l0 .01" /><path d="M3 13a20 20 0 0 0 18 0" /></>,
  'ti-checklist': <><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></>,
  'ti-credit-card': <><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></>,
  'ti-user-x': <><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5" /><path d="M22 22l-5 -5" /><path d="M17 22l5 -5" /></>,
  'ti-mail-off': <><path d="M9 5h10a2 2 0 0 1 2 2v10m-2 2h-14a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2" /><path d="M3 7l9 6l.565 -.377m2.435 -1.623l6 -4" /><path d="M3 3l18 18" /></>,
  'ti-info-circle': <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></>,
  'ti-alert-circle': <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></>,
  'ti-crown': <><path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z" /></>,
  'ti-check': <><path d="M5 12l5 5l10 -10" /></>,
  'ti-arrow-right': <><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></>,
  'ti-arrow-left': <><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></>,
  'ti-plus': <><path d="M12 5l0 14" /><path d="M5 12l14 0" /></>,
  'ti-shield-check': <><path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" /><path d="M15 19l2 2l4 -4" /></>,
  'ti-user': <><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></>,
  'ti-external-link': <><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></>,
  /* P19.24 (ADR-0280): *Laporan KPM*'s icon and its dialog's two buttons (the Super Admin mockups' `ti-file-type-pdf`, `ti-brand-whatsapp`, `ti-download`). */
  'ti-file-type-pdf': <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M17 18h2" /><path d="M20 15h-3v6" /><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z" /></>,
  'ti-brand-whatsapp': <><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" /><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" /></>,
  'ti-download': <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></>,
};

export type NavIconName = keyof typeof PATHS;

/** Every name the registry defines, for the spec that proves no nav item is missing one. */
export const NAV_ICON_NAMES = Object.keys(PATHS) as NavIconName[];

/** A Tabler icon's name (`ti-<name>`): drawn at Tabler's own stroke, 2 on the 24 grid, as the mockups' webfont draws it. */
export function isTablerIcon(name: NavIconName): boolean {
  return String(name).startsWith('ti-');
}

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isTablerIcon(name) ? '2' : '1.7'}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The menu's icon by its Tabler name, for the specs that pin part E's icons; the older glyphs carry none.
      data-icon={isTablerIcon(name) ? name : undefined}
      className={className ?? 'h-[18px] w-[18px] shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}
