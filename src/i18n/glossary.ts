/**
 * **The approved glossary's lists, as code reads them** (P18.10-T1 AC-7; OD-237, approved as proposed 2026-10-28).
 *
 * The words themselves are [the glossary approved 2026-10-29](../../../docs/05-delivery/phases/phase-18.10-glossary-for-approval.md):
 * this file holds the two lists a program has to check against, each section citing its part of that document.
 *
 * - **`KEPT_ENGLISH` — §A, the terms that read in English in both languages** (UI-041's five groups, made concrete).
 *   **One list**: a message that is a kept term is written `kept('…')` (`kept.ts`), which accepts only a term listed
 *   here, so two people translating two screens cannot keep different words; a kept term inside an Indonesian
 *   sentence is written through `kept()` as well, which marks it for `lang="en"` (ADR-0179 §8, P18.10-T7).
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
    // UI V1 (UI-004, D-13, D-20; ADR-0180): the field shell's tab bar, its *Lainnya* sheet and its regrouped sidebar — the
    // report's own words, which it gives in English inside the Indonesian UI (`lib/field-nav.ts`). The groups' headings
    // (*Saya*, *Aktivitas*, *Tim saya*, *Program*) are Indonesian words, translated (`shellMessages`); *KPM* is above.
    'Home', 'Activity', 'Unit', 'Unit Dashboard', 'Search agent', 'Summary', 'Leads', 'Goal Setting', 'Personal Summary',
    'Sales', 'Coaching', 'New Hires', 'Group Tree', 'User Management', 'User Mgmt', 'Event', 'Leader Forum', 'KPM Analytics',
    '90-day activation',
    // The platform console (`components/admin-shell.tsx`), beyond the two above.
    'Companies', 'KPMs', 'Platform admin',
    'Manage companies', 'Org role ladder', 'All KPMs', 'Pending KPM requests', 'Leaders past the limit',
    'Billing & subscription', 'KPM Owners & Admins', 'Audit / role change log', 'Cross-platform analytics',
    // The Super Admin's bottom bar (P19.2-T1 AC-9; UI-127, the owner's of 2026-11-02, *Overview · KPMs · Perusahaan ·
    // Analytics · Lainnya*): its fourth item, which the owner gives in English inside the Indonesian bar.
    'Analytics',
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
    // P19.6-T1 (ADR-0218 §11): the line at the foot of a branded KPM's sidebar and *Lainnya*, proposed kept-English.
    'Powered by AgencyBoost',
    // For approval (§B.10, P18.10-T4, new hires and activation): the programme's name in title case, as the coaching
    // record's card and a sentence name it — *Menu 90-Day Activation akan dihapus*.
    '90-Day Activation',
    // For approval (§B.10, P18.10-T4, coaching and unit): the Leader Notes tab's card, §A.1's *Capability Mapping* in the
    // prototype's sentence case (`Overall.html:4346`) — *Capability mapping diperbarui.*
    'Capability mapping',
    // UI V1 (UI-006, UI-036; Phase 18.11 T10): the *Capability mapping* tab's second card, kept English in both
    // languages by the report's list — it was *Pelacak skill* in ID mode.
    'Skill tracker',
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
    // UI V1 (UI-109, the report's own word): KPM Analytics' second tab, *Overview | Compliance*, in both languages.
    'Compliance',
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
    // For approval (§B.10, P18.10-T6, company templates): the Super Admin's name for the category the catalog's tab
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
    // UI V1 (Phase 18.11 T4; UI-028): the roster's *Closing*, registered in T16.
    'Closing (sales leads paid and issued in the period)',
    'Potential Monthly Active Agents in unit', 'Touches on the goal activities', 'New active agents',
    'Rolling persistency', 'New Hire', 'Leaders used', 'Headcount', 'New members this month',
    // P19.3-T1 (ADR-0200, ADR-0201): *Agents who logged activity this month* retired, *Net APE* is *APE, MOC scope*, and
    // the Overview's recruitment is the upload's, *Recruitment last month*.
    'Recruitment last month', 'Projected APE for the year', 'APE, MOC scope',
    'Monthly2 AA', 'Monthly2 AA, Direct Unit', 'Monthly2 AA, Direct Group', 'Direct AB (AB on AB)',
    'MOC rolling persistency', 'Activation cohort', 'Annual Active Agents', 'Avg. Monthly AA', 'Case submission',
    'Average Case Size', 'Cases/producing agents', 'Activation completion rate', 'Goal set', 'First sale',
    'Counts for production', '3M activation', '3M activation %',
    // P19.1-T6 (ADR-0193): the Unit Dashboard's *Potensi* tab — a lead's switch, the tab's AA, a kandidat's rekrut.
    'Potensi', 'AA (the Potensi tab’s)', 'Rekrut',
    // P19.3-T1 (ADR-0201 to ADR-0203): a leader row's uploaded unit persistency, and the forum's D7 and recruitment rows.
    'Unit persistency', '3M new agent %', 'Recruitment, avg. monthly',
    // P19.5-T4 (ADR-0216 §4): the surveys' six (`metrics-and-definitions.md` §A.15).
    'Survey NPS', 'Survey responses', 'Item with an issue', 'Items with an issue, per person', 'Leader support',
    'Coaching downline',
    // P19.5-T2 (ADR-0214 §10, §11): the Data upload's two (`metrics-and-definitions.md`, *Month complete*, *Year to date
    // (calculated)*).
    'Month complete', 'Year to date (calculated)',
    // P19.7-T2 (ADR-0221 §6): the leaders' count of proposals (`metrics-and-definitions.md` §A.16).
    'Proposals made',
    // P19.8-T2 (ADR-0228 §4, OD-283): Home's *Leads* tile (`metrics-and-definitions.md` §A.17).
    'Your open leads',
    // P19.5-T3 (ADR-0215): the *Advanced analytics* page's nineteen (`metrics-and-definitions.md` §A.15) — Demographics, the
    // events' NPS for a period, Quant's seven, the peers' two and Sub-group's eight.
    'Demographics', 'Event NPS, for a period', 'A1 Recruitment per leader', 'A2 Net growth in annual active agents',
    'A3 Active agents per leader', 'B2 Activation within 12 months', 'B3 Tenured agents active',
    'C1 Avg. monthly active agents per leader', 'C3 Avg. active months', 'Peer median', 'Peer status',
    'Sub-group MAA baseline', 'Head of group adoption', 'Downline adoption', 'Power users', 'One-on-ones a week',
    'Weekly activity target', 'Sub-group recruitment baseline', 'Sub-group target met',
  ],
  /**
   * §A.4 — the KPI labels the Owner's and the AB's screens draw, screen by screen. *APE (Rp M)* and *Avg. Case Size
   * (Rp jt)* keep their names; the unit in brackets is a format, which P18.10-T3 writes in each language (§E).
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
    // KPM Analytics' totals and *Leader* list (P19.3-T3; UI-152, the `kpm-leaders` mockups of 3 Nov, ADR-0200 §1, T1 AC-9):
    // the tiles' and the table's KPI names as the mockups draw them, kept in both languages.
    'APE YTD', 'Active this month', 'Active last month', 'Coached (7D)', 'Coached 7D', 'Club', 'Member page',
    // The Unit Dashboard. *Changed 2026-10-30 (UI V1, UI-006; ADR-0180):* the owner's kept list is UI-006's, and *Your
    // team*, *Direct Group production*, *On pace to be active (Group)*, *Potential Recruits (Group)*, *AAB units*,
    // *Activity breakdown*, *Ratios* and *Gap* are Indonesian in ID mode now (UI-003's *Tim Anda*, *Produksi Group*; the
    // rest proposed in §B.10, P18.11). Was kept here. *Gap* stays kept for KPM Analytics' MOC verdict alone, which UI-006
    // does not name.
    'Sales-only', 'Gap',
    // Personal Summary. *Changed 2026-10-30 (UI-006's table):* *Goal vs. actual (APE)*, *Activity pulse* and *Policies still
    // needed* (as a KPI label) are translated — *Target vs. realisasi (APE)*, *Rasio aktivitas*, *Polis yang dibutuhkan*.
    'Activity Ratios', 'Closes this month',
    // Goal Settings. *Changed 2026-10-30 (UI-006):* its ten KPI labels are Indonesian in ID mode (proposed in §B.10, P18.11),
    // and *Appointment to Sales meeting* is UI-016's *Appointment to meeting*, kept as the report writes it.
    'Appointment to meeting',
    // New Hires.
    '3M activation %',
    // For approval (§B.10, P18.10-T4): the forum's *Avg. Case Size* with its unit apart, a format (§E) as *APE*'s is; its
    // section band *Productivity*, beside *Activation*; and its footnote's *AA — Active Agent*.
    'Avg. Case Size', 'Productivity', 'AA', 'Active Agent',
    // For approval (§B.10, P18.10-T4): Data upload's metric headings, the carrier's file's own names, and *# of policy* as
    // a sentence names it — *Koreksi # of policy bulan ini*.
    'Rolling Persistency (%)', 'New Active Agents', 'FYP', '# of Policy', '# of policy',
    // P19.3-T2 (T1's AC-6; ADR-0201 §2): the template's leader-only column, as the table heads it, and a sentence's name.
    'Unit Persistency (%)', 'Unit persistency (%)',
    // For approval (§B.10, P18.10-T4, new hires and activation): the coaching record's *✓ Done · New Active Agent*, the
    // metric's name in the singular.
    'New Active Agent',
    // For approval (§B.10, P18.10-T4, coaching and unit): the Unit Dashboard's *Monthly Active Agent* in a sentence (the
    // registry's *Monthly Active Agent (MAA)*). *Changed 2026-10-30 (UI-006):* *Potential Monthly Active Agent* and *On pace
    // to be active* are translated — *Monthly Active Agent potensial*, *Berpotensi aktif* (proposed in §B.10, P18.11).
    'Monthly Active Agent',
    // For approval (§B.10, P18.10-T4, events): the *Feedback Summary*'s score, *Net Promoter Score*, as the registry's
    // *Event NPS* names it — *Kehadiran belum dikonfirmasi — tidak dihitung dalam NPS*.
    'NPS',
  ],
  /** §A.5 — the roles, as the badges, the consoles' tags and the profile line write them, and the programmes. */
  roles: [
    'KPM', 'AB', 'AAB', 'Agent', 'KPM Owner', 'KPM Admin', 'Owner', 'Admin', 'KPM OWNER', 'Super Admin', 'Superadmin',
    'SUPERADMIN', 'Agency Builder', 'Associate Agency Builder', 'Core Leader', 'MDRT', 'Star Club', 'Elite Club',
    'Chairman’s Club', "Chairman's Club", 'MOC', 'Maintenance of Contract', 'Strategic Leader Forum',
    'Sales Attack Plan', 'AgencyBoost', 'New hire', '3M activation', '90-day activation',
    // Approved 2026-10-29 (the glossary approved 2026-10-29's §B.10, P18.10-T4): *Agent*'s English plural, §B.0 rule 8.
    'Agents',
    // For approval (§B.10, P18.10-T4): *New hire* as a sentence writes it — *untuk new hire* — as §A.6's jargon is listed.
    'new hire',
    // For approval (§B.10, P18.10-T4): a forum meeting's name, *Strategic Check-in — #15*, the programme's (glossary.md).
    'Strategic Check-in',
    // For approval (§B.10, P18.10-T4): *Core Leader* and *KPM Admin* counted, in their English plural, §B.0 rule 8.
    'Core Leaders', 'KPM Admins',
    // For approval (§B.10, P18.10-T4, new hires and activation): *new hire* counted in its English plural, §B.0 rule 8 —
    // *Memuat new hires Anda…*.
    'new hires',
    // For approval (§B.10, P18.10-T6, company templates): a rung's two leader tiers, the client's own names (ADR-0156), as
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
    // P19.4-T4 (ADR-0209; the glossary's *Rider*, kept): add-on cover sold only with a base product — the riders spec's
    // own word in the Indonesian UI (*"Rider ini tidak terpasang …"*, the chip *Rider*).
    'Rider', 'rider', 'riders',
    // For approval (§B.10, P18.10-T4): KPM Analytics' *{name} (Direct)*, as §A.4's *Direct Unit* and *Direct Group*.
    'Direct',
    // For approval (§B.10, P18.10-T4, new hires and activation): New Hires' unit for the reader's own hires, as §A.4's
    // *Monthly2 AA, Direct Unit* names it.
    'Direct Unit',
    // For approval (§B.10, P18.10-T4, field selling): a lead's type, *Recruit* — ADR-0161 §2's short form of
    // *Recruitment* — named as *Sales* beside it is (§A.3); *rekrut* in a sentence.
    'Recruit',
    // For approval (§B.10, P18.10-T4, field selling): *case size* in a sentence, as §A.4's *Avg. case size* names it —
    // Goal Settings' *Rata-rata case size (APE per polis)*.
    'case size',
    // For approval (§B.10, Phase 18.11 T12, UI-105): the pipeline strip's short words for three stages, as the trade
    // writes them in Indonesian — *SPAJ* (the report's), *AAJI* and *JFW* (`glossary.md`).
    'SPAJ', 'AAJI', 'JFW',
    // UI V1 (Phase 18.11 T4; UI-006's list, ADR-0180 §4): *Last updated* (UI-028's date line) and *Group*, D-16's *Unit /
    // Group* — the Activities tab's switch, *Produksi Group* — kept in both languages as the report writes them.
    'Last updated', 'Group',
    // UI V1 (Phase 18.11 T13; UI-108: *Say "Feedback", not "Masukan"*): an event's *Feedback*, as the owner writes it —
    // *Feedback belum dikirim*, *Kirim feedback*.
    'Feedback', 'feedback',
    // P19.5-T1 (the glossary's *MAPA driver*, OD-266 Q1: never expanded): a section of *Advanced analytics*, the same in
    // both languages as the template mockup writes it. *Sub-group* and *Power user*, the spec's own words in the ID UI.
    'MAPA driver', 'Sub-group', 'Power user',
  ],
  /**
   * For approval (§B.10, P18.10-T4, public and account): *Your account*'s *Pronoun* options — English pronouns, which only
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
  // For approval (§B.10, Phase 18.11 T9): the invite share block's *QR* button (UI-084), as the report writes it in
  // both languages.
  'QR',
  // For approval (§B.10, P19.6-T2): an HTML page's file icon on a pitch card, as *PDF* is the PDF's (ADR-0217).
  'HTML',
  // For approval (§B.10, P18.10-T4): the forum's *PIC*, the person in charge, as Indonesian offices write it.
  'PIC',
  // For approval (§B.10, P18.10-T4, new hires and activation): New Hires' column, the loanword §B.10's *checklist* is.
  'Checklist',
  // For approval (§B.10, P18.10-T4, field selling): a balance's formula between its two sides, *A vs B* — as Indonesian
  // writes *versus*.
  'vs',
  // For approval (§B.10, P18.10-T4, field selling): a product's channel, the Product Catalog's tag and toggle — the
  // Indonesian name of the line, which the English already uses (*Konvensional* is its pair).
  'Syariah',
  // For approval (§B.10, P18.10-T4, events): an event type's field, Settings › Events — a loanword, as *email* is (§B.0
  // rule 5).
  'Emoji',
  // For approval (§B.10, P18.10-T4, training): a skill card's *No.* and *Format* columns, as an Indonesian table heads
  // them, and two kinds of material, the loanwords §B.10's *File* (the roster import's) and *video* already are.
  'No.', 'Format', 'File', 'Video',
  // P19.6-T1 (§B7): *Tampilan KPM*'s first field, and its preview's second frame — the same word in Indonesian.
  'Logo', 'Laptop',
  // For approval (§B.10, P18.10-T6, company templates): a company's web-address name, the column and the field on
  // *Manage Companies* — as the API's refusals write it (*Slug "…" sudah dipakai*).
  'Slug',
  // For approval (§B.10, Phase 18.11 T11): Home's *+ Log* pill in the *Aktivitas saya* tile (UI-100), as the report
  // writes it in both languages.
  'Log',
  // For approval (§B.10, Phase 18.11 T20; ADR-0185): a template card's *★ Default*, the loanword the API's refusals and
  // *Jadikan default* already use for a company's default template.
  'Default',
  // For approval (§B.10, P19.7-T1; the proposal spec of 3 November and the glossary's *Proposal* and *Plan*): the Super
  // Admin's *Proposal* section on a product, the spec's own word in the Indonesian UI.
  'Proposal',
  // For approval (§B.10, P19.5-T4; `coaching-survey-results-2026-11-02.html`): the coaching *Survei* tab's bar, as the
  // mockup writes it in the Indonesian UI — *Full-time*, *Part-time*, and the generations *Gen Z · Gen Y · Gen X*
  // (the glossary's *Demographics*).
  'Full-time', 'Part-time', 'Gen Z', 'Gen Y', 'Gen X',
  // For approval (§B.10, P19.2-T2 AC-2; UI-131, `admin-mobile` screen 3, `admin-desktop` screen 2): the Super Admin's
  // product list — its *Filter* button, the word §B.10 already approved for the calendar's *Filters* (2026-10-29) —
  // and two marks that are not words: the *#* column and the *–* a product not in a new office's catalogue shows.
  'Filter', '#', '–',
] as const;

/**
 * **The words §B translates where §A keeps the same spelling elsewhere** (P18.10-T4): *Pending* is a status chip in
 * §B.3 (*Menunggu*) and a tab of *All members* in §A.3; *Removed* likewise (*Dikeluarkan*); *Groups* is that tab and a
 * field's legend (*Grup*); *Owner* is the KPM's role (§A.5) and a group's owner (*Pemilik*) — the last two approved 2026-10-29
 * in §B.10. The characters cannot tell the two apart, so a message whose English is one of these may be translated
 * (`catalogue.spec.ts`); **where it is the kept term it is written `kept('…')`**, which `tsc` holds to the same term in
 * both languages (`MessagesOf`).
 */
