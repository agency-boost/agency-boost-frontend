import { makeMe } from './harness';
import type { Lead } from '@/lib/leads';
import type {
  CatalogProduct, PayTermView, Proposal, ProposalClient, ProposalFieldView, ProposalItem, ProposalRow,
} from '@/lib/proposals';

/**
 * **The proposal's fixtures** (P19.7-T2; *P19.14*): Rina, an Agent of 0417, with the proposal grants; her leads — one
 * with an earlier proposal's client to start from; a catalogue of Prudential products as `GET /proposals/catalog`
 * answers them, a syariah one, an `up_premium` one with pay terms and one out of the client's age (demo figures, not
 * Prudential's); and a proposal as every route answers it — shaped as `functional/proposal.md`'s *Data contract*.
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
  '/kpm/config': {
    body: {
      activity: [], ratios: [], version: 1,
      // The Sales ladder's first stage: where *+ Lead baru* puts a new lead (P19.14-T1 AC-2).
      leadPipelines: [{ pipeline: 'sales', statuses: [{ code: 'NOT_YET_APPROACHED', label: 'Belum didekati', status: 'active', rank: 1 }] }],
    },
  },
  '/kpm/org-levels': { body: [] },
};

export function lead(over: Partial<Lead> & { id: string; name: string }): Lead {
  return {
    ownerMembershipId: 'mem-rina', type: 'sales', contact: { phone: null, email: null }, statusCode: null,
    thisMonth: false, committedMonths: [], lastEditedBy: null, remarks: null, nextActionDate: null, nextActionNote: null,
    outcome: null, source: null, dateRegistered: '2026-11-01T03:00:00.000Z',
    version: 3, flags: [], overdueDays: null,
    ...over,
  } as Lead;
}

/** The client step 1 enters (P19.14-T1): the proposal's own, never the lead's. */
export const EMPTY_DETAILS = { status: null, dependants: null, occupation: null, city: null, needs: [], needsOther: null };

export function client(over: Partial<ProposalClient> = {}): ProposalClient {
  return { name: 'Ibu Rosa Damayanti', age: 42, ageSetOn: '2026-11-05', gender: 'female', details: { ...EMPTY_DETAILS }, ...over };
}

/** Ibu Rosa: a lead with an earlier proposal, so step 1 starts from its client (P19.14-T1 AC-5). */
export const ROSA = lead({
  id: 'l-rosa', name: 'Ibu Rosa Damayanti',
  proposals: {
    count: 1, latest: { id: 'p-1', products: ['PRUWell Medical', 'PRUCinta'] }, done: 1, latestDone: { id: 'p-1' },
    client: { age: 43, gender: 'female', details: { ...EMPTY_DETAILS, city: 'Bandung', needs: ['HOSPITAL'] } },
  },
});
/** Ibu Wulan: a lead with no proposal — step 1 starts empty. */
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
    category: 'health', typeLabel: 'KESEHATAN', needTag: 'HOSPITAL', isSyariah: false, calcType: 'manual',
    defaultInsured: 'client', currency: { fixed: 'IDR' }, fields: [], payTerms: [],
    frequencies: ['monthly', 'quarterly', 'semiannual', 'annual'], smokerRated: false, planRule: null, entryAge: null,
    outOfAge: false, plans: [], faq: [], riders: [],
    ...over,
  };
}

export const term = (key: string, over: Partial<PayTermView> = {}): PayTermView => ({
  key, label: key, years: null, toAge: null, single: false, maxEntryAge: null, default: false, ...over,
});

export const MEDICAL = product({
  productId: 'prod-medical', code: 'PRUWELL_MEDICAL', name: 'PRUWell Medical', fields: MEDICAL_FIELDS,
  plans: [
    { name: 'Bronze', popular: false, highlights: [{ label: 'Kamar per hari', value: 'Rp 500 rb' }] },
    { name: 'Silver', popular: false, highlights: [{ label: 'Kamar per hari', value: 'Rp 1 Jt' }] },
    { name: 'Gold', popular: true, highlights: [{ label: 'Kamar per hari', value: 'Rp 1,5 Jt' }, { label: 'Wilayah', value: 'Asia' }] },
  ],
  faq: [{ question: 'Apakah ada masa tunggu?', answer: 'Ada, 30 hari untuk sakit biasa.' }],
  riders: [{ code: 'PRU_PA', name: 'PRUPersonal Accident' }],
});

