'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireSession } from '@/components/require-session';
import { RoleBadge } from '@/components/ui/role-badge';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { api, toDisplayError } from '@/lib/api-client';
import { useSession, type Me } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';

export default function ProfilePage() {
  return (
    <RequireSession>
      <Profile />
    </RequireSession>
  );
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
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Your account</h1>
          <p className="mt-1 text-md text-muted">{me?.user.email}</p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void signOut()}>
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <WhoAmI />
        <ProfileForm onSaved={reload} />
        <PasswordForm />
      </div>
    </main>
  );
}

function WhoAmI() {
  const { me } = useSession();
  if (!me) return null;

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">Where you stand</h2>
      <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-md">
        <dt className="text-muted">Platform role</dt>
        <dd className="text-navy">
          {me.user.platformRole === 'super_admin' ? 'Super Admin' : 'None'}
        </dd>

        <dt className="text-muted">Office</dt>
        <dd className="text-navy">
          {me.membership ? <code className="text-sm">{me.membership.kpmId}</code> : 'Not in an office yet'}
        </dd>

        <dt className="text-muted">Role in office</dt>
        <dd className="text-navy">
          {me.membership ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <RoleBadge role={me.membership.hierarchyRole} />
              {me.membership.isKpmOwner && <Tag>KPM Owner</Tag>}
              {me.membership.isKpmAdmin && <Tag>KPM Admin</Tag>}
            </span>
          ) : (
            '—'
          )}
        </dd>

        <dt className="text-muted">Permissions</dt>
        <dd className="text-navy">
          {/* Shown because Phase 2 has almost no screens to exercise them on, and a
              reviewer needs to see that the server resolved a real set rather than a
              placeholder. */}
          <details>
            <summary className="cursor-pointer text-muted">{me.permissions.length} granted</summary>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {me.permissions.map((p) => (
                <li key={p} className="rounded-pill bg-navy/[0.06] px-2 py-0.5 text-sm">
                  {p}
                </li>
              ))}
            </ul>
          </details>
        </dd>
      </dl>

      {me.user.platformRole === 'super_admin' && (
        <Link href="/admin" className="mt-4 inline-block text-md text-navy underline">
          Open the platform console
        </Link>
      )}
    </Card>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-amber/20 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-amber-dark">
      {children}
    </span>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { me } = useSession();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronoun, setPronoun] = useState<Me['user']['pronoun']>('they');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    setFullName(me.user.fullName ?? '');
    setPreferredName(me.user.preferredName ?? '');
    setPronoun(me.user.pronoun ?? 'they');
  }, [me]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        body: { fullName, preferredName, pronoun },
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
        {error && <ErrorBanner {...error} />}
        {saved && (
          <p role="status" className="text-md font-semibold text-success">
            Saved.
          </p>
        )}

        <Field label="Full name" htmlFor="fullName">
          <TextInput id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field label="Preferred name" htmlFor="preferredName" hint="What colleagues call you day to day.">
          <TextInput
            id="preferredName"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
          />
        </Field>

        <Field
          label="Pronoun"
          htmlFor="pronoun"
          hint="Yours to set. It appears in the commitment sentence your leader reads back to you in coaching."
        >
          <Select
            id="pronoun"
            value={pronoun}
            onChange={(e) => setPronoun(e.target.value as Me['user']['pronoun'])}
          >
            {PRONOUNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" disabled={busy || !fullName.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
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
          <TextInput
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>

        <Field label="New password" htmlFor="newPassword" hint="At least 10 characters. Length beats symbols.">
          <TextInput
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" disabled={busy || !currentPassword || newPassword.length < 10}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}
