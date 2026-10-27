'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { listInsurers, type Insurer } from '@/lib/companies';
import { GENDER_LABEL, WORK_STATUS_LABEL, type Gender, type WorkStatus } from '@/lib/personal';
import { AUTH_PAGE } from '@/components/auth-page';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { cn } from '@/lib/cn';
import { heldBecause } from '@/lib/disabled-reason';

/**
 * Self-signup.
 *
 * Creating an account and joining an office are separate steps, deliberately: an office
 * is a commercial relationship, and only a Super Admin creates one (ADR-0005). What this
 * screen produces is a verified person with no membership — the valid "new agent" state
 * — who then joins through one of the four onboarding paths.
 *
 * **The insurer and the agent code are asked for here, not later** (ADR-0017). The code
 * is the one the insurer issued, and it identifies the person the way their email does —
 * so it belongs to the account, and the account exists before any office admits them.
 * `GET /companies` is the one company question a visitor may ask without a token.
 *
 * **And what a person records** (ADR-0158, P18.8-T4): their date of birth, the month they joined the
 * insurer — the label names it, *Joined Prudential*, once one is chosen — whether they work full-time
 * or part-time, and their gender. All four required. Whether the birth date is 18 years ago and the
 * month not still to come is the server's to say, and its sentence is shown under the field it names.
 */
const MIN_LENGTH = 10;

