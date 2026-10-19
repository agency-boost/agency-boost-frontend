import { makeMe } from './harness';
import type {
  TrainingCategoryProgress, TrainingModulePage, TrainingModuleRow, TrainingProgressView, TrainingSkillProgress,
} from '@/lib/training';

/**
 * **Training as the contract serves it** (`scratchpad/p185/contract-training.md`, P18.5-T1 to T4), shaped on
 * the demo seed's Rina (`Overall.html:7756-7759`): four Sales modules done, *Asking the Right Discovery
 * Questions* in progress. One fixture for the learner's pages, the coaching tab and the axe run, so the
 * screens are tested against one shape.
 */

const counts = (rows: readonly TrainingModuleRow[]) => {
  const done = rows.filter((r) => r.status === 'done').length;
  return { done, total: rows.length, pct: rows.length === 0 ? null : Math.round((100 * done) / rows.length) };
};

export const row = (code: string, title: string, over: Partial<TrainingModuleRow> = {}): TrainingModuleRow => ({
  code, title, formats: ['file'], status: 'not_started', completedAt: null, ...over,
});

export function skill(code: string, label: string, modules: TrainingModuleRow[], over: Partial<TrainingSkillProgress> = {}): TrainingSkillProgress {
  return { code, label, offered: true, modules, archived: [], ...counts(modules), ...over };
}

export function category(
  code: string, label: string, skills: TrainingSkillProgress[], over: Partial<TrainingCategoryProgress> = {},
): TrainingCategoryProgress {
  return {
    code, label, description: null, offered: true, skills, ...counts(skills.flatMap((s) => s.modules)), ...over,
  };
}

const DONE = { status: 'done' as const, completedAt: '2026-09-20T03:00:00.000Z' };

/** The office's Sales, six skills as ADR-0029 cards them (contradiction 3), Rina's statuses. */
export const SALES = category('SALES', 'Sales', [
  skill('PROSPECTING', 'Prospecting', [
    row('PROSPECT_LIST', 'Building Your Prospect List', DONE),
    row('REFERRAL_GENERATION', 'Referral Generation Techniques', { ...DONE, formats: ['video'] }),
    row('COLD_APPROACH', 'Cold Approach Scripts', DONE),
  ]),
  skill('NEEDS_ANALYSIS', 'Needs Analysis', [
    row('FINANCIAL_NEEDS', 'Conducting a Financial Needs Analysis', { ...DONE, formats: ['video'] }),
    row('DISCOVERY_QUESTIONS', 'Asking the Right Discovery Questions', { status: 'in_progress' }),
  ]),
  skill('OBJECTION_HANDLING', 'Objection Handling', [
    row('OBJECTION_FUNDAMENTALS', 'Objection Handling Fundamentals', { formats: ['video'] }),
    row('PRICE_OBJECTIONS', 'Handling Price Objections', { formats: ['link'] }),
  ]),
  skill('CLOSING', 'Closing', [
    row('CLOSING_TECHNIQUES', 'Closing Techniques That Work', { formats: ['file', 'link'] }),
  ]),
  skill('CROSS_SELL', 'Cross-sell', [row('CROSS_SELL_OPPORTUNITIES', 'Identifying Cross-sell Opportunities')]),
  skill('RETENTION', 'Retention', [row('CLIENT_RETENTION', 'Client Retention Best Practices', { formats: [] })]),
], { description: 'Structured modules — tracked here.' });

/** A category the office offers nothing in yet: its subtab, *(0/0)*, the prototype's empty card. */
export const PRODUCT = category('PRODUCT', 'Product', []);

export function progressView(categories: TrainingCategoryProgress[] = [SALES, PRODUCT], membershipId = 'mem-rina'): TrainingProgressView {
  const all = categories.filter((c) => c.offered);
  const done = all.reduce((n, c) => n + c.done, 0);
  const total = all.reduce((n, c) => n + c.total, 0);
  return {
    membershipId, categories, done, total, pct: total === 0 ? null : Math.round((100 * done) / total), allOfferedDone: total > 0 && done === total,
  };
}

/** *Closing Techniques That Work*: a file and a link, the file opened before. */
export function modulePage(over: Partial<TrainingModulePage> = {}): TrainingModulePage {
  return {
    code: 'CLOSING_TECHNIQUES',
    title: 'Closing Techniques That Work',
    category: { code: 'SALES', label: 'Sales' },
    skill: { code: 'CLOSING', label: 'Closing' },
    items: [
      { id: 'it-file', kind: 'file', label: 'closing-techniques.pdf', mimeType: 'application/pdf', bytes: 120_000, url: null },
      { id: 'it-link', kind: 'link', label: 'Closing in practice', mimeType: null, bytes: null, url: 'https://example.com/closing' },
    ],
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    openedItemIds: ['it-file'],
    can: { update: true },
    ...over,
  };
}

/** Rina, an Agent: she reads and sets her own (roles §3.7). */
export const LEARNER = makeMe({
  user: { ...makeMe().user, fullName: 'Rina Wijaya', initials: 'RW' },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['training_progress:read', 'training_progress:update', 'coaching_session:read'],
});

/** A read-only support session as Rina: reads, and sets nothing (D-support). */
export const SUPPORT = makeMe({
  ...LEARNER,
  isImpersonating: true,
  impersonationReadOnly: true,
  impersonatedBy: 'Super Admin',
  permissions: ['training_progress:read', 'coaching_session:read'],
});

/** The shell's own reads, for a page drawn inside the agent layout. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const NOT_FOUND = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } };
