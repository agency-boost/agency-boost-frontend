import { makeMe } from './harness';
import type { Lead } from '@/lib/leads';
import type {
  CatalogProduct, Proposal, ProposalFieldView, ProposalItem, ProposalRow,
} from '@/lib/proposals';

/**
 * **The proposal's fixtures** (P19.7-T2): Rina, an Agent of 0417, with the proposal grants; her leads; a catalogue of
 * three Prudential products as `GET /proposals/catalog` answers them (demo figures, not Prudential's); and a proposal as
 * every route answers it — shaped as `functional/proposal.md`'s *Data contract* writes them.
 */

export const PROPOSAL_PERMISSIONS = [
  'proposal:read', 'proposal:create', 'proposal:update', 'proposal:delete', 'proposal:download',
  'lead:read', 'lead:create', 'lead:update', 'product_catalog:read', 'personal_summary:read',
];

export const RINA = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: PROPOSAL_PERMISSIONS,
});

/** The Super Admin viewing as Rina: a view-only session holds the reads alone (ADR-0206 §4). */
export const VIEWING_RINA = {
  ...RINA,
  isImpersonating: true,
  impersonationReadOnly: true,
  impersonatedBy: 'u-root',
  permissions: ['proposal:read', 'lead:read', 'product_catalog:read', 'personal_summary:read'],
};

export const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export function lead(over: Partial<Lead> & { id: string; name: string }): Lead {
  return {
    ownerMembershipId: 'mem-rina', type: 'sales', contact: { phone: null, email: null }, statusCode: null,
    thisMonth: false, committedMonths: [], lastEditedBy: null, remarks: null, nextActionDate: null, nextActionNote: null,
    outcome: null, source: null, dateRegistered: '2026-11-01T03:00:00.000Z', age: null, ageRecordedOn: null, gender: null,
    version: 3, flags: [], overdueDays: null,
    ...over,
  } as Lead;
}

export const ROSA = lead({ id: 'l-rosa', name: 'Ibu Rosa Damayanti', age: 42, ageRecordedOn: '2026-11-05', gender: 'female' });
export const WULAN = lead({ id: 'l-wulan', name: 'Ibu Wulan Sari' });

export function field(over: Partial<ProposalFieldView> & { key: string; label: string }): ProposalFieldView {
  return {
    labelSyariah: null, type: 'chips', options: [], default: null, quickAmounts: [], minMinor: null, showOnPdf: true,
    showOnSummary: false, paymentYears: false, plan: false, currency: false,
    ...over,
  };
}

const opt = (label: string, years: number | null = null) => ({ label, years, currency: null });

export const MEDICAL_FIELDS: ProposalFieldView[] = [
  field({ key: 'plan', label: 'Plan', plan: true, options: ['Bronze', 'Silver', 'Gold'].map((l) => opt(l)), default: 'Gold' }),
  field({ key: 'wilayah', label: 'Wilayah', options: [opt('Indonesia'), opt('Asia')], default: 'Indonesia' }),
  field({ key: 'kamar', label: 'Kamar', options: [opt('1 tempat tidur')], default: '1 tempat tidur' }),
  field({ key: 'masa', label: 'Masa berlaku', type: 'fixed', options: [opt('Dilindungi sampai usia 88')], default: 'Dilindungi sampai usia 88' }),
];

export const CERAH_FIELDS: ProposalFieldView[] = [
  field({ key: 'masa_tunggu', label: 'Masa tunggu', paymentYears: true, options: [opt('10 tahun', 10), opt('15 tahun', 15)], default: '10 tahun' }),
  field({
    key: 'penarikan', label: 'Penarikan per bulan', labelSyariah: 'Penarikan dana per bulan', type: 'money',
    quickAmounts: [10_000_000_000, 25_000_000_000], minMinor: null,
  }),
];

export function product(over: Partial<CatalogProduct> & { productId: string; code: string; name: string }): CatalogProduct {
  return {
    category: 'health', typeLabel: 'KESEHATAN', defaultInsured: 'client', currency: { fixed: 'IDR' }, fields: [],
    plans: [], faq: [], riders: [],
    ...over,
  };
}

export const MEDICAL = product({
  productId: 'prod-medical', code: 'PRUWELL_MEDICAL', name: 'PRUWell Medical', fields: MEDICAL_FIELDS,
  plans: [
    { name: 'Bronze', popular: false, highlights: [{ label: 'Kamar per hari', value: 'Rp 500 rb' }] },
    { name: 'Silver', popular: false, highlights: [{ label: 'Kamar per hari', value: 'Rp 1 jt' }] },
    { name: 'Gold', popular: true, highlights: [{ label: 'Kamar per hari', value: 'Rp 1,5 jt' }, { label: 'Wilayah', value: 'Asia' }] },
  ],
  faq: [{ question: 'Apakah ada masa tunggu?', answer: 'Ada, 30 hari untuk sakit biasa.' }],
  riders: [{ code: 'PRU_PA', name: 'PRUPersonal Accident' }],
});

export const CERAH = product({
  productId: 'prod-cerah', code: 'PRUCERAH', name: 'PRUCerah', category: 'education', typeLabel: 'DANA PENDIDIKAN',
  defaultInsured: 'child', fields: CERAH_FIELDS,
});

export const CINTA = product({ productId: 'prod-cinta', code: 'PRUCINTA', name: 'PRUCinta', category: 'life', typeLabel: 'JIWA' });

export const CATALOG = [MEDICAL, CERAH, CINTA];

export function itemOf(p: CatalogProduct, over: Partial<ProposalItem> = {}): ProposalItem {
  const chips = Object.fromEntries(
    p.fields.filter((f) => f.type === 'chips' && f.default !== null).map((f) => [f.key, f.default as string]),
  );
  return {
    itemId: `item-${p.code.toLowerCase()}`, productId: p.productId, productCode: p.code, productVersion: 2, name: p.name,
    plan: p.fields.find((f) => f.plan) ? String(chips.plan ?? '') || null : null,
    currency: 'IDR',
    snapshot: {
      name: p.name, syariahName: null, typeLabel: p.typeLabel, category: p.category, currencies: ['IDR'], fields: p.fields,
      benefits: [], pdfDetail: [],
    },
    insured: { relation: p.defaultInsured, name: null, age: null },
    fieldValues: chips,
    premium: { amountMinor: null, currency: 'IDR' },
    totalPaid: null,
    choice: null,
    ...over,
  };
}

export function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p-1', version: 4, leadId: 'l-rosa', leadDeleted: false,
    client: { name: 'Ibu Rosa Damayanti', age: 42, gender: 'female' },
    channel: 'conventional', payFrequency: 'monthly', showTotal: false, status: 'draft', doneAt: null, firstDoneAt: null,
    date: '2026-11-05', fileName: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf', items: [], totals: [], duplicatedFrom: null,
    createdAt: '2026-11-05T02:00:00.000Z', updatedAt: '2026-11-05T02:10:00.000Z',
    ...over,
  };
}

export function row(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: 'p-1', version: 4, client: { name: 'Ibu Rosa Damayanti' }, date: '2026-11-05',
    fileName: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf',
    products: [{ name: 'PRUWell Medical', plan: 'Gold' }, { name: 'PRUCinta', plan: null }], status: 'done',
    totals: [{ currency: 'IDR', amountMinor: 125_000_000 }], leadId: 'l-rosa', leadDeleted: false,
    updatedAt: '2026-11-05T02:10:00.000Z',
    ...over,
  };
}

export const conflict = { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Changed.', details: { expectedVersion: 4, actualVersion: 5 } } } };
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
