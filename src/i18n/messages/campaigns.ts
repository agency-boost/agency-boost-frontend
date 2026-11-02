import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The agents' *Campaign List*, in words** (P18.98-T4, events, campaigns and the calendar; `functional/campaigns.md`,
 * *The module's own strings*): the page's title and line, *Seasonal · Structural*, the status filter, the five sections
 * and their empty lines, a card — its tags, *Promotion path*, the prize, *Needs:* and each requirement in words, the
 * chase — the campaign's dialog with its requirements and progress, and the toasts (`lib/campaigns.ts`). What a person
 * is chasing — the Summary's rows, *Campaigns they're chasing*, *Chasing MDRT* — is `campaign-chasing.ts`'.
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:3664-3702`, `:7920-8243`), ours
 * where it does not. The Indonesian is the approved glossary's — *Musiman · Struktural*, *Berjalan · Akan datang ·
 * Berakhir* (§B.3), *Belum diunggah*, *Terpenuhi* (§B.3, §B.10), *Mengejar* (§B.10), a requirement's *minimal · lebih
 * dari · maksimal · kurang dari · tepat* as the API writes them (§B.10) — with what it lacked proposed in the glossary
 * for approval's §B.10 (*Kejar*, *Hadiah*, *Syarat:*, *Jalur promosi*, *Kriteria promosi*, *Klub produksi* …). **Kept**
 * (§A): the title, *KPM*, *campaign* (§A.6), *APE*, *new hire*, a metric's name as the server serves it (§A.4).
 * **Typed content stays as typed**: a campaign's title, blurb, description, prize and emoji; the server's window and
 * duration words (P18.98-T5). **A figure is never a message's**: a target and a reading are written by the caller in the
 * figures' language and passed in.
 *
 * @moved lib/campaigns.ts
 * @moved components/campaigns/campaign-list.tsx
 * @moved components/campaigns/campaign-dialog.tsx
 * @moved components/campaigns/campaign-parts.tsx
 * @moved components/campaigns/chasing-card.tsx
 * @moved app/(agent)/campaigns/
 */

type Comparator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

const en = {
  /** The page (`:10411`): the nav item's words (§A.2), and its line — *Tap*, never *click* (P18.95-T9 AC-5). */
  title: kept('Campaign List'),
  subtitle: "Company and KPM campaigns — mark the ones you're chasing, tap any card for full requirements.",
  /** The two tabs (`:3667-3670`), named for a screen reader, and the status filter (`:3674-3679`). */
  types: 'Campaign types',
  seasonal: 'Seasonal',
  structural: 'Structural',
  statusFilter: 'Show campaigns',
  all: 'All',
  running: 'Running',
  upcoming: 'Upcoming',
  ended: 'Ended',
  /** A structural campaign's status tag (`:8047-8051`). */
  ongoing: 'Ongoing',
  /** The structural view's two sections (`:8102-8111`), and every section's empty line (`:8091-8111`). */
  promotionCriteria: 'Promotion Criteria',
  productionClubs: 'Production Clubs',
  noRunning: 'No running campaigns right now.',
  noUpcoming: 'No upcoming campaigns.',
  noEnded: 'No ended campaigns to show.',
  noPromotion: 'No promotion criteria published yet.',
  noOngoing: 'No ongoing incentives right now.',
  /** Every campaign is the office's (OD-156, ADR-0146): the source tag reads *KPM* (`:8029`). */
  sourceTag: kept('KPM'),
  promotionPath: 'Promotion path',
  ongoingIncentive: 'Ongoing incentive',
  requirementsTitle: 'Requirements',
  prize: 'Prize',
  chase: 'Chase',
  /** The round star on a phone's card, named with its campaign (UI V1, UI-108). */
  chaseName: ({ title }: { title: string }) => `Chase ${title}`,
  chasing: 'Chasing',
  viewDetails: 'View details',
  /** The two toasts (`toggleChase`, `:8144`): the title as the office typed it. */
  chased: ({ title }: { title: string }) => `Now chasing "${title}"`,
  unchased: ({ title }: { title: string }) => `Removed "${title}" from your chase list`,
  /** Our own: the states the prototype lacks and the reasons it never gives (D-lists; AC-5). */
  loading: 'Loading the campaigns…',
  loadingOne: 'Loading the campaign…',
  tryAgain: 'Try again',
  close: 'Close',
  notFound: 'This campaign isn’t on your list.',
  notFoundHint: 'It may have been withdrawn, or the address may be mistyped.',
  blocked: {
    ended: 'This campaign has ended.',
    not_eligible: 'This campaign is not open to your role.',
  },
  notUploaded: 'Not uploaded yet',
  /** An activity requirement with nothing logged in its window: no file is awaited, so not *Not uploaded yet*. */
  nothingLogged: 'Nothing logged yet',
  notMeasured: 'Not measured yet',
  met: 'Met',
  /** After a met row's ✓, for a screen reader. */
  metAfter: ', met',
  /** The card's requirements, ***Needs:*** — the client's word (P18.95-T10 AC-3), where the prototype wrote *Requirements:*. */
  needs: 'Needs:',
  /**
   * **One requirement in words** (P18.95-T10 AC-3): *Rp 16 jt APE*, *3 new hires*, *more than 2 new active agents* — the
   * comparison said (*at least* is the plain figure), the target written by the caller, then what it counts, one and
   * many as the figure is. `noun` is the metric's code where it has one; without, the prototype's `{name} {target}`.
   */
  requirement: ({ comparator, target, noun, one, name }: {
    comparator: Comparator; target: string; noun: string | null; one: boolean; name: string;
  }) => {
    const figure = `${({ gte: '', gt: 'more than ', lte: 'at most ', lt: 'under ', eq: 'exactly ' })[comparator]}${target}`;
    const nouns: Record<string, readonly [string, string]> = {
      APE_ACHIEVED: [kept('APE'), kept('APE')],
      NEW_HIRES: [kept('new hire'), kept('new hires')],
      NEW_ACTIVE_AGENTS: ['new active agent', 'new active agents'],
      MAA_COUNT_IN_UNIT: ['active agent in unit', 'active agents in unit'],
      CASCADE_ACTIVITY_TOUCHES: ['goal activity', 'goal activities'],
      ROLLING_PERSISTENCY: ['rolling persistency', 'rolling persistency'],
    };
    const words = noun ? nouns[noun] : undefined;
    return words ? `${figure} ${one ? words[0] : words[1]}` : `${name} ${figure}`;
  },
  /** A requirement's progress in the dialog (OD-157): *"{current} of {target}"*, both written by the caller. */
  progress: ({ current, target }: { current: string; target: string }) => `${current} of ${target}`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Campaign List'),
  subtitle: `${kept('Campaign')} perusahaan dan ${kept('KPM')} — tandai yang Anda kejar, ketuk kartu mana pun untuk melihat syarat lengkapnya.`,
  types: `Jenis ${kept('campaign')}`,
  seasonal: 'Musiman',
  structural: 'Struktural',
  statusFilter: `Tampilkan ${kept('campaign')}`,
  all: 'Semua',
  running: 'Berjalan',
  upcoming: 'Akan datang',
  ended: 'Berakhir',
  // As the compliance tree's tag (`kpm-compliance.ts`): a structural campaign that has started is running.
  ongoing: 'Berjalan',
  promotionCriteria: 'Kriteria promosi',
  productionClubs: 'Klub produksi',
  noRunning: `Belum ada ${kept('campaign')} yang berjalan saat ini.`,
  noUpcoming: `Belum ada ${kept('campaign')} yang akan datang.`,
  noEnded: `Belum ada ${kept('campaign')} yang sudah berakhir.`,
  noPromotion: 'Belum ada kriteria promosi yang diterbitkan.',
  noOngoing: 'Belum ada insentif berkelanjutan saat ini.',
  sourceTag: kept('KPM'),
  promotionPath: 'Jalur promosi',
  ongoingIncentive: 'Insentif berkelanjutan',
  requirementsTitle: 'Syarat',
  prize: 'Hadiah',
  chase: 'Kejar',
  chaseName: ({ title }) => `Kejar ${title}`,
  chasing: 'Mengejar',
  viewDetails: 'Lihat detail',
  chased: ({ title }) => `Sekarang mengejar "${title}"`,
  unchased: ({ title }) => `"${title}" dihapus dari daftar kejaran Anda`,
  loading: `Memuat ${kept('campaign')}…`,
  loadingOne: `Memuat detail ${kept('campaign')}…`,
  tryAgain: 'Coba lagi',
  close: 'Tutup',
  notFound: `${kept('Campaign')} ini tidak ada di daftar Anda.`,
  notFoundHint: 'Mungkin sudah ditarik, atau alamatnya salah ketik.',
  blocked: {
    ended: `${kept('Campaign')} ini sudah berakhir.`,
    not_eligible: `${kept('Campaign')} ini tidak terbuka untuk peran Anda.`,
  },
  notUploaded: 'Belum diunggah',
  nothingLogged: 'Belum ada yang tercatat',
  notMeasured: 'Belum diukur',
  met: 'Terpenuhi',
  metAfter: ', terpenuhi',
  needs: 'Syarat:',
  // An Indonesian noun has one form for one and many; a kept one keeps its English plural (§B.0 rule 8).
  requirement: ({ comparator, target, noun, one, name }) => {
    const figure = `${({ gte: '', gt: 'lebih dari ', lte: 'maksimal ', lt: 'kurang dari ', eq: 'tepat ' })[comparator]}${target}`;
    const nouns: Record<string, readonly [string, string]> = {
      APE_ACHIEVED: [kept('APE'), kept('APE')],
      NEW_HIRES: [kept('new hire'), kept('new hires')],
      NEW_ACTIVE_AGENTS: ['agen aktif baru', 'agen aktif baru'],
      MAA_COUNT_IN_UNIT: [`agen aktif di ${kept('unit')}`, `agen aktif di ${kept('unit')}`],
      CASCADE_ACTIVITY_TOUCHES: [`aktivitas ${kept('goal')}`, `aktivitas ${kept('goal')}`],
      ROLLING_PERSISTENCY: [kept('Rolling persistency'), kept('Rolling persistency')],
    };
    const words = noun ? nouns[noun] : undefined;
    return words ? `${figure} ${one ? words[0] : words[1]}` : `${name} ${figure}`;
  },
  progress: ({ current, target }) => `${current} dari ${target}`,
};

export const campaignsMessages = defineMessages({ en, id });
