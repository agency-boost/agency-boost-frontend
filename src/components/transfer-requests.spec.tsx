import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { transfer } from '@test/joining-fixtures';
import { TransferRequests } from './transfer-requests';

/**
 * ***Permintaan pindah unit*** on All members › *Menunggu* (P19.20-T1 AC-4; the People mockup's frame 11): who, from → to,
 * who asked, *seluruh tim ikut pindah*, *Tolak* / *Setujui*.
 */
describe('P19.20-T1 AC-4 move requests on Menunggu', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.20-T1 AC-4 lists who moves, who asked, from where to where, oldest first, the whole team moving', async () => {
    const later = transfer({
      transferId: 'tr-2', requestedAt: '2026-10-28T03:00:00.000Z',
      member: { membershipId: 'mem-dimas', name: 'Dimas Pratama', agentCode: '80102' },
    });
    stubFetch({ '/transfer-requests': { body: [later, transfer()] } });
    const onCount = vi.fn();
    renderWithSession(<TransferRequests onCount={onCount} />);

    const rows = await screen.findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Raka Aditama · 87014');
    expect(rows[0]).toHaveTextContent('Requested by AGUS PRASETYO · moves from SATRIA NUGRAHA to AGUS PRASETYO');
    expect(rows[1]).toHaveTextContent('Dimas Pratama');
    expect(screen.getByText('oldest first · the whole team moves')).toBeInTheDocument();
    expect(onCount).toHaveBeenLastCalledWith(2);
  });

  it('P19.20-T1 AC-4 Setujui asks once, then moves; the queue is the server’s answer', async () => {
    const { calls } = stubFetch({
      '/transfer-requests': { body: [transfer()] },
      'POST /transfer-requests/tr-1/approve': { body: [] },
    });
    renderWithSession(<TransferRequests />);

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/tr-1/approve'))).toBe(true));
    await vi.waitFor(() => expect(screen.queryByText('Raka Aditama')).not.toBeInTheDocument());
  });

  it('P19.20-T2 AC-4 Tolak asks why in a centred dialog with Batal and a red Tolak, and sends the reason', async () => {
    const { calls } = stubFetch({
      '/transfer-requests': { body: [transfer()] },
      'POST /transfer-requests/tr-1/decline': { body: [] },
    });
    renderWithSession(<TransferRequests />);

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Bukan wilayah saya');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));

    await vi.waitFor(() => {
      const call = calls.find((c) => c.url.includes('/tr-1/decline'));
      expect(JSON.parse(String(call?.init.body))).toEqual({ reason: 'Bukan wilayah saya' });
    });
  });

  it('P19.20-T1 AC-4 draws nothing while none waits', async () => {
    stubFetch({ '/transfer-requests': { body: [] } });
    const onCount = vi.fn();
    renderWithSession(<TransferRequests onCount={onCount} />);

    await vi.waitFor(() => expect(onCount).toHaveBeenCalledWith(0));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('P19.20-T1 AC-4 in Indonesian, as the mockup words it', async () => {
    stubFetch({ '/transfer-requests': { body: [transfer()] } });
    renderInIndonesian(<TransferRequests />);

    expect(await screen.findByRole('heading', { name: 'Permintaan pindah unit' })).toBeInTheDocument();
    expect(screen.getByText('terlama dulu · seluruh tim ikut pindah')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Diajukan AGUS PRASETYO · pindah dari SATRIA NUGRAHA ke AGUS PRASETYO');
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeInTheDocument();
  });
});
