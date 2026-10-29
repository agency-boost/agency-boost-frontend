'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { inviteTokenOf, readInviteBanner, type InviteBanner } from '@/lib/invites';
import { signInPathFrom } from '@/lib/return-path';
import { listInsurers, type Insurer } from '@/lib/companies';
import { genderLabels, workStatusLabels, type Gender, type WorkStatus } from '@/lib/personal';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';
import { AUTH_PAGE } from '@/components/auth-page';
import { DateField } from '@/components/ui/date-field';
import { Button, ButtonLink, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { PasswordInput } from '@/components/ui/password-input';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { cn } from '@/lib/cn';
import { heldBecause } from '@/lib/disabled-reason';
import { PublicTitle } from '@/components/public-title';

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
  return (
    // `useSearchParams` needs a boundary: an invite's link carries its token in the query string.
    <Suspense fallback={<main className={AUTH_PAGE}><Skeleton><SkeletonText lines={4} /></Skeleton></main>}>
      <Register />
    </Suspense>
  );
}

/**
 * **On a leader's invite** (`?invite=…`): the banner *"You're joining {leader}'s team · {KPM}"*, the insurer, the
 * agent code and the join date filled in from the invite and read-only — the server takes the invite's whatever
 * arrives — and the name filled in and the person's to correct. *Register KPM* and *Find Your Leader* never come:
 * the account joins the leader's unit as it is made. A link that opens nothing says why, in the server's words.
 */
