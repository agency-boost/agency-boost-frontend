import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { kpmOwnersMessages } from '@/i18n/messages/kpm-owners';
import { BSD, CONSOLE_SUPER_ADMIN, PEOPLE } from '@test/console-fixtures';
import type { ConsoleKpmPeople } from '@/lib/admin-console';
import type { KpmOwnerView } from '@/lib/kpm-owners';
import { KpmOwnerAdminSection } from './kpm-owner-admin-section';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/x',
}));

const RULES = { rules: { 'color-contrast': { enabled: false } } };
const WILSON = PEOPLE.owners.owners[0];
const SARI: KpmOwnerView = {
  userId: 'u-sari', membershipId: 'm-sari', fullName: 'Sari Puspita', agentCode: '86004', role: 'aab', photoUrl: null,
  since: '2026-11-22T03:00:00.000Z', state: 'invited',
};
const withOwners = (owners: KpmOwnerView[], canManage = true): ConsoleKpmPeople => ({ ...PEOPLE, owners: { owners, canManage } });
const TREE = {
  nodes: [
    { membershipId: 'm-wilson', fullName: 'Wilson Tanoto', preferredName: null, initials: 'WT', agentCode: '86001', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 1, directCounts: { ab: 0, aab: 1, agent: 0, total: 1 }, subtreeCount: 2, isLeader: true, isSelf: false },
    { membershipId: 'm-sari', fullName: 'Sari Puspita', preferredName: null, initials: 'SP', agentCode: '86004', role: 'aab', depth: 1, layer: 2, leaderId: 'm-wilson', directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 }, subtreeCount: 1, isLeader: true, isSelf: false },
    { membershipId: 'm-joko', fullName: 'Joko Prasetyo', preferredName: null, initials: 'JP', agentCode: '86005', role: 'agent', depth: 2, layer: 3, leaderId: 'm-sari', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
  ],
  leader: null, rootIds: ['m-wilson'], selfId: null, counts: { ab: 1, aab: 1, agent: 1, total: 3 },
};

/**
 * ***Owner & admin* on the KPM page** (P19.27-T2; ADR-0285; F-2 of the 21 November brief; the mockup's screens 6–8, stop
 * motion C frames 1–9): *KPM Owner · n* with *＋ Tambah owner*, each owner's ⋯ — *Lihat profil*, *Kirim ulang undangan*
 * while invited, *Hapus sebagai owner* asked first and greyed on the last owner — two cards on a phone, the existing card
 * from 768px, and the *Tambah owner* sheet: a bottom sheet on a phone, a centred dialog from 768px.
 */
