import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { LeaderPicker, type LeaderPickerProps } from './leader-picker';

const choice = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-sari', fullName: 'Sari Puspita', agentCode: '10004', orgLevelCode: 'AAB', role: 'aab',
  unitSize: 3, direct: true, ...over,
});
const YOSEF = choice({ membershipId: 'mem-yosef', fullName: 'Yosef Tambunan', agentCode: '87001', orgLevelCode: 'AB', role: 'ab', unitSize: 9, direct: false });

function picker(over: Partial<LeaderPickerProps> = {}) {
  const props: LeaderPickerProps = {
    open: true, membershipId: 'mem-maya', memberName: 'Maya Anggraini', downlineCount: 2, mode: 'office',
    onDone: vi.fn(), onClose: vi.fn(), ...over,
  };
  return { props, ui: <LeaderPicker {...props} /> };
}

/**
 * **The shared leader picker** (P19.12-T4; ADR-0247 §2–§3): *Ganti* on the member page's *Melapor ke* and *Pindahkan ke
 * leader lain* on *Tim Anda*. Which group a leader is in is the server's (`direct`); what a choice does follows it.
 */
describe('P19.12-T4 LeaderPicker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.12-T4 AC-2 the office: one list with no heading, every choice moved at once; PUT, then onDone with the member', async () => {
    const moved = { membershipId: 'mem-maya', leaderId: 'mem-sari' };
    const { calls } = stubFetch({
      '/members/mem-maya/leader-choices': { body: [choice()] },
      'PUT /members/mem-maya/leader': { body: moved },
    });
    const { props, ui } = picker();
    renderWithSession(ui);
    const dialog = await screen.findByRole('dialog', { name: 'Move Maya Anggraini to another leader' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Sari Puspita' }));
    expect(within(dialog).queryByRole('heading', { name: 'In your team' })).toBeNull();
    expect(within(dialog).getByText('Maya Anggraini and the 2 people under them move to Sari Puspita’s unit now.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move now' }));
    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledWith({ kind: 'moved', member: moved, leader: choice() }));
    expect(JSON.parse(String(calls.find((c) => c.init.method === 'PUT')?.init.body))).toEqual({ leaderMembershipId: 'mem-sari' });
  });

  it('P19.12-T4 AC-2 says nobody else moves when nobody is under them, and offers another choice', async () => {
    stubFetch({ '/leader-choices': { body: [choice(), YOSEF] } });
    renderWithSession(picker({ downlineCount: 0 }).ui);
    await userEvent.click(await screen.findByRole('button', { name: 'Sari Puspita' }));
    expect(screen.getByText('Maya Anggraini moves to Sari Puspita’s unit now.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose another leader' }));
    expect(await screen.findByRole('button', { name: 'Yosef Tambunan' })).toBeInTheDocument();
  });

  it('P19.12-T4 AC-3 a leader: two headed groups; a choice outside the tree is a request, POST, onDone with the move waiting', async () => {
    const waiting = { transferId: 'tr-9', toName: 'Yosef Tambunan', requestedAt: '2026-11-11T03:00:00.000Z' };
    const { calls } = stubFetch({
      '/leader-choices': { body: [choice(), YOSEF] },
      'POST /members/mem-maya/transfer-request': { status: 201, body: waiting },
    });
    const { props, ui } = picker({ mode: 'leader' });
    renderWithSession(ui);
    const direct = await screen.findByTestId('leader-choices-direct');
    expect(within(direct).getByText(/AAB · 10004 · 3 people under them/)).toBeInTheDocument();
    expect(within(screen.getByTestId('leader-choices-request')).getByText('Yosef Tambunan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yosef Tambunan' }));
    await userEvent.type(screen.getByLabelText('Why? (optional)'), 'Dekat kantor');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledWith({ kind: 'requested', transfer: waiting, leader: YOSEF }));
    expect(JSON.parse(String(calls.find((c) => c.init.method === 'POST')?.init.body))).toEqual({
      leaderMembershipId: 'mem-yosef', reason: 'Dekat kantor',
    });
  });

  it('P19.12-T4 AC-3 a refusal that says the move may be asked for turns the choice into a request', async () => {
    stubFetch({
      '/leader-choices': { body: [choice()] },
      'PUT /members/mem-maya/leader': {
        status: 403,
        body: { error: { code: 'ORG_LEADER_CHANGE_NOT_PERMITTED', message: 'That leader is outside your team.', details: { canRequest: true }, requestId: 'r-1' } },
      },
    });
    const { props, ui } = picker({ mode: 'leader' });
    renderWithSession(ui);
    await userEvent.click(await screen.findByRole('button', { name: 'Sari Puspita' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That leader is outside your team.');
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument();
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it('P19.12-T4 AC-2 searches by name or code, and says when nothing matches — or there is nobody', async () => {
    const { calls } = stubFetch({ '/leader-choices?q=zz': { body: [] }, '/leader-choices': [{ body: [choice()] }, { body: [] }] });
    renderWithSession(picker().ui);
    await screen.findByRole('button', { name: 'Sari Puspita' });
    await userEvent.type(screen.getByLabelText('Search a leader'), 'zz');
    expect(await screen.findByText('No leader matches that.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/members/mem-maya/leader-choices?q=zz'))).toBe(true);
  });

  it('P19.12-T4 AC-2 an empty office says so', async () => {
    stubFetch({ '/leader-choices': { body: [] } });
    renderWithSession(picker().ui);
    expect(await screen.findByText('There is no leader to move them to.')).toBeInTheDocument();
  });

  it('P19.12-T4 AC-2 a failed read is said, not shown as nobody', async () => {
    stubFetch({ '/leader-choices': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Membership not found.', requestId: 'r-1' } } } });
    renderWithSession(picker().ui);
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership not found.');
    expect(screen.queryByText('There is no leader to move them to.')).toBeNull();
  });

  it('P19.12-T4 AC-8 in Indonesian, the client’s two sentences as written', async () => {
    stubFetch({ '/leader-choices': { body: [choice(), YOSEF] } });
    renderInIndonesian(picker({ mode: 'leader' }).ui);
    expect(await screen.findByRole('heading', { name: 'Di tim Anda' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leader lain · perlu persetujuan Owner/Admin' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sari Puspita' }));
    expect(screen.getByText('Maya Anggraini dan 2 orang di bawahnya pindah ke unit Sari Puspita sekarang.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pilih leader lain' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yosef Tambunan' }));
    expect(screen.getByText(
      'Ini dikirim sebagai permintaan ke Owner/Admin. Maya Anggraini tetap melapor kepada Anda sampai disetujui.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim permintaan' })).toBeInTheDocument();
  });
});