function Register() {
  const token = inviteTokenOf(useSearchParams());
  // The personal details' labels in the reader's language (`lib/personal.ts`, P18.98-T4).
  const language = useLanguage();
  const genders = genderLabels(language);
  const workStatuses = workStatusLabels(language);
  const all = useMessages(authMessages);
  const t = all.register;
  const rules = all.password;
  const [invite, setInvite] = useState<InviteBanner | null>(null);
  const [inviteError, setInviteError] = useState<ApiError | null>(null);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', companyId: '', agentCode: '',
    dateOfBirth: '', companyJoinMonth: '', workStatus: '' as WorkStatus | '', gender: '' as Gender | '',
  });
  const [insurers, setInsurers] = useState<Insurer[] | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    readInviteBanner(token)
      .then((banner) => {
        if (!live) return;
        setInvite(banner);
        // Filled in from the invite: the insurer and the code are held to it, the name is theirs to correct.
        setForm((f) => ({ ...f, fullName: f.fullName || banner.fullName, companyId: banner.companyId, agentCode: banner.agentCode }));
      })
      .catch((err) => { if (live) setInviteError(toDisplayError(err)); });
    return () => { live = false; };
  }, [token]);

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
  const joinedLabel = t.joined({ insurer: insurerName ?? null });
  const missing = [
    [!form.fullName.trim(), t.fullName],
    [!form.dateOfBirth, t.dateOfBirth],
    [!form.gender, t.gender],
    [!form.companyId, t.insurer],
    [!form.agentCode.trim(), t.agentCode],
    [!form.companyJoinMonth, joinedLabel],
    [!form.workStatus, t.status],
    [!form.email.trim(), t.email],
    [!form.password, t.password],
    [!form.confirmPassword, t.confirmPassword],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const passwordWrong = tooShort || padded || mismatch;
  const held = !busy && (missing.length > 0 || passwordWrong);
  const heldWhy = held ? heldBecause({ missing, fix: passwordWrong ? t.fixPassword : null }, language) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The confirmation never leaves the screen. `RegisterDto` has no field for it, and
      // global validation rejects an unknown one — so sending the whole form object would
      // turn a correctly filled form into a 400.
      const { confirmPassword: _confirm, ...body } = form;
      await api('/auth/register', { method: 'POST', body: invite && token ? { ...body, inviteToken: token } : body });
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const signIn = token ? signInPathFrom({ pathname: '/join', search: `?invite=${encodeURIComponent(token)}` }) : '/login';

  if (token && !invite) {
    return (
      <main className={AUTH_PAGE}>
        <PublicTitle>
          <h1 className="mb-6 font-display text-3xl font-bold text-navy">{t.title}</h1>
        </PublicTitle>
        <Card>
          {inviteError ? (
            <div className="flex flex-col gap-3">
              <ErrorBanner {...inviteError} />
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/login" variant="secondary">{t.signIn}</ButtonLink>
                <ButtonLink href="/register" variant="secondary">{t.invite.withoutInvite}</ButtonLink>
              </div>
            </div>
          ) : (
            <Skeleton label={t.invite.checking}><SkeletonText lines={4} /></Skeleton>
          )}
        </Card>
      </main>
    );
  }

  return (
    <main className={AUTH_PAGE}>
      {/*
        * The line under the title is the client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 26): from 768px it
        * reads as before. On a phone the title keeps the line's gap below it, so the form does not start against it.
        * **Never on an invite** (a production walk, 2026-10-27): accepting one places them in the leader's office, so
        * the line would contradict the banner under it. The title keeps its gap at every size then.
        */}
      <PublicTitle>
        <h1 className={cn('font-display text-3xl font-bold text-navy', invite ? 'mb-6' : 'max-md:mb-6')}>{t.title}</h1>
      </PublicTitle>
      {!invite && (
        <p className={cn('mb-6 mt-1 text-md text-muted', REMOVED_ON_PHONE)}>
          {t.line}
        </p>
      )}

      {invite && (
        <Card className="mb-4 border-l-4 border-l-amber" density="compact">
          <p className="font-display text-lg font-bold text-navy">{t.invite.banner({ leader: invite.leaderName, kpm: invite.kpm.code })}</p>
          <p className="mt-1 text-md text-muted">{t.invite.bannerLine({ branch: invite.kpm.branchName, company: invite.companyName })}</p>
        </Card>
      )}

      <Card>
        {invite?.existingAccount ? (
          <div className="flex flex-col gap-3">
            <p className="text-md text-navy">{t.invite.existing}</p>
            <ButtonLink href={signIn} className="self-start">{t.invite.signInToAccept}</ButtonLink>
          </div>
        ) : done ? (
          <div>
            {/* The API answers the same way for an address that already exists, so this
                screen must too — saying "already registered" would let anyone test
                addresses against it. */}
            <p className="text-md text-navy">{t.sent({ email: <strong>{form.email}</strong> })}</p>
            <p className="mt-2 text-sm text-muted">{t.sentLine}</p>
            {invite && <p className="mt-2 text-sm text-muted">{t.invite.doneLine({ leader: invite.leaderName })}</p>}
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              {t.backToSignIn}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && !refusedField && <ErrorBanner {...error} />}

            <Field label={t.fullName} htmlFor="fullName">
              <TextInput
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                value={form.fullName}
                onChange={set('fullName')}
              />
            </Field>

            <Field label={t.dateOfBirth} htmlFor="dateOfBirth" error={fieldError('dateOfBirth')}>
              <DateField
                id="dateOfBirth"
                name="dateOfBirth"
                autoComplete="bday"
                required
                value={form.dateOfBirth}
                onChange={(value) => set('dateOfBirth')({ target: { value } })}
                invalid={refusedField === 'dateOfBirth'}
                className="w-full"
              />
            </Field>

            <Field label={t.gender} htmlFor="gender" error={fieldError('gender')}>
              <Select id="gender" name="gender" required value={form.gender} onChange={set('gender')}>
                <option value="">{t.choose}</option>
                {(Object.keys(genders) as Gender[]).map((g) => (
                  <option key={g} value={g}>{genders[g]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label={t.insurer}
              htmlFor="companyId"
              hint={t.insurerHint}
            >
              {invite ? (
                <TextInput id="companyId" name="companyId" value={invite.companyName} readOnly className="bg-base text-muted" />
              ) : (
              <Select
                id="companyId"
                name="companyId"
                required
                value={form.companyId}
                onChange={set('companyId')}
                disabled={insurers === null}
              >
                <option value="">
                  {insurers === null ? t.loading : t.chooseInsurer}
                </option>
                {(insurers ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              )}
            </Field>

            <Field
              label={t.agentCode}
              htmlFor="agentCode"
              // The client's words at every size (P18.95-T7 AC-1, grey text row 26).
              hint={t.agentCodeHint}
            >
              <TextInput
                id="agentCode"
                name="agentCode"
                required
                inputMode="numeric"
                autoComplete="off"
                value={form.agentCode}
                onChange={set('agentCode')}
                readOnly={Boolean(invite)}
                className={invite ? 'bg-base text-muted' : undefined}
              />
            </Field>

            {invite && (
              <Field label={t.invite.joinDate} htmlFor="joinDate">
                <DateField id="joinDate" value={invite.joinDate} onChange={() => undefined} readOnly className="w-full" />
              </Field>
            )}

            <Field
              label={joinedLabel}
              htmlFor="companyJoinMonth"
              hint={t.joinedHint}
              error={fieldError('companyJoinMonth')}
            >
              <TextInput
                id="companyJoinMonth"
                name="companyJoinMonth"
                type="month"
                required
                placeholder={t.monthShape}
                value={form.companyJoinMonth}
                onChange={set('companyJoinMonth')}
                invalid={refusedField === 'companyJoinMonth'}
              />
            </Field>

            <Field label={t.status} htmlFor="workStatus" error={fieldError('workStatus')}>
              <Select id="workStatus" name="workStatus" required value={form.workStatus} onChange={set('workStatus')}>
                <option value="">{t.choose}</option>
                {(Object.keys(workStatuses) as WorkStatus[]).map((w) => (
                  <option key={w} value={w}>{workStatuses[w]}</option>
                ))}
              </Select>
            </Field>

            <Field label={t.email} htmlFor="email" hint={t.emailHint}>
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
              label={t.password}
              htmlFor="password"
              hint={rules.hint({ n: MIN_LENGTH })}
              error={
                tooShort
                  ? rules.tooShort({ n: MIN_LENGTH })
                  : padded
                    ? rules.padded
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
              label={t.confirmPassword}
              htmlFor="confirmPassword"
              error={mismatch ? rules.mismatch : undefined}
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
                {busy ? t.creating : t.create}
              </Button>
              {heldWhy && <p id="create-account-held" className="text-xs text-muted">{heldWhy}</p>}
            </div>

            <Link href={signIn} className="text-center text-sm text-muted underline">
              {t.haveAccount}
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
