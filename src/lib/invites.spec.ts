import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  acceptInvite, addAgent, AGENT_CODE_DIGITS, approveTransfer, askedFor, cancelInvite, declineTransfer, inviteMessage, inviteTokenOf,
  inviteWhatsAppLink, readInviteBanner, readInvites, readMyTransfers, readTransferQueue, resendInvite,
} from './invites';

describe('+ Add agent’s calls (P18.96-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.96-T3 AC-1 to AC-4 calls the contract’s paths with its bodies, the ids and the token encoded', async () => {
    const { calls } = stubFetch({ '/': { body: {} } });
    await addAgent({ agentCode: '80777', fullName: 'Yusuf Hidayat', phone: '0812', joinDate: '2026-10-27' });
    await readInvites();
    await resendInvite('inv/1');
    await cancelInvite('inv-1');
    await readMyTransfers();
    await readInviteBanner('kpm.a/b');
    await acceptInvite('kpm.ab');
    await readTransferQueue();
    await approveTransfer('tr-1');
    await declineTransfer('tr-1', 'Not now.');
    await declineTransfer('tr-1');
    expect(calls.map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body])).toEqual([
      ['POST', '/new-hires/agents', '{"agentCode":"80777","fullName":"Yusuf Hidayat","phone":"0812","joinDate":"2026-10-27"}'],
      ['GET', '/new-hires/invites', undefined],
      ['POST', '/new-hires/invites/inv%2F1/resend', undefined],
      ['DELETE', '/new-hires/invites/inv-1', undefined],
      ['GET', '/new-hires/transfers', undefined],
      ['GET', '/invites/kpm.a%2Fb', undefined],
      ['POST', '/invites/kpm.ab/accept', undefined],
      ['GET', '/transfer-requests', undefined],
      ['POST', '/transfer-requests/tr-1/approve', undefined],
      ['POST', '/transfer-requests/tr-1/decline', '{"reason":"Not now."}'],
      ['POST', '/transfer-requests/tr-1/decline', '{}'],
    ]);
  });

  it('P18.96-T8 M3 names a request as its asker named them: the name typed, or the code on an older one', () => {
    const asked = { transferId: 't', agentCode: '87014', to: { membershipId: 'm', name: 'Agus' }, status: 'pending' as const, requestedAt: '' };
    expect(askedFor({ ...asked, requestedName: 'Raka A.' })).toBe('Raka A.');
    expect(askedFor({ ...asked, requestedName: null })).toBe('87014');
    expect(askedFor({ ...asked, requestedName: '' })).toBe('87014');
  });

  it('P18.96-T3 AC-2 Share on WhatsApp opens the invitee’s chat with the message filled in, from the number as typed', () => {
    const link = 'https://app.test/register?invite=kpm.abc';
    expect(inviteMessage(' Yusuf Hidayat ', link)).toBe(
      'Halo Yusuf Hidayat, saya mengundang Anda bergabung di tim saya di AgencyBoost: https://app.test/register?invite=kpm.abc',
    );
    // The leads' rule: a leading 0 becomes 62, every other character goes.
    expect(inviteWhatsAppLink('0812-8077-7001', 'Yusuf Hidayat', link)).toBe(
      `https://wa.me/6281280777001?text=${encodeURIComponent(inviteMessage('Yusuf Hidayat', link))}`,
    );
    expect(inviteWhatsAppLink('+62 812 8077 7001', 'Yusuf', link)).toMatch(/^https:\/\/wa\.me\/6281280777001\?text=/);
    // Not a number WhatsApp could open: no link, so the screen offers no button that fails.
    expect(inviteWhatsAppLink('12345', 'Yusuf', link)).toBeNull();
  });

  it('P18.96-T3 AC-4 reads the token from ?invite=, and the code’s digits', () => {
    expect(inviteTokenOf(new URLSearchParams('invite=kpm.abc'))).toBe('kpm.abc');
    expect(inviteTokenOf(new URLSearchParams('invite=%20'))).toBeNull();
    expect(inviteTokenOf(new URLSearchParams(''))).toBeNull();
    expect(AGENT_CODE_DIGITS.test('80777')).toBe(true);
    expect(AGENT_CODE_DIGITS.test('PRU-1')).toBe(false);
  });
});
