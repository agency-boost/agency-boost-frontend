import { makeMe } from './harness';
import type { AttackPlan, CatalogCard, CatalogProduct, CatalogScript } from '@/lib/product-catalog';

/**
 * **Sales tools, as the field reads answer them** (Phase 14): the shelf, one product, a plan — shaped as
 * `backend/src/modules/products/product-catalog.response.dto.ts` documents them, with the seed's names.
 */

export const FIELD_PERMISSIONS = ['product_catalog:read', 'commission_rates:read'];

/** Rina, an Agent of 0417, who reads both screens. */
export const RINA_ME = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: FIELD_PERMISSIONS,
});

/** A Super Admin in a read-only support session, acting as Rina (roles §3.13). */
export const READ_ONLY_RINA = { ...RINA_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' };

/** What the agent shell reads, so a page renders inside it. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Product not found.', requestId: 'r-404' } } };
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };

export function card(over: Partial<CatalogCard> & { code: string }): CatalogCard {
  return {
    name: over.code, tagline: `${over.code}'s line.`, category: { code: 'life', label: 'Life' },
    channel: 'conventional', lifecycle: 'active', needs: ['life-protection'], ...over,
  };
}

/** 0417's shelf, cut down: two Life, one Health in Syariah, and PGB in run-off. */
export const SHELF: CatalogCard[] = [
  card({ code: 'PRUMAPAN', name: 'PRUMapan (nama kami)', tagline: 'Dana pensiun yang cair rutin dari usia 55.', needs: ['retirement'] }),
  card({ code: 'PRUFUTURE', name: 'PRUFuture', tagline: 'Affordable whole-life to age 100.' }),
  card({
    code: 'PRUSEHAT_SYARIAH', name: 'PRUSehat Syariah', tagline: 'Sharia health cover.', channel: 'syariah',
    category: { code: 'health', label: 'Health' }, needs: ['health'],
  }),
  card({
    code: 'PRULINK_GENERASI_BARU_PGB', name: 'PRULink Generasi Baru (PGB)', tagline: 'Legacy unit-link.',
    category: { code: 'investment', label: 'Investment-linked' }, lifecycle: 'closed_to_new_business', needs: ['investment'],
  }),
];

export const SCRIPT: CatalogScript = {
  goodFit: 'Sandwich-generation milenial.',
  opening: 'Setting up retirement income isn’t easy.',
  benefits: ['Paid annually from 55.', 'Death cover.'],
  fullScript: 'Setting up retirement income alongside daily expenses isn’t easy. Shall I prepare an illustration?',
  objectionTheySay: 'Retirement is too far away to think about right now.',
  objectionYouSay: 'I hear that a lot — it doesn’t feel urgent yet.',
  nextAction: 'Shall I prepare an illustration?',
};

export function product(over: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    code: 'PRUMAPAN', name: 'PRUMapan (nama kami)', tagline: 'Dana pensiun yang cair rutin dari usia 55.',
    category: { code: 'life', label: 'Life' }, channel: 'conventional', lifecycle: 'active', needs: ['retirement'],
    benefits: ['Manfaat Dana Mapan paid annually.', 'Death cover.'],
    differentiator: 'The accessible retirement-income option.',
    bestFit: 'Sandwich-generation milenial and Gen Z.',
    runOffNote: null,
    commissionSchedule: [{ year: 1, rate: 0.3 }, { year: 2, rate: 0.15 }, { year: 3, rate: 0.05 }],
    script: SCRIPT,
    documents: [
      { slot: 'brochure', label: 'Brochure', available: true },
      { slot: 'illustration', label: 'Illustration / Simulation', available: false },
      { slot: 'productDoc', label: 'Product Document', available: false },
    ],
    ...over,
  };
}

/** PGB, in run-off and with no script, as the read answers it. */
export const PGB = product({
  code: 'PRULINK_GENERASI_BARU_PGB', name: 'PRULink Generasi Baru (PGB)', tagline: 'Legacy unit-link.',
  category: { code: 'investment', label: 'Investment-linked' }, lifecycle: 'closed_to_new_business', needs: ['investment'],
  runOffNote: 'In run-off — not actively issued to new applicants. Shown for reference only; not part of the current sales shelf.',
  commissionSchedule: [],
  script: { ...SCRIPT, opening: '', fullScript: '', nextAction: '' },
});

/** *Retirement income, 25–34, Rp500K–Rp2M* in 0417: PRUMapan, Good fit, PRUAnugerah the one alternative. */
export function plan(over: Partial<AttackPlan> = {}): AttackPlan {
  return {
    brief: { need: 'retirement', age: 2, budget: 2 },
    product: product(),
    verdict: 'good_fit',
    outside: [],
    alternatives: [{ code: 'PRUANUGERAH', name: 'PRUAnugerah' }],
    moreCount: 0,
    shelfEmpty: false,
    ...over,
  };
}