export const KEPT_ELSEWHERE = [
  'Pending', 'Removed', 'Groups', 'Owner',
  // P18.10-T4, the office reporting: *Month* is §B.4's field (*Bulan*, Data upload's month) and §A.3's Calendar tab;
  // *Categories* is §B.4's word for a group of chips (*Kategori*, the compliance tree's) and §A.3's Training tab.
  'Month', 'Categories',
  // P18.10-T4, field selling: *Activity* is §A.3's coaching tab and the Activity Dashboard's first column, a header
  // (*Aktivitas*, §B bucket 2).
  'Activity',
  // For approval (§B.10, P18.10-T4, field selling): *Health*, *Critical illness* and *Education* are §A.3's Product
  // Catalog categories, kept as its tabs, and three of the Sales Attack Plan's eight needs — a brief's answers, translated
  // with the other five (*Kesehatan*, *Penyakit kritis*, *Pendidikan*, the words §A.3 offered for the tabs).
  'Health', 'Critical illness', 'Education',
  // UI V1 (Phase 18.11 T13; UI-107): the field's Product Catalog writes its categories in Indonesian in ID mode — *Semua
  // produk*, *Jiwa*, *Kesehatan*, *Penyakit kritis*, *Pendidikan*, *Unit link* — where the Super Admin's Company template
  // still keeps them (§A.3).
  'All products', 'Life', 'Investment-linked',
  // P18.10-T4, coaching and unit: *Details* is §A.3's product drawer tab and §B.1's *Detail* — the Unit Dashboard's ⌄
  // column as a screen reader names it.
  'Details',
  // For approval (§B.10, P18.10-T6, company templates): *Investment* is the Company template's product category, kept with
  // the catalog's tabs, and the Sales Attack Plan's need (*Investasi*); *Companies* is §A.1's nav heading and *Manage
  // Companies*' table caption (*Perusahaan*).
  'Investment', 'Companies',
  // P18.10-T6, the Super Admin's console: *Office* is §A.2's title of an office's page (*Office*, then its code and
  // branch) and §B.4's column (*KPM*, §B.9) — *Leaders past the limit*' and *KPM Owners & Admins*' tables; *Member* is
  // §A.2's title of a member's page and *Leaders past the limit*' column (*Anggota*, §B.4 *Members*).
  'Office', 'Member',
  // UI V1 (UI-006, 2026-10-30): *Gap* is KPM Analytics' MOC verdict, kept (§A.4), and the Unit Dashboard's tile, translated
  // — *Selisih* (proposed in §B.10, P18.11).
  'Gap',
  // P19.2-T1 (UI-147; ADR-0198 §2): *Settings* was the office console's kept nav heading (§A.1); the office view's group
  // is *Pengaturan* in ID mode, as UI-147 and `kpm-owner-desktop` write it, in the one shell.
  'Settings',
  // UI V1 (Phase 18.11 T16): *Group* is D-16's *Unit / Group* switch, kept (`kept('Group')`, UI-006), and the office's
  // informal groups' column in *All members*, translated with the rest of that tab — *Grup*, as *Grup informal* is.
  'Group',
  // For approval (§B.10, Phase 18.11 T20; ADR-0185): the KPM template's section *Checklist aktivasi* and *Pengaturan
  // perusahaan*'s three parts, *Produk · Campaign · Rekrutmen*, translated as the developer wrote them for the product
  // owner — where the Owner's own nav keeps *Activation checklist*, *Products*, *Campaigns* and *Recruitment* (§A.1).
  'Activation checklist', 'Products', 'Campaigns', 'Recruitment',
  // P19.5-T3 (ADR-0215): *Demographics* and *Weekly activity target* are metric names (§A.4, kept on the KPM's page) and
  // two of the template editor's *Ambang & benchmark* labels, translated as the template mockup writes them — *Demografi*,
  // *Target aktivitas mingguan* (P19.5-T1).
  'Demographics', 'Weekly activity target',
] as const;
