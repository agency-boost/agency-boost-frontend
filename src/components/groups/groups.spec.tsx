import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { InLanguage, renderWithSession, stubFetch } from '../../../test/harness';
import { GroupCardMenu } from './group-actions';
import { GroupAbsSheet } from './group-abs-sheet';
import { GroupDialog } from './group-dialog';
import { TargetDialog } from './target-dialog';
import type { AbGroupTargetsView, InformalGroupsView } from '@/lib/informal-groups';

const AGUS = { membershipId: 'm-agus', name: 'Agus Prasetyo' };
const ab = (membershipId: string, name: string, over = {}) => ({
  membershipId, name, agentCode: null, isGroupLeader: false, isCoreLeader: false, people: 9, leaders: 3, ...over,
});

const GROUPS: InformalGroupsView = {
  groups: [
    {
      groupId: 'g-top', name: 'Top Producers 2026', leaders: [{ membershipId: 'm-wilson', name: 'Wilson Tanoto' }],
      abs: [ab('m-agus', 'Agus Prasetyo'), ab('m-wilson', 'Wilson Tanoto', { isGroupLeader: true, people: 1, leaders: 1 })],
      counts: { leaders: 4, people: 10, abGroups: 2 },
    },
    {
      groupId: 'g-new', name: 'New Agent Mentoring Circle', leaders: [], abs: [ab('m-satria', 'Satria Nugraha', { people: 3 })],
      counts: { leaders: 1, people: 3, abGroups: 1 },
    },
  ],
  ungrouped: { abs: [ab('m-yosef', 'Yosef Tambunan')], counts: { leaders: 2, people: 9, abGroups: 1 } },
  unplaced: 0,
  canWrite: true,
};

const row = (over = {}) => ({
  abMembershipId: 'm-agus', name: 'Agus Prasetyo', agentCode: null, isGroupLeader: false, people: 9,
  activeAgentTarget: 6, rekrutTarget: 3, source: 'set' as const, fromMonth: '2026-11', rekrutYtdTarget: 30,
  apeTargetMinor: 300_000_000_00, goalsSet: 4, ...over,
});
const totals = { activeAgentTarget: 6, rekrutTarget: 3, rekrutYtdTarget: 30, apeTargetMinor: 300_000_000_00, unset: 0, abGroups: 1, people: 9 };
const targets = (month = '2026-11', over = {}): AbGroupTargetsView => ({
  month, currentMonth: '2026-11', earliestMonth: '2024-01', latestMonth: '2027-11', max: 999, currency: 'IDR',
  total: { ...totals, unplacedPeople: 0 },
  groups: [{ group: { groupId: 'g-top', name: 'Top Producers 2026' }, leaders: [], totals, abGroups: [row(over)] }],
  canWrite: true,
});

