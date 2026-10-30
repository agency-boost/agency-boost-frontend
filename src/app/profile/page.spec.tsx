import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderLive, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import { FieldAvatar } from '@/components/field-nav';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

/** Agus, an AB tagged Core Leader with an informal group, leading eleven people (`profile-mobile`). */
const AGUS = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Prasetyo', preferredName: 'Agus', pronoun: 'he',
    initials: 'AP', platformRole: 'none', dateOfBirth: '1995-03-18', gender: 'male', companyJoinMonth: '2020-09',
    workStatus: 'full_time', phone: null, avatarUrl: null,
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: false,
    isKpmAdmin: false, status: 'active', directCount: 4, isCoreLeader: true, groups: ['Marvelous'],
    office: { code: '0417', branch: 'BSD City Branch' },
  },
  permissions: ['profile:read_self', 'calendar_entry:read', 'calendar_entry:update'],
});

/** Indah, an Agent who leads nobody. */
const INDAH = makeMe({
  user: { ...AGUS.user, id: 'u-indah', fullName: 'Indah Permatasari', email: 'indah@kpm0417.test', gender: 'female' },
  membership: {
    membershipId: 'mem-indah', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', isKpmOwner: false,
    isKpmAdmin: false, status: 'active', directCount: 0, isCoreLeader: false, groups: [],
    office: { code: '0417', branch: 'BSD City Branch' },
  },
  permissions: ['profile:read_self'],
});

const FACTS = {
  companyName: 'Prudential Indonesia', agentCode: '70012345',
  leader: { name: 'Wilson Tanoto', orgLevelCode: 'AB' },
  group: { people: 11, ab: 0, aab: 3, agents: 8 },
};
const SESSIONS = [
  {
    sessionId: 's1', userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit Chrome/120 Mobile Safari', ip: '103.10.1.2',
    lastUsedAt: '2026-10-30T08:00:00.000Z', startedAt: '2026-10-01T08:00:00.000Z', expiresAt: '2026-11-01T08:00:00.000Z', current: true,
  },
  {
    sessionId: 's2', userAgent: 'Mozilla/5.0 (Macintosh) Safari/605', ip: '103.10.1.3',
    lastUsedAt: '2026-10-29T08:00:00.000Z', startedAt: '2026-10-01T08:00:00.000Z', expiresAt: '2026-11-01T08:00:00.000Z', current: false,
  },
];

