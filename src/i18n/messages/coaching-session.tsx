import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { Pronoun } from '@/lib/coaching';
import { ENGLISH_PRONOUNS } from './coaching';

/**
 * **A coaching session's words** (P18.98-T4, coaching and unit; `functional/coaching.md`, *The module's own strings*):
 * the *Coaching Session* tab's workspace — its header, *▶ Start coaching session*, last week's items, the Goal, Ratios
 * and Activity cards, the tips, the next actions, finalize and *Edit again* — the parts the archive and `/coaching/me`
 * draw it with (`coaching-parts.tsx`), and the print (`coaching-print.tsx`). The record's own words are
 * `coaching-record.tsx`'s; the agreement's — last week's items, the tips, the next actions — are here, and it reads them.
 *
 * **English is the source** of the keys: the prototype's strings as built (`Overall.html:4167-4319`, `:10666-11187`) and
 * the module's own (L-01), none of ADR-0084's six words in either language. The Indonesian is the approved glossary's
 * (OD-237; §B.0), with what it lacked in the glossary for approval's §B.10: an *action item* is the forum's *tindakan*,
 * *finalize* *finalkan* (§B.3's *Final*), *pro-rated* *prorata*, *Coaching tips* *Tips coaching*.
 *
 * **Kept in both languages** (§A): *Goal*, *Ratios*, *Leads*, the cascade's three stages (*Set appointment*, *Sales
 * meeting*, *Submission polis*), *Annual APE target*, *Benchmark*, *1-on-1*, *coaching*, *leads*, *goals* — a kept
 * noun in its English plural (§B.0 rule 8) — and the title on paper. *Activity*, the person's tab, is the card's and the
 * table's heading here, translated (`KEPT_ELSEWHERE`). **A person is *dia***. **Content stays as typed** (ADR-0179 §5): an
 * item's, a tip's and a note's words, a lead's name, a section's and a ratio's label, the reason a session was reopened.
 * **A figure is never a message's**: a date, a sum or a percentage is written by the caller in the figures' language and
 * handed in — `day` a node where it is drawn bold.
 *
 * @moved components/coaching-session.tsx
 * @moved components/coaching-parts.tsx
 * @moved components/coaching-print.tsx
 */
