'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';

/**
 * Self-signup.
 *
 * Creating an account and joining an office are separate steps, deliberately: an office
 * is a commercial relationship, and only a Super Admin creates one (ADR-0005). What this
 * screen produces is a verified person with no membership — the valid "new agent" state
 * — who then joins through one of the four onboarding paths.
 */
const MIN_LENGTH = 10;

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // The same three rules the server applies, checked here so the failure is immediate
  // rather than a round trip. The server check remains the real one.
  const tooShort = form.password.length > 0 && form.password.length < MIN_LENGTH;
  const padded = /^\s|\s$/.test(form.password);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: form });
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">Create your account</h1>
      <p className="mb-6 mt-1 text-md text-muted">
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
            {error && <ErrorBanner {...error} />}

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
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={set('password')}
                invalid={tooShort || padded}
              />
            </Field>

            <Button
              type="submit"
              disabled={busy || tooShort || padded || !form.fullName.trim() || !form.email.trim()}
            >
              {busy ? 'Creating…' : 'Create account'}
            </Button>

            <Link href="/login" className="text-center text-sm text-muted underline">
              Already have an account? Sign in
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
