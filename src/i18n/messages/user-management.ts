import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **User Management** (P18.98-T4, new hires and activation; `functional/org-hierarchy.md`, *Joining an office*,
 * *Invites*, *Deciding, and pulling somebody in*, *Changing what somebody is*, *Removing somebody*): the four screens of
 * one journey and the tab row over them — *Register KPM* (`/user-management/kpm`), *Find Your Leader* (`…/leader`), *Add
 * New Agents* (`…/add`) and *Pending Requests* (`…/pending`). The request inbox the last draws is `requests.ts`'; a role
 * change's sentence `org.ts`'; the leader limit's refusal and its ask `leader-limit.tsx`'.
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:3480-3631`,
 * `User_Management_Section.html`), the client's grey text (P18.95-T7 AC-1, rows 1–7), and ours. The Indonesian is the
 * approved glossary's — *Batal · Konfirmasi · Kirim permintaan · Salin tautan* (§B.1), *Menambahkan… · Mengirim…*,
 * *Permintaan terkirim* (§B.2), *Nama · Peran · Alasan* (§B.4), *Belum ada yang melapor kepada Anda.* (§B.5); *office* is
 * *KPM*, *reports to* *melapor ke* and *tagged to* *di-tag ke* (§B.9); *Keluarkan* for removing a member (§B.10) — with
 * what it lacked proposed in the glossary for approval's §B.10. **Kept** (§A): the title and its four tabs, *KPM*, the
 * roles, *leader*, *unit*, *AgencyBoost*, *Role change log* and *Removed* (two tabs of *All members*, named). A person is
 * *dia* (§B.0 rule 8); *Tap* is *Ketuk*.
 *
 * **Typed content stays as typed**: an office's company, code and branch, a person's name and agent code, a reason,
 * the leader code and its link. **The subtitle names no company** (§C1, generalised 2026-10-29): the prototype's *Find the
 * Prudential KPM …* would be untrue for another company's agent, the directory under it lists every company's offices,
 * each naming its own, and the session carries no company to name, so the sentence drops the name rather than adding a
 * read for it.
 *
 * @moved components/user-management-tabs.tsx
 * @moved app/(agent)/user-management/
 */
const en = {
  /** The heading over the four tabs, the nav item's words (P18.95-T9 AC-2), and the tabs. */
  title: kept('User Management'),
  tabs: {
    kpm: kept('Register KPM'),
    leader: kept('Find Your Leader'),
    add: kept('Add New Agents'),
    pending: kept('Pending Requests'),
  },
  /** Why *Find Your Leader* is locked, and the card in its place. */
  registerFirst: 'Register an office first',

  /** *Register KPM* (`Overall.html:3480-3509`). */
  kpm: {
    subtitle: 'Find the KPM your branch belongs to.',
    loading: 'Loading your office…',
    registered: 'Registered office',
    pendingLine: 'You are in the office and waiting for a leader to take you on.',
    activeLine: 'You are an active member of this office.',
    moving: 'Moving to a different office is not something you can do yourself — ask whoever administers your office.',
    noneTitle: 'No office registered yet',
    noneLine: 'Find the office your branch belongs to. You will need this before you can find a leader.',
    searchTitle: 'Search for your office',
    searchLine: 'Select the one your branch belongs to. Registering does not make you a member yet — a leader still has to '
      + 'take you on.',
    search: 'Search',
    searchExample: 'Office code or branch name',
    /** An office in the directory: its company and its code, as stored. */
    office: ({ company, code }: { company: string; code: string }) => `${company} — ${kept('KPM')} ${code}`,
    select: 'Select',
    registering: 'Registering…',
    noMatch: 'No offices match that search.',
    noneAvailable: 'No offices are available to join.',
    /** Asking for an office that does not exist (ADR-0011): where it stands, and the form. */
    askedTitle: 'You asked for an office',
    askedLine: ({ company }: { company: string }) =>
      `${company} · waiting on ${kept('AgencyBoost')}. You will be told either way, and if it is approved the office is yours to run.`,
    declinedTitle: ({ branch }: { branch: string }) => `Your request for ${branch} was declined`,
    noReason: 'No reason was given. Ask whoever manages your region.',
    declinedLine: 'You can search again above, or ask for a different office.',
    cannotFind: 'Cannot find your office?',
    cannotFindLine: `If your branch is not on ${kept('AgencyBoost')} yet, ask for it. Somebody at ${kept('AgencyBoost')} `
      + 'decides, and if they agree the office is created and you become its Owner.',
    ask: 'Ask for an office',
    branch: 'What is your branch called?',
    branchExample: 'Surabaya Branch',
    note: 'Anything they should know?',
    noteExample: 'Twelve agents already working this area',
    sending: 'Sending…',
    send: 'Send the request',
  },

  /** *Find Your Leader* (`Overall.html:3517-3564`; the grey text's rows 1–3; ADR-0170 §6). */
  leader: {
    subtitle: 'Search leaders in your KPM and request to be tagged.',
    loading: 'Loading your leader…',
    registerFirstLine: 'Finding a leader means searching inside one office, so we need to know which. It is one step, and '
      + 'you can change nothing else until it is done.',
    goToRegister: 'Go to Register KPM',
    haveCode: "Have a leader's code, link or QR?",
    haveCodeLine: 'Any of the three does the same thing: it joins you and tags you to them in one step, with no approval. '
      + 'Opening their link or scanning their QR takes you to the same place.',
    useInvite: 'Use an invite instead',
    reportingTo: 'Currently reporting to',
    /** In the search's place for a reader who already has a leader (ADR-0170 §6), the client's words. */
    changingLeader: 'Changing leader goes through your office admin.',
    findALeader: 'Find a leader',
    needApprove: "They'll need to approve.",
    searchByName: 'Search by name',
    nameExample: 'Name',
    noUnit: 'No unit yet — they can still take you on',
    inUnit: ({ n }: { n: number }) => `${n} in their unit`,
    yourLeader: 'Your leader',
    requestSent: 'Request sent',
    withdraw: 'Withdraw',
    withdrawing: 'Withdrawing…',
    sendRequest: 'Send request',
    sending: 'Sending…',
    noMatch: 'No leaders match that search.',
    /** `ab` and `aab` the company's rungs' short names. */
    noLeaders: ({ ab, aab }: { ab: string; aab: string }) => `This office has no ${ab}s or ${aab}s yet.`,
    oneAtATime: 'One request at a time. Asking somebody else replaces it rather than adding a second — two open requests '
      + 'could both be approved.',
  },

  /** *Add New Agents* (`Overall.html:3574-3596`; the grey text's rows 4–6). */
  add: {
    subtitle: 'Invite new people or tag existing agents to your team.',
    inviteTitle: 'Invite someone',
    inviteLine: 'Share this so new agents join your team.',
    inviteLink: 'Invite link',
    copyLink: 'Copy link',
    leaderCode: 'Leader code',
    copyCode: 'Copy code',
    loadingCode: 'Loading your leader code…',
    findTitle: 'Find someone already here',
    findLine: 'Agents without a leader. Tap Add to join your unit.',
    searchByName: 'Search by name',
    nameExample: 'Name',
    searching: 'Searching untagged agents…',
    noMatch: 'No untagged agents match that search.',
    everybodyReports: 'Everybody in this office already reports to somebody.',
    reportsToNobody: 'reports to nobody',
    addThem: 'Add them to your unit?',
    cancel: 'Cancel',
    adding: 'Adding…',
    confirm: 'Confirm',
    addToMyUnit: 'Add to my unit',
    /** *Your team*: the people who report to the reader, their roles, and removing one. */
    teamTitle: 'Your team',
    teamLine: "People who report to you. Only somebody's direct leader can change their role, and changing it moves nobody "
      + '— they keep reporting to you either way.',
    loadingUnit: 'Loading your unit…',
    nobodyReports: 'Nobody reports to you yet.',
    leadsCount: ({ n }: { n: number }) => `leads ${n}`,
    reportsToYou: 'reports to you',
    role: 'Role',
    remove: 'Remove',
    removeName: ({ name }: { name: string }) => `Remove ${name}`,
    changeRoleTitle: ({ name }: { name: string }) => `Change ${name}'s role?`,
    why: 'Why?',
    roleWhyHint: 'Kept in the role change log, which is the only place this can be read back.',
    roleWhyExample: 'Ready to bring on their own agents',
    changing: 'Changing…',
    confirmChange: 'Confirm change',
    removeTitle: ({ name }: { name: string }) => `Remove ${name}?`,
    removeLine: "This removes them from your team immediately. They'll need to search and request a new leader if they "
      + 'want to rejoin under you or someone else.',
    removeNote: 'Nothing is deleted. Their record and everything they logged stays with the office, on the Removed list.',
    reportsToThem: ({ n }: { n: number }) => (n === 1 ? '1 person reports to them' : `${n} people report to them`),
    sayWhere: 'Say where they go. Removing a leader without deciding this would leave them reporting to somebody who has '
      + 'left.',
    moveToMyUnit: 'Move them to my unit',
    leaveUnassigned: 'Leave them unassigned, for another leader to pick up',
    removeWhyHint: 'Kept on their record, and sent to them.',
    removeWhyExample: 'Left the industry',
    /** `word` the word the server checks, the same in both languages. */
    typeToConfirm: ({ word }: { word: string }) => `Type ${word} to confirm`,
    typeWord: ({ word }: { word: string }) => `Type ${word}`,
    removing: 'Removing…',
    removeFromTeam: 'Remove from team',
    /*
     * UI V1 (2026-10-30, Phase 18.99 T9; UI-082, UI-083): the rows. The role pill opens the role sheet; on a desktop
     * *Keluarkan* sits in a row's ⋮ menu; the table's columns.
     */
    /** The role pill's name: what it does, the role it shows. */
    changeRoleOf: ({ name, role }: { name: string; role: string }) => `Change ${name}’s role, now ${role}`,
    /** A desktop row's ⋮ menu. */
    actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
    /** The desktop table's columns (the role's is `role`). */
    columns: { name: 'Name', code: 'Code', status: 'Status' },
  },

  /** *Pending Requests* (`Overall.html:3625-3631`; the grey text's row 7). */
  pending: {
    subtitle: 'Approve or decline agents who requested to be tagged to you.',
    heading: 'Incoming requests',
    line: 'Approve to add them to your unit.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('User Management'),
  tabs: {
    kpm: kept('Register KPM'),
    leader: kept('Find Your Leader'),
    add: kept('Add New Agents'),
    pending: kept('Pending Requests'),
  },
  registerFirst: `Daftarkan ${kept('KPM')} terlebih dahulu`,

  kpm: {
    subtitle: `Temukan ${kept('KPM')} tempat cabang Anda berada.`,
    loading: `Memuat ${kept('KPM')} Anda…`,
    registered: `${kept('KPM')} terdaftar`,
    pendingLine: `Anda sudah masuk ${kept('KPM')} dan sedang menunggu ${kept('leader')} menerima Anda.`,
    activeLine: `Anda anggota aktif ${kept('KPM')} ini.`,
    moving: `Pindah ke ${kept('KPM')} lain tidak dapat Anda lakukan sendiri — minta kepada pengelola ${kept('KPM')} Anda.`,
    noneTitle: `Belum ada ${kept('KPM')} yang terdaftar`,
    noneLine: `Temukan ${kept('KPM')} tempat cabang Anda berada. Anda memerlukannya sebelum dapat mencari ${kept('leader')}.`,
    searchTitle: `Cari ${kept('KPM')} Anda`,
    searchLine: `Pilih ${kept('KPM')} tempat cabang Anda berada. Mendaftar belum menjadikan Anda anggota — ${kept('leader')} `
      + 'masih harus menerima Anda.',
    search: 'Cari',
    searchExample: `Kode ${kept('KPM')} atau nama cabang`,
    office: ({ company, code }) => `${company} — ${kept('KPM')} ${code}`,
    select: 'Pilih',
    registering: 'Mendaftarkan…',
    noMatch: `Tidak ada ${kept('KPM')} yang cocok dengan pencarian itu.`,
    noneAvailable: `Tidak ada ${kept('KPM')} yang tersedia untuk diikuti.`,
    askedTitle: `Anda mengajukan ${kept('KPM')}`,
    askedLine: ({ company }) =>
      `${company} · menunggu ${kept('AgencyBoost')}. Anda akan diberi tahu apa pun hasilnya, dan jika disetujui, ${kept('KPM')} `
        + 'itu Anda yang kelola.',
    declinedTitle: ({ branch }) => `Permintaan Anda untuk ${branch} ditolak`,
    noReason: 'Tidak ada alasan yang diberikan. Tanyakan kepada pengelola wilayah Anda.',
    declinedLine: `Anda dapat mencari lagi di atas, atau mengajukan ${kept('KPM')} lain.`,
    cannotFind: `Tidak menemukan ${kept('KPM')} Anda?`,
    cannotFindLine: `Jika cabang Anda belum ada di ${kept('AgencyBoost')}, ajukan. Tim ${kept('AgencyBoost')} yang `
      + `memutuskan, dan jika disetujui, ${kept('KPM')} itu dibuat dan Anda menjadi ${kept('Owner')}-nya.`,
    ask: `Ajukan ${kept('KPM')}`,
    branch: 'Apa nama cabang Anda?',
    branchExample: 'Cabang Surabaya',
    note: 'Ada yang perlu mereka ketahui?',
    noteExample: 'Dua belas agen sudah bekerja di area ini',
    sending: 'Mengirim…',
    send: 'Kirim permintaan',
  },

  leader: {
    subtitle: `Cari ${kept('leader')} di ${kept('KPM')} Anda dan minta untuk di-tag.`,
    loading: `Memuat ${kept('leader')} Anda…`,
    registerFirstLine: `Mencari ${kept('leader')} berarti mencari di dalam satu ${kept('KPM')}, jadi kami perlu tahu yang `
      + 'mana. Hanya satu langkah, dan Anda belum dapat mengubah apa pun sebelum langkah ini selesai.',
    goToRegister: `Buka ${kept('Register KPM')}`,
    haveCode: `Punya kode, tautan, atau QR dari ${kept('leader')}?`,
    haveCodeLine: `Ketiganya sama saja: Anda langsung bergabung dan di-tag ke ${kept('leader')} itu dalam satu langkah, `
      + 'tanpa persetujuan. Membuka tautannya atau memindai QR-nya membawa Anda ke tempat yang sama.',
    useInvite: 'Gunakan undangan saja',
    reportingTo: 'Saat ini melapor ke',
    changingLeader: `Penggantian ${kept('leader')} dilakukan melalui ${kept('Admin')} ${kept('KPM')} Anda.`,
    findALeader: `Cari ${kept('leader')}`,
    needApprove: 'Dia perlu menyetujuinya.',
    searchByName: 'Cari berdasarkan nama',
    nameExample: 'Nama',
    noUnit: `Belum punya ${kept('unit')} — dia tetap dapat menerima Anda`,
    inUnit: ({ n }) => `${n} di ${kept('unit')}-nya`,
    yourLeader: `${kept('Leader')} Anda`,
    requestSent: 'Permintaan terkirim',
    withdraw: 'Tarik kembali',
    withdrawing: 'Menarik kembali…',
    sendRequest: 'Kirim permintaan',
    sending: 'Mengirim…',
    noMatch: `Tidak ada ${kept('leader')} yang cocok dengan pencarian itu.`,
    noLeaders: ({ ab, aab }) => `${kept('KPM')} ini belum punya ${ab} atau ${aab}.`,
    oneAtATime: 'Satu permintaan dalam satu waktu. Meminta kepada orang lain akan menggantikannya, bukan menambah yang kedua '
      + '— dua permintaan terbuka bisa sama-sama disetujui.',
  },

  add: {
    subtitle: 'Undang orang baru atau tag agen yang sudah ada ke tim Anda.',
    inviteTitle: 'Undang seseorang',
    inviteLine: 'Bagikan ini agar agen baru bergabung ke tim Anda.',
    inviteLink: 'Tautan undangan',
    copyLink: 'Salin tautan',
    leaderCode: `Kode ${kept('leader')}`,
    copyCode: 'Salin kode',
    loadingCode: `Memuat kode ${kept('leader')} Anda…`,
    findTitle: 'Cari orang yang sudah ada di sini',
    findLine: `Agen tanpa ${kept('leader')}. Ketuk Tambahkan untuk memasukkannya ke ${kept('unit')} Anda.`,
    searchByName: 'Cari berdasarkan nama',
    nameExample: 'Nama',
    searching: 'Mencari agen yang belum di-tag…',
    noMatch: 'Tidak ada agen tanpa tag yang cocok dengan pencarian itu.',
    everybodyReports: `Semua orang di ${kept('KPM')} ini sudah melapor ke seseorang.`,
    reportsToNobody: 'tidak melapor ke siapa pun',
    addThem: `Tambahkan dia ke ${kept('unit')} Anda?`,
    cancel: 'Batal',
    adding: 'Menambahkan…',
    confirm: 'Konfirmasi',
    addToMyUnit: `Tambahkan ke ${kept('unit')} saya`,
    teamTitle: 'Tim Anda',
    teamLine: `Orang yang melapor kepada Anda. Hanya ${kept('leader')} langsung seseorang yang dapat mengubah perannya, dan `
      + 'mengubahnya tidak memindahkan siapa pun — dia tetap melapor kepada Anda.',
    loadingUnit: `Memuat ${kept('unit')} Anda…`,
    nobodyReports: 'Belum ada yang melapor kepada Anda.',
    leadsCount: ({ n }) => `memimpin ${n}`,
    reportsToYou: 'melapor kepada Anda',
    role: 'Peran',
    remove: 'Keluarkan',
    removeName: ({ name }) => `Keluarkan ${name}`,
    changeRoleTitle: ({ name }) => `Ubah peran ${name}?`,
    why: 'Alasan',
    roleWhyHint: `Disimpan di ${kept('Role change log')}, satu-satunya tempat ini dapat dibaca kembali.`,
    roleWhyExample: 'Siap merekrut agennya sendiri',
    changing: 'Mengubah…',
    confirmChange: 'Konfirmasi perubahan',
    removeTitle: ({ name }) => `Keluarkan ${name}?`,
    removeLine: `Ini langsung mengeluarkan dia dari tim Anda. Dia perlu mencari dan meminta ${kept('leader')} baru jika `
      + 'ingin bergabung kembali di bawah Anda atau orang lain.',
    removeNote: `Tidak ada yang dihapus. Datanya dan semua yang dia catat tetap ada di ${kept('KPM')}, di daftar `
      + `${kept('Removed')}.`,
    reportsToThem: ({ n }) => `${n} orang melapor kepadanya`,
    sayWhere: `Tentukan ke mana mereka pindah. Mengeluarkan ${kept('leader')} tanpa menentukan ini akan membuat mereka `
      + 'melapor kepada orang yang sudah keluar.',
    moveToMyUnit: `Pindahkan mereka ke ${kept('unit')} saya`,
    leaveUnassigned: `Biarkan mereka tanpa ${kept('leader')}, untuk diambil ${kept('leader')} lain`,
    removeWhyHint: 'Disimpan di datanya, dan dikirim kepadanya.',
    removeWhyExample: 'Keluar dari industri',
    typeToConfirm: ({ word }) => `Ketik ${word} untuk mengonfirmasi`,
    typeWord: ({ word }) => `Ketik ${word}`,
    removing: 'Mengeluarkan…',
    removeFromTeam: 'Keluarkan dari tim',
    changeRoleOf: ({ name, role }) => `Ubah peran ${name}, sekarang ${role}`,
    actionsFor: ({ name }) => `Tindakan untuk ${name}`,
    columns: { name: 'Nama', code: 'Kode', status: 'Status' },
  },

  pending: {
    subtitle: 'Setujui atau tolak agen yang meminta di-tag ke Anda.',
    heading: 'Permintaan masuk',
    line: `Setujui untuk menambahkan mereka ke ${kept('unit')} Anda.`,
  },
};

export const userManagementMessages = defineMessages({ en, id });
