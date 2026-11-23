import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { sameName } from '@/lib/account-retirement';
import { RetireAccountDialog } from './retire-account-dialog';

/**
 * ***Hapus akun*** **— the confirmation** (P19.31-T2 AC-2; ADR-0289): what ends, what stays, a reason and the name typed
 * in full; a refusal's sentence in place of the button. English is this spec's; the console reads Indonesian by default.
 */
const PREVIEW = {
  userId: 'u-simonta', fullName: 'Simonta  Tuan', email: 'simonta.prudential@contoh.test', kpmsWithHistory: 1, refusal: null,
  membership: { membershipId: 'm-1', kpmId: 'k-1', kpmName: 'BSD City Branch', kpmCode: '0417', status: 'active' },
};
const URL = '/admin/accounts/u-simonta/retirement';

afterEach(() => vi.unstubAllGlobals());

describe('P19.31-T2 the Hapus akun confirmation', () => {
  it('P19.31-T2 AC-2 says what ends — the login, the membership — and what stays, then asks a reason and the name', async () => {
    stubFetch({ [`GET ${URL}`]: { body: PREVIEW } });
    renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={vi.fn()} />);
    const box = screen.getByRole('dialog', { name: 'Delete account' });
    const ends = await within(box).findByRole('region', { name: 'What ends' });
    expect(ends).toHaveTextContent('The login: simonta.prudential@contoh.test and its password no longer sign in.');
    expect(ends).toHaveTextContent('Membership in BSD City Branch (KPM 0417): removed from the KPM.');
    const stays = within(box).getByRole('region', { name: 'What stays' });
    expect(stays).toHaveTextContent('Their history in 1 KPM — activity, leads, coaching and the rest — stays, with their name.');
    expect(stays).toHaveTextContent('Their email and agent code can be used again for a new account.');
    expect(within(box).getByLabelText('Reason')).toBeInTheDocument();
    expect(within(box).getByLabelText('Type “Simonta Tuan” to confirm')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Delete account' })).toBeDisabled();
  });

  it('P19.31-T2 AC-2 the button is live once there is a reason and the name typed is theirs, any case and spacing', async () => {
    const onDone = vi.fn();
    const { calls } = stubFetch({
      [`GET ${URL}`]: { body: PREVIEW },
      [`POST ${URL}`]: { body: { userId: 'u-simonta', fullName: 'Simonta  Tuan', retiredAt: '2026-11-23T03:00:00.000Z', membershipEnded: null, invitationsCancelled: 0 } },
    });
    renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={onDone} />);
    const box = screen.getByRole('dialog', { name: 'Delete account' });
    const button = await within(box).findByRole('button', { name: 'Delete account' });
    await userEvent.type(within(box).getByLabelText('Reason'), 'Dibuat ulang dari file District 41.');
    await userEvent.type(within(box).getByLabelText('Type “Simonta Tuan” to confirm'), 'simonta');
    expect(button).toBeDisabled();
    await userEvent.type(within(box).getByLabelText('Type “Simonta Tuan” to confirm'), ' TUAN ');
    expect(button).toBeEnabled();
    // The danger button: red outline, the token's.
    expect(button).toHaveClass('border-alert', 'text-alert');
    await userEvent.click(button);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Simonta  Tuan'));
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(String(post?.init.body))).toEqual({ reason: 'Dibuat ulang dari file District 41.', fullName: 'simonta TUAN ' });
  });

  it.each([
    ['ACCOUNT_RETIRE_OWNER', 'They are an owner of Kelapa Gading Branch. Remove them as owner first (Kelola owner), then delete the account.'],
    ['ACCOUNT_RETIRE_HAS_REPORTS', '2 people report to them in BSD City Branch. Move them to another leader first (Ganti leader), then delete the account.'],
    ['ACCOUNT_RETIRE_PLATFORM_TEAM', 'This is an AgencyBoost team account. Remove them from the platform team first, if they should go.'],
  ])('P19.31-T2 AC-2 %s: its sentence in place of the button, and Close alone', async (code, message) => {
    stubFetch({ [`GET ${URL}`]: { body: { ...PREVIEW, refusal: { code, message, details: {} } } } });
    renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={vi.fn()} />);
    const box = screen.getByRole('dialog', { name: 'Delete account' });
    expect(await within(box).findByRole('alert')).toHaveTextContent(message);
    expect(within(box).queryByRole('button', { name: 'Delete account' })).toBeNull();
    expect(within(box).queryByLabelText('Reason')).toBeNull();
    expect(within(box).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });

  it('P19.31-T2 AC-2 a refusal when it is pressed (the state changed meanwhile) is said in the dialog', async () => {
    stubFetch({
      [`GET ${URL}`]: { body: PREVIEW },
      [`POST ${URL}`]: { status: 409, body: { error: { code: 'ACCOUNT_RETIRE_OWNER', message: 'They are an owner of BSD City Branch.', requestId: 'r' } } },
    });
    const onDone = vi.fn();
    renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={onDone} />);
    const box = screen.getByRole('dialog', { name: 'Delete account' });
    await within(box).findByRole('region', { name: 'What ends' });
    await userEvent.type(within(box).getByLabelText('Reason'), 'x');
    await userEvent.type(within(box).getByLabelText('Type “Simonta Tuan” to confirm'), 'Simonta Tuan');
    await userEvent.click(within(box).getByRole('button', { name: 'Delete account' }));
    expect(await within(box).findByText('They are an owner of BSD City Branch.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('P19.31-T2 AC-2 in Indonesian, and an account in no KPM: nothing else ends', async () => {
    stubFetch({ [`GET ${URL}`]: { body: { ...PREVIEW, membership: null, kpmsWithHistory: 0 } } });
    renderInIndonesian(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={vi.fn()} />);
    const box = screen.getByRole('dialog', { name: 'Hapus akun' });
    const ends = await within(box).findByRole('region', { name: 'Yang berakhir' });
    expect(ends).toHaveTextContent('Login: simonta.prudential@contoh.test dan password-nya tidak bisa dipakai masuk lagi.');
    expect(ends).not.toHaveTextContent('Keanggotaan');
    expect(within(box).getByRole('region', { name: 'Yang tetap' })).toHaveTextContent('Tidak ada yang lain: dia belum masuk KPM mana pun.');
    expect(within(box).getByLabelText('Alasan')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Hapus akun' })).toBeDisabled();
  });

  it('P19.31-T2 has no axe violations, ready and refused', async () => {
    const rules = { rules: { 'color-contrast': { enabled: false } } };
    stubFetch({ [`GET ${URL}`]: { body: PREVIEW } });
    const ready = renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={vi.fn()} />);
    await screen.findByRole('region', { name: 'What ends' });
    expect((await axe(ready.baseElement, rules)).violations ?? []).toEqual([]);
    ready.unmount();
    stubFetch({ [`GET ${URL}`]: { body: { ...PREVIEW, refusal: { code: 'ACCOUNT_RETIRE_OWNER', message: 'Owner.', details: {} } } } });
    const refused = renderWithSession(<RetireAccountDialog userId="u-simonta" fallbackName="Simonta Tuan" onClose={vi.fn()} onDone={vi.fn()} />);
    await screen.findByRole('alert');
    expect((await axe(refused.baseElement, rules)).violations ?? []).toEqual([]);
  });

  it('P19.31-T2 sameName compares as the server does', () => {
    expect(sameName('  simonta   TUAN ', 'Simonta Tuan')).toBe(true);
    expect(sameName('Simonta', 'Simonta Tuan')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });
});