/** The four `POST /auth/register` refuses by name (`details.field`), shown under their own field. */
const PERSONAL_FIELDS = ['dateOfBirth', 'companyJoinMonth', 'workStatus', 'gender'] as const;
type PersonalField = (typeof PERSONAL_FIELDS)[number];

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', companyId: '', agentCode: '',
    dateOfBirth: '', companyJoinMonth: '', workStatus: '' as WorkStatus | '', gender: '' as Gender | '',
  });
  const [insurers, setInsurers] = useState<Insurer[] | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    // No preselection. Choosing the wrong insurer is not recoverable from this screen —
    // the code is unique inside one of them — so the list opens on nothing chosen.
    listInsurers()
      .then((rows) => { if (live) setInsurers(rows); })
      .catch((err) => { if (live) { setInsurers([]); setError(toDisplayError(err)); } });
    return () => { live = false; };
  }, []);

  // The same three rules the server applies, checked here so the failure is immediate
  // rather than a round trip. The server check remains the real one.
  const tooShort = form.password.length > 0 && form.password.length < MIN_LENGTH;
  const padded = /^\s|\s$/.test(form.password);
  // Only once they have started the second box: complaining that an empty field does not
  // match the one above it is telling somebody off for not having finished typing.
  const mismatch = form.confirmPassword.length > 0 && form.confirmPassword !== form.password;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  // The insurer's own name in the join month's label — *Joined Prudential* — once one is chosen.
  const insurerName = insurers?.find((c) => c._id === form.companyId)?.name;
  // A refusal that names one of the four is said under that field, not over the form.
  const refusedField = PERSONAL_FIELDS.find((f) => f === error?.details?.field) as PersonalField | undefined;
  const fieldError = (f: PersonalField) => (refusedField === f ? error?.message : undefined);

  /*
   * **What *Create account* waits for, said under it** (P18.95-T7 AC-3; UI-030): the fields still empty, by their
   * labels and in the form's order, or — once none is — that the password is wrong, which its own field says.
   */
  const joinedLabel = `Joined ${insurerName ?? 'your insurer'}`;
  const missing = [
    [!form.fullName.trim(), 'Full name'],
    [!form.dateOfBirth, 'Date of birth'],
    [!form.gender, 'Gender'],
    [!form.companyId, 'Insurer'],
    [!form.agentCode.trim(), 'Agent code'],
    [!form.companyJoinMonth, joinedLabel],
    [!form.workStatus, 'Status'],
    [!form.email.trim(), 'Email'],
    [!form.password, 'Password'],
    [!form.confirmPassword, 'Confirm password'],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const passwordWrong = tooShort || padded || mismatch;
  const held = !busy && (missing.length > 0 || passwordWrong);
  const heldWhy = held ? heldBecause({ missing, fix: passwordWrong ? 'Fix the password above.' : null }) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The confirmation never leaves the screen. `RegisterDto` has no field for it, and
      // global validation rejects an unknown one — so sending the whole form object would
      // turn a correctly filled form into a 400.
      const { confirmPassword: _confirm, ...body } = form;
      await api('/auth/register', { method: 'POST', body });
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={AUTH_PAGE}>
      {/*
        * The line under the title is the client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 26): from 768px it
        * reads as before. On a phone the title keeps the line's gap below it, so the form does not start against it.
        */}
      <h1 className="font-display text-3xl font-bold text-navy max-md:mb-6">Create your account</h1>
      <p className={cn('mb-6 mt-1 text-md text-muted', REMOVED_ON_PHONE)}>
        Your office is added separately. This is just your login.
      </p>

      <Card>
        {done ? (
          <div>
            {/* The API answers the same way for an address that already exists, so this
                screen must too — saying "already registered" would let anyone test
                addresses against it. */}
            <p className="text-md text-navy">
              If <strong>{form.email}</strong> can be registered, a verification link is on its way.
            </p>
            <p className="mt-2 text-sm text-muted">
              Open it to finish setting up your account. The link lasts 24 hours and works once.
            </p>
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && !refusedField && <ErrorBanner {...error} />}

            <Field label="Full name" htmlFor="fullName">
              <TextInput
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                value={form.fullName}
                onChange={set('fullName')}
              />
            </Field>

            <Field label="Date of birth" htmlFor="dateOfBirth" error={fieldError('dateOfBirth')}>
              <TextInput
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                autoComplete="bday"
                required
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                invalid={refusedField === 'dateOfBirth'}
              />
            </Field>

            <Field label="Gender" htmlFor="gender" error={fieldError('gender')}>
              <Select id="gender" name="gender" required value={form.gender} onChange={set('gender')}>
                <option value="">Choose</option>
                {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                  <option key={g} value={g}>{GENDER_LABEL[g]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Insurer"
              htmlFor="companyId"
              hint="Whoever issued your agent code."
            >
              <Select
                id="companyId"
                name="companyId"
                required
                value={form.companyId}
                onChange={set('companyId')}
                disabled={insurers === null}
              >
                <option value="">
                  {insurers === null ? 'Loading…' : 'Choose your insurer'}
                </option>
                {(insurers ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Agent code"
              htmlFor="agentCode"
              // The client's words at every size (P18.95-T7 AC-1, grey text row 26).
              hint="Found on your contract"
            >
              <TextInput
                id="agentCode"
                name="agentCode"
                required
                inputMode="numeric"
                autoComplete="off"
                value={form.agentCode}
                onChange={set('agentCode')}
              />
            </Field>

            <Field
              label={joinedLabel}
              htmlFor="companyJoinMonth"
              hint="The month and year you joined them."
              error={fieldError('companyJoinMonth')}
            >
              <TextInput
                id="companyJoinMonth"
                name="companyJoinMonth"
                type="month"
                required
                placeholder="YYYY-MM"
                value={form.companyJoinMonth}
                onChange={set('companyJoinMonth')}
                invalid={refusedField === 'companyJoinMonth'}
              />
            </Field>

            <Field label="Status" htmlFor="workStatus" error={fieldError('workStatus')}>
              <Select id="workStatus" name="workStatus" required value={form.workStatus} onChange={set('workStatus')}>
                <option value="">Choose</option>
                {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((w) => (
                  <option key={w} value={w}>{WORK_STATUS_LABEL[w]}</option>
                ))}
              </Select>
            </Field>

            <Field label="Email" htmlFor="email" hint="Your verification link goes here.">
              <TextInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={set('email')}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={`At least ${MIN_LENGTH} characters. Length beats symbols.`}
              error={
                tooShort
                  ? `Use at least ${MIN_LENGTH} characters.`
                  : padded
                    ? 'Do not begin or end with a space.'
                    : undefined
              }
            >
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={set('password')}
                invalid={tooShort || padded}
              />
            </Field>

            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              error={mismatch ? 'The two passwords do not match.' : undefined}
            >
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                invalid={mismatch}
              />
            </Field>

            <div className="flex flex-col gap-1">
              <Button type="submit" disabled={busy || held} aria-describedby={heldWhy ? 'create-account-held' : undefined}>
                {busy ? 'Creating…' : 'Create account'}
              </Button>
              {heldWhy && <p id="create-account-held" className="text-xs text-muted">{heldWhy}</p>}
            </div>

            <Link href="/login" className="text-center text-sm text-muted underline">
              Already have an account? Sign in
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
