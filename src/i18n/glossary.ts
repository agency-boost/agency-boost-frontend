/**
 * **The approved glossary's lists, as code reads them** (P18.98-T1 AC-7; OD-237, approved as proposed 2026-10-28).
 *
 * The words themselves are [the glossary approved 2026-10-29](../../../docs/05-delivery/phases/phase-18.98-glossary-for-approval.md):
 * this file holds the two lists a program has to check against, each section citing its part of that document.
 *
 * - **`KEPT_ENGLISH` — §A, the terms that read in English in both languages** (UI-041's five groups, made concrete).
 *   **One list**: a message that is a kept term is written `kept('…')` (`kept.ts`), which accepts only a term listed
 *   here, so two people translating two screens cannot keep different words; a kept term inside an Indonesian
 *   sentence is written through `kept()` as well, which marks it for `lang="en"` (ADR-0179 §8, P18.98-T7).
 * - **`SAME_IN_INDONESIAN` — the §B words whose approved Indonesian is spelled as the English** (*Menu*, *Status*,
 *   *Email* …). They are Indonesian words in ID mode, not kept terms: no `lang="en"`. A message identical in both
 *   languages must be one of these two lists' (`catalogue.spec.ts`, the check T4 AC-2 asks for).
 *
 * **Data, not shipped**: the app imports its *types* only (`import type`), so neither list is in a bundle — `kept()`
 * remembers the terms it is called with instead. A word the glossary does not hold is added to the glossary for
 * approval first, then here (ADR-0179 §3). A page's title is its menu item in title case (§A.2): a title-case form not
 * yet listed is added under `titles` with the page that draws it.
 */
