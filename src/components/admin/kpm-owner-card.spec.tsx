import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import type { TenantRow } from '@/lib/admin';
import { KpmOwnerCard } from './kpm-owner-card';

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:read_profile', 'kpm:assign_owner', 'impersonation:start'],
});

const KPM: TenantRow = {
  _id: 'kpm-0602', code: '0602', branchName: 'Bandung Dago', companyId: 'co-1', companyName: 'Prudential',
  address: null, contactPhone: null, timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-11-05T03:00:00.000Z', settings: {},
  ownerUserId: 'u-wulan', ownerName: 'Wulan Kartika', ownerEmail: 'wulan.kartika@example.test',
  subscription: null, leadersUsed: 1, subscriptionState: 'none',
  ownerState: 'invited', ownerPhone: '+6281277006020', ownerInvitedAt: '2026-11-05T03:00:00.000Z', pendingOwner: null,
  memberCount: 1, membersBesidesOwner: 0,
} as TenantRow;

/**
 * **The Owner's card** (P19.4-T3 AC-9; ADR-0212 §2–§4): the state, the number to call, *Kirim ulang undangan*, *Ganti
 * pemilik* and *Buka sebagai Owner* — at a phone's width and a laptop's.
 */
describe('P19.4-T3 the Owner’s card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 1280])('P19.4-T3 AC-9 at %ipx: Diundang, the WhatsApp number to call, the email, when it went, and the three actions', async (px) => {
    atWidth(px);
    renderInIndonesian(<KpmOwnerCard kpm={KPM} onChanged={vi.fn()} />, { me: SUPER_ADMIN });
    expect(screen.getByText('Wulan Kartika')).toBeInTheDocument();
    expect(screen.getByText('Diundang')).toBeInTheDocument();
    // A number to call, opening the Super Admin's own WhatsApp with nothing composed (ADR-0212 §4).
    const chat = screen.getByRole('link', { name: 'Buka WhatsApp ke Wulan Kartika' });
    expect(chat).toHaveAttribute('href', 'https://wa.me/6281277006020');
    expect(chat.getAttribute('href')).not.toContain('text=');
    expect(screen.getByText('wulan.kartika@example.test')).toBeInTheDocument();
    expect(screen.getByText('Undangan dikirim 5 Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim ulang undangan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ganti pemilik' })).toHaveAttribute('href', '/admin/tenants/kpm-0602/owner');
    expect(screen.getByRole('link', { name: 'Buka sebagai Owner' }))
      .toHaveAttribute('href', '/admin/impersonate/u-wulan?kpmId=kpm-0602');
  });

  it('P19.4-T3 AC-6 Kirim ulang undangan sends again, says so, and hands the page the KPM as the API answered it', async () => {
    const after = { ...KPM, ownerInvitedAt: '2026-11-06T03:00:00.000Z' };
    const { calls } = stubFetch({ '/admin/tenants/kpm-0602/owner/invitation': { body: after } });
    const onChanged = vi.fn();
    renderWithSession(<KpmOwnerCard kpm={KPM} onChanged={onChanged} />, { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'Send the invitation again' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(after));
    expect(calls.find((c) => c.url.endsWith('/admin/tenants/kpm-0602/owner/invitation'))!.init.method).toBe('POST');
    expect(screen.getByText('Invitation sent again.')).toBeInTheDocument();
  });

  it('P19.4-T3 AC-6 shows the API’s refusal where the button is, and changes nothing', async () => {
    stubFetch({
      '/admin/tenants/kpm-0602/owner/invitation': {
        status: 429,
        body: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many attempts. Try again in 60 minutes.', requestId: 'r-1' } },
      },
    });
    const onChanged = vi.fn();
    renderWithSession(<KpmOwnerCard kpm={KPM} onChanged={onChanged} />, { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'Send the invitation again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('P19.4-T3 AC-6 an Owner who has signed in reads Aktif, and is offered no invitation', () => {
    renderWithSession(<KpmOwnerCard kpm={{ ...KPM, ownerState: 'active' }} onChanged={vi.fn()} />, { me: SUPER_ADMIN });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send the invitation again' })).toBeNull();
  });

  it('P19.4-T3 AC-6 an Owner named with no email reads Belum diundang, with no resend: Ganti pemilik gives the email', () => {
    const pending = {
      ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null, ownerState: 'not_invited' as const, ownerInvitedAt: null,
      pendingOwner: { fullName: 'Wulan Kartika', phone: '+6281277006020', agentCode: '70045001' },
    };
    renderInIndonesian(<KpmOwnerCard kpm={pending} onChanged={vi.fn()} />, { me: SUPER_ADMIN });
    expect(screen.getByText('Wulan Kartika')).toBeInTheDocument();
    expect(screen.getByText('Belum diundang')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kirim ulang undangan' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buka sebagai Owner' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tetapkan pemilik' })).toHaveAttribute('href', '/admin/tenants/kpm-0602/owner');
  });

  it('P19.4-T3 AC-6 a KPM with nobody named says so', () => {
    const none = {
      ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null, ownerState: 'none' as const, ownerPhone: null,
      ownerInvitedAt: null,
    };
    renderWithSession(<KpmOwnerCard kpm={none} onChanged={vi.fn()} />, { me: SUPER_ADMIN });
    expect(screen.getByText('No owner yet. Nobody can run this KPM until one is set.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set owner' })).toBeInTheDocument();
  });

  it('draws no action for a reader without the grants (the API refuses them anyway)', () => {
    renderWithSession(<KpmOwnerCard kpm={KPM} onChanged={vi.fn()} />, { me: makeMe({ permissions: ['kpm:read_profile'] }) });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: /owner/i })).toBeNull();
  });
});
