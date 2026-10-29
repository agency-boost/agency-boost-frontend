'use client';

import { useEffect, useState } from 'react';
import { LanguageField } from '@/components/language-field';
import { RoleShell } from '@/components/role-shell';
import { SessionList } from '@/components/session-list';
import { DateField } from '@/components/ui/date-field';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { heldBecause } from '@/lib/disabled-reason';
import { genderLabels, workStatusLabels, type Gender, type WorkStatus } from '@/lib/personal';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';
import { personalMessages } from '@/i18n/messages/personal';
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

/** The pronoun's three choices, in this order; each one's words are the catalogue's (`accountMessages.details.pronouns`). */
const PRONOUNS: Me['user']['pronoun'][] = ['she', 'he', 'they'];

function Profile() {
  const { me, reload } = useSession();
  // The same hook the sidebar menu uses, so the two cannot end a session differently.
  const { signOut, busy } = useSignOut();
  const t = useMessages(accountMessages);

  return (
    <RoleShell
      title={t.title}
      subtitle={me?.user.email}
      // Everybody may read their own account, and the matrix says so at `own` in all six
      // columns. Naming it here overrides the chrome's own gate, which is about the
      // application that chrome belongs to and not about this route.
      permission="profile:read_self"
      actions={
        <Button variant="secondary" disabled={busy} onClick={() => void signOut()}>
          {busy ? t.signingOut : t.signOut}
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
  // The personal details' labels in the reader's language (`lib/personal.ts`, P18.98-T4).
  const language = useLanguage();
  const genders = genderLabels(language);
  const workStatuses = workStatusLabels(language);
  const t = useMessages(accountMessages).details;
  const { notRecorded } = useMessages(personalMessages);
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
  const lockedHint = personalLocked ? t.locked : undefined;

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
      <h2 className="font-display text-lg font-bold text-navy">{t.heading}</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
        {error && !refusedField && <ErrorBanner {...error} />}
        {saved && (
          <p role="status" className="text-md font-semibold text-success">
            {t.saved}
          </p>
        )}

        <Field label={t.fullName} htmlFor="fullName" hint={lockedHint}>
          <TextInput
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={personalLocked}
          />
        </Field>

        <Field label={t.preferredName} htmlFor="preferredName" hint={lockedHint ?? t.preferredNameHint}>
          <TextInput
            id="preferredName"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            disabled={personalLocked}
          />
        </Field>

        <Field
          label={t.pronoun}
          htmlFor="pronoun"
          hint={lockedHint ?? t.pronounHint}
          // The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 27); a support session's reason still shows.
          hintOnPhone={lockedHint !== undefined}
        >
          <Select
            id="pronoun"
            value={pronoun}
            onChange={(e) => setPronoun(e.target.value as Me['user']['pronoun'])}
            disabled={personalLocked}
          >
            {PRONOUNS.map((p) => (
              <option key={p} value={p}>
                {t.pronouns[p]}
              </option>
            ))}
          </Select>
        </Field>

        {/*
          * *Language* (P18.98-T2 AC-4): saves itself, as the header's switch does, so *Save* below is not for it. Shown
          * and not offered in a support session, as the rest of the card is. Nothing until the switch is live.
          */}
        <LanguageField disabled={personalLocked} hint={lockedHint} />

        {recordsPersonal && (
          <>
            <Field
              label={t.dateOfBirth}
              htmlFor="dateOfBirth"
              hint={lockedHint}
              error={fieldError('dateOfBirth')}
            >
              <DateField
                id="dateOfBirth"
                autoComplete="bday"
                value={personal.dateOfBirth}
                onChange={(value) => setOne('dateOfBirth')({ target: { value } })}
                disabled={personalLocked}
                invalid={refusedField === 'dateOfBirth'}
                className="w-full"
              />
            </Field>

            <Field label={t.gender} htmlFor="gender" hint={lockedHint} error={fieldError('gender')}>
              <Select id="gender" value={personal.gender} onChange={setOne('gender')} disabled={personalLocked}>
                {!personal.gender && <option value="">{notRecorded}</option>}
                {(Object.keys(genders) as Gender[]).map((g) => (
                  <option key={g} value={g}>{genders[g]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label={t.joined}
              htmlFor="companyJoinMonth"
              hint={lockedHint ?? t.joinedHint}
              error={fieldError('companyJoinMonth')}
            >
              <TextInput
                id="companyJoinMonth"
                type="month"
                placeholder={t.monthShape}
                value={personal.companyJoinMonth}
                onChange={setOne('companyJoinMonth')}
                disabled={personalLocked}
                invalid={refusedField === 'companyJoinMonth'}
              />
            </Field>

            <Field label={t.status} htmlFor="workStatus" hint={lockedHint} error={fieldError('workStatus')}>
              <Select id="workStatus" value={personal.workStatus} onChange={setOne('workStatus')} disabled={personalLocked}>
                {!personal.workStatus && <option value="">{notRecorded}</option>}
                {(Object.keys(workStatuses) as WorkStatus[]).map((w) => (
                  <option key={w} value={w}>{workStatuses[w]}</option>
                ))}
              </Select>
            </Field>
          </>
        )}

        {/* Nothing here is a support session's to save (ADR-0162 §4), so it is not offered one. */}
        {!personalLocked && (
          <Button type="submit" disabled={busy || !fullName.trim()}>
            {busy ? t.saving : t.save}
          </Button>
        )}
      </form>
    </Card>
  );
}

function PasswordForm() {
  const language = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useMessages(accountMessages).password;

  // Only once they have started the second box — an empty field has not disagreed yet.
  const mismatch = confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;

  /*
   * **What *Change password* waits for, said under it** (P18.95-T7 AC-3; UI-030): the boxes still empty, by their
   * labels, then a new password under ten characters, then the two that disagree — which its field says as well.
   */
  const tooShort = newPassword.length > 0 && newPassword.length < 10;
  const missing = [
    [!currentPassword, t.current],
    [!newPassword, t.newPassword],
    [!confirmNewPassword, t.confirm],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const held = !currentPassword || newPassword.length < 10 || mismatch || !confirmNewPassword;
  const heldWhy = held && !busy
    ? heldBecause({
      missing,
      fix: tooShort ? t.tooShort({ n: 10 }) : mismatch ? t.fix : null,
    }, language)
    : null;

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
      <h2 className="font-display text-lg font-bold text-navy">{t.heading}</h2>
      <p className="mt-1 text-md text-muted">{t.line}</p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}
        {done && (
          <p role="status" className="text-md font-semibold text-success">
            {t.changed}
          </p>
        )}

        <Field label={t.current} htmlFor="currentPassword">
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>

        <Field label={t.newPassword} htmlFor="newPassword" hint={t.hint({ n: 10 })}>
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
          label={t.confirm}
          htmlFor="confirmNewPassword"
          error={mismatch ? t.mismatch : undefined}
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

        <div className="flex flex-col gap-1">
          <Button type="submit" disabled={busy || held} aria-describedby={heldWhy ? 'change-password-held' : undefined}>
            {busy ? t.changing : t.change}
          </Button>
          {heldWhy && <p id="change-password-held" className="text-xs text-muted">{heldWhy}</p>}
        </div>
      </form>
    </Card>
  );
}
