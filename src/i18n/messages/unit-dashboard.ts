import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { RosterStatus } from '@/lib/coaching';

/**
 * **The Unit Dashboard's words** (P18.98-T4, coaching and unit; `functional/unit-dashboard.md`, *The module's own
 * strings*): the period switch, the four tiles, *Your team's roster* as a table and as a phone's cards — its groups,
 * totals, marks, pills and drills — a row's detail, *Update production*, and the states the prototype lacks; with the
 * sentences `lib/unit-dashboard.ts` builds from the server's figures.
 *
 * **English is the source** of the keys: the prototype's strings verbatim (`Overall.html:3888-3949`, `:6906-7622`;
 * D-copy) and the module's own (L-01), **none of OD-39's six words** in either language — no *office*, no *KPM* — but the
 * one sentence after *+ Add agent* that says who approves a transfer. The Indonesian is the approved glossary's (OD-237;
 * §B.0), reusing the words the office's screens settled — *agen langsung*, *Unit {name}*, *Belum diunggah*, *dari target
 * {sum}*, *jadi tidak dihitung dalam total ini* — with what it lacked in the glossary for approval's §B.10: *Roster tim
 * Anda*, *prorata*, *aktivitas goal*, *Perbarui produksi*'s dialog.
 *
 * **Kept in both languages** (§A): the title, the tiles' and the detail's names (*Your team*, *Direct Group production*,
 * *On pace to be active (Group)*, *Potential Recruits (Group)*, *Gap*, *Activity breakdown*, *Ratios*, *Sales-only* —
 * §A.4), *AAB units*, the cascade's three stages, *New hire*, *Monthly Active Agent*, *Leads*, *1:1*, *goal*, *target*,
 * *unit*, *closing*, *case*, the roles. **Content stays as typed** (ADR-0179 §5): names, a follow-up's words, a ratio's
 * and a section's label, a campaign's title, the server's MDRT sentence. **A figure is never a message's**: a sum, a
 * percentage, a month or a day is written by the caller in the figures' language and handed in.
 *
 * @moved lib/unit-dashboard.ts
 * @moved components/unit/
 * @moved app/(agent)/unit/
 */
