import { makeMe } from './harness';

/**
 * **The KPM template's doubles** (ADR-0185; P18.99-T20): a Super Admin, two companies and the library, a company's
 * templates as `GET /admin/companies/:companyId/templates` answers them — with `sections` — and one kind of one template
 * as `GET …/template/:kind` answers it. Shared by the company page, a template's checklist, a section's editor, the
 * company settings, their Indonesian specs and the axe sweep.
 */
export const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud', 'company_template:read', 'company_template:write', 'recruitment_playbook:write'],
});

export const PRUDENTIAL = {
  _id: 'c1', name: 'Prudential', slug: 'prudential', defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta',
  status: 'active', usesPlatformDefaults: true, kind: 'insurer',
};
export const ALLIANZ = { ...PRUDENTIAL, _id: 'c2', name: 'Allianz Life', slug: 'allianz-life' };
export const LIBRARY = { ...PRUDENTIAL, _id: 'lib', name: 'Template', slug: 'template', kind: 'template' };

const KINDS = [
  'activity_taxonomy', 'lead_pipeline', 'ratio_set', 'activation_checklist', 'training_taxonomy', 'capability_ladder',
  'event_types',
] as const;
type Kind = (typeof KINDS)[number];
type Section = { publishedVersion: number | null; hasDraft: boolean };

/** Every kind as `state`, then each of `over`. */
export function sections(state: Section, over: Partial<Record<Kind, Section>> = {}): Record<Kind, Section> {
  return Object.fromEntries(KINDS.map((k) => [k, over[k] ?? state])) as Record<Kind, Section>;
}

/** One named template, as the list answers it. */
export function namedTemplate(over: Record<string, unknown> = {}) {
  const s = (over.sections as Record<Kind, Section> | undefined) ?? sections({ publishedVersion: 1, hasDraft: false });
  return {
    id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active',
    archivedAt: null, origin: { kind: 'migration' }, officeCount: 3,
    publishedVersions: Object.fromEntries(KINDS.map((k) => [k, s[k].publishedVersion])),
    createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    ...over,
    sections: s,
  };
}

/**
 * Prudential's two: its default, every section published at version 1 (taxonomy v3); and *BSD City settings*, two
 * sections with a change waiting, one never published, one empty.
 */
export const DEFAULT_TEMPLATE = namedTemplate({
  sections: sections({ publishedVersion: 1, hasDraft: false }, { activity_taxonomy: { publishedVersion: 3, hasDraft: false } }),
});
export const BSD_CITY = namedTemplate({
  id: 't-bsd', name: 'BSD City settings', isDefault: false, officeCount: 0, origin: { kind: 'office' },
  sections: sections({ publishedVersion: 1, hasDraft: false }, {
    lead_pipeline: { publishedVersion: 1, hasDraft: true },
    event_types: { publishedVersion: null, hasDraft: true },
    activation_checklist: { publishedVersion: null, hasDraft: false },
    ratio_set: { publishedVersion: null, hasDraft: false },
  }),
});
export const ARCHIVED = namedTemplate({
  id: 't-old', name: 'Old branches', isDefault: false, status: 'archived', archivedAt: '2026-10-20T03:00:00.000Z',
  officeCount: 1,
});
export const LIBRARY_DEFAULT = namedTemplate({ id: 't-lib', companyId: 'lib', name: 'Default template', officeCount: 0 });
export const ALLIANZ_DEFAULT = namedTemplate({ id: 't-allianz', companyId: 'c2', name: 'Allianz Life template' });

/** One kind of one template, as `GET …/template/:kind` answers it. */
export function kindView(kind: string, payload: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return {
    id: `row-${kind}`, companyId: 'c1', templateId: 't-default', kind, version: 1, status: 'published',
    payload, publishedAt: '2026-10-07T03:00:00.000Z', publishedVersion: 1, officesBehind: 0, officesUnrecorded: 0,
    ...over,
  };
}

export const TAXONOMY = {
  categories: [{ code: 'SELLING', label: 'Selling', displayOrder: 1 }],
  types: [{ code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: null, displayOrder: 1 }],
};
export const RATIOS = {
  ratios: [{
    code: 'SUBMISSION_RATE', label: 'Submission rate', numerator: ['SELL_SUBMISSION'], denominator: ['SELL_SUBMISSION'],
    benchmark: 0.3, comparison: 'gte', displayOrder: 1,
  }],
};
export const PIPELINE = {
  statuses: [
    { pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1, isTerminal: false },
    { pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 2, isTerminal: true },
    { pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: true },
  ],
};
export const EVENT_TYPES = {
  types: [{ code: 'TRAINING', label: 'Training', emoji: '📚', color: '#2E4370', displayOrder: 1 }],
};
