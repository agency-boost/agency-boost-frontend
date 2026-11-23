'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner, Field, Textarea, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { accountRetirementMessages } from '@/i18n/messages/account-retirement';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { readRetirement, retireAccount, sameName, type RetirementPreview } from '@/lib/account-retirement';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Hapus akun*** **— the confirmation** (P19.31-T2 AC-2; ADR-0289 §1–§3). Opened from Anggota's member sheet ⋯ and the
 * ⋯ beside *Masukkan* on *Menunggu*'s *Belum ada KPM* — the Super Admin's alone (`account:retire`).
 *
 * - **First it reads what retiring would do** (`GET /admin/accounts/:userId/retirement`, writes nothing): **what ends** —
 *   the login, and the one live membership, removed from its KPM — and **what stays** — the history in each KPM, with the
 *   name — and that the address and the agent code are free again.
 * - **A refusal** (an AgencyBoost team account, an owner, people reporting to them) is shown **instead of the button**:
 *   its sentence, saying what to do first, and *Tutup* alone.
 * - Otherwise *Alasan* and the person's **full name typed in**; ***Hapus akun***, in red, is live once both are there and
 *   the name is theirs (as the server compares it: spaces collapsed, any case — and it checks again).
 * - Done: `onDone` with the name, for the toast *"Akun <nama> dihapus."*; a refusal or failure in the reader's words.
 *
 * A centred dialog from 768px, a sheet on a phone, as the console's other confirmations. Tokens only.
 */
export function RetireAccountDialog({
  userId,
  fallbackName,
  onClose,
  onDone,
}: {
  userId: string;
  /** The name the row shows, for the title while the preview is read. */
  fallbackName: string;
  onClose: () => void;
  onDone: (fullName: string) => void;
}) {
  const t = useMessages(accountRetirementMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const reasonId = useId();
  const nameId = useId();
  const [preview, setPreview] = useState<RetirementPreview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    readRetirement(userId)
      .then((answer) => { if (live) setPreview(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [userId]);

  const name = preview?.fullName ?? fallbackName;
  const refused = preview?.refusal ?? null;
  const ready = preview !== null && refused === null;
  const confirmed = ready && reason.trim() !== '' && sameName(typed, name);

  async function retire() {
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const done = await retireAccount(userId, { reason: reason.trim(), fullName: typed });
      onDone(done.fullName);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t.title}
      description={name.toUpperCase()}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className={ready ? 'grid grid-cols-2 gap-2' : 'flex'} data-retire-actions="">
          <Button variant="secondary" className="min-h-11 w-full" onClick={onClose} disabled={busy}>
            {ready ? t.cancel : t.close}
          </Button>
          {ready && (
            <Button
              variant="danger"
              className="min-h-11 w-full"
              onClick={() => void retire()}
              disabled={!confirmed || busy}
              aria-busy={busy || undefined}
            >
              {busy ? t.deleting : t.confirm}
            </Button>
          )}
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pb-2" data-retire-account={refused ? 'refused' : ready ? 'ready' : ''}>
        {error && <ErrorBanner {...error} />}
        {preview === null && !error && <Skeleton label={t.loading}><SkeletonText lines={4} /></Skeleton>}
        {refused && (
          <p role="alert" className="rounded-md bg-pill-red px-3 py-2 text-md text-pill-red-ink" data-retire-refusal={refused.code}>
            {refused.message}
          </p>
        )}
        {ready && preview && (
          <>
            <section aria-labelledby={`${nameId}-ends`}>
              <h3 id={`${nameId}-ends`} className="text-md font-bold text-alert">{t.ends}</h3>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-md text-ink">
                <li>{t.endsLogin({ email: preview.email })}</li>
                {preview.membership && (
                  <li>{t.endsMembership({ kpm: preview.membership.kpmName, code: preview.membership.kpmCode })}</li>
                )}
              </ul>
            </section>
            <section aria-labelledby={`${nameId}-stays`}>
              <h3 id={`${nameId}-stays`} className="text-md font-bold text-navy">{t.stays}</h3>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-md text-ink">
                <li>{preview.kpmsWithHistory > 0 ? t.staysHistory({ n: preview.kpmsWithHistory }) : t.staysNone}</li>
                <li>{t.free}</li>
              </ul>
            </section>
            <Field label={t.reason} htmlFor={reasonId} hint={t.reasonHint}>
              <Textarea id={reasonId} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} disabled={busy} />
            </Field>
            <Field label={t.typeName({ name: name.replace(/\s+/g, ' ').trim() })} htmlFor={nameId}>
              <TextInput
                id={nameId}
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                disabled={busy}
                className="max-md:h-11"
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
