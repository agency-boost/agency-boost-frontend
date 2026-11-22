import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { addUser, placeUser } from './add-user';

/**
 * **WhatsApp's window, opened only where WhatsApp will open in it** (the integration round's walk of P19.26–P19.29,
 * 2026-11-22): *Masukkan* for somebody with no number opened a blank tab that shut again at once.
 */
const KPM = { id: 'k-1', code: '0602', branch: 'Bekasi Barat Branch', created: false };
const PLACED = (phone: string | null) => ({
  outcome: 'placed', membershipId: 'm-fajar', kpm: KPM, appLink: 'https://app.test/masuk',
  person: { userId: 'u-fajar', fullName: 'Fajar Nugroho', phone, email: 'fajar@contoh.test' },
});

afterEach(() => vi.unstubAllGlobals());

describe('lib/add-user — the WhatsApp window', () => {
  it('Masukkan, the account with no number: no window at all, and WhatsApp not opened', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED(null) } });
    const answer = await placeUser('u-fajar', { kpmId: 'k-1', role: 'AGENT' });
    expect(open).not.toHaveBeenCalled();
    expect(answer.whatsAppOpened).toBe(false);
  });

  it('Masukkan, the account with a number: WhatsApp opens at it once the place is saved, never a blank window first', async () => {
    const opened = { opener: {} as unknown };
    const open = vi.fn(() => opened);
    vi.stubGlobal('open', open);
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED('+6281211112222') } });
    const answer = await placeUser('u-fajar', { kpmId: 'k-1', role: 'AGENT' });
    expect(open).toHaveBeenCalledTimes(1);
    const [href] = open.mock.calls[0] as unknown as [string];
    expect(href).toMatch(/^https:\/\/wa\.me\/6281211112222\?text=/);
    expect(decodeURIComponent(href)).toContain('https://app.test/masuk');
    expect(opened.opener).toBeNull();
    expect(answer.whatsAppOpened).toBe(true);
  });

  it('Masukkan, a browser that refuses the window: saved, and WhatsApp not opened', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED('+6281211112222') } });
    expect((await placeUser('u-fajar', { kpmId: 'k-1' })).whatsAppOpened).toBe(false);
  });

  /*
   * **iPhone Safari blocks a window opened after the save answers** (the lead's walk, 2026-11-22): with the row's
   * `hasPhone`, *Masukkan* opens the window in the press, as *Tambah user* does, and points it at WhatsApp afterwards.
   */
  it('Masukkan, a row with hasPhone: the window opens in the press, then WhatsApp opens in it', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    const open = vi.fn(() => opened);
    vi.stubGlobal('open', open);
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED('+6281211112222') } });
    const answer = await placeUser('u-fajar', { kpmId: 'k-1', role: 'AGENT' }, { hasPhone: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(opened.opener).toBeNull();
    expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/6281211112222\?text=/);
    expect(opened.close).not.toHaveBeenCalled();
    expect(answer.whatsAppOpened).toBe(true);
  });

  it('Masukkan, hasPhone but the answer carries no number: the window opened in the press is closed', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED(null) } });
    const answer = await placeUser('u-fajar', { kpmId: 'k-1' }, { hasPhone: true });
    expect(opened.close).toHaveBeenCalledTimes(1);
    expect(opened.location.href).toBe('');
    expect(answer.whatsAppOpened).toBe(false);
  });

  it('Masukkan, hasPhone and the save refused: the window opened in the press is closed and the refusal thrown', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({
      'POST /admin/accounts/u-fajar/placement': {
        status: 409, body: { error: { code: 'ORG_AGENT_ALREADY_TAGGED', message: 'Already Aktif.', requestId: 'r-1' } },
      },
    });
    await expect(placeUser('u-fajar', { kpmId: 'k-1' }, { hasPhone: true })).rejects.toBeTruthy();
    expect(opened.close).toHaveBeenCalledTimes(1);
  });

  it('Masukkan, hasPhone and a browser that refuses the window: saved, and WhatsApp not opened', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    stubFetch({ 'POST /admin/accounts/u-fajar/placement': { body: PLACED('+6281211112222') } });
    expect((await placeUser('u-fajar', { kpmId: 'k-1' }, { hasPhone: true })).whatsAppOpened).toBe(false);
  });

  it('Tambah user: a number WhatsApp reads opens the window in the press; one it cannot read opens none', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    const open = vi.fn(() => opened);
    vi.stubGlobal('open', open);
    const invited = {
      outcome: 'invited', link: 'https://app.test/user-invite/t', kpm: KPM,
      invitation: { id: 'inv-1', kpmId: 'k-1', fullName: 'Rina Kartika', phone: '+6281277884410', email: null },
    };
    stubFetch({ 'POST /user-invitations': { body: invited } });
    const answer = await addUser({ fullName: 'Rina Kartika', phone: '+6281277884410', kpmId: 'k-1' });
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/6281277884410\?text=/);
    expect(answer.whatsAppOpened).toBe(true);

    open.mockClear();
    stubFetch({ 'POST /user-invitations': { body: { ...invited, invitation: { ...invited.invitation, phone: '' } } } });
    expect((await addUser({ fullName: 'Rina Kartika', phone: '', kpmId: 'k-1' })).whatsAppOpened).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
