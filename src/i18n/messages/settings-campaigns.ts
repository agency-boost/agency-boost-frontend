import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Pengaturan › Campaigns, in words** (P18.10-T4; P19.25-T5, ADR-0282; `functional/campaigns.md`): the filter
 * *Semua · Struktural · Musiman*, a campaign's row — its line and its tag —, ⋯, *+ Tambah campaign*, the two notes under
 * the list, and the add-and-edit form with its requirements. *Changed 2026-11-20 (P19.25-T5 AC-1):* the *Production club
 * tiers* tab and its words — the carrier's tiers and MOC — are gone (*"no Production club"*; *"MOC / Club: not shown
 * anywhere for now"*), and so is the screen's line, which spoke of them. The frame and the shared
 * controls — *Save*, *Cancel*, *Edit*, *Archive*, *Restore*, *Remove*, *Show archived*, *Code*, *Description* — are
 * `settings.ts`'; the agents' words a campaign shares — *Seasonal*, *Structural*, *Not measured yet* — are `campaigns.ts`'.
 *
 * **English is the source**, as built (the prototype's *+ Create campaign* is an `alert()`, `KPM_Owner.html:1681`). The
 * Indonesian is the approved glossary's — *Judul · Jenis* (§B.4), *KPM ini* (§B.9), *Belum ada apa pun di sini.* (§B.5),
 * a comparison's *minimal · lebih dari · maksimal · kurang dari · tepat* and *metrik · aturan · kriteria* as the API
 * writes them (§B.10) — with what it lacked proposed in the glossary for approval's §B.10; *Struktural* and *Musiman* are
 * the glossary's. **Kept** (§A): the title, *campaign*, *Target*, a metric's name as served. **Typed content stays as
 * typed**: a campaign's title, line, description and prize; the rungs' labels. **A figure is never a message's**: a target and a money field's mark are written by the caller.
 *
 * @moved app/(tenant)/kpm/settings/campaigns/
 */
const en = {
  title: kept('Campaigns'),
  /**
   * **The filter and the row** (P19.25-T5 AC-1; `data-upload-pengaturan-*` frame 20): *Semua 4 · Struktural 2 · Musiman 2*;
   * a row's line, its requirements and when it runs — *setiap tahun*, *sepanjang tahun*, a seasonal one's dates or
   * *mulai …* —; the two notes under the list, verbatim from the mockup.
   */
  filterLabel: 'Show campaigns',
  filter: {
    all: ({ n }: { n: number }) => `All ${n}`,
    structural: ({ n }: { n: number }) => `Structural ${n}`,
    seasonal: ({ n }: { n: number }) => `Seasonal ${n}`,
  },
  when: { calendar_year: 'every year', rolling_12m: 'year-round' },
  from: ({ day }: { day: string }) => `from ${day}`,
  noteStructural: 'Structural = always on (promotion paths, MDRT)',
  noteSeasonal: 'Seasonal = has a start and an end date',
  more: ({ title }: { title: string }) => `More for ${title}`,
  noneOfKind: 'No campaigns of this kind yet.',
  /** A campaign's phase, worked out on every read, and whose it is (P18.9-T4 AC-8; UI-030). */
  phases: { upcoming: 'Upcoming', running: 'Running', ended: 'Ended' },
  thisOffice: 'This office',
  /** One requirement in words: *"APE achieved at least Rp 600 Jt"* — the metric's name as served, the target the caller's. */
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
  /** Every requirement, each a row (P18.2-T7 AC-9). */
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
};

const id: MessagesOf<typeof en> = {
  title: kept('Campaigns'),
  filterLabel: `Tampilkan ${kept('campaign')}`,
  filter: {
    all: ({ n }) => `Semua ${n}`,
    structural: ({ n }) => `Struktural ${n}`,
    seasonal: ({ n }) => `Musiman ${n}`,
  },
  when: { calendar_year: 'setiap tahun', rolling_12m: 'sepanjang tahun' },
  from: ({ day }) => `mulai ${day}`,
  noteStructural: 'Struktural = berlaku terus (jenjang, MDRT)',
  noteSeasonal: 'Musiman = ada tanggal mulai dan selesai',
  more: ({ title }) => `Lainnya untuk ${title}`,
  noneOfKind: `Belum ada ${kept('campaign')} jenis ini.`,
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
};

export const settingsCampaignsMessages = defineMessages({ en, id });
