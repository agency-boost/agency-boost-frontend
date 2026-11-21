/**
 * **People's fixtures** (P19.20): a roster row as `GET /members` answers it, the KPM's tree as `GET /members/tree?view=kpm`
 * answers it, and a member as the sheet reads them — shared by the People specs.
 */
/** A roster row as `GET /members` answers it, with the columns All members draws. */
export const row = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-agus', agentCode: '80005', role: 'ab', orgLevelCode: 'AB', status: 'active',
  fullName: 'Agus Prasetyo', preferredName: null, email: 'agus@kpm0417.test', initials: 'AP',
  leaderId: 'mem-wilson', leaderName: 'Wilson Tanoto', depth: 1, directCount: 9, subtreeCount: 18, isLeader: true,
  isKpmOwner: false, isKpmAdmin: false, isCoreLeader: true, canTagCoreLeader: true, openable: true, photoUrl: null,
  joinedAt: '2025-01-02T02:00:00.000Z', removedAt: null, invitation: 'signed_in', canChangeRole: true,
  canPromoteToAb: true, canRemove: true, roleChoices: ['AGENT', 'AAB', 'AB'], canChangeLeader: true, canEditDetails: true,
  lastActivityOn: '2026-11-20', lastActivityDays: 0, lastActivityStatus: 'recent',
  lastCoachedDays: null, lastCoachedStatus: 'never',
  groupPlace: { group: { groupId: 'g-top', name: 'Top Producers 2026' }, ab: { membershipId: 'mem-agus', name: 'Agus Prasetyo' }, isGroupLeader: false },
  ...over,
});


export const node = (over: Record<string, unknown>) => ({
  membershipId: 'mem-somebody', fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: '80000', role: 'agent', depth: 0, layer: 1,
  leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false,
  isSelf: false, todayActivityCount: 0, photoUrl: null, openable: true, ...over,
});

/** Wilson (the reader) → Agus (AB) → Rina (agent), Sari (AAB); Wilson → Yosef (AB). */
export const KPM_TREE = {
  nodes: [
    node({ membershipId: 'mem-wilson', fullName: 'Wilson Tanoto', role: 'ab', isLeader: true, directCount: 2, isSelf: true, todayActivityCount: 3 }),
    node({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab', leaderId: 'mem-wilson', isLeader: true, directCount: 2, todayActivityCount: 5 }),
    node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', role: 'aab', leaderId: 'mem-agus' }),
    node({ membershipId: 'mem-rina', fullName: 'Rina Kurnia', role: 'agent', leaderId: 'mem-agus', todayActivityCount: 2 }),
    node({ membershipId: 'mem-yosef', fullName: 'Yosef Tambunan', role: 'ab', leaderId: 'mem-wilson' }),
  ],
  leader: null,
  rootIds: ['mem-wilson'],
  selfId: 'mem-wilson',
  counts: { ab: 2, aab: 1, agent: 1, total: 4 },
};


/** Budi, an agent under Sari: two blanks — a birth date and the month he joined the company (frame 16). */
export const budi = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-budi', agentCode: '80009', role: 'agent', orgLevelCode: 'AGENT', status: 'active',
  fullName: 'Budi Santoso', preferredName: null, email: 'budi@kpm0417.test', initials: 'BS',
  leaderId: 'mem-sari', leaderName: 'Sari Puspita', depth: 3, directCount: 0, subtreeCount: 0, isLeader: false,
  isKpmOwner: false, isKpmAdmin: false, isCoreLeader: false, joinedAt: '2025-09-20T02:00:00.000Z', joinDate: '2025-09-20',
  removedAt: null, invitation: 'invited', canChangeRole: true, canPromoteToAb: true, canRemove: true,
  roleChoices: ['AGENT', 'AAB', 'AB'], canChangeLeader: true, canEditDetails: true, openable: true, photoUrl: null,
  personal: {
    dateOfBirth: null, gender: 'male', companyJoinMonth: null, workStatus: 'full_time', phone: '+6285711223344',
    companyName: 'Prudential',
  },
  ...over,
});

