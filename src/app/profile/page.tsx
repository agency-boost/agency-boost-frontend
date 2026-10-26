'use client';

import { useEffect, useState } from 'react';
import { RoleShell } from '@/components/role-shell';
import { SessionList } from '@/components/session-list';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { GENDER_LABEL, WORK_STATUS_LABEL, type Gender, type WorkStatus } from '@/lib/personal';
import { useSession, type Me } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * Your account.
 *
 * **`RoleShell`, so the sidebar survives.** This rendered a bare `RequireSession` with no
 * chrome at all until 2026-09-06: you signed in as a Super Admin, clicked your own name,
 * and every link on the screen vanished. Everybody has an account, so the route belongs
 * to no one role family and wears whichever chrome its reader came in with.
 *
 * **No *Where you stand* card since 2026-10-01** (P10.1-T2 AC-10, ADR-0062 §3). It listed the
 * platform role, the raw office id and every permission code, for a Phase 2 reviewer who had
 * no other screen to see them on. None of those is a customer's word: the sidebar chip already
 * says who you are, and what you may do is what the screens offer. The password and *Where you
 * are signed in* sections stay — they are the account's security, not its description.
 */
export default function ProfilePage() {
  return <Profile />;
}

const PRONOUNS: { value: Me['user']['pronoun']; label: string }[] = [
  { value: 'she', label: 'she / her' },
  { value: 'he', label: 'he / him' },
  { value: 'they', label: 'they / them' },
];

function Profile() {
  const { me, reload } = useSession();
  // The same hook the sidebar menu uses, so the two cannot end a session differently.
  const { signOut, busy } = useSignOut();

  return (
    <RoleShell
      title="Your account"
      subtitle={me?.user.email}
      // Everybody may read their own account, and the matrix says so at `own` in all six
      // columns. Naming it here overrides the chrome's own gate, which is about the
      // application that chrome belongs to and not about this route.
      permission="profile:read_self"
      actions={
        <Button variant="secondary" disabled={busy} onClick={() => void signOut()}>
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      }
    >
      <div className="flex max-w-3xl flex-col gap-4">
        <ProfileForm onSaved={reload} />
        <PasswordForm />
        <SessionList />
      </div>
    </RoleShell>
  );
}

/**
 * **What a person records** (ADR-0158 §3, P18.8-T4 AC-6): the four registration and the roster import
 * ask, which somebody who arrived before them completes here. Saved with the rest of *Your details*,
 * and only the ones changed are sent — an emptied box clears nothing, because none of them is clearable.
 */
type Personal = { dateOfBirth: string; companyJoinMonth: string; workStatus: WorkStatus | ''; gender: Gender | '' };
const PERSONAL_FIELDS = ['dateOfBirth', 'companyJoinMonth', 'workStatus', 'gender'] as const;

function personalOf(me: Me | null): Personal {
  return {
    dateOfBirth: me?.user.dateOfBirth ?? '',
    companyJoinMonth: me?.user.companyJoinMonth ?? '',
    workStatus: me?.user.workStatus ?? '',
    gender: me?.user.gender ?? '',
  };
}

function ProfileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { me } = useSession();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronoun, setPronoun] = useState<Me['user']['pronoun']>('they');
  const [personal, setPersonal] = useState<Personal>(personalOf(null));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * A Super Admin sells for nobody and is nobody's member, so there is nothing of this to record. In a
   * support session **the whole card** is shown and not offered: the four are the person's own word (P18.8-T4
   * AC-6), and since ADR-0162 §4 the API refuses `PATCH /auth/me` in any session, elevated or setup included.
   */
  const recordsPersonal = me?.user.platformRole !== 'super_admin';
  const personalLocked = Boolean(me?.isImpersonating);
  const lockedHint = personalLocked ? 'Only they can change this, not a support session.' : undefined;

  useEffect(() => {
    if (!me) return;
    setFullName(me.user.fullName ?? '');
    setPreferredName(me.user.preferredName ?? '');
    setPronoun(me.user.pronoun ?? 'they');
    setPersonal(personalOf(me));
  }, [me]);

  const setOne = <K extends keyof Personal>(key: K) => (e: { target: { value: string } }) =>
    setPersonal({ ...personal, [key]: e.target.value as Personal[K] });
  // A refusal that names one of the four is said under that field, not over the card.
  const refusedField = PERSONAL_FIELDS.find((f) => f === error?.details?.field);
  const fieldError = (f: (typeof PERSONAL_FIELDS)[number]) => (refusedField === f ? error?.message : undefined);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const before = personalOf(me);
      const changed = recordsPersonal && !personalLocked
        ? Object.fromEntries(PERSONAL_FIELDS
          .filter((f) => personal[f] !== '' && personal[f] !== before[f])
          .map((f) => [f, personal[f]]))
        : {};
      await api('/auth/me', {
        method: 'PATCH',
        // An empty preferred name is none (UI-005): `''` printed a blank header where the full name belonged.
        body: { fullName, preferredName: preferredName.trim() || null, pronoun, ...changed },
      });
      await onSaved();
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">Your details</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
        {error && !refusedField && <ErrorBanner {...error} />}
        {saved && (
          <p role="status" className="text-md font-semibold text-success">
            Saved.
          </p>
        )}

        <Field label="Full name" htmlFor="fullName" hint={lockedHint}>
          <TextInput
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={personalLocked}
          />
        </Field>

        <Field label="Preferred name" htmlFor="preferredName" hint={lockedHint ?? 'What colleagues call you day to day.'}>
          <TextInput
            id="preferredName"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            disabled={personalLocked}
          />
        </Field>

        <Field
          label="Pronoun"
          htmlFor="pronoun"
          hint={lockedHint ?? 'Yours to set. It appears in the commitment sentence your leader reads back to you in coaching.'}
        >
          <Select
            id="pronoun"
            value={pronoun}
            onChange={(e) => setPronoun(e.target.value as Me['user']['pronoun'])}
            disabled={personalLocked}
          >
            {PRONOUNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        {recordsPersonal && (
          <>
            <Field
              label="Date of birth"
              htmlFor="dateOfBirth"
              hint={lockedHint}
              error={fieldError('dateOfBirth')}
            >
              <TextInput
                id="dateOfBirth"
                type="date"
                autoComplete="bday"
                value={personal.dateOfBirth}
                onChange={setOne('dateOfBirth')}
                disabled={personalLocked}
                invalid={refusedField === 'dateOfBirth'}
              />
            </Field>

            <Field label="Gender" htmlFor="gender" hint={lockedHint} error={fieldError('gender')}>
              <Select id="gender" value={personal.gender} onChange={setOne('gender')} disabled={personalLocked}>
                {!personal.gender && <option value="">Not recorded</option>}
                {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                  <option key={g} value={g}>{GENDER_LABEL[g]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Joined your insurer"
              htmlFor="companyJoinMonth"
              hint={lockedHint ?? 'The month and year you joined them.'}
              error={fieldError('companyJoinMonth')}
            >
              <TextInput
                id="companyJoinMonth"
                type="month"
                placeholder="YYYY-MM"
                value={personal.companyJoinMonth}
                onChange={setOne('companyJoinMonth')}
                disabled={personalLocked}
                invalid={refusedField === 'companyJoinMonth'}
              />
            </Field>

            <Field label="Status" htmlFor="workStatus" hint={lockedHint} error={fieldError('workStatus')}>
              <Select id="workStatus" value={personal.workStatus} onChange={setOne('workStatus')} disabled={personalLocked}>
                {!personal.workStatus && <option value="">Not recorded</option>}
                {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((w) => (
                  <option key={w} value={w}>{WORK_STATUS_LABEL[w]}</option>
                ))}
              </Select>
            </Field>
          </>
        )}

        {/* Nothing here is a support session's to save (ADR-0162 §4), so it is not offered one. */}
        {!personalLocked && (
          <Button type="submit" disabled={busy || !fullName.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        )}
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Only once they have started the second box — an empty field has not disagreed yet.
  const mismatch = confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      // The confirmation is a screen concern. The endpoint takes two fields.
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">Password</h2>
      <p className="mt-1 text-md text-muted">
        Changing it signs out your other sessions. This one stays open.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}
        {done && (
          <p role="status" className="text-md font-semibold text-success">
            Password changed. Your other sessions were signed out.
          </p>
        )}

        <Field label="Current password" htmlFor="currentPassword">
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>

        <Field label="New password" htmlFor="newPassword" hint="At least 10 characters. Length beats symbols.">
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmNewPassword"
          error={mismatch ? 'The two passwords do not match.' : undefined}
        >
          <PasswordInput
            id="confirmNewPassword"
            autoComplete="new-password"
            required
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            invalid={mismatch}
          />
        </Field>

        <Button
          type="submit"
          disabled={
            busy || !currentPassword || newPassword.length < 10
            || mismatch || !confirmNewPassword
          }
        >
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}
