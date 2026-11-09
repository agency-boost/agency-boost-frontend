import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The KPM Overview's own words** (P18.10-T4, the office reporting; `functional/kpm-overview.md`): the page's five
 * sections (`components/overview/*`), the words `lib/kpm-overview.ts` builds from the server's figures — the trend, the
 * not-logged list, the leaderboard, the recruitment pill, the year's production and its tooltip — and the directory's
 * *Last activity* (`daysAgoWords`).
 *
 * **English is the source** of the keys, the prototype's words as built (`KPM_Owner.html:929-1222`, `:4875-4889`); the
 * Indonesian is the approved glossary's (OD-237; §B.0's voice), with the words it lacked added to the glossary for
 * approval's §B.10. **Kept in both languages** (§A.4's Overview KPI labels): the title, each section's and each card's
 * name (*Team composition*, *Agents who logged activity this month*, *Coaching coverage* …) and the tiles' (*Expected to
 * close*, *Target*, *Last month*, *Pipeline now*), with the roles and the jargon. **Content stays as typed**: the
 * company's name, the office's code and branch, a ladder's rung and every member's name. **A figure is never a
 * message's**: a sum, a percentage and a month are written by the caller in the figures' language and passed in.
 *
 * @moved app/(tenant)/kpm/overview/page.tsx
 * @moved components/overview/
 * @moved lib/kpm-overview.ts
 */
