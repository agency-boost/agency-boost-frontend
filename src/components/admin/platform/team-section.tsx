'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { TonePill } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformMessages } from '@/i18n/messages/admin-platform';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { addSuperAdmin, listSuperAdmins, revokeSuperAdmin, type SuperAdmin } from '@/lib/platform';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Platform* › *Tim Super Admin*** (P19.23-T6 AC-2; ADR-0279; frame f53): AgencyBoost's own people.
 *
 * - **A row per Super Admin**: the NAME in capitals, the email under it; *Anda* on the reader's own row, which has no
 *   *Cabut*; *Cabut* red on the others, behind a confirmation (a bottom sheet on a phone). The status shows only when it
 *   is not plain active.
 * - ***+ Tambah Super Admin*** opens one field, the email of an **existing, verified account in no KPM** — the server
 *   says why when it is not one, under the field.
 * - Every answer is the team as it now stands; the API never removes your own role or the last one, whatever this draws.
 */
export function TeamSection() {
  const t = useMessages(adminPlatformMessages);
  const [team, setTeam] = useState<SuperAdmin[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<SuperAdmin | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(() => {
    setError(null);
    listSuperAdmins().then(setTeam).catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  if (error && team === null) {
    return (
      <div>
        <ErrorBanner code={error.code} message={t.failed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={load}>{t.retry}</Button>
      </div>
    );
  }
  if (team === null) {
    return (
      <Skeleton label={t.loading}>
        <div className="rounded-lg bg-card">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 border-b border-hairline px-4 py-3 last:border-b-0">
              <SkeletonBar className="w-40" />
              <SkeletonBar className="w-56" />
            </div>
          ))}
        </div>
      </Skeleton>
    );
  }

  return (
    <>
      <div className="rounded-lg bg-card">
        <ul aria-label={t.team.caption} className="[&>li+li]:border-t [&>li+li]:border-hairline">
          {team.map((person) => (
            <li key={person.userId} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-bold uppercase text-navy">{person.fullName}</p>
                <p className="truncate text-sm text-muted">{person.email}</p>
              </div>
              {person.status !== 'active' && <TonePill tone="grey">{t.team.status[person.status]}</TonePill>}
              {person.isYou ? (
                <TonePill tone="blue">{t.team.you}</TonePill>
              ) : (
                <Button
                  variant="danger"
                  className="min-h-10 px-3.5"
                  aria-label={t.team.revokeOf({ name: person.fullName })}
                  onClick={() => setRevoking(person)}
                >
                  {t.team.revoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-11 w-full items-center gap-1.5 border-t border-hairline px-4 text-base font-semibold text-primary-ink hover:bg-hover-row"
        >
          <LineIcon name="plus" className="h-4 w-4" />
          {t.team.add}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{t.team.note}</p>

      <AddDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(next, email) => {
          setTeam(next);
          setAdding(false);
          const person = next.find((p) => p.email === email.trim().toLowerCase());
          show(t.team.added({ name: person?.fullName ?? email }));
        }}
      />
      <RevokeDialog
        person={revoking}
        onClose={() => setRevoking(null)}
        onRevoked={(next, person) => {
          setTeam(next);
          setRevoking(null);
          show(t.team.revoked({ name: person.fullName }));
        }}
      />
      <Toast toast={toast} />
    </>
  );
}

/** *Tambah Super Admin*: one field; the server's refusal under it (`details.field: email`). */
function AddDialog({
  open, onClose, onAdded,
}: { open: boolean; onClose: () => void; onAdded: (team: SuperAdmin[], email: string) => void }) {
  const t = useMessages(adminPlatformMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onAdded(await addSuperAdmin(email.trim()), email);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t.team.addTitle}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" className="min-h-11" onClick={onClose}>{t.cancel}</Button>
          <Button className="min-h-11" disabled={busy || email.trim() === ''} onClick={() => void submit()}>
            {t.team.addConfirm}
          </Button>
        </div>
      )}
    >
      <form
        className="pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void submit();
        }}
      >
        <Field label={t.team.email} htmlFor="super-admin-email" hint={t.team.addHint} error={error?.message}>
          <TextInput
            id="super-admin-email"
            type="email"
            autoComplete="off"
            value={email}
            invalid={Boolean(error)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

/** *Cabut*'s confirmation: what it does, and the server's refusal if it gives one. */
function RevokeDialog({
  person, onClose, onRevoked,
}: { person: SuperAdmin | null; onClose: () => void; onRevoked: (team: SuperAdmin[], person: SuperAdmin) => void }) {
  const t = useMessages(adminPlatformMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(null), [person]);

  const confirm = async () => {
    if (!person) return;
    setBusy(true);
    try {
      onRevoked(await revokeSuperAdmin(person.userId), person);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={person !== null}
      title={person ? t.team.revokeTitle({ name: person.fullName }) : ''}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" className="min-h-11" onClick={onClose}>{t.cancel}</Button>
          <Button variant="danger" className="min-h-11" disabled={busy} onClick={() => void confirm()}>
            {t.team.revokeConfirm}
          </Button>
        </div>
      )}
    >
      <p className="pb-2 text-md text-ink">{t.team.revokeBody}</p>
      {error && <ErrorBanner code={error.code} message={error.message} requestId={error.requestId} />}
    </Modal>
  );
}
