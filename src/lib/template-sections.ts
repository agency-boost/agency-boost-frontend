import type { NamedTemplate, OfficeTemplateKind, TemplateKind } from '@/lib/admin';

/**
 * **A template's six sections** (ADR-0185 §3): the seven kinds a named template holds, grouped as an Owner's settings
 * group them — *Activities & ratios* is the activity taxonomy (with its activity binding) and the ratio set together,
 * as the Owner's *Activity types* holds its *Ratio benchmarks* (`KPM_Owner.html:1329-1330`). The order is the Owner's
 * sidebar's, which ADR-0018 made this screen mirror.
 *
 * Each section's **parts** are its pills: a part is a kind, or one half of a kind's payload (*Sales* and *Recruitment*
 * are both `lead_pipeline`). The words are the catalogue's (`admin-template.tsx`, `sections` and `pills`), by key.
 */
export type SectionSlug = 'activity' | 'leads' | 'activation' | 'training' | 'capability' | 'events';

export type PillKey =
  | 'activityTypes' | 'ratios' | 'sales' | 'recruitment' | 'categories' | 'skills' | 'modules' | 'ladder'
  | 'tiers' | 'moc' | 'promotion';

export interface SectionPart {
  /**
   * What stands in the address bar's hash, and the catalogue's `pills` key. `only` for a section of one part, which
   * draws no pills.
   */
  key: PillKey | 'only';
  kind: TemplateKind;
  /** The half of the kind's payload the part draws, where a kind has halves. */
  half?: string;
}

export interface TemplateSection {
  slug: SectionSlug;
  /** The kinds, in the order *Publish* sends them: the taxonomy before the ratios checked against it. */
  kinds: OfficeTemplateKind[];
  parts: SectionPart[];
}

export const TEMPLATE_SECTIONS: readonly TemplateSection[] = [
  {
    slug: 'activity',
    kinds: ['activity_taxonomy', 'ratio_set'],
    parts: [{ key: 'activityTypes', kind: 'activity_taxonomy' }, { key: 'ratios', kind: 'ratio_set' }],
  },
  {
    slug: 'leads',
    kinds: ['lead_pipeline'],
    parts: [
      { key: 'sales', kind: 'lead_pipeline', half: 'sales' },
      { key: 'recruitment', kind: 'lead_pipeline', half: 'recruitment' },
    ],
  },
  { slug: 'activation', kinds: ['activation_checklist'], parts: [{ key: 'only', kind: 'activation_checklist' }] },
  {
    slug: 'training',
    kinds: ['training_taxonomy'],
    parts: [
      { key: 'categories', kind: 'training_taxonomy', half: 'categories' },
      { key: 'skills', kind: 'training_taxonomy', half: 'skills' },
      { key: 'modules', kind: 'training_taxonomy', half: 'modules' },
    ],
  },
  {
    slug: 'capability',
    kinds: ['capability_ladder'],
    parts: [
      { key: 'ladder', kind: 'capability_ladder', half: 'ladder' },
      { key: 'skills', kind: 'capability_ladder', half: 'skills' },
    ],
  },
  { slug: 'events', kinds: ['event_types'], parts: [{ key: 'only', kind: 'event_types' }] },
];

/** The company's carrier rules (ADR-0026): *Campaigns* on *Company settings*, its three headings each a pill. */
export const CAMPAIGN_PARTS: readonly SectionPart[] = [
  { key: 'tiers', kind: 'campaign_kinds', half: 'production_club' },
  { key: 'moc', kind: 'campaign_kinds', half: 'moc' },
  { key: 'promotion', kind: 'campaign_kinds', half: 'promotion_path' },
];

export const sectionOf = (slug: string): TemplateSection | null =>
  TEMPLATE_SECTIONS.find((s) => s.slug === slug) ?? null;

/** Which section holds a kind — for an old link's `#leads-sales`, and *Publish all*'s report. */
export const sectionOfKind = (kind: TemplateKind): TemplateSection | null =>
  TEMPLATE_SECTIONS.find((s) => (s.kinds as readonly string[]).includes(kind)) ?? null;

/**
 * **Where one section of a template stands** (ADR-0185 §3), from the list's `sections`:
 *
 * - `draft` — a change waits on any of its kinds;
 * - `published` — every kind has a published version and nothing waits;
 * - `partial` — some kinds are published, none waits (only *Activities & ratios* has two);
 * - `empty` — nothing published, nothing waiting: an office made from the template gets none of it.
 *
 * `versions` are each kind's newest published, in the section's order — what the row's detail and its *Terbit vN* say.
 */
