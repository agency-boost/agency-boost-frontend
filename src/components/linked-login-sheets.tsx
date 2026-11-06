'use client';

import { useId, useState } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { accountLinkMessages } from '@/i18n/messages/account-links';
import { startLink } from '@/lib/account-links';
import { toDisplayError, type ApiError } from '@/lib/api-client';

/**
 * **The two sheets of a linked login** (P19.2-T1 AC-8; UI-169 item 5; ADR-0199 §2, §4), opened from the avatar menu and
 * loaded only then (`shell.tsx`, `dynamic`): *Tambah akun*, and the sheet that asks the other login's password once on a
 * browser that holds no session of it. `ResponsiveSheet`, as every sheet is: a bottom sheet below 1024px, a modal above,
 * the main action pinned at the foot.
 */

/**
 * ***Tambah akun*** (ADR-0199 §2): the other login's email and the reader's own password, then *Periksa kotak masuk akun
 * itu*. **What follows the send says nothing about the other address** — the API answers the same whatever it is, and
 * so does this: *if* it can be linked, a link is on its way. A wrong password, an own address, a link that already
 * stands or an unverified address of the reader's own are the server's sentences, in the sheet.
 */
export function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useMessages(accountLinkMessages).add;
  const formId = useId();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const close = () => {
    setEmail('');
    setCurrentPassword('');
    setError(null);
    setSentTo(null);
    onClose();
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email.trim() || !currentPassword) return;
    setBusy(true);
    setError(null);
    try {
      await startLink(email.trim(), currentPassword);
      setSentTo(email.trim());
      setCurrentPassword('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      title={sentTo ? t.sentTitle : t.title}
      onClose={close}
      footer={sentTo ? (
        <Button type="button" onClick={close} className="w-full">{t.done}</Button>
      ) : (
        <Button type="submit" form={formId} disabled={busy || !email.trim() || !currentPassword} className="w-full">
          {busy ? t.sending : t.send}
        </Button>
      )}
    >
      {sentTo ? (
        <p role="status" data-link-sent="" className="text-md text-ink">{t.sent({ email: sentTo })}</p>
      ) : (
        <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <p className="text-md text-muted">{t.line}</p>
          {error && <ErrorBanner {...error} />}
          <Field label={t.email} htmlFor={`${formId}-email`}>
            <TextInput
              id={`${formId}-email`}
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t.currentPassword} htmlFor={`${formId}-password`} hint={t.currentPasswordHint}>
            <PasswordInput
              id={`${formId}-password`}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
        </form>
      )}
    </ResponsiveSheet>
  );
}

/**
 * **The other login's password, once** (ADR-0199 §4): a switch to a login this browser holds no session of answers
 * `409 AUTH_LINK_SIGN_IN_REQUIRED`, and this asks its password — a sign-in for that login, by the sign-in limiter. A
 * wrong one is the server's sentence here and the sheet stays; the right one switches, and the shell lands.
 */
export function LinkedSignInSheet({
  open,
  email,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** The other login's address, from `linkedLogin`. */
  email: string;
  onClose: () => void;
  /** The switch with this password; rejects with the server's refusal. */
  onSubmit: (password: string) => Promise<void>;
}) {
  const t = useMessages(accountLinkMessages).signIn;
  const formId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const close = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      setPassword('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      title={t.title}
      description={email}
      onClose={close}
      footer={(
        <Button type="submit" form={formId} disabled={busy || !password} className="w-full">
          {busy ? t.working : t.submit}
        </Button>
      )}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <p className="text-md text-muted">{t.line({ email })}</p>
        {error && <ErrorBanner {...error} />}
        <Field label={t.password} htmlFor={`${formId}-password`}>
          <PasswordInput
            id={`${formId}-password`}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </ResponsiveSheet>
  );
}
