import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { addUserMessages } from '@/i18n/messages/add-user';
import { AddUserButton } from './add-user-button';
import { AddUserSheet, type AddUserDone } from './add-user-sheet';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/members',
  useSearchParams: () => new URLSearchParams(),
}));

const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' },
  membership: null,
  permissions: ['kpm:create', 'member:add', 'member:place', 'platform_members:read', 'kpm:list_all', 'company:crud'],
});
const KPM = '66f0000000000000000006a2';
const BSD = '66f0000000000000000004a7';
const TENANTS = [
  { _id: KPM, companyId: 'co-1', companyName: 'Prudential', code: '0602', branchName: 'Bekasi Barat Branch', status: 'active' },
  { _id: BSD, companyId: 'co-1', companyName: 'Prudential', code: '0417', branchName: 'BSD City Branch', status: 'active' },
  { _id: '66f0000000000000000007a1', companyId: 'co-2', companyName: 'Sejahtera Baru Life', code: '0701', branchName: 'Cempaka Putih Branch', status: 'active' },
];
const ROLES = [
  { code: 'AGENT', label: 'Agent', class: 'agent' }, { code: 'AAB', label: 'AAB', class: 'aab' }, { code: 'AB', label: 'AB', class: 'ab' },
];
const OPTIONS = {
  kpm: { id: KPM, code: '0602', branch: 'Bekasi Barat Branch', company: { id: 'co-1', name: 'Prudential' } },
  company: { id: 'co-1', name: 'Prudential' },
  roles: ROLES,
  seniorCode: 'AB',
  leaders: [
    { membershipId: 'm-ys', fullName: 'Yohanes Saputra', role: ROLES[2], isOwner: true, photoUrl: null },
    { membershipId: 'm-sm', fullName: 'Sinta Maharani', role: ROLES[1], isOwner: false, photoUrl: null },
  ],
  mayMakeOwner: true,
  mayMakeKpm: true,
};
const INVITED = {
  outcome: 'invited',
  invitation: {
    id: 'inv-1', kpmId: KPM, fullName: 'Rina Kartika', phone: '+6281277884410', email: null, role: { code: 'AGENT', class: 'agent' },
    leaderMembershipId: 'm-sm', makeOwner: false, state: 'pending', invitedAt: '2026-11-22T03:00:00.000Z',
    expiresAt: '2026-12-06T03:00:00.000Z',
  },
  link: 'https://app.test/user-invite/66f0.secret',
  kpm: { id: KPM, code: '0602', branch: 'Bekasi Barat Branch', created: false },
};
const opened = { location: { href: '' }, opener: {} as unknown, close: vi.fn() };

beforeEach(() => {
  opened.location.href = '';
  opened.close.mockClear();
  vi.stubGlobal('open', vi.fn(() => opened));
});
afterEach(() => vi.unstubAllGlobals());

const lists = {
  '/admin/tenants': { body: TENANTS },
  '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer' }, { _id: 'co-2', name: 'Sejahtera Baru Life', kind: 'insurer' }] },
};

function open(extra: Record<string, unknown> = {}, props: Partial<Parameters<typeof AddUserSheet>[0]> = {}) {
  const onDone = vi.fn<(done: AddUserDone) => void>();
  const stub = stubFetch({ ...lists, '/user-invitations/options': { body: OPTIONS }, ...extra } as never);
  renderWithSession(<AddUserSheet onClose={vi.fn()} onDone={onDone} {...props} />, { me: SUPER_ADMIN });
  return { ...stub, onDone };
}

