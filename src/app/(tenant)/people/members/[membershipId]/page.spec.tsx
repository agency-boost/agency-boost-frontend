import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import MemberPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members/mem-1',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
  },
  permissions: ['member:read_profile', 'member:complete_personal'],
});

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'aab', status: 'active',
  fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test', initials: 'RW',
  leaderId: 'mem-ab', leaderName: 'Wilson Tanoto', depth: 1, directCount: 0, subtreeCount: 0,
  isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
  removedAt: null, invitation: 'signed_in',
  // P3.1-T13. The server decides what this viewer may do; the default here is an Owner
  // looking at an ordinary member, which is the case the screen is built around.
  canChangeRole: true, canPromoteToAb: true, canRemove: true,
  ...over,
});

/** What a person records, all of it: P19.12-T5's `phone` among it. */
const RECORDED = {
  dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: '2020-09', workStatus: 'part_time',
  phone: '+6281211002200', companyName: 'Prudential',
};

/** The four tiles' read (ADR-0205 §1): Rina's figures, as `GET /members/:membershipId/performance` answers them. */
const PERFORMANCE = {
  membershipId: 'mem-1', today: '2026-11-05',
  activity: { from: '2026-10-30', to: '2026-11-05', count: 14 },
  production: { year: '2026', actualMinor: 310_000_000_000, targetMinor: 500_000_000_000, attainmentPct: 62, goalSet: true },
  lastOneOnOne: null,
  leads: { month: '2026-11', open: 9, closing: 2 },
};

const params = routeParams({ membershipId: 'mem-1' });

/** The page's reads, Rina by default; `over` her read, `extra` any route besides. */
function open(over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, me = OWNER) {
  const stubbed = stubFetch({
    '/members/mem-1/reports': { body: [] },
    '/members/mem-1/performance': { body: PERFORMANCE },
    '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false } },
    '/members/groups': { body: [] },
    '/members/leader-limit-requests': { body: [] },
    '/members/mem-1': { body: member(over) },
    ...extra,
  });
  renderInLayout(TenantLayout, <MemberPage params={params} />, { me });
  return stubbed;
}

/** *Data pribadi*, opened: its rows by term. */
async function personalData() {
  const heading = await screen.findByRole('heading', { name: 'Personal data' });
  const details = heading.closest('details')!;
  if (!details.open) await userEvent.click(heading.closest('summary')!);
  const row = (term: string) => within(details).getByText(term).nextElementSibling;
  return { details, row, text: (term: string) => row(term)?.textContent };
}