const reads = (extra: Record<string, unknown> = {}) => ({
  '/auth/me/profile': { body: FACTS },
  '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
  '/auth/sessions': { body: SESSIONS },
  '/calendar/settings': { body: { hideDetails: false } },
  '/notifications': { body: { items: [], unread: 0 } },
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('UI-111 Profil saya', () => {
  it('UI-111 the title row reads My profile; the photo card shows the initials, the name, AB · Core Leader · the leader code and Change photo', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    expect(screen.getByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument();
    const card = document.querySelector('[data-photo-card]') as HTMLElement;
    expect(within(card).getByText('Agus Prasetyo')).toBeInTheDocument();
    expect(await within(card).findByText('AB · Core Leader · AGUS01')).toBeInTheDocument();
    expect(within(card).getByText('AP')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Change your profile photo' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
    // The photo card no longer repeats the email; it is a Data diri field.
    expect(within(card).queryByText('agus@kpm0417.test')).not.toBeInTheDocument();
  });

  it('UI-111 the sections in order: Personal details, KPM and role, Settings, Security, then Sign out last', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(['Personal details', 'KPM and role', 'Preferences', 'Security']);
    const buttons = within(document.querySelector('[data-profile]') as HTMLElement).getAllByRole('button');
    expect(buttons[buttons.length - 1]).toHaveTextContent('Sign out');
  });

  it('UI-111 Personal details is the sign-up form: no Preferred name or Pronoun, the insurer and the agent code locked with their hint', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    expect(screen.getByLabelText('Full name')).toHaveValue('Agus Prasetyo');
    expect(screen.queryByLabelText('Preferred name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pronoun')).not.toBeInTheDocument();
    expect(await screen.findByText('Prudential Indonesia')).toBeInTheDocument();
    expect(screen.getByText('70012345')).toBeInTheDocument();
    expect(screen.getByText('Cannot be changed. Ask your KPM admin if it is wrong.')).toBeInTheDocument();
    // The dates as sign-up shows them.
    expect(screen.getByText('18 / 03 / 1995')).toBeInTheDocument();
    expect(screen.getByText('09 / 2020')).toBeInTheDocument();
    // Choices are segments.
    expect(screen.getByRole('radio', { name: 'Male' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Full-time' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('WhatsApp number')).toHaveValue('');
    expect(screen.getByText('+62')).toBeInTheDocument();
  });

  it('UI-111 the floating Unsaved · Save pill appears only after a change, and goes when the change is undone', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });
    expect(document.querySelector('[data-floating-save]')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Part-time' }));
    expect(document.querySelector('[data-floating-save]')).not.toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Full-time' }));
    expect(document.querySelector('[data-floating-save]')).toBeNull();
  });

  it('UI-111 the WhatsApp number saves as +62 with what changed, and nothing else; the session is read again and Saved shows', async () => {
    const { calls } = stubFetch(reads({ 'PATCH /auth/me': { body: AGUS } }));
    const { session } = renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812-1100-2200');
    await userEvent.click(screen.getByRole('radio', { name: 'Part-time' }));
    const pill = document.querySelector('[data-floating-save]') as HTMLElement;
    await userEvent.click(within(pill).getByRole('button', { name: 'Save' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init.body))).toEqual({ phone: '+6281211002200', workStatus: 'part_time' });
    await waitFor(() => expect(session.reload).toHaveBeenCalled());
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('UI-111 a number that is not one is said under its field and nothing is sent', async () => {
    const { calls } = stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.type(screen.getByLabelText('WhatsApp number'), '123');
    const pill = document.querySelector('[data-floating-save]') as HTMLElement;
    await userEvent.click(within(pill).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Write 9 to 13 digits after +62.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it('UI-111 KPM and role: the office, AB · Agency Builder with the Core Leader pill, the leader, the informal group, the group › and the leader code', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    const facts = await screen.findByText('Wilson Tanoto · AB');
    const card = facts.closest('[data-kpm-role]') as HTMLElement;
    expect(within(card).getByText('BSD City Branch')).toBeInTheDocument();
    expect(within(card).getByText('AB · Agency Builder')).toBeInTheDocument();
    expect(within(card).getAllByText('Core Leader').length).toBeGreaterThan(0);
    expect(within(card).getByText('Marvelous')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '11 people · 3 AAB · 8 Agents' })).toHaveAttribute('href', '/group-tree');
    expect(await within(card).findByText('AGUS01')).toBeInTheDocument();
  });

  it('UI-111 Copy puts the leader code on the clipboard and says Copied', async () => {
    stubFetch(reads());
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.click(await screen.findByRole('button', { name: 'Copy Leader code' }));
    expect(writeText).toHaveBeenCalledWith('AGUS01');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('UI-111 an Agent reads KPM, Role Agent and their leader — no group, no leader code — and no informal group when there is none', async () => {
    stubFetch(reads({ '/auth/me/profile': { body: { ...FACTS, leader: { name: 'Agus Prasetyo', orgLevelCode: 'AB' }, group: null } } }));
    renderWithSession(<ProfilePage />, { me: INDAH });

    expect(await screen.findByText('Agus Prasetyo · AB')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.queryByText('Your group')).not.toBeInTheDocument();
    expect(screen.queryByText('Leader code')).not.toBeInTheDocument();
    expect(screen.queryByText('Informal group')).not.toBeInTheDocument();
  });

  it('UI-111 Bahasa › opens a small sheet of the two languages; choosing one saves at once, the same choice as the switch', async () => {
    const { calls } = stubFetch(reads({ 'PATCH /auth/me': { body: AGUS } }));
    renderLive(<ProfilePage />, { me: AGUS });

    const row = screen.getByRole('button', { name: /Bahasa/ });
    expect(row).toHaveTextContent('Bahasa Indonesia');
    await userEvent.click(row);
    const sheet = await screen.findByRole('dialog', { name: 'Bahasa' });
    expect(within(sheet).getByRole('radio', { name: 'Bahasa Indonesia' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'English' }));

    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH' && String(c.init.body).includes('"locale":"en"'))).toBe(true));
    // Said in the language just chosen.
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('UI-111 / D-30 Hide Calendar activities saves at once on PUT /calendar/settings', async () => {
    const { calls } = stubFetch(reads({ 'PUT /calendar/settings': { body: { hideDetails: true } } }));
    renderWithSession(<ProfilePage />, { me: AGUS });

    const toggle = await screen.findByRole('switch', { name: 'Hide Calendar activities' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAccessibleDescription('Your team still sees when you are busy, without the details');
    await userEvent.click(toggle);

    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toEqual({ hideDetails: true });
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it('UI-111 password still works as today: Change password › opens its three fields in a sheet and changes it', async () => {
    const { calls } = stubFetch(reads({ '/auth/change-password': { body: { status: 'changed' } } }));
    renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change password' });
    await userEvent.type(within(sheet).getByLabelText('Current password'), 'old-password-1');
    await userEvent.type(within(sheet).getByLabelText('New password'), 'new-password-123');
    await userEvent.type(within(sheet).getByLabelText('Confirm new password'), 'new-password-123');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Change password' }));

    const sent = calls.find((c) => c.url.includes('/auth/change-password'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ currentPassword: 'old-password-1', newPassword: 'new-password-123' });
    expect(await within(sheet).findByText('Password changed. Your other sessions were signed out.')).toBeInTheDocument();
  });

  it('UI-111 devices still work as today: the row counts them and names this one; its sheet signs another out', async () => {
    const { calls } = stubFetch(reads({ 'DELETE /auth/sessions/s2': { body: null } }));
    renderWithSession(<ProfilePage />, { me: AGUS });

    const row = await screen.findByRole('button', { name: /2 devices · this one: Chrome on Android/ });
    await userEvent.click(row);
    const sheet = await screen.findByRole('dialog', { name: 'Where you are signed in' });
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Sign this one out' }));
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/auth/sessions/s2'))).toBe(true);
    expect(within(sheet).getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
  });

  it('UI-111 Remove photo clears it, reads the session again and says so', async () => {
    const { calls } = stubFetch(reads({ 'DELETE /auth/me/avatar': { body: { avatarUrl: null } } }));
    const withPhoto = makeMe({ ...AGUS, user: { ...AGUS.user, avatarUrl: 'https://signed.test/agus.jpg' } });
    const { session } = renderWithSession(<ProfilePage />, { me: withPhoto });

    await userEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const sheet = await screen.findByRole('dialog', { name: 'Profile photo' });
    expect(within(sheet).getByRole('button', { name: 'Save photo' })).toBeDisabled();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove photo' }));

    expect(calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/auth/me/avatar'))).toBe(true);
    await waitFor(() => expect(session.reload).toHaveBeenCalled());
    expect(await screen.findByText('Photo removed')).toBeInTheDocument();
  });

  it('UI-111 the photo sheet offers Camera and Gallery, Save photo grey until a picture is chosen, and no Remove photo without one', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.click(screen.getByRole('button', { name: 'Change your profile photo' }));
    const sheet = await screen.findByRole('dialog', { name: 'Profile photo' });
    expect(within(sheet).getByRole('button', { name: 'Camera' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Gallery' })).toBeInTheDocument();
    expect(within(sheet).getByRole('slider', { name: 'Zoom' })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Save photo' })).toBeDisabled();
    expect(within(sheet).queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
    expect(sheet.querySelector('input[data-pick="camera"]')).toHaveAttribute('capture', 'user');
    expect(sheet.querySelector('input[data-pick="gallery"]')).toHaveAttribute('accept', 'image/*');
  });

  it('UI-111 a saved photo is every avatar of theirs: the title row’s and the Lainnya sheet’s draw it, the initials without one', () => {
    const { container, rerender } = render(<FieldAvatar account={{ initials: 'AP', avatarUrl: 'https://signed.test/agus.jpg' }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://signed.test/agus.jpg');
    rerender(<FieldAvatar account={{ initials: 'AP', avatarUrl: null }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('AP');
  });

  it('UI-111 in a support session it is shown and not offered: no photo change, no save, the fields disabled', async () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, {
      me: makeMe({ ...AGUS, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'sa-1' }),
    });

    expect(screen.queryByRole('button', { name: 'Change photo' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeDisabled();
    expect(screen.getByLabelText('WhatsApp number')).toBeDisabled();
    expect(screen.getByText('Only they can change this, not a support session.')).toBeInTheDocument();
  });

  it('UI-111 a Super Admin reads their name, email and number — no personal fields and no KPM and role', () => {
    stubFetch(reads({ '/auth/me/profile': { body: { companyName: null, agentCode: null, leader: null, group: null } } }));
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        user: { ...AGUS.user, id: 'u-root', fullName: 'Root', platformRole: 'super_admin' },
        membership: null,
        permissions: ['profile:read_self'],
      }),
    });

    expect(screen.getByLabelText('Full name')).toHaveValue('Root');
    expect(screen.queryByText('Insurance company')).not.toBeInTheDocument();
    expect(screen.queryByText('KPM and role')).not.toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp number')).toBeInTheDocument();
  });
});

/**
 * **UI-111 — the email, a field** (UI V1, 2026-10-30; ADR-0181): *Jika diubah, tautan verifikasi dikirim ke alamat
 * baru*. A changed email and the page's save ask for the password in a sheet, then `POST /auth/me/email`; the field
 * keeps the address the account has, and a line under it says where the link went until the page is loaded again.
 */
describe('UI-111 changing the email', () => {
  const pill = () => document.querySelector('[data-floating-save]') as HTMLElement;

  async function askWith(address: string) {
    const field = screen.getByLabelText('Email');
    await userEvent.clear(field);
    await userEvent.type(field, address);
    await userEvent.click(within(pill()).getByRole('button', { name: 'Save' }));
  }

  it('UI-111 the email is a field, prefilled, with the report’s hint', () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    const field = screen.getByLabelText('Email');
    expect(field).toHaveValue('agus@kpm0417.test');
    expect(field).toBeEnabled();
    expect(field).toHaveAccessibleDescription('If you change it, a verification link is sent to the new address');
  });

  it('UI-111 a changed email asks for the password in a sheet, sends the link, and says where it went; nothing is patched', async () => {
    const { calls } = stubFetch(reads({ 'POST /auth/me/email': { status: 202, body: { status: 'accepted' } } }));
    const { session } = renderWithSession(<ProfilePage />, { me: AGUS });

    await askWith('agus.baru@kpm0417.test');
    const sheet = await screen.findByRole('dialog', { name: 'Change email' });
    expect(within(sheet).getByText('Enter your password to send a verification link to agus.baru@kpm0417.test.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Send link' })).toBeDisabled();
    await userEvent.type(within(sheet).getByLabelText('Current password'), 'my-password-1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send link' }));

    const sent = calls.find((c) => c.url.includes('/auth/me/email'))!;
    expect(sent.init.method).toBe('POST');
    expect(JSON.parse(String(sent.init.body))).toEqual({ newEmail: 'agus.baru@kpm0417.test', currentPassword: 'my-password-1' });
    expect(await screen.findByText(
      'A verification link was sent to agus.baru@kpm0417.test. Your email changes once that link is opened.',
    )).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change email' })).not.toBeInTheDocument());
    // The account still has the old address until the link is opened, and the field says so.
    expect(screen.getByLabelText('Email')).toHaveValue('agus@kpm0417.test');
    expect(document.querySelector('[data-floating-save]')).toBeNull();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(session.reload).not.toHaveBeenCalled();
  });

  it('UI-111 with another change beside it: the link first, then the rest saved on PATCH /auth/me without the email', async () => {
    const { calls } = stubFetch(reads({
      'POST /auth/me/email': { status: 202, body: { status: 'accepted' } },
      'PATCH /auth/me': { body: AGUS },
    }));
    const { session } = renderWithSession(<ProfilePage />, { me: AGUS });

    await userEvent.click(screen.getByRole('radio', { name: 'Part-time' }));
    await askWith('agus.baru@kpm0417.test');
    const sheet = await screen.findByRole('dialog', { name: 'Change email' });
    // Nothing is saved while the sheet waits for the password.
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    await userEvent.type(within(sheet).getByLabelText('Current password'), 'my-password-1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send link' }));

    await waitFor(() => expect(session.reload).toHaveBeenCalled());
    const order = calls.filter((c) => c.init.method === 'POST' || c.init.method === 'PATCH').map((c) => c.init.method);
    expect(order).toEqual(['POST', 'PATCH']);
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init.body))).toEqual({ workStatus: 'part_time' });
  });

  it('UI-111 a wrong password is said in the sheet, and nothing is saved', async () => {
    const { calls } = stubFetch(reads({
      'POST /auth/me/email': {
        status: 401,
        body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Your current password is not correct.', requestId: 'r-1' } },
      },
    }));
    renderWithSession(<ProfilePage />, { me: AGUS });

    await askWith('agus.baru@kpm0417.test');
    const sheet = await screen.findByRole('dialog', { name: 'Change email' });
    await userEvent.type(within(sheet).getByLabelText('Current password'), 'wrong-password');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send link' }));

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Your current password is not correct.');
    expect(screen.getByLabelText('Email')).toHaveValue('agus.baru@kpm0417.test');
    expect(screen.queryByText(/A verification link was sent/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it('UI-111 an address another account has is said under the field, and the sheet closes', async () => {
    stubFetch(reads({
      'POST /auth/me/email': {
        status: 409,
        body: {
          error: {
            code: 'AUTH_EMAIL_TAKEN', message: 'That address belongs to another account. Use a different one.',
            requestId: 'r-2', details: { field: 'newEmail' },
          },
        },
      },
    }));
    renderWithSession(<ProfilePage />, { me: AGUS });

    await askWith('dewi@kpm0417.test');
    const sheet = await screen.findByRole('dialog', { name: 'Change email' });
    await userEvent.type(within(sheet).getByLabelText('Current password'), 'my-password-1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send link' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change email' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      expect.stringContaining('That address belongs to another account. Use a different one.'),
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('UI-111 something that is not an address is said under the field, and no sheet opens', async () => {
    const { calls } = stubFetch(reads());
    renderWithSession(<ProfilePage />, { me: AGUS });

    await askWith('agus-at-kpm');

    expect(await screen.findByText('Write a whole email address, like name@example.com.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Change email' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/auth/me/email'))).toBe(false);
  });

  it('UI-111 in a support session the email is shown and not offered', () => {
    stubFetch(reads());
    renderWithSession(<ProfilePage />, {
      me: makeMe({ ...AGUS, isImpersonating: true, impersonationReadOnly: false, impersonatedBy: 'sa-1' }),
    });

    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