export const KEPT_ENGLISH = {
  /** §A.1 — every group heading and item of the three shells' nav, as each shell draws it. */
  navigation: [
    // The field shell (`components/agent-shell.tsx`): headings, then items.
    'Personal tools', 'Unit tools', 'New agent', 'Training', 'Sales tools', 'Recruitment tools', 'KPM', 'Campaign',
    'Core leader', 'Admin',
    'Activity management', 'Leads management', 'Goal settings', 'Personal summary', 'Calendar', 'Unit dashboard',
    'Coaching session', 'Your 90-day activation', 'New hires', 'Training modules', 'Sales Attack Plan', 'Recruitment',
    'Event list', 'Campaign list', 'Strategic Leader Forum', 'KPM analytics', 'Advanced analytics', 'Group tree',
    'User management',
    // The office console (`components/tenant-shell.tsx`), beyond the field shell's words.
    'Reporting', 'Leader Meetings', 'Settings', 'People',
    'Overview', 'Data upload', 'Activity types', 'Lead statuses', 'Activation checklist', 'Capability Mapping',
    'Events', 'Campaigns', 'Products', 'Recruitment pitch', 'Branch info', 'All members', 'Import people', 'Org tree',
    'Manage KPM admins',
    // The platform console (`components/admin-shell.tsx`), beyond the two above.
    'Companies', 'KPMs', 'Platform admin',
    'Manage companies', 'Org role ladder', 'All KPMs', 'Pending KPM requests', 'Leaders past the limit',
    'Billing & subscription', 'KPM Owners & Admins', 'Audit / role change log', 'Cross-platform analytics',
  ],
  /**
   * §A.2 — a destination's title, its menu item in title case, and the other titles that are names. The titles that
   * are sentences addressed to the reader (*Your account*, *Create your account* …) are Indonesian in ID mode, not here.
   */
  titles: [
    'Activity Management', 'Leads Management', 'Goal Settings', 'Personal Summary', 'Unit Dashboard',
    'Coaching Session', 'Your 90-Day Activation', 'New Hires', 'Training Modules', 'Event List', 'Campaign List',
    'KPM Analytics', 'Group Tree', 'User Management', 'All Members', 'Org Tree', 'Manage KPM Admins',
    'Manage Companies', 'All KPMs', 'Pending KPM Requests', 'Billing & Subscription', 'Audit / Role Change Log',
    'Product Catalog', 'Ratio benchmarks', 'Member', 'Company template', 'Office', 'Notifications', 'AgencyBoost',
    // For approval (§B.10, P18.98-T4, new hires and activation): the programme's name in title case, as the coaching
    // record's card and a sentence name it — *Menu 90-Day Activation akan dihapus*.
    '90-Day Activation',
    // For approval (§B.10, P18.98-T4, coaching and unit): the Leader Notes tab's card, §A.1's *Capability Mapping* in the
    // prototype's sentence case (`Overall.html:4346`) — *Capability mapping diperbarui.*
    'Capability mapping',
  ],
  /**
   * §A.3 — every tab row as built, and the two rows approved as tabs: Calendar's *Week · Month* and the Product
   * Catalog's categories. A filter that names a status (*All · Upcoming · Past*) follows the status words (§B.3).
   */
  tabs: [
    'Log Activity', 'Dashboard', 'Ratio',
    'Sales Attack Plan', 'Product Catalog',
    'Details', 'Attack Plan', 'Documents',
    'Pitch Materials',
    'Personal Summary', 'Goal Setting', 'Activity', 'Training', 'Activation', 'Coaching Session', 'Leader Notes',
    'Register KPM', 'Find Your Leader', 'Add New Agents', 'Pending Requests',
    'Overview', 'Compliance, Events, and Campaigns',
    'Activity Mgmt', 'Events', 'Campaigns',
    'Overview & Stats', 'Agenda', 'Action Items',
    'Activity types', 'Ratio benchmarks',
    'Categories', 'Skills', 'Modules',
    'Ladder',
    'Event types',
    'Production club tiers',
    'Products', 'Script approvals',
    'Directory', 'Pending', 'Removed', 'Role change log', 'Groups',
    'Sales', 'Recruitment', 'Activation checklist', 'Maintenance of Contract', 'Promotion paths',
    'Week', 'Month',
    'All products', 'Life', 'Health', 'Critical illness', 'Education', 'Investment-linked',
    // For approval (§B.10, P18.98-T6, company templates): the Super Admin's name for the category the catalog's tab
    // calls *Investment-linked*, a product's category on the Company template's *Products* tab — kept with the four
    // beside it; the Sales Attack Plan's need of the same spelling is translated (`KEPT_ELSEWHERE`).
    'Investment',
  ],
  /** §A.4 — the client's examples of metric and KPI names (UI-041). */
  metricExamples: [
    'Active agents', 'Manpower', 'Net APE', 'Annual Active Agents', 'Case submission', 'Avg. case size', 'YTD', 'FY',
    'Monthly target',
  ],
  /**
   * §A.4 — every name in the metric registry (`backend/src/domain/constants/metrics.ts`), served by `GET /metrics`.
   * `glossary.spec.ts` reads the registry and fails when the two differ.
   */
  metrics: [
    'Monthly Active Agent (MAA)', 'Active agents in unit', 'Pacing to MAA', 'Activity-logging compliance, last 7 days',
    'Activity-logging compliance, this month', 'Activity-logging compliance rate', 'Logged touches by category',
    'Coached in the last 7 days', 'Coached in the last 30 days', 'Days since last 1:1', 'Coaching coverage',
    'AB / AAB coaching frequency', 'APE achieved', 'APE target', 'APE achieved vs target', 'Gap to target',
    'Policies still needed', 'Months left in the year', 'Policies to close this month',
    'Appointments to hold this month', 'Leads to contact this month', 'On-track / pace status',
    'Selling vs Recruitment balance', 'Selling success rate', 'Recruitment success rate', 'Leads per activity',
    'Set appointment to meeting', 'Your logged leads-to-appointment rate', 'Your logged closing rate',
    'This month’s APE target', 'Closings over the last 30 days', 'Closings needed per week',
    'Activity target for the period', 'Logged against the activity target',
    'Activity target for the last 7 days, pro-rated', 'Activation completion', 'Activation day', 'Training completion',
    'Event attendance status', 'Event attendance rate', 'Event NPS', 'Campaign qualification',
    'Maintenance of Contract', 'Production club tier', 'Recruitment pipeline now', 'Expected to close',
    'Open sales leads', 'Sales leads closing this month', 'Recruitment candidates nominated this month',
    'Potential Monthly Active Agents in unit', 'Touches on the goal activities', 'New active agents',
    'Rolling persistency', 'New Hire', 'Leaders used', 'Headcount', 'New members this month',
    'Agents who logged activity this month', 'Recruitment closed last month', 'Projected APE for the year', 'Net APE',
    'Monthly2 AA', 'Monthly2 AA, Direct Unit', 'Monthly2 AA, Direct Group', 'Direct AB (AB on AB)',
    'MOC rolling persistency', 'Activation cohort', 'Annual Active Agents', 'Avg. Monthly AA', 'Case submission',
    'Average Case Size', 'Cases/producing agents', 'Activation completion rate', 'Goal set', 'First sale',
    'Counts for production', '3M activation', '3M activation %',
  ],
  /**
   * §A.4 — the KPI labels the Owner's and the AB's screens draw, screen by screen. *APE (Rp M)* and *Avg. Case Size
   * (Rp jt)* keep their names; the unit in brackets is a format, which P18.98-T3 writes in each language (§E).
   */
  kpis: [
    // The forum's *Overview & Stats*.
    'Manpower', '# of agents', '# of units', '# of AB', '# of AAB', 'Metrics', 'Full Year & YTD View', 'Monthly View',
    'Full Year', 'YTD', 'This Month, Last Year', 'Last Month', 'This Month', 'Monthly Target', 'APE (Rp M)',
    'FLC (avg. monthly)', 'Annual Active Agents', '3M new agent %', 'Avg. monthly AA', 'Case submission',
    'Cases/producing agents', 'Avg. Case Size (Rp jt)', 'AS OF', 'TBD',
    // The Overview (`/kpm/overview`).
    'Team composition', 'Total members', 'Engagement', 'Agents who logged activity this month',
    'Activity logging — this week', 'Coaching coverage', 'Coached in last 7 days', 'Coached in last 30 days',
    'AB coaching frequency', 'Recruitment pipeline', 'Pipeline now', 'Expected to close', 'Target', 'Last month',
    'Production — this year', 'Units furthest behind target',
    // KPM Analytics.
    'Unit comparison', 'AB', 'APE — This Month', 'APE — Last Month', 'APE — Annual', 'Coached (7d)',
    'Producing this month', 'Producing last month', 'Total leads', 'MOC', 'ABs meeting MOC', 'Monthly production',
    // The Unit Dashboard.
    'Your team', 'Direct Group production', 'On pace to be active (Group)', 'Potential Recruits (Group)', 'AAB units',
    'Activity breakdown', 'Ratios', 'Sales-only', 'Gap',
    // Personal Summary.
    'Goal vs. actual (APE)', 'Activity pulse', 'Activity Ratios', 'Policies still needed', 'Closes this month',
    // Goal Settings.
    'Annual APE target', 'Annual savings target', 'APE already produced this year', "This month's APE target",
    'Policies per month', 'Policies per week', 'Monthly activity target', 'Conversion assumptions', 'Closing rate',
    'Commission rate',
    // New Hires.
    '3M activation %',
    // For approval (§B.10, P18.98-T4): the forum's *Avg. Case Size* with its unit apart, a format (§E) as *APE*'s is; its
    // section band *Productivity*, beside *Activation*; and its footnote's *AA — Active Agent*.
    'Avg. Case Size', 'Productivity', 'AA', 'Active Agent',
    // For approval (§B.10, P18.98-T4): Data upload's metric headings, the carrier's file's own names, and *# of policy* as
    // a sentence names it — *Koreksi # of policy bulan ini*.
    'Rolling Persistency (%)', 'New Active Agents', 'FYP', '# of Policy', '# of policy',
    // For approval (§B.10, P18.98-T4, new hires and activation): the coaching record's *✓ Done · New Active Agent*, the
    // metric's name in the singular.
    'New Active Agent',
    // For approval (§B.10, P18.98-T4, field selling): Goal Settings' second conversion rate, the client's label (ADR-0160
    // §4), the twin of *Closing rate* beside it and named from §A.6's cascade stages.
    'Appointment to Sales meeting',
    // For approval (§B.10, P18.98-T4, coaching and unit): the Unit Dashboard's *Monthly Active Agent* in a sentence (the
    // registry's *Monthly Active Agent (MAA)*), the ✓'s name *Potential Monthly Active Agent*, and a total's *On pace to be
    // active: 6/12* — its tile's name without *(Group)*.
    'Monthly Active Agent', 'Potential Monthly Active Agent', 'On pace to be active',
    // For approval (§B.10, P18.98-T4, events): the *Feedback Summary*'s score, *Net Promoter Score*, as the registry's
    // *Event NPS* names it — *Kehadiran belum dikonfirmasi — tidak dihitung dalam NPS*.
    'NPS',
  ],
  /** §A.5 — the roles, as the badges, the consoles' tags and the profile line write them, and the programmes. */
  roles: [
    'KPM', 'AB', 'AAB', 'Agent', 'KPM Owner', 'KPM Admin', 'Owner', 'Admin', 'KPM OWNER', 'Super Admin', 'Superadmin',
    'SUPERADMIN', 'Agency Builder', 'Associate Agency Builder', 'Core Leader', 'MDRT', 'Star Club', 'Elite Club',
    'Chairman’s Club', "Chairman's Club", 'MOC', 'Maintenance of Contract', 'Strategic Leader Forum',
    'Sales Attack Plan', 'AgencyBoost', 'New hire', '3M activation', '90-day activation',
    // Approved 2026-10-29 (the glossary approved 2026-10-29's §B.10, P18.98-T4): *Agent*'s English plural, §B.0 rule 8.
    'Agents',
    // For approval (§B.10, P18.98-T4): *New hire* as a sentence writes it — *untuk new hire* — as §A.6's jargon is listed.
    'new hire',
    // For approval (§B.10, P18.98-T4): a forum meeting's name, *Strategic Check-in — #15*, the programme's (glossary.md).
    'Strategic Check-in',
    // For approval (§B.10, P18.98-T4): *Core Leader* and *KPM Admin* counted, in their English plural, §B.0 rule 8.
    'Core Leaders', 'KPM Admins',
    // For approval (§B.10, P18.98-T4, new hires and activation): *new hire* counted in its English plural, §B.0 rule 8 —
    // *Memuat new hires Anda…*.
    'new hires',
    // For approval (§B.10, P18.98-T6, company templates): a rung's two leader tiers, the client's own names (ADR-0156), as
    // the API's refusals keep them (*jenjang Senior Leader*); and the platform's company of templates (ADR-0164), by
    // its name, as the API's refusals keep it (*adalah Template library*).
    'Senior Leader', 'Associate Leader', 'Template library',
  ],
  /**
   * §A.6 — the sales and recruiting jargon, in the forms a sentence writes it: capitalised and not, and a noun's
   * English plural, which it keeps in an Indonesian sentence (§B.0 rule 8: *1 lead · 3 leads*; rule 4: *di-coaching*).
   * *Policy*, *Prospect* and *Agent code* are translated (*polis*, *prospek*, *kode agen*), so they are not here.
   */
  jargon: [
    'Leads', 'leads', 'Lead', 'lead', 'Pipeline', 'pipeline', 'Follow-up', 'follow-up', 'follow up', 'Closing',
    'closing', 'closings', 'close', 'Coaching', 'coaching', '1-on-1', '1:1', 'Recruitment', 'recruitment',
    'Activation', 'activation', 'Campaign', 'campaign', 'campaigns', 'Activity Management', 'APE', 'Case', 'case',
    'cases', 'Persistency', 'persistency', 'Rolling persistency', 'Set appointment', 'Sales meeting',
    'Submission polis', 'Goal', 'goal', 'goals', 'Target', 'target', 'targets', 'Event', 'event', 'events', 'Leader',
    'leader', 'leaders', 'Unit', 'unit', 'units', 'Downline', 'downline', 'Benchmark', 'benchmark', 'benchmarks',
    'Ratio', 'ratio', 'ratios', 'Script', 'script', 'scripts', 'Pitch', 'pitch', 'Playbook', 'playbook', 'Dashboard',
    'dashboard', 'Skill', 'skill', 'skills', 'Module', 'module', 'modules',
    // For approval (§B.10, P18.98-T4): KPM Analytics' *{name} (Direct)*, as §A.4's *Direct Unit* and *Direct Group*.
    'Direct',
    // For approval (§B.10, P18.98-T4, new hires and activation): New Hires' unit for the reader's own hires, as §A.4's
    // *Monthly2 AA, Direct Unit* names it.
    'Direct Unit',
    // For approval (§B.10, P18.98-T4, field selling): a lead's type, *Recruit* — ADR-0161 §2's short form of
    // *Recruitment* — named as *Sales* beside it is (§A.3); *rekrut* in a sentence.
    'Recruit',
    // For approval (§B.10, P18.98-T4, field selling): *case size* in a sentence, as §A.4's *Avg. case size* names it —
    // Goal Settings' *Rata-rata case size (APE per polis)*.
    'case size',
  ],
  /**
   * For approval (§B.10, P18.98-T4, public and account): *Your account*'s *Pronoun* options — English pronouns, which only
   * English sentences use (*her sales activity targets*); Indonesian writes *dia* for everybody (§B.0 rule 8), so the
   * choice reads as itself in both languages.
   */
  pronouns: ['she / her', 'he / him', 'they / them'],
} as const;

