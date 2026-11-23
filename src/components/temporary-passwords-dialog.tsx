'use client';

import { useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { temporaryPasswordsMessages } from '@/i18n/messages/temporary-passwords';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { saveFile } from '@/lib/save-file';
import { issueTemporaryPasswords, previewTemporaryPasswords, type TemporaryPasswordsPreview } from '@/lib/temporary-passwords';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Akun & password*** **— the confirmation, then the file** (P19.30-T1 AC-6, T2 AC-2; ADR-0288 §2, §4). Opened from
 * *Unduh akun & password (PDF)*: the KPM page's ⋯ (the Super Admin), *All members*' ⋯ (an Owner) and *Import people*'s
 * result (`membershipIds`, the accounts the commit made).
 *
 * - **First it asks how many** (`POST /members/temporary-passwords/preview`), which issues nothing, and says it: *PDF ini
 *   memuat n orang …*, that an older PDF stops working for them, and that each must choose their own password at first
 *   sign-in — the three things ADR-0288 asks the confirmation to say — and that the sheet is confidential.
 * - **Two steps** (*changed 2026-11-23*, the P19.30 browser walk: a download started after the issue's `await`, as the
 *   dialog closed, ended `canceled` with 0 bytes — the passwords re-issued and no file to show for it):
 *   1. ***Buat PDF*** issues the passwords (`issueTemporaryPasswords`) and **keeps the PDF in the dialog**; a toast says it
 *      is ready.
 *   2. ***Unduh PDF*** saves that same file **inside the reader's own click** (`saveFile`), as often as it is pressed — the
 *      same file every time, nothing issued again. ***Selesai*** closes the dialog and lets the file go.
 * - **Nobody to list**: it says so, and offers nothing to make — *Tutup* only.
 * - A refusal is said in the dialog in the reader's words (`toDisplayError`). A centred dialog from 768px, a bottom sheet
 *   on a phone, as the KPM report's. The server decides who may and who is listed; this decides nothing.
 */
export function TemporaryPasswordsDialog({
  membershipIds,
  onClose,
  onReady,
}: {
  /** Narrow it to these memberships (*Import people*'s result). Absent: every account of the KPM not yet its person's. */
  membershipIds?: readonly string[];
  onClose: () => void;
  /** Told once the PDF is made, with how many it lists. */
  onReady?: (count: number) => void;
}) {
  const t = useMessages(temporaryPasswordsMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const { toast, show } = useToast();
  const [preview, setPreview] = useState<TemporaryPasswordsPreview | null>(null);
  /** The PDF once made — held here until *Selesai*, so *Unduh PDF* saves it in the click itself. */
  const [made, setMade] = useState<{ file: Blob; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const count = preview?.count ?? null;

  useEffect(() => {
    let live = true;
    previewTemporaryPasswords(membershipIds)
      .then((answer) => { if (live) setPreview(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipIds]);

  async function make() {
    if (!preview || preview.count === 0) return;
    setBusy(true);
    setError(null);
    try {
      const file = await issueTemporaryPasswords(membershipIds);
      setMade({ file, count: preview.count });
      show(t.ready({ n: preview.count }));
      onReady?.(preview.count);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  /** Synchronous, in the click: the file is already here. */
  function download() {
    if (!made || !preview) return;
    try {
      saveFile(made.file, preview.fileName);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  const nobody = count === 0;
  const footer = made ? (
    <div className="grid grid-cols-2 gap-2" data-temporary-passwords-actions="">
      <Button variant="secondary" className="min-h-11 w-full" onClick={onClose}>{t.done}</Button>
      <Button className="min-h-11 w-full gap-1.5" onClick={download}>
        <NavIcon name="ti-download" className="h-[18px] w-[18px] shrink-0" />
        {t.download}
      </Button>
    </div>
  ) : (
    <div className={nobody || count === null ? 'flex' : 'grid grid-cols-2 gap-2'} data-temporary-passwords-actions="">
      <Button variant="secondary" className="min-h-11 w-full" onClick={onClose} disabled={busy}>
        {nobody ? t.close : t.cancel}
      </Button>
      {!nobody && count !== null && (
        <Button className="min-h-11 w-full gap-1.5" onClick={() => void make()} disabled={busy} aria-busy={busy || undefined}>
          <NavIcon name="ti-file-type-pdf" className="h-[18px] w-[18px] shrink-0" />
          {busy ? t.making : t.make}
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Modal
        open
        title={t.title}
        description={preview ? t.subtitle({ kpm: preview.kpmName }) : undefined}
        onClose={onClose}
        placement={phone ? 'sheet' : 'center'}
        handle={phone}
        closeLabel={ui.close}
        footer={footer}
      >
        <div className="flex flex-col gap-3 pb-2" data-temporary-passwords={made ? 'ready' : ''}>
          {error && <ErrorBanner {...error} />}
          {count === null && !error && <Skeleton label={t.loading}><SkeletonText lines={3} /></Skeleton>}
          {nobody && <p className="text-md text-ink">{t.nobody}</p>}
          {made ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-md text-ink">
              <li><b>{t.madeLine({ n: made.count })}</b></li>
              <li>{t.again}</li>
              <li>{t.confidential}</li>
            </ul>
          ) : count !== null && count > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-md text-ink">
              <li><b>{t.lists({ n: count })}</b></li>
              <li>{t.older}</li>
              <li>{t.firstSignIn}</li>
              <li>{t.confidential}</li>
            </ul>
          )}
        </div>
      </Modal>
      <Toast toast={toast} />
    </>
  );
}
