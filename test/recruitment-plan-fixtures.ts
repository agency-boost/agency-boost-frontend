import { makeMe } from './harness';
import type { Choice, RecruitmentAttackPlanView, RecruitmentPlan } from '@/lib/recruitment';
import type { Me } from '@/lib/session';

/**
 * **Recruitment › Attack Plan, as the plan's read answers it** (Phase 17, P17-T3): the vocabulary and a plan,
 * shaped as the contract documents `GET /recruitment/attack-plan`, with the prototype's own words
 * (`AgencyBoost_Recruitment_Section.html:305-330`, `:394-510`) — the seed's for a company started from the
 * defaults.
 */

const c = (code: string, label: string): Choice => ({ code, label });

export const TYPES = [
  c('fresh-grad', 'Fresh grad'), c('career-switch', 'Career switcher'), c('business-owner', 'Business owner'),
  c('retiree', 'Retiree'), c('other-insurer', 'Agent (other insurer)'),
];
export const MOTIVATIONS = [
  c('side-income', 'Extra income on the side'), c('full-career', 'Full career change'),
  c('flexibility', 'Flexibility / time freedom'), c('leadership', 'Building a team / leadership'),
];
export const HESITATIONS = [
  c('no-experience', 'No sales experience'), c('stable-job', 'Already has a stable job'),
  c('reputation', 'Insurance has a bad reputation'), c('no-network', 'No network to sell to'),
  c('time', 'Worried about time commitment'),
];
export const VOCABULARY = { types: TYPES, motivations: MOTIVATIONS, hesitations: HESITATIONS };

const by = (list: Choice[], code: string) => list.find((x) => x.code === code)!;

export const NEXT_ACTION =
  'Send them the Opportunity Overview from Pitch Materials, and set a specific date for their licensing or first shadow session — don\'t leave it open-ended.';

/**
 * *Fresh grad*, driven by *Extra income on the side* and *Building a team / leadership*, hesitant about *No
 * sales experience* and *Worried about time commitment*: two openings, so tagged; two push-backs, the base's.
 */
export function plan(over: Partial<RecruitmentPlan> = {}): RecruitmentPlan {
  return {
    brief: {
      type: by(TYPES, 'fresh-grad'),
      motivations: [by(MOTIVATIONS, 'side-income'), by(MOTIVATIONS, 'leadership')],
      hesitations: [by(HESITATIONS, 'no-experience'), by(HESITATIONS, 'time')],
    },
    profile: {
      code: 'fresh-grad',
      label: 'Fresh graduate',
      tagline: 'New to the workforce, deciding on a first real career move.',
      goodFitFor:
        'Someone weighing this against an entry-level corporate job, who needs to know growth here isn\'t capped by tenure or hierarchy.',
      benefits: [
        'No prior experience required — full structured training and licensing support from day one.',
        'Income is performance-based from the start, so effort compounds instead of waiting on annual raises.',
      ],
    },
    openings: [
      {
        motivation: by(MOTIVATIONS, 'side-income'),
        text: 'Are you thinking of this as something on the side for now, or could it become your main thing if it works out?',
      },
      {
        motivation: by(MOTIVATIONS, 'leadership'),
        text: 'Where do you want to be in three years — still doing the same role, or running your own team?',
      },
    ],
    objections: [
      {
        hesitation: by(HESITATIONS, 'no-experience'),
        theySay: 'I don\'t have any sales experience — I don\'t think I could do this.',
        youSay: 'Nobody starts with experience. The first 90 days are structured, so you\'re never selling alone.',
        profileOwn: false,
      },
      {
        hesitation: by(HESITATIONS, 'time'),
        theySay: 'I\'m worried about how much time this takes outside a normal schedule.',
        youSay: 'Activity is tracked, not hours.',
        profileOwn: false,
      },
    ],
    nextAction: NEXT_ACTION,
    ...over,
  };
}

/** One motivation and one hesitation: *Retiree*, *Flexibility*, *Worried about time* — the retiree's own words. */
export const RETIREE_PLAN = plan({
  brief: { type: by(TYPES, 'retiree'), motivations: [by(MOTIVATIONS, 'flexibility')], hesitations: [by(HESITATIONS, 'time')] },
  profile: {
    code: 'retiree', label: 'Retiree',
    tagline: 'Re-entering the workforce after time away, or looking for reduced-hours work.',
    goodFitFor: 'Someone who needs flexibility more than a fixed schedule, and has an underused personal network.',
    benefits: ['Flexible schedule — activity is tracked by outcome, not clock-in hours.'],
  },
  openings: [{ motivation: by(MOTIVATIONS, 'flexibility'), text: 'What\'s the actual time you have available in a normal week right now?' }],
  objections: [{
    hesitation: by(HESITATIONS, 'time'),
    theySay: 'I\'m not sure I have much time to give this right now.',
    youSay: 'That\'s exactly why activity is tracked by outcome, not hours.',
    profileOwn: true,
  }],
});

/** The read without a brief, or with one: the vocabulary every time. */
export const view = (p: RecruitmentPlan | null = null, hasPlaybook = true): RecruitmentAttackPlanView => ({
  hasPlaybook, vocabulary: VOCABULARY, plan: hasPlaybook ? p : null,
});

/** The address of `plan()`, as the page is handed it. */
export const BRIEF = { type: 'fresh-grad', motivation: 'side-income,leadership', hesitation: 'no-experience,time' };

export const FIELD_PERMISSIONS = ['recruitment:read', 'product_catalog:read'];

type Membership = NonNullable<Me['membership']>;
const membership = (over: Partial<Membership> = {}): Membership => ({
  membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
  isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});

/** Rina, an Agent of 0417. */
export const RINA_ME = makeMe({ membership: membership(), permissions: FIELD_PERMISSIONS });

/** Every holder of `recruitment:read` (roles §3.x): the three rungs, and the Owner and the Admin in their field view. */
export const READERS = [
  ['an Agent', RINA_ME],
  ['an AAB', makeMe({ membership: membership({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 }), permissions: FIELD_PERMISSIONS })],
  ['an AB', makeMe({ membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 3 }), permissions: FIELD_PERMISSIONS })],
  ['the Owner, in the field view', makeMe({ membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true }), permissions: FIELD_PERMISSIONS })],
  ['an Admin, in the field view', makeMe({ membership: membership({ isKpmAdmin: true }), permissions: FIELD_PERMISSIONS })],
] as const;

/** A Super Admin in a read-only support session, acting as Rina (roles §3.13). */
export const READ_ONLY_RINA = { ...RINA_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' };

/** What the agent shell reads, so a page renders inside it. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const refused = (parameter: string) => ({
  status: 400,
  body: { error: { code: 'VALIDATION_FAILED', message: 'The brief is not one we can read.', details: { [parameter]: 'unknown' }, requestId: 'r-400' } },
});
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
