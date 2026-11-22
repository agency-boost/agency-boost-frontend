import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { OwnerWhatsAppInviteButton } from './owner-whatsapp-invite';

/**
 * ***Kirim undangan* — the KPM Owner invited by WhatsApp** (P19.23-T2 AC-3; ADR-0277; OD-420): the window opened inside
 * the click, the link asked for, the window pointed at WhatsApp with the Owner's number and the message in Indonesian;
 * the browser's blocked window, a number WhatsApp cannot open and the API's refusal each said under the button, the
 * window closed again.
 */
const CLAIM = {
  kind: 'claim', link: 'https://app.agencyboost.test/owner-invite/kpm-1.secret', ownerName: 'BUDI HARTONO',
  ownerPhone: '+6281234567890', kpmName: 'Serpong Branch', kpmCode: '0418', companyName: 'Prudential',
  expiresAt: '2026-11-27T03:00:00.000Z',
};
const ROUTE = 'POST /admin/tenants/kpm-1/owner/whatsapp-invitation';

let opened: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> } | null;
let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  opened = { opener: 'console', location: { href: 'about:blank' }, close: vi.fn() };
  open = vi.fn(() => opened);
  vi.stubGlobal('open', open);
});
afterEach(() => vi.unstubAllGlobals());

describe('P19.23-T2 AC-3 Kirim undangan', () => {
  it('P19.23-T2 AC-3 opens the window in the click, then points it at WhatsApp with the Owner’s number and the link', async () => {
    stubFetch({ [ROUTE]: { body: CLAIM } });
    const onSent = vi.fn();
    renderInIndonesian(<OwnerWhatsAppInviteButton kpmId="kpm-1" ownerName="BUDI HARTONO" onSent={onSent} />, {});
    await userEvent.click(screen.getByRole('button', { name: 'Kirim undangan ke BUDI HARTONO lewat WhatsApp' }));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(opened!.opener).toBeNull();
    const href = new URL(opened!.location.href);
    expect(`${href.origin}${href.pathname}`).toBe('https://wa.me/6281234567890');
    expect(href.searchParams.get('text')).toBe(
      'Halo BUDI HARTONO, KPM Serpong Branch · Prudential Anda sudah siap di AgencyBoost. Buka tautan ini untuk masuk '
      + 'sebagai owner: https://app.agencyboost.test/owner-invite/kpm-1.secret',
    );
    expect(await screen.findByText('WhatsApp terbuka untuk BUDI HARTONO. Kirim pesannya di sana.')).toBeInTheDocument();
    expect(opened!.close).not.toHaveBeenCalled();
  });

  it('P19.23-T2 AC-3 an Owner whose account never signed in gets the password link’s words', async () => {
    stubFetch({ [ROUTE]: { body: { ...CLAIM, kind: 'password', link: 'https://app.agencyboost.test/reset-password/abc' } } });
    renderInIndonesian(<OwnerWhatsAppInviteButton kpmId="kpm-1" />, {});
    await userEvent.click(screen.getByRole('button', { name: 'Kirim undangan' }));
    await waitFor(() => expect(opened!.location.href).toContain('wa.me'));
    expect(new URL(opened!.location.href).searchParams.get('text'))
      .toContain('Buka tautan ini untuk membuat kata sandi dan masuk sebagai owner: https://app.agencyboost.test/reset-password/abc');
  });

  it('P19.23-T2 AC-3 a browser that blocks the window: said, and nothing asked of the API', async () => {
    open.mockReturnValue(null);
    const { calls } = stubFetch({ [ROUTE]: { body: CLAIM } });
    renderWithSession(<OwnerWhatsAppInviteButton kpmId="kpm-1" />, {});
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The browser blocked the new window. Allow pop-ups for AgencyBoost, then try again.');
    expect(calls).toEqual([]);
  });

  it('P19.23-T2 AC-3 a number WhatsApp cannot open: the window closed, the reader told to correct it', async () => {
    stubFetch({ [ROUTE]: { body: { ...CLAIM, ownerPhone: null } } });
    renderWithSession(<OwnerWhatsAppInviteButton kpmId="kpm-1" />, {});
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('BUDI HARTONO\'s WhatsApp number cannot be opened.');
    expect(opened!.close).toHaveBeenCalled();
  });

  it('P19.23-T2 AC-3 the API’s refusal, in its own words, the window closed and the button usable again', async () => {
    stubFetch({
      [ROUTE]: {
        status: 409,
        body: { error: { code: 'TENANT_OWNER_NOT_INVITABLE', message: 'Rina has already signed in, so there is nothing to invite them to.', requestId: 'r-1' } },
      },
    });
    renderWithSession(<OwnerWhatsAppInviteButton kpmId="kpm-1" variant="outline" label="Kirim ulang" />, {});
    await userEvent.click(screen.getByRole('button', { name: 'Kirim ulang' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rina has already signed in');
    expect(opened!.close).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Kirim ulang' })).toBeEnabled();
  });
});
