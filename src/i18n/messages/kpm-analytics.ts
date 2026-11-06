import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **KPM Analytics' own words** — its *Overview* tab (P18.10-T4, the office reporting; `functional/kpm-analytics.md`):
 * the layout's title and tabs (`app/kpm/analytics/layout.tsx`), the KPM's totals, the *Leader* list and the leader's
 * sheet (`components/analytics/leaders.tsx`, P19.3-T3), *Lihat untuk* (`group-filter.tsx`), *Period*, MOC's cell and
 * dialog (`moc.tsx`), *Monthly production* (`monthly-production.tsx`) and the words `lib/kpm-analytics.ts` builds.
 *
 * **English is the source** of the keys, the prototype's words as built (`KPM_Owner.html:1225-1260`, `:3090-3445`);
 * the Indonesian is the approved glossary's (OD-237; §B.0's voice), with the words it lacked added to the glossary for
 * approval's §B.10. **Kept in both languages** (§A): the title and the tabs, every column's KPI name (*Manpower*,
 * *APE — This Month*, *Producing this month* …), *MOC*, *Gap*, the roles and the jargon (*AB*, *AAB*, *Agent*,
 * *benchmark*, *target*). **Content stays as typed**: a leader's and a member's name, a club's and a criterion's label,
 * the company's MOC rules and the server's sentences (`moc.path`, `moc.missing`, `mocRulesText`). **A figure is never
 * a message's**: its caller writes it in the figures' language (`useFigureLanguage()`) and passes it in.
 *
 * Not here: *What is APE?* and the ⓘ's lines, which are the glossary's terms (`lib/terms.ts`), shared by every screen.
 *
 * @moved app/kpm/analytics/layout.tsx
 * @moved app/kpm/analytics/page.tsx
 * @moved components/analytics/kpm-analytics.tsx
 * @moved components/analytics/moc.tsx
 * @moved components/analytics/leaders.tsx
 * @moved components/analytics/group-filter.tsx
 * @moved components/analytics/monthly-production.tsx
 * @moved lib/kpm-analytics.ts
 */

/** The two periods the screen offers, as the address carries them. */
type Period = 'this_month' | 'previous_month';

