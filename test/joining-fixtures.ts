import type { InviteView, RequestedTransferView, SharedInvite, TransferView } from '@/lib/invites';

/**
 * **+ Add agent's fixtures** (P18.96-T3; ADR-0170): an invite as the server lists it, its shared form, a transfer, and
 * a join request — the rows `/new-hires`, the Unit Dashboard, *All Members* and the invite pages read.
 */
export const TODAY = '2026-10-27';

export const invite = (over: Partial<InviteView> = {}): InviteView => ({
  inviteId: 'inv-1', fullName: 'Yusuf Hidayat', agentCode: '80777', phone: '0812-8077-7001', joinDate: TODAY,
  status: 'pending', expiresAt: '2026-11-10T03:00:00.000Z', invitedAt: '2026-10-27T03:00:00.000Z',
  leader: { membershipId: 'mem-sari', name: 'Sari Puspita' }, existingAccount: false, ...over,
});

export const LINK = 'https://app.test/register?invite=kpm-1.secret';

export const shared = (over: Partial<InviteView> = {}): SharedInvite => ({ invite: invite(over), link: LINK });

export const transfer = (over: Partial<TransferView> = {}): TransferView => ({
  transferId: 'tr-1',
  member: { membershipId: 'mem-raka', name: 'Raka Aditama', agentCode: '87014' },
  from: { membershipId: 'mem-satria', name: 'Satria Nugraha' },
  to: { membershipId: 'mem-agus', name: 'Agus Prasetyo' },
  requestedBy: { membershipId: 'mem-agus', name: 'Agus Prasetyo' },
  requestedAt: '2026-10-26T03:00:00.000Z',
  requestedName: 'Raka Aditama',
  ...over,
});

/** The same request as Agus, who asked, is answered it: what he typed, and nothing of Satria's unit (M3). */
export const requestedTransfer = (over: Partial<RequestedTransferView> = {}): RequestedTransferView => ({
  transferId: 'tr-1',
  requestedName: 'Raka Aditama',
  agentCode: '87014',
  to: { membershipId: 'mem-agus', name: 'Agus Prasetyo' },
  status: 'pending',
  requestedAt: '2026-10-26T03:00:00.000Z',
  ...over,
});

export const joinRequest = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', membershipId: 'mem-putri', fullName: 'Putri Anggraini', initials: 'PA', email: 'putri@kpm0417.test',
  agentCode: '80008', role: 'agent', requestedAt: '2026-10-25T00:00:00.000Z', routedFromName: null,
  leaderMembershipId: 'mem-sari', leaderName: 'Sari Puspita', ...over,
});

/** The permissions a leader who adds and decides holds, on top of the activation's. */
export const JOINING_PERMISSIONS = ['member:invite', 'leader_request:read_inbox', 'leader_request:approve'];
