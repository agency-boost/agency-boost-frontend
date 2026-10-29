import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The platform's Overview** — `/admin`, the Super Admin's home (P18.98-T6; `functional/tenant-provisioning.md`, *The
 * module's own strings*): the attention queue's frame, the four tiles and the companies.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's —
 * *Perlu perhatian* (§B.3), *Memuat {…}…* (§B.2, *Memuat Overview…*), *Anggota* (§B.4), *KPM* for an office (§B.9),
 * *susunan jenjang* for the ladder (§B.10). **Kept** (§A): the title, the tiles' and the section's names (*Companies*,
 * *KPMs*, *Total members*, *ABs* in their English plural, §B.0 rule 8), *Superadmin*, *KPM Owner*, *Admin*, *Company
 * template*, *AgencyBoost*. **The queue's items are the server's** (`tag`, `title`, `detail`, `actionLabel`, P18.98-T5's
 * console words), and a company's name and its ladder's rungs are as typed. A figure is written by the page.
 *
 * @moved app/(admin)/admin/page.tsx
 */
const en = {
  title: kept('Overview'),
  subtitle: 'Every company and KPM on AgencyBoost',
  loading: 'Loading the platform overview…',
  attention: 'Needs your attention',
  nothing: 'Nothing needs the platform right now.',
  /** Under the queue: nothing in it is the office's to do. */
  attentionFooter: ({ n }: { n: number }) =>
    `${n === 1 ? '1 item needs' : `${n} items need`} Superadmin action — nothing here can be delegated to a KPM Owner or Admin.`,
  glance: 'At a glance',
  glanceLine: 'Across every company on the platform',
  companies: kept('Companies'),
  /** The section's heading: *Perusahaan* in Indonesian, where the tile keeps its name (`KEPT_ELSEWHERE`). */
  companiesHeading: 'Companies',
  kpms: kept('KPMs'),
  totalMembers: kept('Total members'),
  /** The AB badge's name in its English plural (P18.95-T9 AC-1; §B.0 rule 8). */
  abs: ({ ab }: { ab: string }) => `${ab}s`,
  companiesLine: 'Each company has its own role ladder, product catalog, and Company template',
  /** `ladder` the company's rungs as typed, joined with arrows. */
  ladder: ({ ladder }: { ladder: string }) => `Role ladder: ${ladder}`,
  noLadder: 'No role ladder defined yet',
  members: 'Members',
  noCompanies: 'No companies yet. Add one to start provisioning offices.',
};

const id: MessagesOf<typeof en> = {
  title: kept('Overview'),
  subtitle: `Setiap perusahaan dan ${kept('KPM')} di ${kept('AgencyBoost')}`,
  loading: `Memuat ${kept('Overview')} platform…`,
  attention: 'Perlu perhatian Anda',
  nothing: 'Saat ini tidak ada yang perlu ditangani platform.',
  attentionFooter: ({ n }) =>
    `${n} item memerlukan tindakan ${kept('Superadmin')} — tidak ada yang dapat didelegasikan ke ${kept('KPM Owner')} atau ${kept('Admin')}.`,
  glance: 'Sekilas',
  glanceLine: 'Di semua perusahaan di platform',
  companies: kept('Companies'),
  companiesHeading: 'Perusahaan',
  kpms: kept('KPMs'),
  totalMembers: kept('Total members'),
  abs: ({ ab }) => `${ab}s`,
  companiesLine: `Setiap perusahaan memiliki susunan jenjang, katalog produk, dan ${kept('Company template')} sendiri`,
  ladder: ({ ladder }) => `Susunan jenjang: ${ladder}`,
  noLadder: 'Belum ada susunan jenjang',
  members: 'Anggota',
  noCompanies: `Belum ada perusahaan. Tambahkan satu untuk mulai menyiapkan ${kept('KPM')}.`,
};

export const adminOverviewMessages = defineMessages({ en, id });