const f = (pronoun: Pronoun) => ENGLISH_PRONOUNS[pronoun];
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const en = {
  /** `.session-header-card` (`Overall.html:4169-4175`): the day drawn bold, the session's own once finalized. */
  today: ({ day }: { day: ReactNode }) => <>{"Today's session — "}{day}</>,
  /** The header's tag (P18.95-T7 AC-2, UI-021). */
  tag: { notStarted: 'Not started', draft: 'Draft', finalized: 'Finalized' },
  /** *View past sessions ▾* and its list; the arrow is drawn apart. */
  past: {
    show: 'View past sessions',
    hide: 'Hide past sessions',
    none: 'No past sessions yet.',
    view: 'View →',
  },
  /** The pre-start state (`Overall.html:4176-4184`): the ▶ is drawn apart. Its line went at every size (UI-032). */
  start: {
    button: 'Start coaching session',
  },

  /**
   * **The session card** (UI V1, UI-032): one card — *Sesi hari ini*, the day, the tag and *Mulai sesi coaching* — with
   * the past sessions as rows under it, three and then *Semua*.
   */
  sessionCard: {
    label: 'Today’s session',
    past: 'Past sessions',
    /** A past session's row: `day` and `summary` written by the caller. */
    row: ({ day, summary }: { day: string; summary: string }) => `${day} · ${summary}`,
    all: ({ n }: { n: number }) => `All (${n})`,
    fewer: 'Show fewer',
  },

  /**
   * **The session's Leads card** (UI V1, UI-062, UI-081): compact rows, five and then *Tampilkan semua (n)*, the closed
   * leads in one line. The search, *+ Tambah lead*, *Isi tindakan* and *Isi tanggal* are the leads module's words.
   */
  leadsCard: {
    showAll: ({ n }: { n: number }) => `Show all (${n})`,
    showFewer: 'Show fewer',
    closed: ({ won, lost }: { won: number; lost: number }) => `Closed: Won ${won} · Lost ${lost}`,
    none: `No ${kept('leads')} yet.`,
    noMatch: `No ${kept('lead')} matches.`,
    /** *Isi tanggal*'s picker, named for the lead. */
    pickDate: ({ name }: { name: string }) => `Next action date for ${name}`,
    reading: `Reading the ${kept('leads')}…`,
  },

  /** **The pinned *Finalkan* bar and the sticky column's foot** (UI V1, UI-060, UI-062). */
  bar: {
    /** Left of *Finalkan* on a phone: *Draf · 6 tindakan*. */
    draft: ({ n }: { n: number }) => `Draft · ${n} ${n === 1 ? 'action' : 'actions'}`,
    /** The refusal above the button, with how many rows lack a date: *(1)*. */
    count: ({ sentence, n }: { sentence: string; n: number }) => `${sentence} (${n})`,
    /** After finalize: the green strip (`day` written by the caller, *30 Okt*). */
    finalized: ({ day }: { day: string }) => `Finalized ${day}`,
  },
  opening: 'Opening the session…',
  /** The one line a version conflict leaves. */
  reloaded: 'This session was changed somewhere else, so it has been read again.',
  /** What follows *Session started ✓* when last week's were carried (`Overall.html:10699`). */
  carried: 'unfinished items and tips from last week carried forward.',
  goalUpdated: 'Goal updated — reflected across both tabs.',
  /** UI-060: *toast "Tersimpan"*, then the green strip says the rest. */
  finalizedToast: 'Saved',
  reopenedToast: 'Reopened for editing — finalize again when you’re done.',
  /** The Leads card (ADR-0076) and its table's caption, in the coachee's pronoun. */
  leads: kept('Leads'),
  theirLeads: ({ pronoun }: { pronoun: Pronoun }) => `${cap(f(pronoun).possessive)} leads`,

  /** What a session agreed: the workspace's cards, the archive's, `/coaching/me`'s and the print's headings. */
  agreement: {
    lastWeek: "Last week's action items",
    /** Last week's card's tag: `day` the session it came from; `coach` who led it, on the reader's own page. */
    fromSession: ({ day, coach }: { day: string; coach: string | null }) => `From ${day} session${coach ? ` · ${coach}` : ''}`,
    /** A row's date control and its save, named for its words or its place. */
    date: ({ item }: { item: string }) => `Date, ${item}`,
    item: ({ n }: { n: number }) => `item ${n}`,
    tips: 'Coaching tips',
    /** `/coaching/me`'s, by the coach's first name (`Overall.html:4532`). */
    tipsFrom: ({ name }: { name: string }) => `Coaching tips from ${name}`,
    noTips: 'No tips were added this session.',
    next: 'Next action items',
    fromLeads: 'From leads (automatic)',
    /** The workspace's sub-labels, sentence case (UI-061): *Dari leads* with the ⚡, and *Lainnya*. */
    fromLeadsShort: `From ${kept('leads')}`,
    otherShort: 'Other',
    /** Behind the ⚡'s ⓘ (D-25). */
    autoWhy: `Taken from each ${kept('lead')}’s next action. Change it in the ${kept('lead')}.`,
    noLeadDates: 'No leads have a next action date set yet.',
    other: 'Other action items',
    noOther: 'No other action items were added this session.',
    /** A lead's tag, *Leads · {name}* (`.action-from-tag`). */
    fromLead: ({ name }: { name: string }) => `Leads · ${name}`,
  },

  /** *Goal* (`Overall.html:4192-4214`; ADR-0075). */
  goal: {
    title: kept('Goal'),
    annualTarget: 'Annual APE target',
    save: 'Save',
    cancel: 'Cancel',
    tapToEdit: 'Tap this year’s target to edit',
    reading: 'Reading the goal…',
    none: 'No goal set',
    set: 'Set this year’s target',
    /** After the target, for a screen reader: the figure is the control. */
    editTarget: ', this year’s target — edit',
    month: 'This month’s target',
    year: 'This year’s target',
    notUploaded: 'Not uploaded yet',
    /** The two tiles' labels on the session (UI-062). */
    monthTile: 'This month',
    yearTile: 'This year',
    /** `sum` written by the caller. */
    remaining: ({ sum, period }: { sum: string; period: 'month' | 'year' }) => `${sum} remaining this ${period}.`,
  },

  /** *Ratios*, *Last 30 days* (`Overall.html:4215-4218`). */
  ratios: {
    title: 'Ratios',
    tag: 'Last 30 days',
    working: 'Working out the ratios…',
    none: ({ pronoun }: { pronoun: Pronoun }) => `There are no ratios for ${f(pronoun).possessive} role yet.`,
    noneYours: 'There are no ratios for your role yet.',
    /** `value` written by the caller: *30%*, *±30 points*, or a balance's band. */
    benchmark: ({ value }: { value: string }) => `Benchmark: ${value}`,
    eachSide: ({ low, high }: { low: string; high: string }) => `${low}–${high} each side`,
  },

  /** *Activity → view full dashboard* · *Last 7 days* (`Overall.html:4221-4254`) and its drill. */
  activity: {
    title: 'Activity',
    full: '→ view full dashboard',
    tag: 'Last 7 days',
    reading: 'Reading the last 7 days…',
    dialog: ({ name }: { name: string }) => `${name} — Activity Dashboard`,
    dialogLine: 'Last 7 days · category breakdown',
    caption: ({ name }: { name: string }) => `${name}, last 7 days`,
    columns: { category: 'Category', logged: 'Logged', target: 'Target (pro-rated)' },
    close: 'Close',
    /** The cascade's three stages (ADR-0160 §4), names (§A.6). */
    targets: { leads: kept('Set appointment'), appointments: kept('Sales meeting'), closings: kept('Submission polis') },
    /** After the count: *14 / 16 pro-rated* — metrics §B.3's label. */
    proRated: ({ target }: { target: number }) => ` / ${target} pro-rated`,
    noTarget: 'No target yet',
    nothingMore: 'Nothing more needed this month',
    against: ({ label }: { label: string }) => `${label} against the pro-rated target`,
    of: ({ logged, target }: { logged: number; target: number }) => `${logged} of ${target}`,
  },

  /** *Coaching tips* (`Overall.html:4287-4293`). */
  tips: {
    add: 'Add tip',
    emptyOpen: 'No tips added yet — tap + above to add one.',
    tip: ({ n }: { n: number }) => `Tip ${n}`,
    placeholder: 'Type the tip…',
    remove: ({ n }: { n: number }) => `Remove tip ${n}`,
  },

  /** *Next action items* (`Overall.html:4295-4301`). */
  actions: {
    add: 'Add action',
    emptyOpen: 'No other action items yet — tap + above to add one.',
    date: ({ n }: { n: number }) => `Date, action item ${n}`,
    item: ({ n }: { n: number }) => `Action item ${n}`,
    placeholder: 'What needs to happen…',
    remove: ({ n }: { n: number }) => `Remove action item ${n}`,
    guard: 'Fill in the action item you already started before adding another.',
  },

  /** The finalize card (`Overall.html:4303-4315`): the ✓ is drawn apart. */
  finalize: {
    button: 'Finalize this session',
    line: 'Coaching is only counted as done once finalized. You can keep editing everything until then.',
    /** The green tag (`:4309`): `day` written by the caller, empty before there is one. */
    badge: ({ day }: { day: string }) => `✓ Finalized ${day}`,
  },

  /** *Edit again* (ADR-0079) and its question. */
  editAgain: {
    button: 'Edit again',
    closed: ({ until }: { until: string }) => `This session could be reopened until ${until}.`,
    title: 'Edit this session again?',
    line: ({ name }: { name: string }) =>
      `Say why it needs changing. The reason stays with the session, and everyone who reads the session reads it — ${name} included.`,
    reason: 'Reason',
    cancel: 'Cancel',
  },

  /** *⬇ Download as PDF* (ADR-0077) and the paper (`Overall.html:11145-11187`): the ⬇ is drawn apart. */
  print: {
    download: 'Download as PDF',
    title: ({ name }: { name: string }) => `Coaching Session — ${name}`,
    coachedBy: ({ name }: { name: string }) => `Coached by ${name}`,
    finalized: 'Finalized',
    noneAdded: 'None added.',
    none: 'None.',
    fromLeads: 'Next action items — from leads',
    other: 'Next action items — other',
  },
};

