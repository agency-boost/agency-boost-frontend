import { makeMe } from './harness';
import type { ConsoleDashboard, ConsoleKpm, ConsoleKpmPeople, UsageCounts } from '@/lib/admin-console';

/**
 * **The Super Admin console's fixtures** (P19.23-T1, T2; ADR-0277): `GET /admin/dashboard` and `GET /admin/tenants/:id/people`
 * as the API answers them, after the mockups' example data (`superadmin-tablet-stopmotion-2026-11-19`, f01–f13).
 */
export const CONSOLE_SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Dina Kusuma', preferredName: null,
    pronoun: 'they', initials: 'DK', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'platform_metrics:read', 'kpm:read_profile', 'kpm:create', 'kpm:assign_owner',
    'kpm:update_company_tag', 'kpm:suspend', 'kpm:archive', 'company_template:write'],
});

export const BSD = '66f0000000000000000002a1';
export const MAGNI = '66f0000000000000000002a2';
export const CEMPAKA = '66f0000000000000000002a3';
export const GADING = '66f0000000000000000002a4';
export const HOLD = '66f0000000000000000002a5';
export const PRU = '66f0000000000000000002c1';
export const SBL = '66f0000000000000000002c2';
export const ALZ = '66f0000000000000000002c3';

const counts = (members: number, everUsed: number, used14: number, powerUsers: number): UsageCounts =>
  ({ members, everUsed, used14, powerUsers });

const kpm = (over: Partial<ConsoleKpm> & Pick<ConsoleKpm, 'kpmId' | 'name' | 'code'>): ConsoleKpm => ({
  companyId: PRU, companyName: 'Prudential', status: 'active', active: true, ownerName: 'WILSON TANOTO', ownerState: 'active',
  createdAt: '2026-01-05T00:00:00.000Z', usage: { leader: counts(0, 0, 0, 0), agent: counts(0, 0, 0, 0) }, issues: [],
  missingMonth: null, ...over,
});

export const DASHBOARD: ConsoleDashboard = {
  asOf: '2026-11-20',
  comparedWith: '2026-10-20',
  scale: { greenFromPct: 80, yellowFromPct: 50 },
  overall: { kpms: 5, kpmsNewThisMonth: 1, companies: 3, activeKpms: 3, leaders: 11, agents: 22 },
  funnel: {
    members: 33,
    everUsed: { count: 27, pct: 82, previousCount: 24, previousPct: 73 },
    used14: { count: 18, pct: 55, previousCount: 16, previousPct: 48 },
    powerUsers: { count: 6, pct: 18, previousCount: 6, previousPct: 18 },
  },
  approvalsPending: 3,
  companies: [
    { companyId: ALZ, name: 'Allianz Life' },
    { companyId: PRU, name: 'Prudential' },
    { companyId: SBL, name: 'Sejahtera Baru Life' },
  ],
  kpms: [
    kpm({ kpmId: BSD, name: 'BSD City Branch', code: '0417',
      usage: { leader: counts(10, 10, 9, 4), agent: counts(20, 16, 8, 2) } }),
    kpm({ kpmId: GADING, name: 'Kelapa Gading Branch', code: '0555', active: false, ownerName: 'HENDRA WIJAYA',
      issues: ['subscription_ended'] }),
    kpm({ kpmId: MAGNI, name: 'Magni', code: '1234', ownerName: 'NADIA SAFITRI', issues: ['no_members'],
      usage: { leader: counts(1, 1, 1, 0), agent: counts(0, 0, 0, 0) } }),
    kpm({ kpmId: HOLD, name: 'Suspended Branch', code: '0999', status: 'suspended', active: false, ownerName: null,
      ownerState: 'none', issues: ['suspended'] }),
    kpm({ kpmId: CEMPAKA, name: 'Cempaka Putih Branch', code: '0701', companyId: SBL, companyName: 'Sejahtera Baru Life',
      ownerName: 'HADI GUNAWAN', ownerState: 'not_invited', issues: ['owner_not_invited', 'data_missing'], missingMonth: '2026-10',
      usage: { leader: counts(0, 0, 0, 0), agent: counts(2, 0, 0, 0) } }),
  ],
};

export const PEOPLE: ConsoleKpmPeople = {
  kpm: { kpmId: BSD, name: 'BSD City Branch', code: '0417', companyId: PRU, companyName: 'Prudential', status: 'active' },
  owner: { state: 'active', person: { membershipId: 'm-wilson', userId: 'u-wilson', fullName: 'Wilson Tanoto', class: 'ab' }, pendingName: null },
  admins: [{ membershipId: 'm-linda', userId: 'u-linda', fullName: 'Linda Kusuma', class: 'agent' }],
  coreLeaders: [
    { membershipId: 'm-agus', userId: 'u-agus', fullName: 'Agus Prasetyo', class: 'ab' },
    { membershipId: 'm-satria', userId: 'u-satria', fullName: 'Satria Nugraha', class: 'ab' },
  ],
  members: {
    total: 27, leaders: 9, agents: 18,
    first: [
      { membershipId: 'm-wilson', userId: 'u-wilson', fullName: 'Wilson Tanoto', class: 'ab', groupName: 'Top Producers 2026', lastUsedDays: 0, lastUsedStatus: 'recent' },
      { membershipId: 'm-agus', userId: 'u-agus', fullName: 'Agus Prasetyo', class: 'ab', groupName: 'Top Producers 2026', lastUsedDays: 0, lastUsedStatus: 'recent' },
      { membershipId: 'm-sari', userId: 'u-sari', fullName: 'Sari Puspita', class: 'aab', groupName: 'Top Producers 2026', lastUsedDays: 1, lastUsedStatus: 'recent' },
      { membershipId: 'm-arief', userId: 'u-arief', fullName: 'Arief Hidayat', class: 'aab', groupName: null, lastUsedDays: 22, lastUsedStatus: 'lapsed' },
      { membershipId: 'm-dewi', userId: 'u-dewi', fullName: 'Dewi Lestari', class: 'aab', groupName: 'Top Producers 2026', lastUsedDays: null, lastUsedStatus: 'never' },
    ],
  },
  viewAs: {
    owner: [{ membershipId: 'm-wilson', userId: 'u-wilson', fullName: 'Wilson Tanoto', class: 'ab' }],
    admin: [{ membershipId: 'm-linda', userId: 'u-linda', fullName: 'Linda Kusuma', class: 'agent' }],
    ab: [
      { membershipId: 'm-agus', userId: 'u-agus', fullName: 'Agus Prasetyo', class: 'ab' },
      { membershipId: 'm-wilson', userId: 'u-wilson', fullName: 'Wilson Tanoto', class: 'ab' },
    ],
    agent: [],
  },
};