const en = {
  /** *Last 7 days · This month · This year* (`Overall.html:3895-3897`), a group named *Period*. */
  periods: { '7d': 'Last 7 days', month: 'This month', year: 'This year' },
  period: 'Period',
  /** The strings `Overall.html` draws, verbatim (D-copy). */
  prototype: {
    title: kept('Unit Dashboard'),
    roster: 'Your team’s roster',
    updateProduction: 'Update production',
    yourTeam: kept('Your team'),
    directGroupProduction: kept('Direct Group production'),
    /** The prototype's *Potential Monthly Active Agents (Group)*, in plain words since P18.95-T9 AC-4. */
    potentialActiveTile: kept('On pace to be active (Group)'),
    potentialRecruitsTile: kept('Potential Recruits (Group)'),
    yourUnitRecruits: 'Your unit',
    yourAabs: 'Your AABs',
    aabUnits: kept('AAB units'),
    yourUnitGroup: 'Your Unit',
    yourUnitTotal: 'Your Unit — Total',
    /** A unit head's own row, apart from the unit's total (`:7384`). */
    personal: 'Personal',
    /** The client's word, in *Personal*'s chip (UI-003). */
    newHire: kept('New hire'),
    noOneOnOne: 'No 1:1 yet',
    statusInfo: 'How is status decided?',
    /** The *Status* header's tooltip (`:3929-3935`), its list kept as lines. */
    statusRules: [
      'Evaluated for the current calendar month, regardless of the period toggle above.',
      '1. Not projected to submit ≥1 policy this month? → Needs attention, full stop.',
      '2. Will qualify. Projected pace ≥90% of target? → On track.',
      '3. Will qualify, but pace under 90%? → Watch closely.',
    ].join('\n'),
    gap: kept('Gap'),
    activityBreakdown: kept('Activity breakdown'),
    ratios: kept('Ratios'),
    salesOnly: kept('Sales-only'),
    followUp: 'Flagged follow-up (system-detected)',
    dialogHint: 'Enter the latest figures from the company report — month and year are updated independently.',
    dialogName: 'Name',
    /** `unit` the money's mark in the figures' language: *Rp*, *IDR* — what the boxes beneath are prefixed with. */
    dialogMonth: ({ unit }: { unit: string }) => `Month achieved (${unit})`,
    dialogYear: ({ unit }: { unit: string }) => `Year achieved (${unit})`,
    yourDirectAgents: 'Your direct agents',
    close: 'Close',
    cancel: 'Cancel',
    saveAll: 'Save all',
  },
  /** The activity breakdown's three, in the cascade's words (ADR-0160 §4), names (§A.6). */
  activity: { leads: kept('Set appointment'), appointments: kept('Sales meeting'), closings: kept('Submission polis') },
  /** The pill's tooltip per status (`:7094-7098`), and ADR-0080's state. */
  statusTooltip: {
    on_track: 'Pacing to qualify as a Monthly Active Agent, at or above 90% of expected goal pace.',
    watch_closely: 'Still pacing to qualify as a Monthly Active Agent, but under 90% of expected goal pace — worth a check-in.',
    needs_attention: 'Not projected to submit a policy this month — will not qualify as a Monthly Active Agent.',
    no_goal_set: 'No goal saved for this year, so there is no pace to measure this month against.',
  } satisfies Record<RosterStatus, string>,
  /** The roster's headings (`:3910-3936`), and a phone card's labels. */
  columns: { name: 'Name', goal: 'Goal progress', leads: kept('Leads'), activity: 'Activity', last: 'Last 1:1', status: 'Status' },
  /** The module's own strings — the states the prototype lacks, the marks it does not draw. */
  own: {
    loading: 'Loading your team’s roster…',
    tryAgain: 'Try again',
    /** The ⌄ column's heading, blank on screen (OD-139). */
    details: 'Details',
    notUploaded: 'Not uploaded yet',
    noGoal: 'No goal set',
    /** A month whose target was made before it began (ADR-0047). */
    targetMade: 'Year’s target made',
    targetMadeNote: 'The year’s target was made before this month began — this month needs nothing more.',
    thisMonth: 'this month',
    /** A figure standing without a target (P18.95-T3 AC-2): `sum` written by the caller. */
    produced: ({ sum }: { sum: string }) => `produced ${sum}`,
    proRated: 'pro-rated',
    /** ADR-0165 §2: *goal activities*, never *touches*. */
    goalActivities: ({ n }: { n: number }): string => (n === 1 ? 'goal activity' : 'goal activities'),
    activityInfo: 'What counts as a goal activity?',
    activityRule: 'The activities a goal is built from: Set appointment, Sales meeting, Submission polis. Not every activity logged.',
    ratiosEmpty: 'There are no ratios for this role yet.',
    loadingRatios: 'Working out the ratios…',
    emptyTitle: 'Nobody is in your unit yet.',
    emptyLine: 'This page lists the people you lead, once somebody joins you. Your own figures are on these screens:',
    notFoundTitle: 'This isn’t a unit you can open.',
    notFoundLine: 'They may lead nobody yet, or sit outside your team, or the address may be mistyped.',
    backToYours: 'Your Unit Dashboard',
    saving: 'Saving…',
    /** What each row's ✓ is called, for a screen reader (P18.95-T9 AC-4). */
    maaMark: kept('Potential Monthly Active Agent'),
    /** What the *New hire* tag adds for a screen reader (P18.96-T5 AC-3). */
    newHireMark: ', no first sale yet',
  },
  /** A unit below the reader (P15-T4 AC-2): titled for its head, so the reader knows whose it is. */
  titleOf: ({ name }: { name: string }) => `${name}’s Unit Dashboard`,
  /** A group and a total named for a unit's head (D-groups). */
  unitOf: ({ name }: { name: string }) => `${name}’s Unit`,
  unitTotalOf: ({ name }: { name: string }) => `${name}’s Unit — Total`,
  /** The tiles and the dialog name a unit below the reader for its head (data honesty). */
  unitLower: ({ name }: { name: string }) => `${name}’s unit`,
  aabsOf: ({ name }: { name: string }) => `${name}’s AABs`,
  directAgentsOf: ({ name }: { name: string }) => `${name}’s direct agents`,
  /** The reader's own row (`:6917`, *You (Jordan)*). */
  you: ({ first }: { first: string }) => `You (${first})`,
  /** The ⌄'s name (OD-139): `name` the person's, `null` for the reader's own row. */
  viewDetails: ({ name }: { name: string | null }) => `View details for ${name ?? 'you'}`,
  /** A phone card's *by {coach}*, under *Last 1:1*. */
  by: ({ name }: { name: string }) => `by ${name}`,
  /** *agents* where the prototype counts people (`:7246`, `:7554`), singular at one. */
  agents: ({ n }: { n: number }) => `${n} ${n === 1 ? 'agent' : 'agents'}`,
  /** *On pace to be active*'s tile: `count` of `of`. */
  agentsOf: ({ count, of }: { count: number; of: number }) => `${count} / ${of} agents`,
  /** *Potential Recruits*'s rows (`:7266-7270`). */
  candidates: ({ n }: { n: number }) => `${n} ${n === 1 ? 'candidate' : 'candidates'}`,
  /** *Your team*'s line (P18.95-T7 AC-1, row 19): the head's own unit, then every AAB unit with everybody in it. */
  teamLine: ({ direct, under }: { direct: number; under: number }) => `${direct} direct · ${under} under AABs`,
  /** The toast after *Save all* (`:7554`), counting only the rows that changed. */
  productionToast: ({ n }: { n: number }) => `Production updated for ${n} ${n === 1 ? 'agent' : 'agents'}.`,
  /** *+ Add agent*'s toasts, after the shared confirmation (P18.96-T3). */
  addedDetail: ({ name }: { name: string }) => `${name} is in the unit now.`,
  transferDetail: ({ name }: { name: string }) => `${name} moves when the office approves it.`,
  /** A total's count of members on pace (P18.95-T9 AC-4; UI-028). */
  onPace: ({ count, of }: { count: number; of: number }) => `On pace to be active: ${count}/${of}`,
  /** The goal line and its sub-line (`:7364-7367`): `pct` and `sum` written by the caller. */
  goal: {
    over: ({ pct, sum }: { pct: string; sum: string }) => `${pct} · +${sum} over`,
    short: ({ pct, sum }: { pct: string; sum: string }) => `${pct} · ${sum} short`,
    /** The Summary's own phrase beside its figure, under a missing one. */
    ofTarget: ({ sum }: { sum: string }) => `of ${sum} target`,
    /** The pair's joiner: *Rp 65,6 jt of 80 jt* (UI-030). */
    of: 'of',
  },
  /** The *Leads* column (`:7399`, `:7371-7373`, `:7443-7445`). */
  leads: {
    sales: 'Sales:',
    recruit: 'Recruit:',
    closing: ({ n }: { n: number }) => `· ${n} closing`,
    nominated: ({ n }: { n: number }) => `· ${n} nominated`,
    potentialRecruits: ({ n }: { n: number }): string => (n === 1 ? 'potential recruit' : 'potential recruits'),
  },
  /** *"{logged} / {target} goal activities"* (`:7404-7405`): *pro-rated* under *Last 7 days* (metrics §B.3). */
  touchesOf: ({ target, proRated }: { target: number; proRated: boolean }) =>
    `/ ${target}${proRated ? ' pro-rated' : ''} ${target === 1 ? 'goal activity' : 'goal activities'}`,
  /** The breakdown's count against its target. */
  countOf: ({ logged, target, proRated }: { logged: number; target: number; proRated: boolean }) =>
    `${logged}/${target}${proRated ? ' pro-rated' : ''}`,
  /** *Gap*'s value and note (`:7326-7328`). */
  gap: {
    remaining: ({ sum }: { sum: string }) => `${sum} remaining`,
    policies: ({ n, sum }: { n: number; sum: string }) =>
      `≈ ${n} polic${n === 1 ? 'y' : 'ies'} needed at their avg case size of ${sum}.`,
  },
  /**
   * The provenance marker (T3 AC-1): the Summary's words in the coaching voice, then who corrected it and when. `month`
   * and `day` written by the caller.
   */
  provenance: {
    yours: 'Your own figure, entered in Goal Settings',
    theirs: 'Their own figure, entered in Goal Settings',
    corrected: ({ month, span, by, day }: { month: string | null; span: 'month' | 'year'; by: string | null; day: string | null }) =>
      `Corrected after the production upload${month ? (span === 'year' ? `, year to date as of ${month}` : `, ${month}`) : ''}`
      + `${by ? `, by ${by}${day ? ` on ${day}` : ''}` : ''}`,
  },
  /** A total's marks (D-figures; ADR-0172 §2): `who` the names, joined, or `null` to count them. */
  marks: {
    missing: ({ who, n }: { who: string | null; n: number }) =>
      `Not uploaded yet for ${who ?? `${n} ${n === 1 ? 'person' : 'people'}`}, so not counted in this total.`,
    newHires: ({ who, n }: { who: string | null; n: number }) => (who === null
      ? `No first sale yet for ${n} ${n === 1 ? 'new hire' : 'new hires'}, so not counted in this total.`
      : `No first sale yet for ${who}, ${n === 1 ? 'a new hire' : 'new hires'}, so not counted in this total.`),
  },
  /** *Update production* held, and who reopens the month: `month` written by the caller. */
  locked: ({ month }: { month: string }) => `Production for ${month} is locked. The Owner or Admin can reopen it.`,
  /** *Overdue {n}d* (`:7292`). */
  overdue: ({ n }: { n: number }) => `Overdue ${n}d`,
};

