import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Settings › Campaigns, in words** (P18.98-T4, events, campaigns and the calendar; `functional/campaigns.md`,
 * `functional/tenant-config.md`): the screen's line and two tabs, a campaign's row, the add-and-edit panel with its
 * requirements, and the carrier's tiers and MOC rules with the line saying whose they are. The frame and the shared
 * controls — *Save*, *Cancel*, *Edit*, *Archive*, *Restore*, *Remove*, *Show archived*, *Code*, *Description* — are
 * `settings.ts`'; the agents' words a campaign shares — *Seasonal*, *Structural*, *Promotion Criteria*, *Production
 * Clubs*, *Not measured yet* — are `campaigns.ts`'.
 *
 * **English is the source**, as built (the prototype's *+ Create campaign* is an `alert()`, `KPM_Owner.html:1681`). The
 * Indonesian is the approved glossary's — *Judul · Jenis* (§B.4), *KPM ini* (§B.9), *Belum ada apa pun di sini.* (§B.5),
 * a comparison's *minimal · lebih dari · maksimal · kurang dari · tepat* and *metrik · aturan · kriteria* as the API
 * writes them (§B.10) — with what it lacked proposed in the glossary for approval's §B.10. **Kept** (§A): the title and
 * its two tabs, *Maintenance of Contract*, *campaign*, *leaders*, *Target*, *Branch info*, a metric's name as served.
 * **Typed content stays as typed**: a campaign's title, line, description and prize; a rule's name and reward; the
 * rungs' labels. **A figure is never a message's**: a target and a money field's mark are written by the caller.
 *
 * @moved app/(tenant)/kpm/settings/campaigns/
 */
const en = {
  title: kept('Campaigns'),
  subtitle: 'What your office is running, and what your insurer measures your leaders against.',
  tabs: { campaigns: kept('Campaigns'), tiers: kept('Production club tiers') },
  /** A campaign's phase, worked out on every read, and whose it is (P18.97-T4 AC-8; UI-030). */
  phases: { upcoming: 'Upcoming', running: 'Running', ended: 'Ended' },
  thisOffice: 'This office',
  /** One requirement in words: *"APE achieved at least Rp 600 jt"* — the metric's name as served, the target the caller's. */
  comparators: { gte: 'at least', gt: 'more than', lte: 'at most', lt: 'less than', eq: 'exactly' },
  requirement: ({ name, comparator, target }: { name: string; comparator: string; target: string }) =>
    `${name} ${comparator} ${target}`,
  reward: ({ reward }: { reward: string }) => `Reward: ${reward}`,
  addCampaign: 'Add a campaign',
  empty: 'No campaigns yet. A campaign is something your office runs, with a requirement your agents can actually be measured against.',
  /** The panel (D-fields). */
  fieldTitle: 'Title',
  codeHintNew: 'Filled in from the title. Permanent.',
  codeHintEditing: 'Permanent — it never changes.',
  kind: 'Kind',
  section: 'Section',
  readOver: 'Read over',
  windows: { rolling_12m: 'The last 12 months', calendar_year: 'Each calendar year' },
  starts: 'Starts',
  startsHint: 'Asking for production figures, it runs in whole months: from a 1st to a month’s last day.',
  ends: 'Ends',
  openTo: 'Open to',
  openToHint: 'Tick none and it is open to everybody.',
  posterEmoji: 'Poster emoji',
  posterColour: 'Poster colour',
  colours: {
    amber: 'Amber', 'amber-dark': 'Dark amber', navy: 'Navy', 'navy-soft': 'Soft navy', muted: 'Grey', success: 'Green', gold: 'Gold',
  },
  cardLine: 'Card line',
  cardLineHint: 'One line under the title on the agent’s card.',
  descriptionHint: 'What the campaign’s details open to.',
  /** Every requirement, each a row (P18.5-T7 AC-9). */
  toReach: 'What has to be reached',
  toReachHint: 'Only what a campaign can measure — a target nothing computes could never be reached. None, and the campaign is not measured.',
  requirementN: ({ n }: { n: number }) => `Requirement ${n}`,
  /** Read before a field's own label, by a screen reader: *"Requirement 2 Comparison"*. */
  requirementBefore: ({ n }: { n: number }) => `Requirement ${n} `,
  chooseMetric: 'Choose a metric',
  notMeasuredOption: ({ name }: { name: string }) => `${name} (not measured yet)`,
  comparison: 'Comparison',
  target: kept('Target'),
  /** A money target's field, its mark the figures' (*Rp*, *IDR*), as its box is typed. */
  targetMoney: ({ mark }: { mark: string }) => `${kept('Target')} (${mark})`,
  removeRequirement: ({ n }: { n: number }) => `Remove requirement ${n}`,
  addRequirement: '+ Add requirement',
  rewardField: 'Reward',
  addTheCampaign: 'Add the campaign',
  saveTheCampaign: 'Save the campaign',
  /** The carrier's rules, read-only with the reason on the card (parity I-76). */
  insurers: 'These are your insurer’s, not your office’s.',
  insurersLine: 'Production club tiers and Maintenance of Contract are the carrier’s recognition and contract rules. You can '
    + 'see what your leaders are measured against; changing them is not your office’s to do — the same boundary as the '
    + 'Company field on Branch info.',
  tierHeadings: { tiers: kept('Production club tiers'), moc: kept('Maintenance of Contract') },
  nothingHere: 'Nothing here yet.',
  /** Between a rule's groups, and between a group's criteria. */
  groupJoin: { any: 'or ', all: 'and ' },
  criteriaJoin: { all: ', and ', any: ', or ' },
  /** A rule nothing can work out yet (ADR-0070): the state and what it waits on, the metrics' names as served. */
  waitingOn: ({ metrics }: { metrics: string }) =>
    `Nothing measures ${metrics} yet, so this rule cannot be worked out. Nothing here guesses them.`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Campaigns'),
  subtitle: `Apa yang dijalankan ${kept('KPM')} Anda, dan ukuran dari perusahaan asuransi untuk menilai ${kept('leaders')} Anda.`,
  tabs: { campaigns: kept('Campaigns'), tiers: kept('Production club tiers') },
  phases: { upcoming: 'Akan datang', running: 'Berjalan', ended: 'Berakhir' },
  thisOffice: `${kept('KPM')} ini`,
  comparators: { gte: 'minimal', gt: 'lebih dari', lte: 'maksimal', lt: 'kurang dari', eq: 'tepat' },
  requirement: ({ name, comparator, target }) => `${name} ${comparator} ${target}`,
  reward: ({ reward }) => `Hadiah: ${reward}`,
  addCampaign: `Tambah ${kept('campaign')}`,
  empty: `Belum ada ${kept('campaign')}. ${kept('Campaign')} adalah program yang diadakan ${kept('KPM')} Anda, dengan syarat yang benar-benar dapat diukur dari agent Anda.`,
  fieldTitle: 'Judul',
  codeHintNew: 'Diisi dari judul. Permanen.',
  codeHintEditing: 'Permanen — tidak pernah berubah.',
  kind: 'Jenis',
  section: 'Bagian',
  readOver: 'Dinilai selama',
  windows: { rolling_12m: '12 bulan terakhir', calendar_year: 'Setiap tahun kalender' },
  starts: 'Mulai',
  startsHint: `Karena memakai angka produksi, ${kept('campaign')} berjalan per bulan penuh: dari tanggal 1 sampai hari terakhir bulan.`,
  ends: 'Selesai',
  openTo: 'Terbuka untuk',
  openToHint: 'Jangan centang apa pun agar terbuka untuk semua orang.',
  posterEmoji: 'Emoji poster',
  posterColour: 'Warna poster',
  colours: {
    amber: 'Jingga', 'amber-dark': 'Jingga tua', navy: 'Biru tua', 'navy-soft': 'Biru tua muda', muted: 'Abu-abu', success: 'Hijau', gold: 'Emas',
  },
  cardLine: 'Kalimat kartu',
  cardLineHint: 'Satu baris di bawah judul pada kartu agent.',
  descriptionHint: `Yang tampil saat detail ${kept('campaign')} dibuka.`,
  toReach: 'Yang harus dicapai',
  toReachHint: `Hanya yang dapat diukur oleh ${kept('campaign')} — ${kept('target')} yang tidak dihitung apa pun tidak akan pernah tercapai. Tanpa syarat, ${kept('campaign')} tidak diukur.`,
  requirementN: ({ n }) => `Syarat ${n}`,
  requirementBefore: ({ n }) => `Syarat ${n} `,
  chooseMetric: 'Pilih metrik',
  notMeasuredOption: ({ name }) => `${name} (belum diukur)`,
  comparison: 'Perbandingan',
  target: kept('Target'),
  targetMoney: ({ mark }) => `${kept('Target')} (${mark})`,
  removeRequirement: ({ n }) => `Hapus syarat ${n}`,
  addRequirement: '+ Tambah syarat',
  rewardField: 'Hadiah',
  addTheCampaign: `Tambahkan ${kept('campaign')}`,
  saveTheCampaign: `Simpan ${kept('campaign')}`,
  insurers: `Ini milik perusahaan asuransi Anda, bukan milik ${kept('KPM')} Anda.`,
  insurersLine: `${kept('Production club tiers')} dan ${kept('Maintenance of Contract')} adalah aturan penghargaan dan kontrak dari `
    + `perusahaan asuransi. Anda dapat melihat ukuran yang dipakai untuk menilai ${kept('leaders')} Anda; mengubahnya bukan `
    + `wewenang ${kept('KPM')} Anda — batasan yang sama dengan kolom Perusahaan di ${kept('Branch info')}.`,
  tierHeadings: { tiers: kept('Production club tiers'), moc: kept('Maintenance of Contract') },
  nothingHere: 'Belum ada apa pun di sini.',
  groupJoin: { any: 'atau ', all: 'dan ' },
  criteriaJoin: { all: ', dan ', any: ', atau ' },
  waitingOn: ({ metrics }) =>
    `Belum ada yang mengukur ${metrics}, jadi aturan ini belum dapat dihitung. Tidak ada yang ditebak di sini.`,
};

export const settingsCampaignsMessages = defineMessages({ en, id });