export const CERAH = product({
  productId: 'prod-cerah', code: 'PRUCERAH', name: 'PRUCerah', category: 'education', typeLabel: 'DANA PENDIDIKAN',
  defaultInsured: 'child', fields: CERAH_FIELDS,
});

export const CINTA = product({ productId: 'prod-cinta', code: 'PRUCINTA', name: 'PRUCinta', category: 'life', typeLabel: 'JIWA', needTag: 'FAMILY' });

/** PCB88 as the list of 11 November draws it: the sum assured beside the premium, four terms, smoker-rated. */
export const PCB = product({
  productId: 'prod-pcb', code: 'PRUCRITICAL_BENEFIT_88', name: 'PCB88', category: 'ci', typeLabel: 'PENYAKIT KRITIS',
  needTag: 'CRITICAL_INCOME', calcType: 'up_premium', smokerRated: true, entryAge: { min: 1, max: 60 },
  payTerms: [
    term('y5', { label: '5 tahun', years: 5, maxEntryAge: 60 }), term('y10', { label: '10 tahun', years: 10, maxEntryAge: 60, default: true }),
    term('y15', { label: '15 tahun', years: 15, maxEntryAge: 50 }), term('single', { label: 'Sekali bayar', single: true, maxEntryAge: 60 }),
  ],
});

/** A syariah product, its own product with its own name (ADR-0255 §1): *Kontribusi*, *Peserta*. */
export const ANUGERAH = product({
  productId: 'prod-anugerah', code: 'PRUANUGERAH_SYARIAH', name: 'PRU Anugerah Syariah', category: 'life', typeLabel: 'JIWA',
  needTag: 'FAMILY', isSyariah: true, calcType: 'up_premium',
});

/** A product the client's age cannot enter: greyed, never added. */
export const SENJA = product({
  productId: 'prod-senja', code: 'PRUSENJA', name: 'PRUSenja', category: 'life', typeLabel: 'JIWA', entryAge: { min: 50, max: 70 }, outOfAge: true,
});

export const CATALOG = [MEDICAL, CERAH, CINTA, PCB, ANUGERAH, SENJA];

export function itemOf(p: CatalogProduct, over: Partial<ProposalItem> = {}): ProposalItem {
  const chips = Object.fromEntries(
    p.fields.filter((f) => f.type === 'chips' && f.default !== null).map((f) => [f.key, f.default as string]),
  );
  return {
    itemId: `item-${p.code.toLowerCase()}`, productId: p.productId, productCode: p.code, productVersion: 2, name: p.name,
    plan: p.fields.find((f) => f.plan) ? String(chips.plan ?? '') || null : null,
    currency: 'IDR',
    snapshot: {
      name: p.name, syariahName: null, typeLabel: p.typeLabel, category: p.category, needTag: p.needTag, isSyariah: p.isSyariah,
      calcType: p.calcType, currencies: ['IDR'], fields: p.fields, planRule: p.planRule, payTerms: p.payTerms,
      frequencies: p.frequencies, smokerRated: p.smokerRated, entryAge: p.entryAge,
      limits: { upStep: null, upMin: null, upMax: null, premiumMin: null, premiumMax: null }, benefits: [], pdfDetail: [],
    },
    insured: { relation: p.defaultInsured, name: null, age: null, gender: null },
    smoker: p.smokerRated ? false : null,
    fieldValues: chips,
    payTerm: p.payTerms.find((t) => t.default)?.key ?? null,
    payFrequency: 'monthly',
    up: null,
    premium: null,
    fixedField: 'none',
    rateTableVersionId: null,
    rateTableEffectiveFrom: null,
    calcNote: null,
    totalPaid: null,
    choice: null,
    ...over,
  };
}

export function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p-1', version: 4, leadId: 'l-rosa', leadDeleted: false,
    client: client(),
    showTotal: false, status: 'draft', doneAt: null, firstDoneAt: null,
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
    totals: [{ currency: 'IDR', payFrequency: 'monthly', amountMinor: 125_000_000, items: 2 }], leadId: 'l-rosa', leadDeleted: false,
    updatedAt: '2026-11-05T02:10:00.000Z',
    ...over,
  };
}

export const conflict = { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Changed.', details: { expectedVersion: 4, actualVersion: 5 } } } };
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
