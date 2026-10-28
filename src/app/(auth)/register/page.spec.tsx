import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import { AUTH_PAGE } from '@/components/auth-page';
import RegisterPage from './page';

/** The page's query string: `?invite=…` for a leader's invite (P18.96-T3), nothing otherwise. */
const query = { current: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/register',
  useSearchParams: () => new URLSearchParams(query.current),
}));

/** The insurers the selector loads. Public, so no token is involved. */
const INSURERS = [
  { _id: 'co-1', name: 'Allianz' },
  { _id: 'co-2', name: 'Prudential' },
];

async function fill(password = 'a long enough password') {
  await userEvent.type(screen.getByLabelText('Full name'), 'Rina Wijaya');
  await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.type(screen.getByLabelText('Confirm password'), password);
  // The insurer that issued the code, and the code itself (ADR-0017).
  await screen.findByRole('option', { name: 'Prudential' });
  await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
  await userEvent.type(screen.getByLabelText('Agent code'), '88213');
  await personal();
}

/**
 * What a person records (ADR-0158, P18.8-T4). A `type="date"` or `type="month"` input takes a value,
 * not keystrokes: jsdom has no picker to type into.
 */
async function personal() {
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-03-15' } });
  fireEvent.change(screen.getByLabelText(/^Joined /), { target: { value: '2021-07' } });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'full_time');
  await userEvent.selectOptions(screen.getByLabelText('Gender'), 'female');
}