const en = {
  /** The layout (`KPM_Owner.html:1225-1229`, `:2028`): the page's title and its two tabs are names (§A.2, §A.3). */
  title: kept('KPM Analytics'),
  subtitle: 'Unit comparisons, club qualification, and trends',
  tabOverview: kept('Overview'),
  /** UI V1 (UI-109): the second tab is *Compliance*, in both languages (its content keeps Events and Campaigns). */
  tabCompliance: kept('Compliance'),
  /** *Unit comparison*'s head (`:1246-1251`), its sub-line counting the ABs (contradiction 11). */
  unitComparison: kept('Unit comparison'),
  unitComparisonSub: ({ n }: { n: number }) =>
    `All ${n} AB${n === 1 ? '' : 's'}, this year — peer benchmark, always shown at group level`,
  /** *Period* (`:338-341`) and its two options (`:1240-1245`). */
  period: 'Period',
  periods: { this_month: 'This month', previous_month: 'Previous month' },
  /** The columns (`:1247-1248`): KPI names, kept (§A.4). The month's two say which month they read (F-174). */
  headAb: kept('AB'),
  headManpower: kept('Manpower'),
  headApeMonth: ({ period }: { period: Period }) =>
    (period === 'this_month' ? kept('APE — This Month') : kept('APE — Last Month')),
  /** *APE YTD* (P19.3-T1 AC-9, the handover's third mockup bug): the year to date of the office's file, never *Annual*. */
  headApeAnnual: kept('APE YTD'),
  headCoached: kept('Coached (7D)'),
  /** *Active this month* / *last month* (ADR-0200 §1: *active* is production in the upload, D1). */
  headActive: ({ period }: { period: Period }) =>
    (period === 'this_month' ? kept('Active this month') : kept('Active last month')),
  headLeads: kept('Total leads'),
  headMoc: kept('MOC'),
  /** The reader's own agency (`:3108`). */
  you: '(you)',
  /** An agency's own unit's row (`:3355-3363`), and its MOC cell. */
  direct: ({ name }: { name: string }) => `${name} (Direct)`,
  seeAbove: ({ name }: { name: string }) => `See ${name} above`,
  tagAb: kept('AB'),
  tagAab: kept('AAB'),
  /** The total row (`:3386-3396`). */
  total: ({ n }: { n: number }) => `Total — all ${n} AB${n === 1 ? '' : 's'}`,
  absMeetingMoc: kept('ABs meeting MOC'),
  /** MOC's cell, named for its leader (`:3283`), and its dialog (`:1875-1890`, `:3291-3318`). */
  mocMet: 'MOC requirements met',
  mocNotMet: 'MOC requirements not yet met',
  mocDialog: ({ name }: { name: string }) => `${name} — Maintenance of Contract`,
  requirementsMet: 'Requirements met',
  notYetMet: 'Not yet met',
  met: 'Met',
  gap: kept('Gap'),
  /** *Monthly production* (`:1253-1258`). */
  monthlyProduction: kept('Monthly production'),
  monthlySub: 'Last 6 months, combined APE — whole group',

  loading: 'Loading the analytics…',
  tryAgain: 'Try again',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  noAbTitle: 'There are no ABs to compare yet.',
  noAbLine: 'Each AB’s agency gets a row here, with its people and its figures.',
  /** The Leader list's one line (ADR-0204 §1, OWN R1, OWN UI-021): what the rows count, said once. */
  currentMembersOnly: 'Current members',
  expand: ({ name }: { name: string }) => `Units in ${name}’s agency`,
  /** After the manpower figure, which is the toggle's visible name: *"31 people in Hendra Wibowo’s agency"*. */
  members: ({ name, n }: { name: string; n: number }) => ` ${n === 1 ? 'person' : 'people'} in ${name}’s agency`,
  mocFor: ({ verdict, name }: { verdict: string; name: string }) => `${verdict} for ${name}`,
  /** `missing` is the server's sentence, saying which input is not uploaded. */
  mocUnknown: ({ name, missing }: { name: string; missing: string }) => `MOC for ${name} — ${missing}`,
  close: 'Close',

  /** An APE cell's line (`apeCellHtml`, `:3229-3231`): *of Rp 6 M target*, the sum written by the caller. */
  ofTarget: ({ target }: { target: string }) => `of ${target} target`,
  /** *Total leads*' line (`:3343`). */
  leadsSub: ({ sales, salesPotential, recruit, recruitPotential }: {
    sales: number; salesPotential: number; recruit: number; recruitPotential: number;
  }) => `${sales} sales (${salesPotential} potential) · ${recruit} recruit (${recruitPotential} potential)`,
  /** One split, one format (D3; UI-094): the AB term only where there is an AB to count. */
  split: ({ ab, aab, agents }: { ab: number; aab: number; agents: number }) =>
    `${ab > 0 ? `${ab} ${kept('AB')} · ` : ''}${aab} ${kept('AAB')} · ${agents} ${agents === 1 ? kept('Agent') : kept('Agents')}`,
  /** *Manpower*'s line (UI-152): *9 leader · 19 agent*, as the mockup writes it. */
  leaderManpower: ({ leaders, agents }: { leaders: number; agents: number }) => `${leaders} ${kept('leader')} · ${agents} agent`,
  /** *Lihat untuk* (UI-152, Overview R5; OD-258): the whole KPM, or one custom group. */
  groupFilter: {
    whole: `Whole ${kept('KPM')}`,
    viewFor: 'View for',
    pillName: ({ name }: { name: string }) => `View for: ${name}`,
    people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
    group: ({ n }: { n: number }) => `Group · ${n} ${n === 1 ? 'person' : 'people'}`,
    manage: `Manage groups in ${kept('All members')}`,
  },
  /** The *Leader* list (UI-152; `kpm-leaders` 1 and the desktop table). */
  leaders: {
    title: kept('Leader'),
    chipsName: 'Show',
    chip: ({ chip, n }: { chip: 'all' | 'ab' | 'aab'; n: number }) =>
      `${chip === 'all' ? 'All' : chip === 'ab' ? kept('AB') : kept('AAB')} ${n}`,
    attentionFirst: 'Needs attention first',
    toLeader: ({ name }: { name: string }) => `to ${name}`,
    headName: 'Name',
    headLeaderOf: `${kept('Leader')} of`,
    headGroup: kept('Group'),
    headApeMonth: ({ period }: { period: Period }) => (period === 'this_month' ? `${kept('APE')} this month` : `${kept('APE')} last month`),
    headActive: 'Active',
    headCoached: kept('Coached 7D'),
    headClub: kept('Club'),
    open: ({ name }: { name: string }) => `Open ${name}`,
    empty: `No ${kept('AB')} or ${kept('AAB')} yet.`,
    emptyLine: `Each ${kept('AB')} and ${kept('AAB')} gets a row here, with their figures.`,
  },
  /** The leader's sheet, or side panel from 1024px (UI-152; `kpm-leaders` 3). */
  sheet: {
    meta: ({ role, group, unit }: { role: string; group: number; unit: number }) =>
      `${role} · ${group} in ${kept('Group')} · ${unit} in ${kept('Unit')}`,
    apeMonth: ({ period }: { period: Period }) => (period === 'this_month' ? `${kept('APE')} this month` : `${kept('APE')} last month`),
    pctOfTarget: ({ pct }: { pct: string }) => `${pct} of target`,
    active: ({ period }: { period: Period }) => (period === 'this_month' ? kept('Active this month') : kept('Active last month')),
    activeSplit: ({ unit, unitOf, aab, aabOf }: { unit: string; unitOf: number; aab: string; aabOf: number }) =>
      `${kept('Unit')} ${unit}/${unitOf} · ${kept('AAB')} ${aab}/${aabOf}`,
    coached: 'Coached 7 days',
    mocMet: 'Met',
    mocNotYet: 'Not yet',
    criteria: ({ met, of }: { met: number; of: number }) => `${met} of ${of} requirements`,
    leads: ({ total, sales, recruit }: { total: number; sales: number; recruit: number }) =>
      `${kept('Leads')} ${total} · ${sales} sales · ${recruit} recruit`,
    potential: ({ n }: { n: number }) => `(${n} potential)`,
    unitDashboard: kept('Unit Dashboard'),
    groupTree: kept('Group Tree'),
    memberPage: kept('Member page'),
  },
  /** UI V1 (UI-109; `kpm-mobile` 2): the phone's Overview in the field shell. */
  v1: {
    perAb: `By ${kept('AB')}`,
    abCount: ({ n }: { n: number }) => `${n} ${kept('AB')}`,
    months: ({ n }: { n: number }) => `${n} months`,
    you: 'You',
    people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
    /** *45% of Rp 1,3 M*: both figures written by the caller. */
    pctOf: ({ pct, target }: { pct: string; target: string }) => `${pct} of ${target}`,
    /** A month with no upload: its bar hatched, its value *–*, and this for a screen reader. */
    noData: 'not uploaded',
    opens: ({ name }: { name: string }) => `${name}: open their figures`,
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('KPM Analytics'),
  subtitle: `Perbandingan ${kept('unit')}, kualifikasi klub, dan tren`,
  tabOverview: kept('Overview'),
  tabCompliance: kept('Compliance'),
  unitComparison: kept('Unit comparison'),
  unitComparisonSub: ({ n }) =>
    `Semua ${n} ${kept('AB')}, tahun ini — ${kept('benchmark')} antarrekan, selalu ditampilkan di tingkat grup`,
  period: 'Periode',
  periods: { this_month: 'Bulan ini', previous_month: 'Bulan lalu' },
  headAb: kept('AB'),
  headManpower: kept('Manpower'),
  headApeMonth: ({ period }) => (period === 'this_month' ? kept('APE — This Month') : kept('APE — Last Month')),
  headApeAnnual: kept('APE YTD'),
  headCoached: kept('Coached (7D)'),
  headActive: ({ period }) => (period === 'this_month' ? kept('Active this month') : kept('Active last month')),
  headLeads: kept('Total leads'),
  headMoc: kept('MOC'),
  you: '(Anda)',
  direct: ({ name }) => `${name} (${kept('Direct')})`,
  seeAbove: ({ name }) => `Lihat ${name} di atas`,
  tagAb: kept('AB'),
  tagAab: kept('AAB'),
  total: ({ n }) => `Total — semua ${n} ${kept('AB')}`,
  absMeetingMoc: kept('ABs meeting MOC'),
  mocMet: `Syarat ${kept('MOC')} terpenuhi`,
  mocNotMet: `Syarat ${kept('MOC')} belum terpenuhi`,
  mocDialog: ({ name }) => `${name} — ${kept('Maintenance of Contract')}`,
  requirementsMet: 'Syarat terpenuhi',
  notYetMet: 'Belum terpenuhi',
  met: 'Terpenuhi',
  gap: kept('Gap'),
  monthlyProduction: kept('Monthly production'),
  monthlySub: `6 bulan terakhir, ${kept('APE')} gabungan — seluruh grup`,

  loading: 'Memuat analitik…',
  tryAgain: 'Coba lagi',
  notUploaded: 'Belum diunggah',
  noGoal: `${kept('Goal')} belum diatur`,
  noAbTitle: `Belum ada ${kept('AB')} untuk dibandingkan.`,
  noAbLine: `Setiap agensi ${kept('AB')} mendapat satu baris di sini, berisi anggota dan angkanya.`,
  currentMembersOnly: 'Anggota saat ini',
  expand: ({ name }) => `${kept('Unit')} di agensi ${name}`,
  // Indonesian has one form for one and many (§B.0 rule 8): *31 orang*, *1 orang*.
  members: ({ name }) => ` orang di agensi ${name}`,
  mocFor: ({ verdict, name }) => `${verdict} untuk ${name}`,
  mocUnknown: ({ name, missing }) => `${kept('MOC')} untuk ${name} — ${missing}`,
  close: 'Tutup',

  ofTarget: ({ target }) => `dari ${kept('target')} ${target}`,
  leadsSub: ({ sales, salesPotential, recruit, recruitPotential }) =>
    `${sales} penjualan (${salesPotential} potensial) · ${recruit} rekrut (${recruitPotential} potensial)`,
  // A kept noun keeps its English plural (§B.0 rule 8): *1 Agent*, *29 Agents*.
  split: ({ ab, aab, agents }) =>
    `${ab > 0 ? `${ab} ${kept('AB')} · ` : ''}${aab} ${kept('AAB')} · ${agents} ${agents === 1 ? kept('Agent') : kept('Agents')}`,
  leaderManpower: ({ leaders, agents }) => `${leaders} ${kept('leader')} · ${agents} agent`,
  groupFilter: {
    whole: `Seluruh ${kept('KPM')}`,
    viewFor: 'Lihat untuk',
    pillName: ({ name }) => `Lihat untuk: ${name}`,
    people: ({ n }) => `${n} orang`,
    group: ({ n }) => `Grup · ${n} orang`,
    manage: `Atur grup di ${kept('All members')}`,
  },
  leaders: {
    title: kept('Leader'),
    chipsName: 'Tampilkan',
    chip: ({ chip, n }) => `${chip === 'all' ? 'Semua' : chip === 'ab' ? kept('AB') : kept('AAB')} ${n}`,
    attentionFirst: 'Perlu perhatian dulu',
    toLeader: ({ name }) => `ke ${name}`,
    headName: 'Nama',
    headLeaderOf: `${kept('Leader')} dari`,
    headGroup: kept('Group'),
    headApeMonth: ({ period }) => (period === 'this_month' ? `${kept('APE')} bulan ini` : `${kept('APE')} bulan lalu`),
    headActive: 'Aktif',
    headCoached: kept('Coached 7D'),
    headClub: kept('Club'),
    open: ({ name }) => `Buka ${name}`,
    empty: `Belum ada ${kept('AB')} atau ${kept('AAB')}.`,
    emptyLine: `Setiap ${kept('AB')} dan ${kept('AAB')} mendapat satu baris di sini, berisi angkanya.`,
  },
  sheet: {
    meta: ({ role, group, unit }) => `${role} · ${group} di ${kept('Group')} · ${unit} di ${kept('Unit')}`,
    apeMonth: ({ period }) => (period === 'this_month' ? `${kept('APE')} bulan ini` : `${kept('APE')} bulan lalu`),
    pctOfTarget: ({ pct }) => `${pct} dari ${kept('target')}`,
    active: ({ period }) => (period === 'this_month' ? kept('Active this month') : kept('Active last month')),
    activeSplit: ({ unit, unitOf, aab, aabOf }) => `${kept('Unit')} ${unit}/${unitOf} · ${kept('AAB')} ${aab}/${aabOf}`,
    coached: 'Coached 7 hari',
    mocMet: 'Terpenuhi',
    mocNotYet: 'Belum',
    criteria: ({ met, of }) => `${met} dari ${of} syarat`,
    leads: ({ total, sales, recruit }) => `${kept('Leads')} ${total} · ${sales} penjualan · ${recruit} rekrut`,
    potential: ({ n }) => `(${n} potensial)`,
    unitDashboard: kept('Unit Dashboard'),
    groupTree: kept('Group Tree'),
    memberPage: kept('Member page'),
  },
  v1: {
    perAb: `Per ${kept('AB')}`,
    abCount: ({ n }) => `${n} ${kept('AB')}`,
    months: ({ n }) => `${n} bulan`,
    you: 'Anda',
    people: ({ n }) => `${n} orang`,
    pctOf: ({ pct, target }) => `${pct} dari ${target}`,
    noData: 'belum diunggah',
    opens: ({ name }) => `${name}: buka angkanya`,
  },
};

export const kpmAnalyticsMessages = defineMessages({ en, id });