describe('P19.28-T2 the Tambah user sheet (F-1)', () => {
  it('P19.28-T2 AC-2 the fields in order, the KPM first to choose; Peran, Leader and the owner switch once it is chosen', async () => {
    atWidth(390);
    open();
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    const labels = [...sheet.querySelectorAll('label, span[id]')].map((n) => n.textContent?.trim()).filter(Boolean);
    expect(labels.slice(0, 4)).toEqual(['Full name', 'WhatsApp number', 'Email · optional', 'KPM']);
    expect(within(sheet).getByLabelText('WhatsApp number')).toHaveAttribute('inputmode', 'tel');
    expect(within(sheet).queryByRole('radiogroup', { name: 'Role' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Add & send WhatsApp invitation' })).toBeInTheDocument();
    // Below 768px a bottom sheet; the title 18/800 (AC-7).
    expect(sheet.closest('[data-modal-root]')).toHaveAttribute('data-placement', 'sheet');
    expect(sheet.className).toContain('[&_[data-modal-head]_h2]:text-xl');
  });

  it('P19.28-T2 AC-8 from 768px the same fields in a centred dialog', async () => {
    atWidth(1024);
    open();
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    expect(sheet.closest('[data-modal-root]')).toHaveAttribute('data-placement', 'center');
  });

  it('P19.28-T2 AC-3 Pilih KPM replaces the content (‹ back), searches by name or code, ＋ KPM baru first', async () => {
    atWidth(390);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'KPM' }));
    const picker = await screen.findByRole('dialog', { name: 'Choose KPM' });
    expect(screen.queryByRole('dialog', { name: 'Add user' })).toBeNull();
    const rows = within(picker).getAllByRole('button').filter((b) => b.closest('li'));
    expect(rows[0]).toHaveTextContent('New KPM');
    await userEvent.type(within(picker).getByRole('searchbox'), '0417');
    expect(within(picker).getByRole('button', { name: /BSD City Branch/ })).toBeInTheDocument();
    expect(within(picker).queryByRole('button', { name: /Bekasi Barat Branch/ })).toBeNull();
    await userEvent.click(within(picker).getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('dialog', { name: 'Add user' })).toBeInTheDocument();
  });

  it('P19.28-T2 AC-2, AC-6 adds Rina: the KPM, the role chips (chosen one navy), the leader list under its field — saved, WhatsApp opened', async () => {
    atWidth(390);
    const { calls, onDone } = open({ 'POST /user-invitations': { body: INVITED } });
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Rina Kartika');
    await userEvent.type(within(sheet).getByLabelText('WhatsApp number'), '0812-7788-4410');
    await userEvent.click(within(sheet).getByRole('button', { name: 'KPM' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose KPM' })).getByRole('button', { name: /Bekasi Barat Branch/ }));
    const form = await screen.findByRole('dialog', { name: 'Add user' });
    expect(within(form).getByText('Prudential · KPM 0602')).toBeInTheDocument();
    const roles = await within(form).findByRole('radiogroup', { name: 'Role' });
    expect(within(roles).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Agent', 'AAB', 'AB']);
    await userEvent.click(within(roles).getByRole('radio', { name: 'Agent' }));
    expect(within(roles).getByRole('radio', { name: 'Agent' })).toHaveClass('bg-secondary');
    await userEvent.click(within(form).getByRole('button', { name: 'Leader' }));
    const leaders = within(form).getByRole('list', { name: 'Leader' });
    expect(within(leaders).getByText('Owner')).toBeInTheDocument();
    await userEvent.click(within(leaders).getByRole('button', { name: /SINTA MAHARANI|Sinta Maharani/ }));
    expect(within(form).getByRole('switch', { name: 'Make KPM Owner' })).not.toBeChecked();
    await userEvent.click(within(form).getByRole('button', { name: 'Add & send WhatsApp invitation' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const sent = calls.find((c) => c.url.endsWith('/user-invitations') && c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({
      fullName: 'Rina Kartika', phone: '+6281277884410', kpmId: KPM, role: 'AGENT', leaderMembershipId: 'm-sm', makeOwner: false,
    });
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: 'invited', fullName: 'Rina Kartika', whatsAppOpened: true }));
    expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/6281277884410\?text=/);
    expect(decodeURIComponent(opened.location.href)).toContain(INVITED.link);
  });

  it('P19.28-T2 AC-2 Leader is hidden for an AB, and nothing is sent until the fields are right', async () => {
    atWidth(390);
    const { calls } = open();
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add & send WhatsApp invitation' }));
    expect(await within(sheet).findByText('Enter their full name.')).toBeInTheDocument();
    expect(within(sheet).getByText('Choose a KPM.')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'KPM' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose KPM' })).getByRole('button', { name: /Bekasi Barat Branch/ }));
    const form = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.click(within(await within(form).findByRole('radiogroup', { name: 'Role' })).getByRole('radio', { name: 'AB' }));
    expect(within(form).queryByRole('button', { name: 'Leader' })).toBeNull();
    expect(calls.some((c) => c.url.endsWith('/user-invitations') && c.init.method === 'POST')).toBe(false);
  });

  it('P19.28-T2 AC-4 ＋ KPM baru: the orange box, Peran AB alone, no Leader, KPM Owner · Ya, Buat KPM & jadikan owner', async () => {
    atWidth(390);
    const { calls } = open({
      '/user-invitations/options?companyId=co-1': { body: { ...OPTIONS, kpm: null, leaders: [] } },
      'POST /user-invitations': { body: { ...INVITED, kpm: { id: 'k-new', code: '0603', branch: 'Bintaro Branch', created: true } } },
    });
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Rina Kartika');
    await userEvent.type(within(sheet).getByLabelText('WhatsApp number'), '81277884410');
    await userEvent.click(within(sheet).getByRole('button', { name: 'KPM' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose KPM' })).getByRole('button', { name: /New KPM/ }));
    const form = await screen.findByRole('dialog', { name: 'Add user' });
    const box = form.querySelector('[data-add-user-new-kpm]') as HTMLElement;
    expect(within(box).getByRole('button', { name: 'Change' })).toBeInTheDocument();
    await userEvent.type(within(box).getByLabelText(/KPM name/), 'Bintaro Branch');
    // The amber ring on the rounded white field, never a rectangle round the bare input (the walk of 2026-11-22).
    const kpmName = within(box).getByLabelText(/KPM name/);
    expect(kpmName.closest('label')).toHaveClass('rounded-[20px]', 'focus-within:ring-2', 'focus-within:ring-focus-ring');
    expect(kpmName).toHaveClass('focus-visible:outline-none');
    await userEvent.click(within(box).getByRole('button', { name: /Choose company|Company/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Prudential' }).catch(() => screen.findByRole('option', { name: 'Prudential' })));
    const roles = await within(form).findByRole('radiogroup', { name: 'Role' });
    await waitFor(() => expect(within(roles).getByRole('radio', { name: 'AB' })).toHaveAttribute('aria-checked', 'true'));
    expect(within(roles).getByRole('radio', { name: 'Agent' })).toBeDisabled();
    expect(within(form).queryByRole('button', { name: 'Leader' })).toBeNull();
    expect(within(form).queryByRole('switch')).toBeNull();
    expect(form.querySelector('[data-add-user-first-owner]')).toHaveTextContent(/KPM Owner.*First owner of this KPM.*Yes/);
    await userEvent.click(within(form).getByRole('button', { name: 'Create KPM & make owner' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/user-invitations') && c.init.method === 'POST')).toBe(true));
    const sent = calls.find((c) => c.url.endsWith('/user-invitations') && c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({
      fullName: 'Rina Kartika', phone: '+6281277884410', newKpm: { branchName: 'Bintaro Branch', companyId: 'co-1' },
    });
  });

  it('P19.28-T2 AC-1 a KPM fixed (a KPM page, Undang anggota): shown, not editable, no KPM baru', async () => {
    atWidth(390);
    open({}, { fixedKpm: { id: KPM, branch: 'Bekasi Barat Branch', code: '0602', companyName: 'Prudential' } });
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    expect(within(sheet).queryByRole('button', { name: 'KPM' })).toBeNull();
    expect(within(sheet).getByText('Bekasi Barat Branch')).toBeInTheDocument();
    expect(await within(sheet).findByRole('radiogroup', { name: 'Role' })).toBeInTheDocument();
  });

  it('P19.28-T2 AC-1 the reader’s own KPM: the server names it, and the save names none', async () => {
    atWidth(1280);
    const admin = makeMe({ permissions: ['member:add'] });
    const stub = stubFetch({
      '/user-invitations/options': { body: { ...OPTIONS, mayMakeOwner: false, mayMakeKpm: false } },
      'POST /user-invitations': { body: INVITED },
    } as never);
    const onDone = vi.fn();
    renderWithSession(<AddUserSheet own onClose={vi.fn()} onDone={onDone} />, { me: admin });
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    expect(await within(sheet).findByText('Bekasi Barat Branch')).toBeInTheDocument();
    // A KPM Admin switches no owner (the server refuses it too).
    expect(within(sheet).queryByRole('switch')).toBeNull();
    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Rina');
    await userEvent.type(within(sheet).getByLabelText('WhatsApp number'), '81277884410');
    await userEvent.click(within(await within(sheet).findByRole('radiogroup', { name: 'Role' })).getByRole('radio', { name: 'AB' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add & send WhatsApp invitation' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const sent = stub.calls.find((c) => c.url.endsWith('/user-invitations') && c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).not.toHaveProperty('kpmId');
    expect(stub.calls.some((c) => c.url.endsWith('/user-invitations/options'))).toBe(true);
  });

  it('P19.28-T2 AC-6 a refusal is the server’s own sentence, the sheet stays, and the window closes', async () => {
    atWidth(390);
    open({
      'POST /user-invitations': {
        status: 409, body: { error: { code: 'ORG_INVITE_PENDING', message: 'This WhatsApp number already has an invitation to this KPM waiting.' } },
      },
    }, { fixedKpm: { id: KPM, branch: 'Bekasi Barat Branch', code: '0602', companyName: 'Prudential' } });
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Rina');
    await userEvent.type(within(sheet).getByLabelText('WhatsApp number'), '81277884410');
    await userEvent.click(within(await within(sheet).findByRole('radiogroup', { name: 'Role' })).getByRole('radio', { name: 'AB' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add & send WhatsApp invitation' }));
    expect(await within(sheet).findByText(/already has an invitation/)).toBeInTheDocument();
    expect(opened.close).toHaveBeenCalled();
  });

  it('P19.28-T2 in Indonesian: the stop motion’s words, verbatim, and no English left', async () => {
    atWidth(390);
    stubFetch({ ...lists, '/user-invitations/options': { body: OPTIONS } } as never);
    renderInIndonesian(<AddUserSheet onClose={vi.fn()} onDone={vi.fn()} />, { me: SUPER_ADMIN });
    const sheet = await screen.findByRole('dialog', { name: 'Tambah user' });
    for (const words of ['Nama lengkap', 'Nomor WhatsApp', 'KPM', 'Pilih KPM']) expect(within(sheet).getAllByText(words).length).toBeGreaterThan(0);
    expect(within(sheet).getByPlaceholderText('Nama sesuai KTP')).toBeInTheDocument();
    expect(within(sheet).getByText('· opsional')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah & kirim undangan WhatsApp' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'KPM' }));
    const picker = await screen.findByRole('dialog', { name: 'Pilih KPM' });
    expect(within(picker).getByPlaceholderText('Cari nama KPM atau kode')).toBeInTheDocument();
    expect(within(picker).getByText('KPM baru')).toBeInTheDocument();
    expect(within(picker).getByText('Belum ada KPM untuk orang ini')).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(addUserMessages))).toEqual([]);
  });
});

describe('P19.28-T2 AC-1 Undang anggota (UI-203)', () => {
  it('P19.28-T2 AC-1 opens the sheet for a reader who may add; a core leader keeps the old address', async () => {
    atWidth(1280);
    stubFetch({ '/user-invitations/options': { body: OPTIONS } } as never);
    const { unmount } = renderWithSession(
      <AddUserButton label="Invite a member" icon={null} fallbackHref="/user-management/add" className="" />,
      { me: makeMe({ permissions: ['member:add'] }) },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Invite a member' }));
    expect(await screen.findByRole('dialog', { name: 'Add user' })).toBeInTheDocument();
    unmount();
    renderWithSession(
      <AddUserButton label="Invite a member" icon={null} fallbackHref="/user-management/add" className="" />,
      { me: makeMe({ permissions: [] }) },
    );
    expect(screen.getByRole('link', { name: 'Invite a member' })).toHaveAttribute('href', '/user-management/add');
  });
});