describe('one member', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows who they are and who they report to', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Rina', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getAllByText('KPM0417-001').length).toBeGreaterThan(0);
  });

  /*
   * P19.12-T5 AC-1 (ADR-0248 §1; the client's message of 11 November 2026, item 9): the title and its state, one row of
   * figures, *Posisi di tim*, *Data pribadi* folded, the reports, and *Keluarkan dari KPM* the very last.
   */
  describe('P19.12-T5 AC-1 the order, and nothing long', () => {
    it('P19.12-T5 AC-1 reads top to bottom: figures, Position in the team, Personal data, the reports, Remove last', async () => {
      open();
      const tiles = await screen.findByRole('region', { name: 'How they are doing' });
      const order = [
        tiles,
        screen.getByRole('heading', { name: 'Position in the team' }),
        screen.getByRole('heading', { name: 'Personal data' }),
        screen.getByRole('heading', { name: 'Who reports to them' }),
        screen.getByRole('button', { name: 'Remove from the office' }),
      ];
      for (let i = 1; i < order.length; i += 1) {
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      // Nothing comes after *Keluarkan dari KPM* in the page's own controls.
      const main = screen.getByRole('main');
      const controls = within(main).getAllByRole('button').concat(within(main).getAllByRole('link'));
      const remove = screen.getByRole('button', { name: 'Remove from the office' });
      expect(controls.filter((c) => remove.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)).toEqual([]);
    });

    it('P19.12-T5 AC-1 the figures are one row of four at every width, with no bar', async () => {
      open();
      const tiles = await screen.findByRole('region', { name: 'How they are doing' });
      const cell = (await within(tiles).findByText('Activity, last 7 days')).closest('[data-stat-tile]')!;
      expect(cell.parentElement!.className).toContain('grid-cols-4');
      expect(cell.parentElement!.className).not.toMatch(/grid-cols-2/);
      expect(tiles.querySelector('[aria-hidden="true"][style]')).toBeNull();
    });

    it('P19.12-T5 AC-1 the long explanations are gone', async () => {
      open({ isLeader: false });
      await screen.findByRole('heading', { name: 'Position in the team' });
      for (const gone of [
        /leads nobody/, /changes nothing about who reports to whom/, /opens the Strategic Leader Forum/,
        /worth writing/, /Kept on their record/, /The server checks this too/, /below the root/,
      ]) {
        expect([String(gone), screen.queryByText(gone)]).toEqual([String(gone), null]);
      }
      expect(screen.queryByText('Depth')).not.toBeInTheDocument();
    });
  });

  describe('P19.12-T5 AC-1 Position in the team', () => {
    const card = async () => (await screen.findByRole('heading', { name: 'Position in the team' })).closest('[data-position-card]') as HTMLElement;
    const line = (within_: HTMLElement, term: string) => within(within_).getByText(term).nextElementSibling as HTMLElement;

    it('P19.12-T5 AC-1 one line each: the role with Edit, the leader with Change, the informal groups with Edit, the unit', async () => {
      open({ isLeader: true, directCount: 3, subtreeCount: 7, canChangeLeader: true }, {
        '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: ['grp-1'], isCoreLeader: true } },
        '/members/groups': {
          body: [{ groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-9', ownerName: 'Wilson', ownerHasLeft: false, memberCount: 1 }],
        },
      });
      const position = await card();
      expect(within(line(position, 'Role')).getByText('AAB')).toBeInTheDocument();
      expect(within(line(position, 'Role')).getByRole('button', { name: 'Edit role' })).toHaveTextContent('Edit');
      expect(line(position, 'Reports to')).toHaveTextContent('Wilson Tanoto');
      expect(within(line(position, 'Reports to')).getByRole('button', { name: 'Change leader' })).toHaveTextContent('Change');
      const groups = line(position, 'Informal groups');
      expect(await within(groups).findByText('New Agent Mentoring Circle')).toBeInTheDocument();
      expect(within(groups).getByText('Core Leader')).toBeInTheDocument();
      expect(within(groups).getByRole('button', { name: 'Edit informal groups' })).toHaveTextContent('Edit');
      expect(line(position, 'Unit')).toHaveTextContent('3 direct · 7 in the whole unit');
    });

    it('P19.12-T5 AC-1 one who leads nobody reads No team; no groups reads None', async () => {
      open();
      const position = await card();
      expect(line(position, 'Unit')).toHaveTextContent('No team');
      expect(await within(line(position, 'Informal groups')).findByText('None')).toBeInTheDocument();
    });

    it('P19.12-T5 AC-1 offers no control a reader may not use: no Edit role, no Change, no Remove', async () => {
      open({ canChangeRole: false, canPromoteToAb: false, canRemove: false, canChangeLeader: false });
      await card();
      expect(screen.queryByRole('button', { name: 'Edit role' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Change leader' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove from the office' })).not.toBeInTheDocument();
    });

    it('P19.12-T5 AC-1 Change on Reports to opens the leader picker for them (P19.12-T4)', async () => {
      const { calls } = open({ canChangeLeader: true, subtreeCount: 4 }, { '/members/mem-1/leader-choices': { body: [] } });
      await userEvent.click(await screen.findByRole('button', { name: 'Change leader' }));
      expect(await screen.findByRole('dialog', { name: 'Move Rina to another leader' })).toBeInTheDocument();
      await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/members/mem-1/leader-choices'))).toBe(true));
    });
  });

  /*
   * P19.12-T5 AC-4 (ADR-0248 §4; the client's TI-1): an active member who never signed in reads *Diundang* or *Belum
   * diundang*, grey, never *Aktif*.
   */
  it.each([
    ['invited', 'active', 'Invited'],
    ['not_invited', 'active', 'Not invited'],
    ['signed_in', 'active', 'Active'],
    [undefined, 'active', 'Active'],
    ['invited', 'removed', 'Removed'],
  ])('P19.12-T5 AC-4 invitation %s, status %s: the title’s pill reads %s', async (invitation, status, label) => {
    open({ invitation, status });
    await screen.findByRole('heading', { name: 'Rina', level: 1 });
    const pill = screen.getByText(label);
    expect(pill).toBeInTheDocument();
    if (label !== 'Active') expect(screen.queryByText('Active')).not.toBeInTheDocument();
    if (label === 'Invited' || label === 'Not invited') expect(pill.className).toContain('text-muted');
  });

  describe('P19.12-T5 AC-2 Personal data, folded', () => {
    it('P19.12-T5 AC-1 is closed by default, and its summary counts what is not recorded', async () => {
      open({ personal: { ...RECORDED, dateOfBirth: null, gender: null, phone: null } });
      const heading = await screen.findByRole('heading', { name: 'Personal data' });
      const details = heading.closest('details')!;
      expect(details.open).toBe(false);
      expect(within(heading.closest('summary')!).getByText('3 not recorded')).toBeInTheDocument();
    });

    it('P19.12-T5 AC-2 the WhatsApp number is shown, a link that opens the chat', async () => {
      open({ personal: RECORDED });
      const { row } = await personalData();
      const link = within(row('WhatsApp number') as HTMLElement).getByRole('link', { name: '+6281211002200' });
      expect(link).toHaveAttribute('href', 'https://wa.me/6281211002200');
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.queryByText(/not recorded$/)).not.toBeInTheDocument();
    });

    it('P19.12-T5 AC-2 no number reads Not recorded', async () => {
      open({ personal: { ...RECORDED, phone: null } });
      const { text } = await personalData();
      expect(text('WhatsApp number')).toBe('Not recorded');
    });

    /* P18.5-T4 AC-6 (ADR-0158 §6): what the person records, *Not recorded* for each they have not given. */
    it('P18.5-T4 AC-6, P19.3-T4 AC-5 what they record, and the two join dates said whose', async () => {
      open({
        joinDate: '2026-07-14',
        personal: { dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: null, workStatus: 'part_time', phone: null, companyName: null },
      });
      const { text } = await personalData();
      expect(text('Full name')).toBe('Rina Wijaya');
      expect(text('Email')).toBe('rina@kpm0417.test');
      expect(text('Date of birth')).toBe('15 Mar 1990');
      expect(text('Gender')).toBe('Female');
      expect(text('Joined the company')).toBe('Not recorded');
      expect(text('Work status')).toBe('Part-time');
      expect(text('Joined AgencyBoost')).toBe('14 Jul 2026');
    });

    it('P19.3-T4 AC-5 the company named: Joined Prudential', async () => {
      open({ joinDate: '2026-07-14', personal: RECORDED });
      const { text } = await personalData();
      expect(text('Joined Prudential')).toBe('Sep 2020');
    });

    it('P18.5-T4 AC-6 draws none of the five, and counts nothing, when the read carries none', async () => {
      open();
      const { details } = await personalData();
      expect(within(details).queryByText('Date of birth')).not.toBeInTheDocument();
      expect(within(details).queryByText('WhatsApp number')).not.toBeInTheDocument();
      expect(within(details).queryByText(/not recorded/)).not.toBeInTheDocument();
      expect(within(details).queryByRole('button', { name: 'Complete details' })).not.toBeInTheDocument();
    });
  });

  /* P19.12-T5 AC-3 (ADR-0248 §3; the client's TI-2): the Owner and the Admins fill the blanks, and only the blanks. */
  describe('P19.12-T5 AC-3 Complete details', () => {
    const BLANKS = { ...RECORDED, dateOfBirth: null, gender: null, phone: null };

    it('P19.12-T5 AC-3 offers only the blank fields, and sends only what was typed', async () => {
      const { calls } = open({ personal: BLANKS }, {
        'PATCH /members/mem-1/personal': {
          body: { membershipId: 'mem-1', filled: ['phone', 'gender'], personal: { ...BLANKS, phone: '+6281211002299', gender: 'male' } },
        },
      });
      const { details } = await personalData();
      await userEvent.click(within(details).getByRole('button', { name: 'Complete details' }));

      const dialog = screen.getByRole('dialog', { name: 'Complete Rina’s details' });
      expect(within(dialog).getByText('Only what is not recorded yet. What is recorded is theirs to change.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('WhatsApp number')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Date of birth')).toBeInTheDocument();
      expect(within(dialog).getByRole('radiogroup', { name: 'Gender' })).toBeInTheDocument();
      // Recorded: not offered.
      expect(within(dialog).queryByRole('radiogroup', { name: 'Work status' })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Joined Prudential')).not.toBeInTheDocument();
      const save = within(dialog).getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();

      await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '0812 1100 2299');
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Male' }));
      await userEvent.click(save);

      const sent = calls.find((c) => c.init.method === 'PATCH')!;
      expect(sent.url).toContain('/members/mem-1/personal');
      expect(JSON.parse(String(sent.init.body))).toEqual({ phone: '+6281211002299', gender: 'male' });
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // The page now says what was filled: one blank left.
      expect(within(details).getByText('1 not recorded')).toBeInTheDocument();
      expect(within(details).getByRole('link', { name: '+6281211002299' })).toBeInTheDocument();
    });

    it('P19.12-T5 AC-3 a number that is not one is said under the field, and nothing is sent', async () => {
      const { calls } = open({ personal: BLANKS });
      const { details } = await personalData();
      await userEvent.click(within(details).getByRole('button', { name: 'Complete details' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '12345');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(within(dialog).getByLabelText('WhatsApp number')).toHaveAttribute('aria-invalid', 'true');
      expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    });

    it('P19.12-T5 AC-3 a value somebody recorded a moment ago: the server’s 409 is said, and the member read again', async () => {
      const { calls } = open({ personal: BLANKS }, {
        'PATCH /members/mem-1/personal': {
          status: 409,
          body: {
            error: {
              code: 'MEMBER_DETAIL_ON_FILE', requestId: 'r',
              message: 'Some of this is already recorded. Only they can change what is recorded, on My profile.',
              details: { membershipId: 'mem-1', fields: ['gender'] },
            },
          },
        },
      });
      const { details } = await personalData();
      const reads = () => calls.filter((c) => c.url.endsWith('/members/mem-1') && (c.init.method ?? 'GET') === 'GET').length;
      const before = reads();
      await userEvent.click(within(details).getByRole('button', { name: 'Complete details' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Female' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Some of this is already recorded.');
      await vi.waitFor(() => expect(reads()).toBeGreaterThan(before));
    });

    it('P19.12-T5 AC-3 a refused value is said under its own field', async () => {
      open({ personal: BLANKS }, {
        'PATCH /members/mem-1/personal': {
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_FAILED', requestId: 'r', message: 'A date of birth must be at least 18 years ago.',
              details: { field: 'gender' },
            },
          },
        },
      });
      const { details } = await personalData();
      await userEvent.click(within(details).getByRole('button', { name: 'Complete details' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Male' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      const group = within(dialog).getByRole('radiogroup', { name: 'Gender' }).parentElement!;
      expect(await within(group).findByRole('alert')).toHaveTextContent('A date of birth must be at least 18 years ago.');
    });

    it('P19.12-T5 AC-3 is not offered to a reader without the grant, nor when nothing is blank', async () => {
      const LEADERLESS = makeMe({ ...OWNER, permissions: ['member:read_profile'] });
      open({ personal: BLANKS }, {}, LEADERLESS);
      const first = await personalData();
      expect(within(first.details).getByText('3 not recorded')).toBeInTheDocument();
      expect(within(first.details).queryByRole('button', { name: 'Complete details' })).not.toBeInTheDocument();
    });

    it('P19.12-T5 AC-3 nothing blank: no button, and no count', async () => {
      open({ personal: RECORDED });
      const { details } = await personalData();
      expect(within(details).queryByRole('button', { name: 'Complete details' })).not.toBeInTheDocument();
      expect(within(details).queryByText(/not recorded/)).not.toBeInTheDocument();
    });
  });

  it('P19.3-T4 AC-4 See dashboard opens a leader’s Unit Dashboard, and anybody else’s Personal Summary', async () => {
    open({ isLeader: false });
    await screen.findByRole('region', { name: 'How they are doing' });
    // Two links, one per range: the title row's from 1024px, the pill after the figures below it.
    const links = screen.getAllByRole('link', { name: 'See dashboard' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/coaching/mem-1/summary', '/coaching/mem-1/summary']);
    expect(links[0].className).toContain('max-lg:hidden');
    expect(links[1].className).toContain('lg:hidden');
  });

  it('P19.3-T4 AC-1 a refused figures read says so in their place, and the page below still renders', async () => {
    open({}, {
      '/members/mem-1/performance': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r' } } },
    });
    expect(await screen.findByText('How they are doing cannot be shown right now. The sections below are unaffected.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Position in the team' })).toBeInTheDocument();
  });

  it('shows the people who report to them', async () => {
    open({ isLeader: true, directCount: 1, subtreeCount: 3 }, {
      '/members/mem-1/reports': {
        body: [member({ membershipId: 'mem-2', agentCode: 'KPM0417-002', role: 'agent', fullName: 'Budi', preferredName: null })],
      },
    });
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Budi' })).toHaveAttribute('href', '/people/members/mem-2');
  });

  it('says nothing about whether someone outside your scope exists', async () => {
    // A "not permitted" message would confirm they are here. 404 and 403 have to read
    // the same, and the screen says why rather than leaving it looking like a bug.
    open({}, {
      '/members/mem-1/reports': { status: 404, body: {} },
      '/members/mem-1/tags': { status: 404, body: {} },
      '/members/mem-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Membership not found.', requestId: 'r-1' } },
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership not found.');
    expect(screen.getByText(/would confirm they are here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the roster' })).toBeInTheDocument();
  });

  describe('informal groups (P3-T9), in their form', () => {
    const tags = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false, ...over,
    });
    const group = (over: Record<string, unknown> = {}) => ({
      groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-9',
      ownerName: 'Wilson Tanoto', ownerHasLeft: false, memberCount: 1, ...over,
    });
    const withTags = (t = tags(), groups: Record<string, unknown>[] = [group()]) =>
      open({}, { '/members/mem-1/tags': { body: t }, '/members/groups': { body: groups } });
    const edit = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Edit informal groups' }));
      return screen.getByRole('dialog', { name: 'Informal groups' });
    };

    it('sends the groups and the flag together, as one save', async () => {
      const { calls } = withTags(tags({ canBeCoreLeader: true }));
      const dialog = await edit();
      await userEvent.click(within(dialog).getByLabelText('New Agent Mentoring Circle'));
      await userEvent.click(within(dialog).getByLabelText('Core Leader'));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
      const sent = calls.find((c) => c.init.method === 'PUT')!;
      expect(JSON.parse(sent.init.body as string)).toEqual({ groupIds: ['grp-1'], isCoreLeader: true });
    });

    it('P18.5-T5 AC-2 a member who is not a leader cannot be ticked Core Leader, and is told why in one line', async () => {
      withTags(tags({ canBeCoreLeader: false }));
      const dialog = await edit();
      expect(within(dialog).getByLabelText('Core Leader')).toBeDisabled();
      expect(within(dialog).getByText('Only a leader can be a Core Leader.')).toBeInTheDocument();
    });

    it('P18.5-T5 AC-2 a tag kept from before ADR-0159 on a non-leader can still be cleared', async () => {
      const { calls } = withTags(tags({ isCoreLeader: true, canBeCoreLeader: false }));
      const dialog = await edit();
      const box = within(dialog).getByLabelText('Core Leader');
      expect(box).toBeEnabled();
      await userEvent.click(box);
      expect(box).toBeDisabled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
      expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')!.init.body as string)).toEqual({ groupIds: [], isCoreLeader: false });
    });

    it('changes nothing until saved, and Cancel discards the draft', async () => {
      const { calls } = withTags();
      const dialog = await edit();
      await userEvent.click(within(dialog).getByLabelText('New Agent Mentoring Circle'));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('keeps showing a tag whose group has been retired', async () => {
      withTags(tags({ groupIds: ['grp-old'] }), [group()]);
      expect(await screen.findByText('A group since retired')).toBeInTheDocument();
    });

    it('points at where groups are made when there are none', async () => {
      withTags(tags(), []);
      const dialog = await edit();
      expect(within(dialog).getByText(/No groups yet/)).toBeInTheDocument();
      expect(within(dialog).getByRole('link', { name: 'All members → Groups' })).toHaveAttribute('href', '/people/members');
    });
  });

  describe('changing a role (P3.1-T13), in its form', () => {
    const edit = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Edit role' }));
      return screen.getByRole('dialog', { name: 'Change their role' });
    };

    it('AC-1: says what the change means, sends the new rung and the reason, then re-reads the person', async () => {
      const { calls } = open({}, { 'PATCH /members/mem-1/role': { body: [] } });
      const dialog = await edit();
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'agent');
      // The office may be acting on somebody who reports to a third person: the general sentence.
      expect(within(dialog).getByText(/Nobody moves/)).toBeInTheDocument();
      expect(within(dialog).queryByText(/reporting to you/)).not.toBeInTheDocument();
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'ab');
      await userEvent.type(within(dialog).getByLabelText('Why?'), 'Ready to build');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));

      const patch = calls.find((c) => c.init.method === 'PATCH');
      expect(patch?.url).toContain('/members/mem-1/role');
      expect(JSON.parse(String(patch?.init.body))).toEqual({ toRole: 'ab', reason: 'Ready to build' });
      await vi.waitFor(() => expect(calls.filter((c) => c.url.endsWith('/members/mem-1')).length).toBeGreaterThan(1));
    });

    it('P19.12-T4 offers the rungs the read’s roleChoices name, and only those', async () => {
      open({ role: 'agent', orgLevelCode: 'AGENT', roleChoices: ['AGENT', 'AAB'], canPromoteToAb: false });
      const dialog = await edit();
      const options = [...within(dialog).getByLabelText('New role').querySelectorAll('option')].map((o) => o.getAttribute('value'));
      expect(options).toEqual(['', 'aab']);
    });

    it('P13.2-T4 AC-5: a promotion past the office’s leader limit is refused in plain words, in the form', async () => {
      open({ role: 'agent' }, {
        'PATCH /members/mem-1/role': {
          status: 409,
          body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 2, leadersUsed: 2 }, requestId: 'r' } },
        },
      });
      const dialog = await edit();
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'aab');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent('This office has reached its limit of 2 leaders, so nobody else can be made an AB or an AAB.');
      expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
      expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
    });
  });

  describe('removing somebody (P3.1-T13), the last thing on the page', () => {
    const removal = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Remove from the office' }));
      return screen.getByRole('dialog', { name: 'Remove Rina' });
    };

    it('AC-2: says what it does in one line, and will not remove until the word is typed as the server checks it', async () => {
      const { calls } = open({}, { 'DELETE /members/mem-1': { body: [] } });
      const dialog = await removal();
      expect(within(dialog).getByText(/Nothing is deleted/)).toBeInTheDocument();
      const confirm = within(dialog).getByRole('button', { name: 'Remove them' });
      expect(confirm).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), 'remove me');
      expect(confirm).toBeDisabled();
      await userEvent.clear(within(dialog).getByLabelText('Type REMOVE to confirm'));
      // Trimmed and case-insensitive, because that is what the server does.
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), ' remove ');
      expect(confirm).toBeEnabled();
      await userEvent.click(confirm);
      expect(JSON.parse(String(calls.find((c) => c.init.method === 'DELETE')?.init.body))).toEqual({ confirmation: ' remove ' });
    });

    it('Cancel cancels — it does not remove the person', async () => {
      const { calls } = open();
      const dialog = await removal();
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(calls.find((c) => c.init.method === 'DELETE')).toBeUndefined();
      expect(screen.queryByLabelText('Type REMOVE to confirm')).not.toBeInTheDocument();
    });

    it('AC-3: a leader with reports cannot be removed until the form says where they go', async () => {
      const { calls } = open({ directCount: 3, isLeader: true }, { 'DELETE /members/mem-1': { body: [] } });
      const dialog = await removal();
      expect(within(dialog).getByText('3 people report to them')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByLabelText('Move them up to Wilson Tanoto'));
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove them' }));
      expect(JSON.parse(String(calls.find((c) => c.init.method === 'DELETE')?.init.body)).subtree)
        .toEqual({ action: 'reassign', toMembershipId: 'mem-ab' });
    });

    it('AC-3: sends no disposition for somebody who leads nobody', async () => {
      const { calls } = open({ directCount: 0 }, { 'DELETE /members/mem-1': { body: [] } });
      const dialog = await removal();
      expect(within(dialog).queryByText(/report to them/)).not.toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove them' }));
      expect(JSON.parse(String(calls.find((c) => c.init.method === 'DELETE')?.init.body))).not.toHaveProperty('subtree');
    });

    it('shows the server refusal in the form rather than pretending it worked', async () => {
      open({}, {
        'DELETE /members/mem-1': {
          status: 403,
          body: { error: { code: 'ORG_REMOVAL_NOT_PERMITTED', message: 'Only somebody’s direct leader can remove them.', requestId: 'r-1' } },
        },
      });
      const dialog = await removal();
      await userEvent.type(within(dialog).getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove them' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('direct leader');
    });
  });

  /*
   * P18.5-T2 (ADR-0157): past the office's leader limit the role change may wait for AgencyBoost instead — the
   * refusal offers *Ask AgencyBoost to approve* where the API says it may be asked (`canRequest`), the same rung and
   * reason are asked, and the card says the change is waiting, with *Cancel request*. And OD-50: the select lists
   * the company's own ladder, a rung it added included.
   */
  describe('P18.5-T2 — a leader past the limit waits for AgencyBoost', () => {
    const LIMIT = {
      status: 409,
      body: {
        error: {
          code: 'LEADER_LIMIT_REACHED', message: 'x', requestId: 'r',
          details: { maxLeaders: 10, leadersUsed: 10, canRequest: true },
        },
      },
    };
    const ask = (over: Record<string, unknown> = {}) => ({
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
      subjectMembershipId: 'mem-1', subjectName: 'Rina Wijaya', subjectAgentCode: '86114', action: 'promote',
      fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: 'Ready to lead', requestedByMembershipId: 'mem-owner',
      requestedByName: 'Hendra Gunawan', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
      declineReason: null, maxLeaders: 10, leadersUsed: 10, ...over,
    });
    const AGENT = { role: 'agent', orgLevelCode: 'AGENT' };
    const edit = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Edit role' }));
      return screen.getByRole('dialog', { name: 'Change their role' });
    };

    it('AC-6 offers Ask AgencyBoost to approve on the refusal, and asks for the same rung and reason', async () => {
      const { calls } = open(AGENT, {
        'PATCH /members/mem-1/role': LIMIT,
        'POST /members/mem-1/leader-limit-request': { status: 201, body: ask() },
        '/members/leader-limit-requests': [{ body: [] }, { body: [ask()] }],
      });
      const dialog = await edit();
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'aab');
      await userEvent.type(within(dialog).getByLabelText('Why?'), 'Ready to lead');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent('Ask AgencyBoost to approve this one past the limit, or to raise it.');
      await userEvent.click(within(alert).getByRole('button', { name: 'Ask AgencyBoost to approve' }));

      const posted = calls.find((c) => c.init.method === 'POST');
      expect(posted?.url).toContain('/members/mem-1/leader-limit-request');
      expect(JSON.parse(String(posted?.init.body))).toEqual({ action: 'promote', orgLevelCode: 'aab', reason: 'Ready to lead' });
      expect(await screen.findByText("Waiting for AgencyBoost's approval")).toBeInTheDocument();
      expect(screen.getByText('Agent → AAB')).toBeInTheDocument();
    });

    it('AC-6 offers no ask where the refusal says none may be made', async () => {
      open(AGENT, {
        'PATCH /members/mem-1/role': {
          ...LIMIT,
          body: { error: { ...LIMIT.body.error, details: { maxLeaders: 10, leadersUsed: 10, canRequest: false } } },
        },
      });
      const dialog = await edit();
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'aab');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent('AgencyBoost can raise it.');
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
    });

    it('AC-6 says on the card that a change is waiting, and Cancel request withdraws it', async () => {
      const { calls } = open(AGENT, {
        '/members/leader-limit-requests': { body: [ask()] },
        'DELETE /members/leader-limit-requests/llr-1': { body: [ask({ status: 'cancelled' })] },
      });
      const card = (await screen.findByRole('heading', { name: 'Position in the team' })).closest('[data-position-card]') as HTMLElement;
      expect(await within(card).findByText("Waiting for AgencyBoost's approval")).toBeInTheDocument();
      await userEvent.click(within(card).getByRole('button', { name: 'Cancel request' }));
      expect(calls.find((c) => c.init.method === 'DELETE')?.url).toContain('/members/leader-limit-requests/llr-1');
      await vi.waitFor(() => expect(screen.queryByText(/Waiting for AgencyBoost/)).not.toBeInTheDocument());
    });

    it('OD-50 lists the company’s own ladder, a rung it added included, and sends its code', async () => {
      const ladder = [
        { orgLevelId: 'l1', companyId: 'c', code: 'AGENT', label: 'Agent', displayOrder: 1, leaderTier: null, status: 'active' },
        { orgLevelId: 'l2', companyId: 'c', code: 'AAB', label: 'Associate Agency Builder', displayOrder: 2, leaderTier: 'associate', status: 'active' },
        { orgLevelId: 'l3', companyId: 'c', code: 'AB', label: 'Agency Builder', displayOrder: 3, leaderTier: 'senior', status: 'active' },
        { orgLevelId: 'l4', companyId: 'c', code: 'UM', label: 'Unit Manager', displayOrder: 4, leaderTier: 'associate', status: 'active' },
        { orgLevelId: 'l5', companyId: 'c', code: 'SM', label: 'Senior Manager', displayOrder: 5, leaderTier: 'senior', status: 'active' },
        { orgLevelId: 'l6', companyId: 'c', code: 'OLD', label: 'Retired rung', displayOrder: 6, leaderTier: null, status: 'archived' },
      ];
      const { calls } = open(AGENT, {
        '/kpm/org-levels': { body: ladder },
        '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], training: [], activationChecklist: null, eventTypes: [], capability: null } },
        'PATCH /members/mem-1/role': { body: [] },
      });
      const dialog = await edit();
      await vi.waitFor(() => expect(within(dialog).getByRole('option', { name: 'Senior Manager' })).toBeInTheDocument());
      const options = [...within(dialog).getByLabelText('New role').querySelectorAll('option')].map((o) => o.textContent);
      expect(options).toEqual([
        'Agent — no change', 'Associate Agency Builder', 'Agency Builder', 'Unit Manager', 'Senior Manager',
      ]);
      await userEvent.selectOptions(within(dialog).getByLabelText('New role'), 'sm');
      expect(within(dialog).getByText(/will change from Agent to SM\./)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
      expect(JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')?.init.body))).toEqual({ toRole: 'sm' });
    });

    it('OD-50 holds a Senior Leader rung, whatever its code, to the office as AB is', async () => {
      const ladder = [
        { orgLevelId: 'l1', companyId: 'c', code: 'AGENT', label: 'Agent', displayOrder: 1, leaderTier: null, status: 'active' },
        { orgLevelId: 'l4', companyId: 'c', code: 'UM', label: 'Unit Manager', displayOrder: 4, leaderTier: 'associate', status: 'active' },
        { orgLevelId: 'l5', companyId: 'c', code: 'SM', label: 'Senior Manager', displayOrder: 5, leaderTier: 'senior', status: 'active' },
      ];
      open({ ...AGENT, canPromoteToAb: false }, {
        '/kpm/org-levels': { body: ladder },
        '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], training: [], activationChecklist: null, eventTypes: [], capability: null } },
      });
      const dialog = await edit();
      await vi.waitFor(() => expect(within(dialog).getByRole('option', { name: 'Unit Manager' })).toBeInTheDocument());
      expect(within(dialog).queryByRole('option', { name: 'Senior Manager' })).not.toBeInTheDocument();
    });
  });
});