/** A term the approved glossary keeps English: the only argument `kept()` accepts. */
export type KeptTerm = (typeof KEPT_ENGLISH)[keyof typeof KEPT_ENGLISH][number];

/**
 * **The §B words whose approved Indonesian is the English word**: an identical message is right for these, and they
 * read as Indonesian (no `lang="en"`). §B.0 rule 5's loanwords, §B.1's *Menu*, §B.4's *Status*, *Email*, *Total*,
 * *Label* and *Item*.
 */
export const SAME_IN_INDONESIAN = [
  'Menu', 'Status', 'Email', 'email', 'Total', 'Label', 'Item', 'PDF', 'online', 'WhatsApp',
  // For approval (§B.10, P18.98-T4): the forum's *PIC*, the person in charge, as Indonesian offices write it.
  'PIC',
  // For approval (§B.10, P18.98-T4, new hires and activation): New Hires' column, the loanword §B.10's *checklist* is.
  'Checklist',
  // For approval (§B.10, P18.98-T4, field selling): a balance's formula between its two sides, *A vs B* — as Indonesian
  // writes *versus*.
  'vs',
  // For approval (§B.10, P18.98-T4, field selling): a product's channel, the Product Catalog's tag and toggle — the
  // Indonesian name of the line, which the English already uses (*Konvensional* is its pair).
  'Syariah',
  // For approval (§B.10, P18.98-T4, events): an event type's field, Settings › Events — a loanword, as *email* is (§B.0
  // rule 5).
  'Emoji',
  // For approval (§B.10, P18.98-T4, training): a skill card's *No.* and *Format* columns, as an Indonesian table heads
  // them, and two kinds of material, the loanwords §B.10's *File* (the roster import's) and *video* already are.
  'No.', 'Format', 'File', 'Video',
  // For approval (§B.10, P18.98-T6, company templates): a company's web-address name, the column and the field on
  // *Manage Companies* — as the API's refusals write it (*Slug "…" sudah dipakai*).
  'Slug',
] as const;

