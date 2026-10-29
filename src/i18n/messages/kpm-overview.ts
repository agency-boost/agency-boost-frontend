import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The KPM Overview's own words** (P18.98-T4, the office reporting; `functional/kpm-overview.md`): the page's five
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
  /** The two periods its cards read (P18.97-T3 AC-6; ADR-0176 §3, UI-020). */
  engagementSub: 'This month · Last 7 days',
  coaching: kept('Coaching coverage'),
  recruitment: kept('Recruitment pipeline'),
  production: kept('Production — this year'),
  totalMembers: kept('Total members'),
  /** OD-142 (ADR-0127 onward): the title says what the figure counts; the sub-line is the prototype's. */
  loggedMonthTitle: kept('Agents who logged activity this month'),
  loggedMonthDesc: 'Logged at least one activity this month',
  weekTitle: kept('Activity logging — this week'),
  weekDesc: "Who has and hasn't logged in the last 7 days",
  /** After the week's figure: *"25 logged · 6 not logged"*. */
  loggedNotLogged: ({ notLogged }: { notLogged: number }) => `logged · ${notLogged} not logged`,
  reveal: "View who hasn't logged →",
  neverLogged: 'Never logged',
  coached7d: kept('Coached in last 7 days'),
  coached30d: kept('Coached in last 30 days'),
  leaderboard: kept('AB coaching frequency'),
  viewFullRanking: 'view full ranking →',
  expectedToClose: kept('Expected to close'),
  target: kept('Target'),
  lastMonth: kept('Last month'),
  pipelineNow: kept('Pipeline now'),
  unitsTitle: kept('Units furthest behind target'),
  unitsSub: 'Tap a row to see the AABs inside that unit',
  noAab: 'No AAB in this unit yet',

  /** The states the prototype lacks (L-01). */
  loading: 'Loading the overview…',
  loadingList: 'Loading who has not logged…',
  tryAgain: 'Try again',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  noTarget: 'No target set',
  everybodyLogged: 'Everybody has logged in the last 7 days.',
  noLeaders: 'No AB leads a team yet.',
  /** Where an AB who leads nobody's rate would be (P18.97-T3 AC-5; ADR-0176 §2, the glossary's *No team*). */
  noTeam: 'No team',
  noUnits: 'No AB leads a unit yet.',
  showFewer: 'show fewer',
  targetInvalid: 'Enter a whole number from 0.',
  targetNotSaved: 'The target was not saved.',
  /** The *Target*'s control and its toast (P18.97-T3 AC-7; ADR-0176 §4, OD-200, UI-020). */
  edit: 'Edit',
  editTarget: 'Edit target',
  targetSaved: 'Target saved ✓',
  /** The figure's own name when it is shown as a dash: a screen reader hears *no rate*, not *dash*. */
  noRate: 'No rate: nobody to count',

  /** *"+6 new this month"* (`:946`). */
  newThisMonth: ({ n }: { n: number }) => `+${n} new this month`,
  /** OD-142's trend, against last month to the same day (`:977`); the counts are the caller's. */
  trendSame: ({ now }: { now: number }) => `Same as last month (${now})`,
  trendUp: ({ last }: { last: number }) => `Up from ${last} last month`,
  trendDown: ({ last }: { last: number }) => `Down from ${last} last month`,
  /** *"Last logged 9 days ago"* (`:991-999`). */
  lastLogged: ({ days }: { days: number }) => `Last logged ${days} day${days === 1 ? '' : 's'} ago`,
  /** *"+ 66 more — full list on the People screen"* (`:1001`). */
  more: ({ n }: { n: number }) => `+ ${n} more — full list on the People screen`,
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
  loggedMonthTitle: kept('Agents who logged activity this month'),
  loggedMonthDesc: 'Mencatat setidaknya satu aktivitas bulan ini',
  weekTitle: kept('Activity logging — this week'),
  weekDesc: 'Siapa yang sudah dan belum mencatat dalam 7 hari terakhir',
  loggedNotLogged: ({ notLogged }) => `sudah mencatat · ${notLogged} belum mencatat`,
  reveal: 'Lihat siapa yang belum mencatat →',
  neverLogged: 'Belum pernah mencatat',
  coached7d: kept('Coached in last 7 days'),
  coached30d: kept('Coached in last 30 days'),
  leaderboard: kept('AB coaching frequency'),
  viewFullRanking: 'lihat peringkat lengkap →',
  expectedToClose: kept('Expected to close'),
  target: kept('Target'),
  lastMonth: kept('Last month'),
  pipelineNow: kept('Pipeline now'),
  unitsTitle: kept('Units furthest behind target'),
  unitsSub: `Ketuk baris untuk melihat ${kept('AAB')} di dalam ${kept('unit')} itu`,
  noAab: `Belum ada ${kept('AAB')} di ${kept('unit')} ini`,

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
  targetInvalid: 'Masukkan bilangan bulat mulai dari 0.',
  targetNotSaved: `${kept('Target')} tidak tersimpan.`,
  edit: 'Ubah',
  editTarget: `Ubah ${kept('target')}`,
  targetSaved: `${kept('Target')} tersimpan ✓`,
  noRate: 'Tanpa persentase: tidak ada yang dihitung',

  newThisMonth: ({ n }) => `+${n} baru bulan ini`,
  trendSame: ({ now }) => `Sama dengan bulan lalu (${now})`,
  trendUp: ({ last }) => `Naik dari ${last} bulan lalu`,
  trendDown: ({ last }) => `Turun dari ${last} bulan lalu`,
  // One form for one and many (§B.0 rule 8): *1 hari*, *9 hari*.
  lastLogged: ({ days }) => `Terakhir mencatat ${days} hari lalu`,
  more: ({ n }) => `+ ${n} lainnya — daftar lengkap di layar ${kept('People')}`,
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
  leftOutMonths: ({ months }) => `Belum diunggah untuk ${months}, jadi tidak dihitung dalam total ini.`,
  leftOutMembers: ({ n }) => `${n} anggota belum mengatur ${kept('goal')}, jadi ${kept('target')} tidak menghitung mereka.`,
  and: 'dan',
  never: 'Tidak pernah',
  today: 'Hari ini',
  daysAgo: ({ days }) => `${days} hari lalu`,
};

export const kpmOverviewMessages = defineMessages({ en, id });