const id: MessagesOf<typeof en> = {
  today: ({ day }) => <>{'Sesi hari ini — '}{day}</>,
  tag: { notStarted: 'Belum dimulai', draft: 'Draf', finalized: 'Final' },
  past: {
    show: 'Lihat sesi sebelumnya',
    hide: 'Sembunyikan sesi sebelumnya',
    none: 'Belum ada sesi sebelumnya.',
    view: 'Lihat →',
  },
  start: {
    button: `Mulai sesi ${kept('coaching')}`,
  },
  sessionCard: {
    label: 'Sesi hari ini',
    past: 'Sesi sebelumnya',
    row: ({ day, summary }) => `${day} · ${summary}`,
    all: ({ n }) => `Semua (${n})`,
    fewer: 'Tampilkan lebih sedikit',
  },
  leadsCard: {
    showAll: ({ n }) => `Tampilkan semua (${n})`,
    showFewer: 'Tampilkan lebih sedikit',
    closed: ({ won, lost }) => `Ditutup: Berhasil ${won} · Tidak berhasil ${lost}`,
    none: `Belum ada ${kept('lead')}.`,
    noMatch: `Tidak ada ${kept('lead')} yang cocok.`,
    pickDate: ({ name }) => `Tanggal tindakan berikutnya untuk ${name}`,
    reading: `Memuat ${kept('leads')}…`,
  },
  bar: {
    draft: ({ n }) => `Draf · ${n} tindakan`,
    count: ({ sentence, n }) => `${sentence} (${n})`,
    finalized: ({ day }) => `Difinalkan ${day}`,
  },
  opening: 'Membuka sesi…',
  reloaded: 'Sesi ini diubah di tempat lain, jadi sudah dimuat ulang.',
  carried: 'item yang belum selesai dan tips dari minggu lalu dibawa ke sesi ini.',
  goalUpdated: `${kept('Goal')} diperbarui — kedua tab sudah menampilkannya.`,
  finalizedToast: 'Tersimpan',
  reopenedToast: 'Dibuka kembali untuk diubah — finalkan lagi setelah selesai.',
  leads: kept('Leads'),
  // *Dia* whatever the pronoun (§B.0 rule 8): *his* and *her* are both *-nya*.
  theirLeads: () => `${kept('Leads')} miliknya`,

  agreement: {
    lastWeek: 'Tindakan minggu lalu',
    fromSession: ({ day, coach }) => `Dari sesi ${day}${coach ? ` · ${coach}` : ''}`,
    date: ({ item }) => `Tanggal, ${item}`,
    item: ({ n }) => `item ${n}`,
    tips: `Tips ${kept('coaching')}`,
    tipsFrom: ({ name }) => `Tips ${kept('coaching')} dari ${name}`,
    noTips: 'Tidak ada tips yang ditambahkan di sesi ini.',
    next: 'Tindakan berikutnya',
    fromLeads: `Dari ${kept('leads')} (otomatis)`,
    fromLeadsShort: `Dari ${kept('leads')}`,
    otherShort: 'Lainnya',
    autoWhy: `Diambil dari tindakan berikutnya setiap ${kept('lead')}. Ubah di ${kept('lead')}-nya.`,
    noLeadDates: `Belum ada ${kept('lead')} yang punya tanggal tindakan berikutnya.`,
    other: 'Tindakan lainnya',
    noOther: 'Tidak ada tindakan lain yang ditambahkan di sesi ini.',
    fromLead: ({ name }) => `${kept('Leads')} · ${name}`,
  },

  goal: {
    title: kept('Goal'),
    annualTarget: 'Target APE tahunan',
    save: 'Simpan',
    cancel: 'Batal',
    tapToEdit: `Ketuk ${kept('target')} tahun ini untuk mengubah`,
    reading: `Memuat ${kept('goal')}…`,
    none: `${kept('Goal')} belum diatur`,
    set: `Atur ${kept('target')} tahun ini`,
    editTarget: `, ${kept('target')} tahun ini — ubah`,
    month: `${kept('Target')} bulan ini`,
    year: `${kept('Target')} tahun ini`,
    notUploaded: 'Belum diunggah',
    monthTile: 'Bulan ini',
    yearTile: 'Tahun ini',
    remaining: ({ sum, period }) => `Sisa ${sum} untuk ${period === 'month' ? 'bulan' : 'tahun'} ini.`,
  },

  ratios: {
    title: 'Rasio',
    tag: '30 hari terakhir',
    working: `Menghitung ${kept('ratio')}…`,
    none: () => `Belum ada ${kept('ratio')} untuk perannya.`,
    noneYours: `Belum ada ${kept('ratio')} untuk peran Anda.`,
    benchmark: ({ value }) => `${kept('Benchmark')}: ${value}`,
    eachSide: ({ low, high }) => `${low}–${high} untuk tiap sisi`,
  },

  activity: {
    title: 'Aktivitas',
    full: `→ lihat ${kept('dashboard')} lengkap`,
    tag: '7 hari terakhir',
    reading: 'Memuat 7 hari terakhir…',
    dialog: ({ name }) => `${name} — ${kept('Activity')} ${kept('Dashboard')}`,
    dialogLine: '7 hari terakhir · rincian per kategori',
    caption: ({ name }) => `${name}, 7 hari terakhir`,
    columns: { category: 'Kategori', logged: 'Tercatat', target: `${kept('Target')} (prorata)` },
    close: 'Tutup',
    targets: { leads: kept('Set appointment'), appointments: kept('Sales meeting'), closings: kept('Submission polis') },
    proRated: ({ target }) => ` / ${target} prorata`,
    noTarget: `Belum ada ${kept('target')}`,
    nothingMore: 'Tidak ada lagi yang perlu dicapai bulan ini',
    against: ({ label }) => `${label} terhadap ${kept('target')} prorata`,
    of: ({ logged, target }) => `${logged} dari ${target}`,
  },

  tips: {
    add: 'Tambah tips',
    emptyOpen: 'Belum ada tips — ketuk + di atas untuk menambahkan.',
    tip: ({ n }) => `Tips ${n}`,
    placeholder: 'Tulis tipsnya…',
    remove: ({ n }) => `Hapus tips ${n}`,
  },

  actions: {
    add: 'Tambah tindakan',
    emptyOpen: 'Belum ada tindakan lain — ketuk + di atas untuk menambahkan.',
    date: ({ n }) => `Tanggal, tindakan ${n}`,
    item: ({ n }) => `Tindakan ${n}`,
    placeholder: 'Apa yang perlu dilakukan…',
    remove: ({ n }) => `Hapus tindakan ${n}`,
    guard: 'Isi dulu tindakan yang sudah Anda mulai sebelum menambahkan yang lain.',
  },

  finalize: {
    button: 'Finalkan sesi ini',
    line: `${kept('Coaching')} baru dihitung selesai setelah difinalkan. Sampai saat itu, Anda masih bisa mengubah semuanya.`,
    badge: ({ day }) => `✓ Difinalkan ${day}`,
  },

  editAgain: {
    button: 'Ubah lagi',
    closed: ({ until }) => `Sesi ini bisa dibuka kembali sampai ${until}.`,
    title: 'Ubah sesi ini lagi?',
    line: ({ name }) =>
      `Jelaskan mengapa sesi ini perlu diubah. Alasannya tersimpan bersama sesi, dan semua orang yang membaca sesi ini akan membacanya — termasuk ${name}.`,
    reason: 'Alasan',
    cancel: 'Batal',
  },

  print: {
    download: 'Unduh sebagai PDF',
    title: ({ name }) => `${kept('Coaching Session')} — ${name}`,
    coachedBy: ({ name }) => `Di-${kept('coaching')} oleh ${name}`,
    finalized: 'Final',
    noneAdded: 'Tidak ada yang ditambahkan.',
    none: 'Tidak ada.',
    fromLeads: `Tindakan berikutnya — dari ${kept('leads')}`,
    other: 'Tindakan berikutnya — lainnya',
  },
};

export const coachingSessionMessages = defineMessages({ en, id });