/**
 * **The words §B translates where §A keeps the same spelling elsewhere** (P18.98-T4): *Pending* is a status chip in
 * §B.3 (*Menunggu*) and a tab of *All members* in §A.3; *Removed* likewise (*Dikeluarkan*); *Groups* is that tab and a
 * field's legend (*Grup*); *Owner* is the KPM's role (§A.5) and a group's owner (*Pemilik*) — the last two approved 2026-10-29
 * in §B.10. The characters cannot tell the two apart, so a message whose English is one of these may be translated
 * (`catalogue.spec.ts`); **where it is the kept term it is written `kept('…')`**, which `tsc` holds to the same term in
 * both languages (`MessagesOf`).
 */
export const KEPT_ELSEWHERE = [
  'Pending', 'Removed', 'Groups', 'Owner',
  // P18.98-T4, the office reporting: *Month* is §B.4's field (*Bulan*, Data upload's month) and §A.3's Calendar tab;
  // *Categories* is §B.4's word for a group of chips (*Kategori*, the compliance tree's) and §A.3's Training tab.
  'Month', 'Categories',
  // P18.98-T4, new hires and activation: *Your team* is §A.4's Unit Dashboard KPI and *Add New Agents*' card of the
  // people who report to the reader (*Tim Anda*, approved in §B.10, 2026-10-29).
  'Your team',
  // P18.98-T4, field selling: *Activity* is §A.3's coaching tab and the Activity Dashboard's first column, a header
  // (*Aktivitas*, §B bucket 2).
  'Activity',
  // For approval (§B.10, P18.98-T4, field selling): *Health*, *Critical illness* and *Education* are §A.3's Product
  // Catalog categories, kept as its tabs, and three of the Sales Attack Plan's eight needs — a brief's answers, translated
  // with the other five (*Kesehatan*, *Penyakit kritis*, *Pendidikan*, the words §A.3 offered for the tabs).
  'Health', 'Critical illness', 'Education',
  // P18.98-T4, coaching and unit: *Details* is §A.3's product drawer tab and §B.1's *Detail* — the Unit Dashboard's ⌄
  // column as a screen reader names it.
  'Details',
  // For approval (§B.10, P18.98-T6, company templates): *Investment* is the Company template's product category, kept with
  // the catalog's tabs, and the Sales Attack Plan's need (*Investasi*); *Companies* is §A.1's nav heading and *Manage
  // Companies*' table caption (*Perusahaan*).
  'Investment', 'Companies',
  // P18.98-T6, the Super Admin's console: *Office* is §A.2's title of an office's page (*Office*, then its code and
  // branch) and §B.4's column (*KPM*, §B.9) — *Leaders past the limit*' and *KPM Owners & Admins*' tables; *Member* is
  // §A.2's title of a member's page and *Leaders past the limit*' column (*Anggota*, §B.4 *Members*).
  'Office', 'Member',
] as const;
