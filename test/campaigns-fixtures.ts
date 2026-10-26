import { makeMe } from './harness';
import type {
  CampaignCard, CampaignDetail, CampaignList, CampaignRequirement, ChasedCampaign, ChasingList,
} from '@/lib/campaigns';

/**
 * **Campaigns, as the field reads answer them** (P18.5-T7 to T9): the list, one campaign, the chases —
 * shaped as `scratchpad/p185/contract-campaigns.md` and the campaigns module's response DTOs document them,
 * with the seed's campaigns (`phase-18.5-agent-enablement.md`, *Seed*) on a run in October 2026.
 */

export const CAMPAIGN_PERMISSIONS = ['campaign:read_list', 'campaign:chase', 'campaign_qualification:read', 'personal_summary:read'];

/** Rina, an Agent of 0417, who reads and chases. */
export const RINA_ME = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: CAMPAIGN_PERMISSIONS,
});

/** A Super Admin in a read-only support session, acting as Rina (roles §3.13): the server answers `can.chase: false`. */
export const READ_ONLY_RINA = {
  ...RINA_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root',
  permissions: ['campaign:read_list', 'campaign_qualification:read', 'personal_summary:read'],
};

/** What the agent shell reads, so a page renders inside it. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Campaign not found.', requestId: 'r-404' } } };
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
export const notOpen = {
  status: 409,
  body: { error: { code: 'CAMPAIGN_NOT_OPEN', message: 'This campaign has ended, so it can no longer be chased or dropped.', requestId: 'r-409' } },
};

/** Rupiah in sen: `rp(500)` is Rp 500.000.000. */
export const rp = (millions: number) => Math.round(millions * 1_000_000 * 100);

export const APE = (millions: number, over: Partial<CampaignRequirement> = {}): CampaignRequirement => ({
  metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte', value: rp(millions), unit: 'idr_minor', measured: true, ...over,
});
export const NEW_HIRE = (n: number): CampaignRequirement => ({
  metricKey: 'NEW_HIRES', metricName: 'New Hire', comparator: 'gte', value: n, unit: 'count', measured: true,
});
export const PERSISTENCY: CampaignRequirement = {
  metricKey: 'ROLLING_PERSISTENCY', metricName: 'Rolling persistency', comparator: 'gte', value: 90, unit: 'percentage', measured: true,
};

export function campaign(over: Partial<CampaignCard> & { code: string }): CampaignCard {
  return {
    title: over.code, kind: 'seasonal', subtype: null, window: 'campaign_dates', phase: 'running',
    startsAt: '2026-09-30T17:00:00.000Z', endsAt: '2026-12-31T16:59:59.999Z', duration: '1 Okt – 31 Des 2026',
    poster: { emoji: '🎯', color: 'navy' }, blurb: '', reward: '', requirements: [],
    chasing: false, eligible: true, chaseBlocked: null, ...over,
  };
}

export const SPRINT = campaign({
  code: 'APE_SPRINT', title: 'Q4 APE Sprint', poster: { emoji: '🚀', color: 'amber' },
  blurb: 'Push for APE this quarter — top 10 unit-wide win a trip.',
  reward: 'Top 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus',
  requirements: [APE(500), NEW_HIRE(1)], chasing: true,
});
export const BLITZ = campaign({
  code: 'NEW_HIRE_BLITZ', title: 'October New Hire Blitz', poster: { emoji: '🧲', color: 'navy-soft' },
  duration: '1 Okt – 31 Okt 2026', endsAt: '2026-10-31T16:59:59.999Z', requirements: [NEW_HIRE(3)],
  blurb: 'Recruit fast — 3 confirmed hires this month unlocks a cash bonus.', reward: 'Rp 3.000.000 cash bonus per qualifying agent',
});
export const CHALLENGE = campaign({
  code: 'APE_CHALLENGE_NEXT', title: 'Q1 APE Challenge', phase: 'upcoming', poster: { emoji: '📊', color: 'navy' },
  duration: '1 Jan – 31 Mar 2027', startsAt: '2026-12-31T17:00:00.000Z', endsAt: '2027-03-31T16:59:59.999Z',
  requirements: [APE(300)], reward: 'To be announced',
});
export const PUSH = campaign({
  code: 'PERSISTENCY_PUSH', title: 'Mid-Year Persistency Push', phase: 'ended', poster: { emoji: '📉', color: 'muted' },
  duration: '1 Apr – 30 Jun 2026', requirements: [PERSISTENCY], reward: 'Rp 2.000.000 cash bonus',
  chasing: true, chaseBlocked: 'ended',
});
export const PROMO_AGENT = campaign({
  code: 'PROMOTION_AGENT_AAB', title: 'Promotion: Agent → AAB', kind: 'structural', subtype: 'promotion',
  window: 'rolling_12m', endsAt: null, duration: 'Rolling 12-month window', poster: { emoji: '🎖️', color: 'navy' },
  requirements: [APE(1200), { ...NEW_HIRE(3), metricKey: 'NEW_ACTIVE_AGENTS', metricName: 'New active agents' }],
  reward: 'Promotion to Associate Agency Builder',
});
export const PROMO_AAB = campaign({
  code: 'PROMOTION_AAB_AB', title: 'Promotion: AAB → AB', kind: 'structural', subtype: 'promotion',
  window: 'rolling_12m', endsAt: null, duration: 'Rolling 12-month window', poster: { emoji: '🏅', color: 'navy' },
  requirements: [APE(3000)], eligible: false, chaseBlocked: 'not_eligible', reward: 'Promotion to Agency Builder',
});
export const MDRT = campaign({
  code: 'MDRT_QUALIFICATION', title: 'MDRT Qualification', kind: 'structural', subtype: 'ongoing', window: 'calendar_year',
  endsAt: null, duration: 'Standing — evaluated per calendar year (1 Jan – 31 Des)', poster: { emoji: '🏆', color: 'gold' },
  requirements: [APE(2400)], chasing: true, reward: 'MDRT membership',
});

/** 0417's list as Rina reads it: two running, one upcoming, one ended, two promotions, MDRT. */
export const LIST: CampaignList = {
  campaigns: [SPRINT, BLITZ, CHALLENGE, PUSH, PROMO_AGENT, PROMO_AAB, MDRT],
  can: { chase: true },
};

export function detail(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    ...SPRINT,
    description: 'Office-wide APE sprint for Q4.\nAll agents hitting the threshold plus one new hire get a cash bonus.',
    can: { chase: true },
    progress: {
      windowLabel: 'Okt – Des 2026',
      final: false,
      rows: [
        { metricKey: 'APE_ACHIEVED', current: rp(620), target: rp(500), unit: 'idr_minor', state: 'met' },
        { metricKey: 'NEW_HIRES', current: null, target: 1, unit: 'count', state: 'not_uploaded' },
      ],
    },
    ...over,
  };
}

export const chased = (c: CampaignCard): ChasedCampaign => ({
  code: c.code, title: c.title, kind: c.kind, subtype: c.subtype, phase: c.phase === 'upcoming' ? 'upcoming' : 'running',
  duration: c.duration, poster: c.poster,
});

/** Rina's chases not ended (D-lists): the sprint and MDRT — *Mid-Year Persistency Push* has ended. */
export const RINA_CHASING: ChasingList = { membershipId: 'mem-rina', campaigns: [chased(SPRINT), chased(MDRT)] };
export const NONE_CHASED: ChasingList = { membershipId: 'mem-budi', campaigns: [] };