describe('P19.27-T2 KpmOwnerAdminSection', () => {
  const changed = vi.fn();
  const show = (people: ConsoleKpmPeople) =>
    renderInIndonesian(<KpmOwnerAdminSection people={people} onChanged={changed} />, { me: CONSOLE_SUPER_ADMIN });

  beforeEach(() => {
    atWidth(1024);
    changed.mockReset();
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.27-T2 AC-1, AC-6 from 768px the owner list sits in the existing Owner & admin card, Admin and Core leader as they were', async () => {
    stubFetch({});
    show(withOwners([WILSON, SARI]));
    const card = await screen.findByRole('region', { name: 'Owner & admin' });
    expect(card).toHaveAttribute('id', 'owners');
    expect(within(card).getByRole('heading', { name: 'KPM Owner · 2' })).toBeInTheDocument();
    const sari = card.querySelector('[data-owner-row="u-sari"]') as HTMLElement;
    expect(sari).toHaveTextContent('AABSari Puspita');
    expect(sari).toHaveTextContent('Owner sejak Nov 2026 · Diundang');
    expect(card.querySelector('[data-owner-row="u-wilson"]')).toHaveTextContent('Owner sejak Agu 2026');
    expect(within(card).getByText('Linda Kusuma')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Tambah admin' })).toHaveAttribute('href', '/people/admins');
  });

  it('P19.27-T2 AC-1, AC-5 on a phone two cards: KPM Owner · n with 52px rows, then Admin · n and Core leader · n', async () => {
    atWidth(375);
    stubFetch({});
    show(withOwners([WILSON], true));
    const owners = await screen.findByRole('region', { name: 'KPM Owner · 1' });
    expect(owners.querySelector('[data-owner-row="u-wilson"]')).toHaveClass('min-h-[52px]');
    expect(within(owners).getByRole('button', { name: /Tambah owner/ })).toHaveClass('min-h-11');
    const admins = document.querySelector('[data-admins-card]') as HTMLElement;
    expect(within(admins).getByRole('heading', { name: 'Admin · 1' })).toBeInTheDocument();
    expect(within(admins).getByRole('heading', { name: 'Core leader · 2' })).toBeInTheDocument();
    expect(within(admins).getByRole('link', { name: /Tambah admin/ })).toHaveAttribute('href', '/people/admins');
    expect(within(admins).getByRole('link', { name: /Atur/ })).toHaveAttribute('href', '/people/admins');
  });

  it('P19.27-T2 AC-5 on a phone with no admin: Belum ada admin', async () => {
    atWidth(375);
    stubFetch({});
    show({ ...withOwners([WILSON]), admins: [] });
    expect(await screen.findByText('Belum ada admin')).toBeInTheDocument();
  });

  it('P19.27-T2 AC-3 an owner’s ⋯: Lihat profil, Kirim ulang undangan while invited, Hapus sebagai owner in red', async () => {
    stubFetch({});
    show(withOwners([WILSON, SARI]));
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent?.trim()))
      .toEqual(['Lihat profil', 'Kirim ulang undangan', 'Hapus sebagai owner']);
    // Red: its words in the danger token, not a glyph alone (the integration round's walk, 2026-11-22).
    expect(screen.getByRole('menuitem', { name: 'Hapus sebagai owner' })).toHaveClass('text-alert');
    expect(screen.getByRole('menuitem', { name: 'Lihat profil' })).not.toHaveClass('text-alert');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lihat profil' }));
    expect(push).toHaveBeenCalledWith('/people/members/m-sari');
    // Signed in: nothing to resend.
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Wilson Tanoto' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent?.trim())).toEqual(['Lihat profil', 'Hapus sebagai owner']);
  });

  it('P19.27-T2 AC-3 Hapus sebagai owner always asks — "Hapus Sari sebagai owner?" / "Sari tetap anggota (AAB)." — then removes', async () => {
    const { calls } = stubFetch({ 'DELETE /members/m-sari/owner': { body: { owners: [WILSON], canManage: true } } });
    show(withOwners([WILSON, SARI]));
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus sebagai owner' }));
    const ask = screen.getByRole('dialog', { name: 'Hapus Sari sebagai owner?' });
    expect(ask).toHaveTextContent('Sari tetap anggota (AAB).');
    expect(calls).toHaveLength(0);
    await userEvent.click(within(ask).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus sebagai owner' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hapus' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([['DELETE', expect.stringContaining('/members/m-sari/owner')]]);
  });

  it('P19.27-T2 AC-3 the last owner: the item is greyed out with "Tambah owner lain dulu", and does nothing', async () => {
    const { calls } = stubFetch({});
    show(withOwners([WILSON]));
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Wilson Tanoto' }));
    const item = screen.getByRole('menuitem', { name: /Hapus sebagai owner/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('Tambah owner lain dulu');
    await userEvent.click(item);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('P19.27-T2 AC-3 a refusal from the server is said in the card (409 KPM_LAST_OWNER)', async () => {
    stubFetch({
      'DELETE /members/m-sari/owner': { status: 409, body: { error: { code: 'KPM_LAST_OWNER', message: 'Sari Puspita adalah satu-satunya owner KPM ini, dan KPM selalu punya owner. Tambah owner lain dulu.', requestId: 'r1' } } },
    });
    show(withOwners([WILSON, SARI]));
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus sebagai owner' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hapus' }));
    expect(await screen.findByText(/satu-satunya owner KPM ini/)).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it('P19.27-T1 AC-4 Kirim ulang undangan opens WhatsApp for that owner — the route names them', async () => {
    const opened = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    const { calls } = stubFetch({
      [`POST /admin/tenants/${BSD}/owner/whatsapp-invitation`]: {
        body: { kind: 'password', link: 'https://agencyboost.id/reset-password/x', ownerName: 'Sari Puspita', ownerPhone: '+6281299990000', kpmName: 'BSD City Branch', kpmCode: '0417', companyName: 'Prudential', expiresAt: '2026-11-29T03:00:00.000Z' },
      },
    });
    show(withOwners([WILSON, SARI]));
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Kirim ulang undangan' }));
    await waitFor(() => expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/6281299990000\?text=/));
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ userId: 'u-sari' });
  });

  it('P19.27-T2 AC-2 Tambah owner: this KPM’s members, owners left out; one radio row each; Jadikan owner pinned; the toast', async () => {
    const { calls } = stubFetch({
      '/members/tree': { body: TREE },
      'POST /members/m-joko/owner': { body: { owners: [WILSON], canManage: true } },
    });
    show(withOwners([WILSON, SARI]));
    await userEvent.click(await screen.findByRole('button', { name: /Tambah owner/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Tambah owner' });
    // From 768px a centred dialog (AC-6).
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', 'center');
    await within(sheet).findByText('Joko Prasetyo');
    expect(within(sheet).queryByText('Wilson Tanoto')).not.toBeInTheDocument();
    expect(within(sheet).queryByText('Sari Puspita')).not.toBeInTheDocument();
    expect(within(sheet).getByPlaceholderText('Cari anggota KPM ini')).toBeInTheDocument();
    const make = within(sheet).getByRole('button', { name: 'Jadikan owner' });
    expect(make).toBeDisabled();
    await userEvent.click(within(sheet).getByRole('radio'));
    await userEvent.click(make);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(calls.some((c) => c.url.includes('/members/m-joko/owner') && c.init.method === 'POST')).toBe(true);
    expect(await screen.findByText('Joko Prasetyo jadi owner')).toBeInTheDocument();
  });

  it('P19.27-T2 AC-2 on a phone the sheet rises from the foot, with its handle', async () => {
    atWidth(375);
    stubFetch({ '/members/tree': { body: TREE } });
    show(withOwners([WILSON]));
    await userEvent.click(await screen.findByRole('button', { name: /Tambah owner/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Tambah owner' });
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', 'sheet');
  });

  it('P19.27-T2 a KPM whose owner waits, named with no email: the name, Belum diundang, and Kirim undangan', async () => {
    stubFetch({});
    show({ ...withOwners([]), owner: { state: 'not_invited', person: null, pendingName: 'BUDI HARTONO' } });
    const row = await waitFor(() => document.querySelector('[data-pending-owner]') as HTMLElement);
    expect(row).toHaveTextContent('BUDI HARTONO');
    expect(row).toHaveTextContent('Belum diundang');
    expect(within(row).getByRole('button', { name: /Kirim undangan/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'KPM Owner · 0' })).toBeInTheDocument();
  });

  it('P19.27-T2 a reader who may not manage owners sees the list, no Tambah owner and no Hapus', async () => {
    stubFetch({});
    show(withOwners([WILSON, SARI], false));
    await screen.findByRole('heading', { name: 'KPM Owner · 2' });
    expect(screen.queryByRole('button', { name: /Tambah owner/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Sari Puspita' }));
    expect(screen.queryByRole('menuitem', { name: /Hapus sebagai owner/ })).not.toBeInTheDocument();
  });

  it('P19.27-T2 axe, and no English left in Indonesian', async () => {
    stubFetch({});
    const { container } = show(withOwners([WILSON, SARI]));
    await screen.findByRole('heading', { name: 'KPM Owner · 2' });
    expect((await axe(container, RULES)).violations).toEqual([]);
    expect(englishShown(document.body, englishOnly(kpmOwnersMessages))).toEqual([]);
  });
});