const id: MessagesOf<typeof en> = {
  periods: { '7d': '7 hari terakhir', month: 'Bulan ini', year: 'Tahun ini' },
  period: 'Periode',
  prototype: {
    title: kept('Unit Dashboard'),
    roster: 'Roster tim Anda',
    updateProduction: 'Perbarui produksi',
    yourTeam: kept('Your team'),
    directGroupProduction: kept('Direct Group production'),
    potentialActiveTile: kept('On pace to be active (Group)'),
    potentialRecruitsTile: kept('Potential Recruits (Group)'),
    yourUnitRecruits: `${kept('Unit')} Anda`,
    yourAabs: `${kept('AAB')} Anda`,
    aabUnits: kept('AAB units'),
    yourUnitGroup: `${kept('Unit')} Anda`,
    yourUnitTotal: `${kept('Unit')} Anda — Total`,
    personal: 'Pribadi',
    newHire: kept('New hire'),
    noOneOnOne: `Belum ada ${kept('1:1')}`,
    statusInfo: 'Bagaimana status ditentukan?',
    statusRules: [
      'Dinilai untuk bulan kalender berjalan, apa pun periode yang dipilih di atas.',
      '1. Tidak diproyeksikan mengajukan ≥1 polis bulan ini? → Perlu perhatian, titik.',
      `2. Akan memenuhi syarat. Proyeksi laju ≥90% dari ${kept('target')}? → Sesuai ${kept('target')}.`,
      '3. Akan memenuhi syarat, tetapi laju di bawah 90%? → Perlu dipantau.',
    ].join('\n'),
    gap: kept('Gap'),
    activityBreakdown: kept('Activity breakdown'),
    ratios: kept('Ratios'),
    salesOnly: kept('Sales-only'),
    followUp: `${kept('Follow-up')} yang ditandai (terdeteksi sistem)`,
    dialogHint: 'Masukkan angka terbaru dari laporan perusahaan — bulan dan tahun diperbarui secara terpisah.',
    dialogName: 'Nama',
    dialogMonth: ({ unit }) => `Pencapaian bulan (${unit})`,
    dialogYear: ({ unit }) => `Pencapaian tahun (${unit})`,
    yourDirectAgents: 'Agen langsung Anda',
    close: 'Tutup',
    cancel: 'Batal',
    saveAll: 'Simpan semua',
  },
  activity: { leads: kept('Set appointment'), appointments: kept('Sales meeting'), closings: kept('Submission polis') },
  statusTooltip: {
    on_track: `Berada di jalur untuk memenuhi syarat sebagai ${kept('Monthly Active Agent')}, pada atau di atas 90% dari laju ${kept('goal')} yang diharapkan.`,
    watch_closely: `Masih di jalur untuk memenuhi syarat sebagai ${kept('Monthly Active Agent')}, tetapi di bawah 90% dari laju ${kept('goal')} yang diharapkan — perlu dicek.`,
    needs_attention: `Tidak diproyeksikan mengajukan polis bulan ini — tidak akan memenuhi syarat sebagai ${kept('Monthly Active Agent')}.`,
    no_goal_set: `Belum ada ${kept('goal')} yang disimpan untuk tahun ini, jadi tidak ada laju untuk mengukur bulan ini.`,
  },
  columns: { name: 'Nama', goal: `Progres ${kept('goal')}`, leads: kept('Leads'), activity: 'Aktivitas', last: `${kept('1:1')} terakhir`, status: 'Status' },
  own: {
    loading: 'Memuat roster tim Anda…',
    tryAgain: 'Coba lagi',
    details: 'Detail',
    notUploaded: 'Belum diunggah',
    noGoal: `${kept('Goal')} belum diatur`,
    targetMade: `${kept('Target')} tahun ini tercapai`,
    targetMadeNote: `${kept('Target')} tahun ini sudah tercapai sebelum bulan ini dimulai — bulan ini tidak perlu apa-apa lagi.`,
    thisMonth: 'bulan ini',
    produced: ({ sum }) => `produksi ${sum}`,
    proRated: 'prorata',
    // One form for one and many (§B.0 rule 8).
    goalActivities: () => `aktivitas ${kept('goal')}`,
    activityInfo: `Apa yang dihitung sebagai aktivitas ${kept('goal')}?`,
    activityRule: `Aktivitas yang menjadi dasar ${kept('goal')}: ${kept('Set appointment')}, ${kept('Sales meeting')}, ${kept('Submission polis')}. Bukan setiap aktivitas yang dicatat.`,
    ratiosEmpty: `Belum ada ${kept('ratio')} untuk peran ini.`,
    loadingRatios: `Menghitung ${kept('ratio')}…`,
    emptyTitle: `Belum ada siapa pun di ${kept('unit')} Anda.`,
    emptyLine: 'Halaman ini menampilkan orang-orang yang Anda pimpin, setelah ada yang bergabung dengan Anda. Angka Anda sendiri ada di layar berikut:',
    notFoundTitle: `Ini bukan ${kept('unit')} yang bisa Anda buka.`,
    notFoundLine: 'Mungkin dia belum memimpin siapa pun, berada di luar tim Anda, atau alamatnya salah ketik.',
    backToYours: `${kept('Unit Dashboard')} Anda`,
    saving: 'Menyimpan…',
    maaMark: kept('Potential Monthly Active Agent'),
    newHireMark: ', belum ada penjualan pertama',
  },
  titleOf: ({ name }) => `${kept('Unit Dashboard')} ${name}`,
  unitOf: ({ name }) => `${kept('Unit')} ${name}`,
  unitTotalOf: ({ name }) => `${kept('Unit')} ${name} — Total`,
  unitLower: ({ name }) => `${kept('Unit')} ${name}`,
  aabsOf: ({ name }) => `${kept('AAB')} ${name}`,
  directAgentsOf: ({ name }) => `Agen langsung ${name}`,
  you: ({ first }) => `Anda (${first})`,
  viewDetails: ({ name }) => (name === null ? 'Lihat detail Anda' : `Lihat detail ${name}`),
  by: ({ name }) => `oleh ${name}`,
  // One form for one and many (§B.0 rule 8): *1 agent*, *12 agent* (§B.1 *+ Tambah agent*).
  agents: ({ n }) => `${n} agent`,
  agentsOf: ({ count, of }) => `${count} / ${of} agent`,
  candidates: ({ n }) => `${n} kandidat`,
  teamLine: ({ direct, under }) => `${direct} langsung · ${under} di bawah ${kept('AAB')}`,
  productionToast: ({ n }) => `Produksi diperbarui untuk ${n} agent.`,
  addedDetail: ({ name }) => `${name} sekarang ada di ${kept('unit')}.`,
  transferDetail: ({ name }) => `${name} pindah setelah ${kept('KPM')} menyetujuinya.`,
  onPace: ({ count, of }) => `${kept('On pace to be active')}: ${count}/${of}`,
  goal: {
    over: ({ pct, sum }) => `${pct} · lebih ${sum}`,
    short: ({ pct, sum }) => `${pct} · kurang ${sum}`,
    ofTarget: ({ sum }) => `dari ${kept('target')} ${sum}`,
    of: 'dari',
  },
  leads: {
    sales: 'Penjualan:',
    recruit: 'Rekrut:',
    closing: ({ n }) => `· ${n} ${kept('closing')}`,
    nominated: ({ n }) => `· ${n} dinominasikan`,
    potentialRecruits: () => 'rekrut potensial',
  },
  touchesOf: ({ target, proRated }) => `/ ${target}${proRated ? ' prorata' : ''} aktivitas ${kept('goal')}`,
  countOf: ({ logged, target, proRated }) => `${logged}/${target}${proRated ? ' prorata' : ''}`,
  gap: {
    remaining: ({ sum }) => `Sisa ${sum}`,
    policies: ({ n, sum }) => `≈ perlu ${n} polis lagi, dengan rata-rata ukuran ${kept('case')}-nya ${sum}.`,
  },
  provenance: {
    yours: `Angka Anda sendiri, diisi di ${kept('Goal Settings')}`,
    theirs: `Angkanya sendiri, diisi di ${kept('Goal Settings')}`,
    corrected: ({ month, span, by, day }) =>
      `Dikoreksi setelah unggahan produksi${month ? (span === 'year' ? `, sejak awal tahun per ${month}` : `, ${month}`) : ''}`
      + `${by ? `, oleh ${by}${day ? ` pada ${day}` : ''}` : ''}`,
  },
  marks: {
    missing: ({ who, n }) => `Belum diunggah untuk ${who ?? `${n} orang`}, jadi tidak dihitung dalam total ini.`,
    newHires: ({ who, n }) => (who === null
      ? `Belum ada penjualan pertama untuk ${n} ${kept('new hire')}, jadi tidak dihitung dalam total ini.`
      : `Belum ada penjualan pertama untuk ${who}, ${kept('new hire')}, jadi tidak dihitung dalam total ini.`),
  },
  locked: ({ month }) => `Produksi untuk ${month} dikunci. ${kept('Owner')} atau ${kept('Admin')} dapat membukanya kembali.`,
  overdue: ({ n }) => `Terlambat ${n} hari`,
};

export const unitDashboardMessages = defineMessages({ en, id });