describe('register', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says plainly that an account is not an office, from 768px — on a phone it is not drawn (P18.95-T7 AC-1)', () => {
    // Creating an account and joining an office are separate steps; a reader who
    // expects one to imply the other will wait for something that is not coming.
    renderWithSession(<RegisterPage />, { me: null });
    const line = screen.getByText('Your office is added separately. This is just your login.');
    // Grey text row 26: the client's *Remove* below 768px, its words kept above it.
    expect(line.className.split(/\s+/).filter((c) => /hidden/.test(c))).toEqual(['max-md:hidden']);
    // The title keeps the line's gap on a phone, so the form does not start against it.
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toHaveClass('max-md:mb-6');
  });

  it('P18.95-T7 AC-1 says where the agent code is, in the client’s words at every size (grey text row 26)', () => {
    renderWithSession(<RegisterPage />, { me: null });
    expect(screen.getByLabelText('Agent code')).toHaveAccessibleDescription('Found on your contract');
    expect(screen.queryByText(/producer id/)).not.toBeInTheDocument();
  });

  it('P18.95-T7 AC-3 places its title as sign-in places its own: one column, its top 16% of a phone down, centred from 768px', () => {
    renderWithSession(<RegisterPage />, { me: null });
    const main = screen.getByRole('main');
    expect(main.className).toBe(AUTH_PAGE);
    expect(main).toHaveClass('justify-center', 'max-md:justify-start', 'max-md:pt-[16svh]');
    expect(main.firstElementChild).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('P18.95-T7 AC-3 says under Create account what it waits for — the fields still empty, by their labels', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });
    const submit = screen.getByRole('button', { name: 'Create account' });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription(
      'Still needed: Full name, Date of birth, Gender, Insurer, Agent code, Joined your insurer, Status, Email, Password and Confirm password.',
    );
    await userEvent.type(screen.getByLabelText('Full name'), 'Rina Wijaya');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
    await userEvent.type(screen.getByLabelText('Agent code'), '88213');
    await personal();
    expect(submit).toHaveAccessibleDescription('Still needed: Password and Confirm password.');

    // Nothing empty, but the password wrong: its own field says how, and the hint says to fix it.
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short');
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription('Fix the password above.');
    expect(screen.getByText('Fix the password above.')).toHaveClass('text-xs', 'text-muted');

    // Live: no hint at all.
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough password');
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAccessibleDescription();
    expect(screen.queryByText(/^Still needed/)).not.toBeInTheDocument();
  });

  it('sends the nine fields the API asks for', async () => {
    const { calls } = stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: { status: 'verification_sent' } },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const register = calls.find((c) => c.url.includes('/auth/register'))!;
    expect(JSON.parse(register.init.body as string)).toEqual({
      fullName: 'Rina Wijaya',
      email: 'rina@kpm0417.test',
      password: 'a long enough password',
      companyId: 'co-2',
      agentCode: '88213',
      dateOfBirth: '1990-03-15',
      companyJoinMonth: '2021-07',
      workStatus: 'full_time',
      gender: 'female',
    });
  });

  it('P18.8-T4 AC-3: asks the four a person records, the join month named after the insurer chosen', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });

    expect(screen.getByLabelText('Date of birth')).toHaveAttribute('type', 'date');
    // Month and year, and the insurer's own name once one is chosen.
    expect(screen.getByLabelText('Joined your insurer')).toHaveAttribute('type', 'month');
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
    expect(screen.getByLabelText('Joined Prudential')).toHaveAttribute('type', 'month');

    const status = screen.getByLabelText<HTMLSelectElement>('Status');
    expect([...status.options].map((o) => o.text)).toEqual(['Choose', 'Full-time', 'Part-time']);
    const gender = screen.getByLabelText<HTMLSelectElement>('Gender');
    expect([...gender.options].map((o) => o.text)).toEqual(['Choose', 'Male', 'Female']);
  });

  it('P18.8-T4 AC-3: holds the button until all four are given', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });
    const submit = screen.getByRole('button', { name: 'Create account' });

    await userEvent.type(screen.getByLabelText('Full name'), 'Rina Wijaya');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough password');
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
    await userEvent.type(screen.getByLabelText('Agent code'), '88213');
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-03-15' } });
    fireEvent.change(screen.getByLabelText('Joined Prudential'), { target: { value: '2021-07' } });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'part_time');
    expect(submit).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'male');
    expect(submit).toBeEnabled();
  });

  it('P18.8-T4 AC-4: says a refusal that names one of the four under that field', async () => {
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': {
        status: 400,
        body: { error: {
          code: 'VALIDATION_FAILED', message: 'A date of birth must be at least 18 years ago.',
          details: { field: 'dateOfBirth' }, requestId: 'req-4',
        } },
      },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const said = await screen.findByText('A date of birth must be at least 18 years ago.');
    expect(said).toHaveAttribute('id', 'dateOfBirth-error');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/verification link is on its way/)).not.toBeInTheDocument();
  });

  it('offers no insurer chosen for you, because the wrong one is not recoverable here', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });

    await screen.findByRole('option', { name: 'Prudential' });
    expect(screen.getByLabelText<HTMLSelectElement>('Insurer').value).toBe('');
    // And the form will not go until one is picked: the code is unique inside an
    // insurer, so submitting against the wrong one is a code that belongs to somebody.
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('confirms the same way whether or not the address is already taken', async () => {
    // The API answers identically on purpose — confirming would let anyone test
    // addresses against this form. The screen must not undo that.
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: { status: 'verification_sent' } },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const confirmation = await screen.findByText(/verification link is on its way/);
    expect(confirmation.textContent).toMatch(/if .* can be registered/i);
    expect(confirmation.textContent).not.toMatch(/already|exists|taken/i);
  });

  it('applies the password rules the server applies, before the round trip', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });
    const submit = screen.getByRole('button', { name: 'Create account' });

    await userEvent.type(screen.getByLabelText('Full name'), 'Rina');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    // Everything else valid, so the password is the only thing holding the button.
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
    await userEvent.type(screen.getByLabelText('Agent code'), '88213');
    await personal();

    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long password ');
    expect(screen.getByText('Do not begin or end with a space.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    // Typed but not yet confirmed: the button stays down, because a create flow needs
    // the second box (the reset screen has needed one since Phase 2).
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough passwor');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Confirm password'), 'd');
    expect(screen.queryByText('The two passwords do not match.')).toBeNull();
    expect(submit).toBeEnabled();
  });

  it('offers to show what was typed, on both password boxes', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });

    // A ten-character minimum makes a mistyped passphrase the likeliest failure, and
    // "the two do not match" does not say which one is wrong.
    const toggles = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggles).toHaveLength(2);

    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    await userEvent.click(toggles[0]);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    // And only that one.
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  });

  it('says how long the verification link lasts', async () => {
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: {} },
    });
    renderWithSession(<RegisterPage />, { me: null });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/24 hours and works once/)).toBeInTheDocument();
  });

  it('shows a server rejection rather than a false confirmation', async () => {
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Password must not begin or end with a space.', requestId: 'req-3' } },
      },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('must not begin or end with a space');
    expect(screen.queryByText(/verification link is on its way/)).not.toBeInTheDocument();
  });

  it('offers the way back to sign in', () => {
    renderWithSession(<RegisterPage />, { me: null });
    expect(screen.getByRole('link', { name: /Already have an account/ })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  describe('on a leader’s invite (P18.96-T3 AC-4, ADR-0170 §3)', () => {
    const TOKEN = 'kpm-1.secret';
    const BANNER = {
      leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-2', companyName: 'Prudential',
      agentCode: '80777', joinDate: '2026-10-27', fullName: 'Yusuf Hidayat', existingAccount: false, expiresAt: '2026-11-10T03:00:00.000Z',
    };
    afterEach(() => { query.current = ''; });

    it('P18.96-T3 AC-4 shows the banner, the name filled in, and the insurer, the agent code and the join date read-only', async () => {
      query.current = `invite=${TOKEN}`;
      const { calls } = stubFetch({ '/companies': { body: INSURERS }, '/invites/': { body: BANNER } });
      renderWithSession(<RegisterPage />, { me: null });
      expect(await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417")).toBeInTheDocument();
      expect(calls.some((c) => c.url.endsWith(`/invites/${encodeURIComponent(TOKEN)}`))).toBe(true);
      expect(screen.getByLabelText('Full name')).toHaveValue('Yusuf Hidayat');
      expect(screen.getByLabelText('Full name')).not.toHaveAttribute('readonly');
      expect(screen.getByLabelText('Agent code')).toHaveValue('80777');
      expect(screen.getByLabelText('Agent code')).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Insurer')).toHaveValue('Prudential');
      expect(screen.getByLabelText('Insurer')).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Join date')).toHaveValue('2026-10-27');
      expect(screen.getByLabelText('Join date')).toHaveAttribute('readonly');
      // Already holding an account goes to sign in, and back to the invite after.
      expect(screen.getByRole('link', { name: 'Already have an account? Sign in' }))
        .toHaveAttribute('href', `/login?next=${encodeURIComponent(`/join?invite=${encodeURIComponent(TOKEN)}`)}`);
    });

    it('P18.96-T3 AC-4 says nothing of the office being added separately: accepting the invite places them in it', async () => {
      // Found walking a production build at 768px (2026-10-27): the line stood beside the banner and contradicted it.
      query.current = `invite=${TOKEN}`;
      stubFetch({ '/companies': { body: INSURERS }, '/invites/': { body: BANNER } });
      renderWithSession(<RegisterPage />, { me: null });
      await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417");
      expect(screen.queryByText(/added separately|just your login/)).not.toBeInTheDocument();
      // The title keeps the line's gap at every size, so the banner does not start against it.
      const title = screen.getByRole('heading', { level: 1, name: 'Create your account' });
      expect(title).toHaveClass('mb-6');
      expect(title).not.toHaveClass('max-md:mb-6');
    });

    it('P18.96-T3 AC-4 registers with the invite’s token, insurer and code, and says they join the leader’s team', async () => {
      query.current = `invite=${TOKEN}`;
      const { calls } = stubFetch({
        '/companies': { body: INSURERS }, '/invites/': { body: BANNER },
        '/auth/register': { status: 201, body: { status: 'verification_sent' } },
      });
      renderWithSession(<RegisterPage />, { me: null });
      await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417");
      await userEvent.type(screen.getByLabelText('Email'), 'yusuf@new.test');
      await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
      await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough password');
      await personal();
      await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
      const register = calls.find((c) => c.url.includes('/auth/register'))!;
      expect(JSON.parse(register.init.body as string)).toMatchObject({
        fullName: 'Yusuf Hidayat', companyId: 'co-2', agentCode: '80777', inviteToken: TOKEN, email: 'yusuf@new.test',
      });
      expect(await screen.findByText("Once you have verified it and signed in, you are in Agus Prasetyo's team.")).toBeInTheDocument();
    });

    it('P18.96-T3 AC-4 a link that opens nothing says so plainly, and offers signing in or registering without it', async () => {
      query.current = `invite=${TOKEN}`;
      stubFetch({
        '/companies': { body: INSURERS },
        '/invites/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'This invite has expired. Ask whoever sent it to send it again.', requestId: 'r' } } },
      });
      renderWithSession(<RegisterPage />, { me: null });
      expect(await screen.findByText('This invite has expired. Ask whoever sent it to send it again.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Create an account without an invite' })).toHaveAttribute('href', '/register');
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
    });

    it('P18.96-T3 AC-4 an invite for an account that exists sends them to sign in and accept', async () => {
      query.current = `invite=${TOKEN}`;
      stubFetch({ '/companies': { body: INSURERS }, '/invites/': { body: { ...BANNER, existingAccount: true } } });
      renderWithSession(<RegisterPage />, { me: null });
      expect(await screen.findByText('This invite is for an account that already exists. Sign in to accept it.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sign in to accept' }))
        .toHaveAttribute('href', `/login?next=${encodeURIComponent(`/join?invite=${encodeURIComponent(TOKEN)}`)}`);
    });
  });
});
