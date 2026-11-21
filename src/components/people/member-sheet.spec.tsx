import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { budi } from '@test/people-fixtures';
import { enterKpm, leaveKpm } from '@/lib/super-admin-kpm';
import { MemberSheet } from './member-sheet';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const tags = { membershipId: 'mem-budi', fullName: 'Budi Santoso', groupIds: [], isCoreLeader: false, canBeCoreLeader: false, canCarryGroup: false, group: { groupId: 'g-1', name: 'Top Producers 2026' }, ab: { membershipId: 'mem-agus', name: 'Agus Prasetyo' } };

describe('P19.20-T2 the member sheet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.20-T2 AC-1 shows the head, Profil and Demografi as the mockup draws them', async () => {
    stubFetch({ '/members/mem-budi/tags': { body: tags }, '/members/mem-budi': { body: budi() } });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByText('Budi Santoso')).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Agent · 80009 · reports to SARI PUSPITA');
    expect(sheet).toHaveTextContent('Joined the KPM');
    expect(sheet).toHaveTextContent('Group · follows AB');
    expect(await within(sheet).findByText('Top Producers 2026')).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Full-time');
    expect(sheet).toHaveTextContent('80009');
    expect(sheet).toHaveTextContent('Male');
    expect(sheet).toHaveTextContent('+6285711223344');
    expect(sheet).toHaveTextContent('budi@kpm0417.test');
    // A follower's group has no pencil; Unit is counted, never typed.
    expect(within(sheet).queryByRole('button', { name: 'Change Group · follows AB' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Change Unit' })).not.toBeInTheDocument();
  });

  it('P19.20-T2 AC-3 a blank reads + Fill in, and the yellow note counts and names the blanks', async () => {
    stubFetch({ '/members/mem-budi/tags': { body: tags }, '/members/mem-budi': { body: budi() } });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findAllByRole('button', { name: /\+ Fill in/ })).toHaveLength(2);
    expect(within(sheet).getByRole('button', { name: /2 details missing · Date of birth, Month joined the company · tap to fill in/ })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('The KPM Owner, admins and core leaders can change these details · changes are logged (who, when)');
  });

  it('P19.20-T2 AC-2 + Isi opens the field’s input; ✓ saves that field, and the sheet shows what the server answered', async () => {
    const { calls } = stubFetch({
      '/members/mem-budi/tags': { body: tags },
      'PATCH /members/mem-budi/personal': { body: { membershipId: 'mem-budi', filled: ['dateOfBirth'], member: budi({ personal: { ...budi().personal, dateOfBirth: '1992-02-14' } }) } },
      '/members/mem-budi': { body: budi() },
    });
    const onChanged = vi.fn();
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} onChanged={onChanged} />);

    const sheet = await screen.findByRole('dialog');
    await userEvent.click(await within(sheet).findByRole('button', { name: '+ Fill in Age' }));
    const input = within(sheet).getByLabelText('Age');
    await userEvent.type(input, '1992-02-14');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save Age' }));

    await vi.waitFor(() => {
      const patch = calls.find((c) => c.init.method === 'PATCH');
      expect(JSON.parse(String(patch?.init.body))).toEqual({ dateOfBirth: '1992-02-14' });
    });
    expect(await within(sheet).findByText(/years · 14 Feb 1992/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ membershipId: 'mem-budi' }));
  });

  it('P19.20-T2 AC-2 a pencil changes a recorded value, and a refusal is said at the field', async () => {
    stubFetch({
      '/members/mem-budi/tags': { body: tags },
      'PATCH /members/mem-budi/personal': { status: 409, body: { error: { code: 'AGENT_CODE_TAKEN', message: 'Agent code 80010 is already registered at Prudential.' } } },
      '/members/mem-budi': { body: budi() },
    });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Change Agent code' }));
    const input = within(sheet).getByLabelText('Agent code');
    await userEvent.clear(input);
    await userEvent.type(input, '80010');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save Agent code' }));

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Agent code 80010 is already registered at Prudential.');
  });

  it('P19.20-T2 AC-2 Peran is the rung select, saved as a role change', async () => {
    const { calls } = stubFetch({
      '/members/mem-budi/tags': { body: tags },
      'PATCH /members/mem-budi/role': { body: [] },
      '/members/mem-budi': { body: budi() },
    });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Change Role' }));
    await userEvent.selectOptions(within(sheet).getByLabelText('Role'), 'aab');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save Role' }));

    await vi.waitFor(() => {
      const call = calls.find((c) => c.url.includes('/role'));
      expect(JSON.parse(String(call?.init.body))).toEqual({ toRole: 'aab' });
    });
  });

  it('P19.20-T2 AC-2 nobody who may not change them is offered a pencil; an email they sign in with has none (OD-400)', async () => {
    stubFetch({
      '/members/mem-budi/tags': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } },
      '/members/mem-budi': { body: budi({ canEditDetails: false, canChangeRole: false, canChangeLeader: false, invitation: 'signed_in' }) },
    });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    await within(sheet).findByText('Budi Santoso');
    expect(within(sheet).queryByRole('button', { name: /^Change / })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByText(/details missing/)).not.toBeInTheDocument();
  });

  it('P19.20-T2 AC-3 green WhatsApp to their number, orange Open profile to the Personal Summary', async () => {
    stubFetch({ '/members/mem-budi/tags': { body: tags }, '/members/mem-budi': { body: budi() } });
    renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6285711223344');
    expect(within(sheet).getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/coaching/mem-budi/summary');
  });

  it('P19.20-T1 AC-5 somebody the reader may not open is said, not shown', async () => {
    stubFetch({ '/members/mem-out': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Membership not found.' } } } });
    renderWithSession(<MemberSheet membershipId="mem-out" onClose={vi.fn()} />);

    expect(await screen.findByText('Membership not found.')).toBeInTheDocument();
  });

  /*
   * Found 2026-11-20 (OD-377; parity I-1231): *Buka profil* opens the Personal Summary, a member's page the KPM's Owner who
   * is nobody's member cannot open — for a Super Admin inside the KPM it was refused there and sent them out of the KPM.
   */
  it('offers Buka profil to the office’s stewards, and not to a Super Admin inside the KPM', async () => {
    stubFetch({ '/members/mem-budi/tags': { body: tags }, '/members/mem-budi': { body: budi() } });
    const view = renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);
    expect(await within(await screen.findByRole('dialog')).findByRole('link', { name: 'Open profile' }))
      .toHaveAttribute('href', '/coaching/mem-budi/summary');
    view.unmount();

    const superAdmin = makeMe({
      user: {
        id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
        pronoun: 'they', initials: 'R', platformRole: 'super_admin',
      },
      membership: null,
      permissions: ['member:read_profile', 'member:update_profile'],
    });
    enterKpm('66f0000000000000000002a1');
    try {
      renderWithSession(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />, { me: superAdmin });
      const sheet = await screen.findByRole('dialog');
      await within(sheet).findByText('Budi Santoso');
      expect(within(sheet).queryByRole('link', { name: 'Open profile' })).not.toBeInTheDocument();
      // WhatsApp stays: it opens a chat, not a page of the KPM.
      expect(within(sheet).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    } finally {
      leaveKpm();
    }
  });

  it('P19.20-T2 AC-1 in Indonesian, word for word', async () => {
    stubFetch({ '/members/mem-budi/tags': { body: tags }, '/members/mem-budi': { body: budi() } });
    renderInIndonesian(<MemberSheet membershipId="mem-budi" onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    await within(sheet).findByText('Budi Santoso');
    for (const words of ['Profil', 'Demografi', 'Peran', 'Leader (melapor ke)', 'Bergabung di KPM', 'Bergabung di perusahaan', 'Waktu', 'Kode agen', 'Umur', 'Jenis kelamin', 'No. WhatsApp', 'Buka profil']) {
      expect(sheet).toHaveTextContent(words);
    }
    expect(sheet).toHaveTextContent('2 data belum diisi · Tanggal lahir, Bulan bergabung di perusahaan · ketuk untuk mengisi');
    expect(sheet).toHaveTextContent('Agent · 80009 · melapor ke SARI PUSPITA');
  });
});