describe('the target card (P19.17-T4; ADR-0270 §4)', () => {
  it('P19.17-T4 AC-4 reads the AB group’s month, steps both targets, and saves that month', async () => {
    const { calls } = stubFetch({
      'GET /kpm/ab-group-targets': { body: targets() },
      'PUT /kpm/ab-group-targets/m-agus': { body: targets('2026-11', { activeAgentTarget: 7, rekrutTarget: 2 }) },
    });
    const onSaved = vi.fn();
    renderWithSession(<TargetDialog ab={AGUS} onClose={() => {}} onSaved={onSaved} />);
    const dialog = await screen.findByRole('dialog', { name: 'Agus Prasetyo’s group targets' });
    expect(await within(dialog).findByText('AB · 9 people · Top Producers 2026')).toBeInTheDocument();
    const aa = within(dialog).getByRole('group', { name: 'Monthly Active Agent target' });
    expect(within(aa).getByText('6')).toBeInTheDocument();
    await userEvent.click(within(aa).getByRole('button', { name: /increase/i }));
    const rekrut = within(dialog).getByRole('group', { name: 'Monthly recruitment target' });
    await userEvent.click(within(rekrut).getByRole('button', { name: /decrease/i }));
    expect(within(dialog).getByText(/The APE target is not changed here/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(put.init.body as string)).toEqual({ month: '2026-11', activeAgentTarget: 7, rekrutTarget: 2 });
  });

  it('P19.17-T4 AC-4 starts at 0 with no target, holds − at 0, and shows a refusal in the dialog', async () => {
    stubFetch({
      'GET /kpm/ab-group-targets': { body: targets('2026-11', { activeAgentTarget: null, rekrutTarget: null, source: 'none' }) },
      'PUT /kpm/ab-group-targets/m-agus': { status: 403, body: { error: { code: 'PERM_DENIED', message: 'Not yours.', requestId: 'r1' } } },
    });
    renderWithSession(<TargetDialog ab={AGUS} onClose={() => {}} onSaved={() => {}} />);
    const aa = await screen.findByRole('group', { name: 'Monthly Active Agent target' });
    expect(within(aa).getByText('0')).toBeInTheDocument();
    expect(within(aa).getByRole('button', { name: /decrease/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not yours.');
  });

  it('reads its words in Indonesian, as the approved card writes them', async () => {
    stubFetch({ 'GET /kpm/ab-group-targets': { body: targets() } });
    renderWithSession(<InLanguage language="id"><TargetDialog ab={AGUS} onClose={() => {}} onSaved={() => {}} /></InLanguage>);
    expect(await screen.findByRole('dialog', { name: 'Target Group Agus Prasetyo' })).toBeInTheDocument();
    expect(await screen.findByText('Target Active Agent per bulan')).toBeInTheDocument();
    expect(screen.getByText('Target Rekrut per bulan')).toBeInTheDocument();
    expect(screen.getByText('Target APE tidak diubah di sini: diambil dari Goal Setting tiap orang.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });
});

describe('the Group dialog (P19.17-T4; ADR-0270 §1)', () => {
  it('P19.17-T4 AC-4 offers the groups and Tanpa group, the AB’s own chosen, and moves the AB', async () => {
    const { calls } = stubFetch({
      'GET /members/groups': { body: GROUPS },
      'PUT /members/m-agus/group': { body: GROUPS },
    });
    const onSaved = vi.fn();
    renderWithSession(<GroupDialog ab={{ ...AGUS, people: 9 }} onClose={() => {}} onSaved={onSaved} />);
    const dialog = await screen.findByRole('dialog', { name: 'Group for Agus Prasetyo' });
    expect(within(dialog).getByText('AB · 9 people move with Agus')).toBeInTheDocument();
    expect(await within(dialog).findByRole('radio', { name: 'Top Producers 2026' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'No group' })).not.toBeChecked();
    expect(within(dialog).getByRole('link', { name: /Manage every group in All members/ })).toHaveAttribute('href', '/people/members');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'New Agent Mentoring Circle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(GROUPS));
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')!.init.body as string)).toEqual({ groupId: 'g-new' });
  });

  it('P19.17-T4 Tanpa group sends null; the same group again only closes', async () => {
    const { calls } = stubFetch({ 'GET /members/groups': { body: GROUPS }, 'PUT /members/m-agus/group': { body: GROUPS } });
    const onClose = vi.fn();
    renderWithSession(<GroupDialog ab={AGUS} onClose={onClose} onSaved={() => {}} manageHref={null} />);
    await screen.findByRole('radio', { name: 'Top Producers 2026' });
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClose).toHaveBeenCalled();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: 'No group' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')!.init.body as string)).toEqual({ groupId: null }));
  });

  it('P19.17-T4 AC-2 Group baru is a name only, the AB and their team going into it', async () => {
    const { calls } = stubFetch({
      'GET /members/groups': { body: GROUPS },
      'POST /members/groups': { status: 201, body: { groupId: 'g-rise', view: GROUPS } },
    });
    const onSaved = vi.fn();
    renderWithSession(<InLanguage language="id"><GroupDialog ab={{ membershipId: 'm-yosef', name: 'Yosef Tambunan' }} onClose={() => {}} onSaved={onSaved} /></InLanguage>);
    expect(await screen.findByText('AB · seluruh tim ikut pindah')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Group baru' }));
    expect(await screen.findByRole('dialog', { name: 'Group baru' })).toBeInTheDocument();
    expect(screen.getByText('Yosef Tambunan dan timnya masuk ke group ini · group leader ditunjuk nanti')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Buat group' }));
    expect(await screen.findByText('Isi nama group')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nama group'), 'Rising Stars 2027');
    await userEvent.click(screen.getByRole('button', { name: 'Buat group' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(GROUPS));
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string))
      .toEqual({ name: 'Rising Stars 2027', abMembershipId: 'm-yosef' });
  });

  it('shows a refusal in the dialog rather than closing', async () => {
    stubFetch({
      'GET /members/groups': { body: GROUPS },
      'PUT /members/m-agus/group': { status: 422, body: { error: { code: 'ORG_GROUP_AB_ONLY', message: 'Only an AB carries a group.', requestId: 'r2' } } },
    });
    renderWithSession(<GroupDialog ab={AGUS} onClose={() => {}} onSaved={() => {}} />);
    await userEvent.click(await screen.findByRole('radio', { name: 'No group' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only an AB carries a group.');
  });
});

describe('a group card’s ⋯ (P19.17-T4; ADR-0270 §2, §3)', () => {
  const top = GROUPS.groups[0];

  it('P19.17-T4 AC-2 renames the group', async () => {
    const { calls } = stubFetch({ 'PUT /members/groups/g-top': { body: GROUPS } });
    const onChanged = vi.fn();
    renderWithSession(<GroupCardMenu group={top} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: 'More for Top Producers 2026' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const name = screen.getByLabelText('Group name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Top Producers 2027');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(GROUPS));
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Top Producers 2027' });
  });

  it('P19.17-T4 AC-1 appoints and removes Group Leaders among the group’s ABs — several may be', async () => {
    const { calls } = stubFetch({
      'PUT /members/groups/g-top/leaders/m-agus': { body: GROUPS },
      'DELETE /members/groups/g-top/leaders/m-wilson': { body: GROUPS },
    });
    const onChanged = vi.fn();
    renderWithSession(<GroupCardMenu group={top} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: 'More for Top Producers 2026' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change Group Leaders' }));
    expect(screen.getByRole('checkbox', { name: /Wilson Tanoto/ })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: /Agus Prasetyo/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Wilson Tanoto/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.map((c) => [c.init.method, c.url.split('/members')[1]])).toEqual([
      ['PUT', '/groups/g-top/leaders/m-agus'], ['DELETE', '/groups/g-top/leaders/m-wilson'],
    ]);
  });

  it('P19.17-T4 AC-2 asks before deleting, its ABs to Tanpa group', async () => {
    const { calls } = stubFetch({ 'DELETE /members/groups/g-top': { body: { ...GROUPS, groups: [GROUPS.groups[1]] } } });
    const onChanged = vi.fn();
    renderWithSession(<InLanguage language="id"><GroupCardMenu group={top} onChanged={onChanged} /></InLanguage>);
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya untuk Top Producers 2026' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus group' }));
    expect(screen.getByText('Hapus group Top Producers 2026?')).toBeInTheDocument();
    expect(screen.getByText('2 AB di group ini dan timnya akan jadi Tanpa group.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls[0].init.method).toBe('DELETE');
  });
});

describe('a group’s AB groups sheet (P19.17-T4, parity I-1077)', () => {
  it('lists the group’s ABs with their size and opens the target card and the Group dialog on one', async () => {
    stubFetch({
      'GET /members/groups': { body: GROUPS },
      'GET /kpm/ab-group-targets': { body: targets() },
    });
    renderWithSession(<GroupAbsSheet groupId="g-top" title="Top Producers 2026" onClose={() => {}} onChanged={() => {}} />);
    const sheet = await screen.findByRole('dialog', { name: 'AB groups of Top Producers 2026' });
    expect(await within(sheet).findByText('2 AB groups · 10 people')).toBeInTheDocument();
    expect(within(sheet).getAllByText('9 people in their group')).toHaveLength(1);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Targets for Agus Prasetyo' }));
    expect(await screen.findByRole('dialog', { name: 'Agus Prasetyo’s group targets' })).toBeInTheDocument();
  });

  it('reads Tanpa group’s ABs for a row with no group', async () => {
    stubFetch({ 'GET /members/groups': { body: GROUPS } });
    renderWithSession(<GroupAbsSheet groupId={null} title="No group" onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText('Yosef Tambunan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More for/ })).toBeNull();
  });
});

describe('the dialogs through axe (P19.17-T4)', () => {
  const clean = async () => {
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  };

  it('the target card, read', async () => {
    stubFetch({ 'GET /kpm/ab-group-targets': { body: targets() } });
    renderWithSession(<TargetDialog ab={AGUS} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByRole('group', { name: 'Monthly Active Agent target' });
    await clean();
  });

  it('the Group dialog, and Group baru', async () => {
    stubFetch({ 'GET /members/groups': { body: GROUPS } });
    renderWithSession(<GroupDialog ab={AGUS} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByRole('radio', { name: 'Top Producers 2026' });
    await clean();
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    await screen.findByLabelText('Group name');
    await clean();
  });
});