export function sectionState(template: Pick<NamedTemplate, 'sections'>, section: TemplateSection): {
  state: 'draft' | 'published' | 'partial' | 'empty';
  versions: { kind: OfficeTemplateKind; version: number | null }[];
  /** Every kind has a published version — what *x/6 bagian terbit* counts, a waiting draft or not. */
  allPublished: boolean;
} {
  const versions = section.kinds.map((kind) => ({ kind, version: template.sections?.[kind]?.publishedVersion ?? null }));
  const anyDraft = section.kinds.some((kind) => template.sections?.[kind]?.hasDraft);
  const published = versions.filter((v) => v.version !== null).length;
  const allPublished = published === versions.length;
  const state = anyDraft ? 'draft' : allPublished ? 'published' : published === 0 ? 'empty' : 'partial';
  return { state, versions, allPublished };
}

/** *x/6 bagian terbit* and *n perubahan belum terbit*: counted by section, the rows a reader sees (ADR-0185 §3). */
export function templateProgress(template: Pick<NamedTemplate, 'sections'>): {
  published: number; total: number; waiting: number;
} {
  const states = TEMPLATE_SECTIONS.map((section) => sectionState(template, section));
  return {
    published: states.filter((s) => s.allPublished).length,
    total: TEMPLATE_SECTIONS.length,
    waiting: states.filter((s) => s.state === 'draft').length,
  };
}

/** The sections with a change waiting, in order: what *Terbitkan semua* names before it publishes. */
export const sectionsWaiting = (template: Pick<NamedTemplate, 'sections'>): TemplateSection[] =>
  TEMPLATE_SECTIONS.filter((section) => sectionState(template, section).state === 'draft');

/** Where a template's pages are. */
export const companyHref = (companyId: string) => `/admin/companies/${companyId}`;
export const settingsHref = (companyId: string) => `/admin/companies/${companyId}/settings`;
export const templateHref = (companyId: string, templateId: string) => `/admin/companies/${companyId}/templates/${templateId}`;
export const sectionHref = (companyId: string, templateId: string, slug: SectionSlug) =>
  `${templateHref(companyId, templateId)}/${slug}`;

/** The old screen's tabs (`#…`), and where each lives now (ADR-0185 §2): a template's section, or the company's own. */
const SECTION_OF: Record<string, [SectionSlug, string]> = {
  activity: ['activity', ''],
  ratios: ['activity', '#ratios'],
  leads: ['leads', ''],
  'leads-sales': ['leads', '#sales'],
  'leads-recruitment': ['leads', '#recruitment'],
  activation: ['activation', ''],
  training: ['training', ''],
  'training-categories': ['training', '#categories'],
  'training-skills': ['training', '#skills'],
  'training-modules': ['training', '#modules'],
  capability: ['capability', ''],
  'capability-ladder': ['capability', '#ladder'],
  'capability-skills': ['capability', '#skills'],
  events: ['events', ''],
};
const SETTINGS_OF: Record<string, string> = {
  products: '#products',
  recruitment: '#recruitment',
  campaigns: '#campaigns',
  'campaign-tiers': '#campaigns',
  'campaign-moc': '#campaigns',
  'campaign-promotion': '#campaigns',
};

/**
 * Where an old link to `/admin/companies/[companyId]/template` goes now (ADR-0185 §2): `?templateId=` to that
 * template, its section where the hash named one; a tab that was the company's own to *Pengaturan perusahaan*; anything
 * else to the company's page. Pure, so the redirect's every case is tested without a router.
 */
export function redirectTarget(companyId: string, search: string, hash: string): string {
  const templateId = new URLSearchParams(search).get('templateId');
  const tab = hash.replace(/^#/, '');
  // **Own keys only**: `tab in …` reads the prototype chain, so `#constructor` or `#toString` would name a "section".
  if (Object.hasOwn(SETTINGS_OF, tab)) return `${settingsHref(companyId)}${SETTINGS_OF[tab]}`;
  if (!templateId) return companyHref(companyId);
  const section = Object.hasOwn(SECTION_OF, tab) ? SECTION_OF[tab] : null;
  return section
    ? `${sectionHref(companyId, templateId, section[0])}${section[1]}`
    : `/admin/companies/${companyId}/templates/${templateId}`;
}