const en = {
  /** The page and its five sections (`:929-1222`). */
  title: kept('Overview'),
  composition: kept('Team composition'),
  engagement: kept('Engagement'),
  /** The two periods its cards read (P18.9-T3 AC-6; ADR-0176 §3, UI-020). */
  engagementSub: 'This month · Last 7 days',
  coaching: kept('Coaching coverage'),
  recruitment: kept('Recruitment pipeline'),
  production: kept('Production — this year'),
  totalMembers: kept('Total members'),
  /**
   * ***Aktif bulan ini*** (P19.3-T2; ADR-0200 §2, D1; the glossary's *Active this month*): the first tile, production in
   * the upload, where OD-142's *Agents who logged activity this month* was. Its ⓘ says what it counts.
   */
  activeMonth: 'Active members this month',
  activeMonthTip: 'Members whose upload for this month shows APE or a policy, of today’s members',
  /** *"per 3 Nov 2026"* (D8): the day the month's rows were written. */
  asOf: ({ day }: { day: string }) => `as of ${day}`,
  /**
   * ***"7 hari: n belum ›"*** (UI-148; ADR-0200 §3): *Pengguna aktif* over the rolling 7 days — the glossary's *App
   * users* — and the pill that opens *Belum mencatat · 7 hari*. Its name for a screen reader says what it counts.
   */
  weekPill: ({ n }: { n: number }) => `7 days: ${n} not yet ›`,
  weekPillLabel: ({ n, of }: { n: number; of: number }) => `App users, 7 days: ${n} of ${of} have not logged. Open the list`,
  /** *Belum mencatat · 7 hari* (UI-148): the sheet below 1024px, the third card from it. */
  notLoggedTitle: 'Not logged · 7 days',
  notLoggedOf: ({ n, of }: { n: number; of: number }) => `${n} of ${of}`,
  /** A row's meta, *"Agent · ke Sari · 14 hari lalu"*: the leader, the reader's own row, and never having logged. */
  toLeader: ({ name }: { name: string }) => `under ${name}`,
  you: 'You',
  neverLogged: 'Never',
  coached7d: kept('Coached in last 7 days'),
  /** The tile's line under the figure (`kpm-overview-*` 2: *"11% · 30 hari: 9"*), where the 30 days' card was. */
  coached30dShort: ({ n }: { n: number }) => `30 days: ${n}`,
  coached30d: kept('Coached in last 30 days'),
  leaderboard: kept('AB coaching frequency'),
  viewFullRanking: 'view full ranking →',
  expectedToClose: kept('Expected to close'),
  target: kept('Target'),
  /** P19.3-T2 (T1's AC-3; ADR-0200 §5, D2): the upload's recruitment for last month, where it read *Last month*. */
  lastMonth: kept('Recruitment last month'),
  pipelineNow: kept('Pipeline now'),
  unitsTitle: kept('Units furthest behind target'),
  /** P19.3-T2 AC-1 (UI-148): a row opens that AB's Unit Dashboard, where it opened to the AABs inside it. */
  unitsSub: `Tap a row to open that AB’s ${kept('Unit Dashboard')}`,

  /** The states the prototype lacks (L-01). */
  loading: 'Loading the overview…',
  loadingList: 'Loading who has not logged…',
  tryAgain: 'Try again',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  noTarget: 'No target set',
  everybodyLogged: 'Everybody has logged in the last 7 days.',
  noLeaders: 'No AB leads a team yet.',
  /** Where an AB who leads nobody's rate would be (P18.9-T3 AC-5; ADR-0176 §2, the glossary's *No team*). */
  noTeam: 'No team',
  noUnits: 'No AB leads a unit yet.',
  showFewer: 'show fewer',
  /** A list's head (P19.2-T3 AC-5; UI-143: *"Semua ›"*, `kpm-overview-desktop` 2: *"Semua 5 ›"*): the whole ranking, in place. */
  allRows: ({ n }: { n: number }) => `All ${n} ›`,
  targetInvalid: 'Enter a whole number from 0.',
  targetNotSaved: 'The target was not saved.',
  /** The *Target*'s control and its toast (P18.9-T3 AC-7; ADR-0176 §4, OD-200, UI-020). */
  edit: 'Edit',
  editTarget: 'Edit target',
  targetSaved: 'Target saved ✓',
  /** The figure's own name when it is shown as a dash: a screen reader hears *no rate*, not *dash*. */
  noRate: 'No rate: nobody to count',

  /** *"+6 new this month"* (`:946`). */
  newThisMonth: ({ n }: { n: number }) => `+${n} new this month`,
  /** *"· 31 in team"* (`:1027`). */
  inTeam: ({ n }: { n: number }) => `· ${n} in team`,
  /** *"Showing 4 of 8 ABs · "* (`:1045`, `:1218`). */
  showing: ({ shown, of }: { shown: number; of: number }) => `Showing ${shown} of ${of} ABs · `,
  /** `updateRecruitStatus()`'s three sentences (`:4875-4889`). */
  recruitOnTrack: ({ expected, target }: { expected: number; target: number }) =>
    `On track to hit target (${expected} of ${target})`,
  recruitAhead: ({ diff, expected, target }: { diff: number; expected: number; target: number }) =>
    `${diff} ahead of target (${expected} of ${target})`,
  recruitShort: ({ diff, expected, target }: { diff: number; expected: number; target: number }) =>
    `${diff} short of target (${expected} of ${target})`,
  /** The year's figure's sub-line (`:1081`), the projection (`:1087`) and the bar's legend (`:1090`). */
  ofTarget: ({ target }: { target: string }) => `of ${target} target`,
  projected: ({ sum }: { sum: string }) => `Projected: ${sum}`,
  targetLegend: ({ sum }: { sum: string }) => `Target: ${sum}`,
  /** A unit's line (`:1107`, `:1121`): an agency's pair over its *unit target*, and what stands in for a figure missing. */
  unitTarget: ({ figures }: { figures: string }) => `${figures} unit target`,
  missingGoal: ({ figure }: { figure: string }) => `${figure} · No goal set`,
  notUploadedOf: ({ target }: { target: string }) => `Not uploaded yet / ${target}`,
  /**
   * **The production tile's next step** (P19.3-T2 AC-7, AC-8; UI-150, UI-157): one pill per month still open, opening
   * Data upload on it — *"Okt belum diunggah ›"*, or *"Unggah Nov 2026 ›"* while nothing was ever uploaded.
   */
  missingPill: ({ month }: { month: string }) => `${month} not uploaded ›`,
  uploadPill: ({ month }: { month: string }) => `Upload ${month} ›`,
  /** *"Pengaturan KPM ›"* (UI-148, Overview R1b): always on the Overview, with what waits for the Owner. */
  settingsTitle: `${kept('KPM')} settings`,
  settingsCount: ({ n }: { n: number }) => `${n} settings`,
  productsAwaiting: ({ n }: { n: number }) => `${n} product${n === 1 ? '' : 's'} waiting for you`,
  checklistDraft: ({ version }: { version: number }) => `checklist draft version ${version}`,
  /** The list's amber pills (`kpm-overview-mobile` 4: *"2 menunggu"*, *"Draf versi 2"*), and its one sub-line. */
  waitingPill: ({ n }: { n: number }) => `${n} waiting`,
  draftPill: ({ version }: { version: number }) => `Draft version ${version}`,
  andRatios: `and ${kept('Ratio benchmarks')}`,
  /** ***Siapkan KPM*** (UI-149; the glossary's *KPM setup card*): the card, its count, its eighth cell. */
  setupTitle: `Set up your ${kept('KPM')}`,
  setupDone: ({ n }: { n: number }) => `${n} of 7 done`,
  stepDone: 'done',
  stepOpen: 'to do',
  importStep: 'Import members',
  uploadStep: ({ month }: { month: string | null }) => (month ? `Upload production ${month}` : 'Upload production'),
  targetStep: 'Set the recruitment target',
  branchEmpty: 'Address and phone not filled in yet',
  activityMeta: 'Check the activities and ratio benchmarks',
  checklistMeta: 'Check the 90-day checklist for new agents',
  productsMeta: 'Choose the products agents sell',
  onlyYou: 'Only 1 member so far: you',
  members: ({ n }: { n: number }) => `${n} member${n === 1 ? '' : 's'}`,
  openUntil: ({ day }: { day: string }) => `Open until ${day}`,
  targetIs: ({ n }: { n: number }) => `Target ${n}`,
  allSettings: 'All settings',
  allSettingsMeta: ({ n }: { n: number }) => `${n} pages`,
  /** *Atur target rekrutmen*'s sheet (UI-148: *"Recruitment pipeline → the target sheet"*), and its save. */
  targetSheetTitle: 'Recruitment target this month',
  save: 'Save',
  saved: 'Saved',
  /**
   * ***Sudah sesuai*** on the four settings pages (P19.3-T2 AC-5; UI-149; the glossary's *Reviewed*): the page is right as
   * it is — its step of the setup card ticks, and nothing of the page changes.
   */
  reviewedAction: 'Mark as reviewed',
  reviewedDone: 'Reviewed ✓',
  reviewedNote: 'Its step on the Overview is ticked. Nothing on this page changed.',
  /** The year's total's tooltip (D-figures): the months it leaves out, listed, and the members with no goal. */
  leftOutMonths: ({ months }: { months: string }) => `Not uploaded yet for ${months}, so not counted in this total.`,
  leftOutMembers: ({ n }: { n: number }) =>
    `${n} ${n === 1 ? 'member has' : 'members have'} no goal set, so the target leaves them out.`,
  /** `a`, `a and b`, `a, b and c`. */
  and: 'and',
  /** The directory's *Last activity* and *Last coached* (`:1834`, `:4490-4519`). */
  never: 'Never',
  today: 'Today',
  daysAgo: ({ days }: { days: number }) => `${days} day${days === 1 ? '' : 's'} ago`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Overview'),
  composition: kept('Team composition'),
  engagement: kept('Engagement'),
  engagementSub: 'Bulan ini · 7 hari terakhir',
  coaching: kept('Coaching coverage'),
  recruitment: kept('Recruitment pipeline'),
  production: kept('Production — this year'),
  totalMembers: kept('Total members'),
  activeMonth: 'Aktif bulan ini',
  activeMonthTip: 'Anggota yang unggahan bulan ini mencatat APE atau polis, dari anggota saat ini',
  asOf: ({ day }) => `per ${day}`,
  weekPill: ({ n }) => `7 hari: ${n} belum ›`,
  weekPillLabel: ({ n, of }) => `Pengguna aktif, 7 hari: ${n} dari ${of} belum mencatat. Buka daftarnya`,
  notLoggedTitle: 'Belum mencatat · 7 hari',
  notLoggedOf: ({ n, of }) => `${n} dari ${of}`,
  toLeader: ({ name }) => `ke ${name}`,
  you: 'Anda',
  neverLogged: 'Belum pernah',
  coached7d: kept('Coached in last 7 days'),
  coached30dShort: ({ n }) => `30 hari: ${n}`,
  coached30d: kept('Coached in last 30 days'),
  leaderboard: kept('AB coaching frequency'),
  viewFullRanking: 'lihat peringkat lengkap →',
  expectedToClose: kept('Expected to close'),
  target: kept('Target'),
  lastMonth: kept('Recruitment last month'),
  pipelineNow: kept('Pipeline now'),
  unitsTitle: kept('Units furthest behind target'),
  unitsSub: `Ketuk baris untuk membuka ${kept('Unit Dashboard')} AB itu`,

  loading: `Memuat ${kept('Overview')}…`,
  loadingList: 'Memuat siapa yang belum mencatat…',
  tryAgain: 'Coba lagi',
  notUploaded: 'Belum diunggah',
  noGoal: `${kept('Goal')} belum diatur`,
  noTarget: `${kept('Target')} belum diatur`,
  everybodyLogged: 'Semua sudah mencatat dalam 7 hari terakhir.',
  noLeaders: `Belum ada ${kept('AB')} yang memimpin tim.`,
  noTeam: 'Tanpa tim',
  noUnits: `Belum ada ${kept('AB')} yang memimpin ${kept('unit')}.`,
  showFewer: 'tampilkan lebih sedikit',
  allRows: ({ n }) => `Semua ${n} ›`,
  targetInvalid: 'Masukkan bilangan bulat mulai dari 0.',
  targetNotSaved: `${kept('Target')} tidak tersimpan.`,
  edit: 'Ubah',
  editTarget: `Ubah ${kept('target')}`,
  targetSaved: `${kept('Target')} tersimpan ✓`,
  noRate: 'Tanpa persentase: tidak ada yang dihitung',

  newThisMonth: ({ n }) => `+${n} baru bulan ini`,
  inTeam: ({ n }) => `· ${n} dalam tim`,
  showing: ({ shown, of }) => `Menampilkan ${shown} dari ${of} ${kept('AB')} · `,
  recruitOnTrack: ({ expected, target }) => `Sesuai ${kept('target')} (${expected} dari ${target})`,
  recruitAhead: ({ diff, expected, target }) => `Lebih ${diff} dari ${kept('target')} (${expected} dari ${target})`,
  recruitShort: ({ diff, expected, target }) => `Kurang ${diff} dari ${kept('target')} (${expected} dari ${target})`,
  ofTarget: ({ target }) => `dari ${kept('target')} ${target}`,
  projected: ({ sum }) => `Proyeksi: ${sum}`,
  targetLegend: ({ sum }) => `${kept('Target')}: ${sum}`,
  unitTarget: ({ figures }) => `${figures} ${kept('target')} ${kept('unit')}`,
  missingGoal: ({ figure }) => `${figure} · ${kept('Goal')} belum diatur`,
  notUploadedOf: ({ target }) => `Belum diunggah / ${target}`,
  missingPill: ({ month }) => `${month} belum diunggah ›`,
  uploadPill: ({ month }) => `Unggah ${month} ›`,
  settingsTitle: `Pengaturan ${kept('KPM')}`,
  settingsCount: ({ n }) => `${n} pengaturan`,
  productsAwaiting: ({ n }) => `${n} produk menunggu Anda`,
  checklistDraft: ({ version }) => `checklist draf versi ${version}`,
  waitingPill: ({ n }) => `${n} menunggu`,
  draftPill: ({ version }) => `Draf versi ${version}`,
  andRatios: `dan ${kept('Ratio benchmarks')}`,
  setupTitle: `Siapkan ${kept('KPM')}`,
  setupDone: ({ n }) => `${n} dari 7 selesai`,
  stepDone: 'selesai',
  stepOpen: 'belum',
  importStep: 'Impor anggota',
  uploadStep: ({ month }) => (month ? `Unggah produksi ${month}` : 'Unggah produksi'),
  targetStep: 'Atur target rekrutmen',
  branchEmpty: 'Alamat dan telepon belum diisi',
  activityMeta: 'Cek aktivitas dan ratio benchmarks',
  checklistMeta: 'Cek checklist 90 hari agen baru',
  productsMeta: 'Pilih produk yang dijual agen',
  onlyYou: 'Baru 1 anggota: Anda',
  members: ({ n }) => `${n} anggota`,
  openUntil: ({ day }) => `Terbuka sampai ${day}`,
  targetIs: ({ n }) => `${kept('Target')} ${n}`,
  allSettings: 'Semua pengaturan',
  allSettingsMeta: ({ n }) => `${n} halaman`,
  targetSheetTitle: `${kept('Target')} rekrutmen bulan ini`,
  save: 'Simpan',
  saved: 'Tersimpan',
  reviewedAction: 'Sudah sesuai',
  reviewedDone: 'Sudah sesuai ✓',
  reviewedNote: `Langkahnya di ${kept('Overview')} sudah dicentang. Tidak ada yang berubah di halaman ini.`,
  leftOutMonths: ({ months }) => `Belum diunggah untuk ${months}, jadi tidak dihitung dalam total ini.`,
  leftOutMembers: ({ n }) => `${n} anggota belum mengatur ${kept('goal')}, jadi ${kept('target')} tidak menghitung mereka.`,
  and: 'dan',
  never: 'Tidak pernah',
  today: 'Hari ini',
  daysAgo: ({ days }) => `${days} hari lalu`,
};

export const kpmOverviewMessages = defineMessages({ en, id });
