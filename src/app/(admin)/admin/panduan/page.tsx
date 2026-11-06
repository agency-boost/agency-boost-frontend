'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { adminPanduanMessages } from '@/i18n/messages/admin-panduan';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { GUIDE_FRAME, readSuperAdminGuide, SUPER_ADMIN_GUIDE_PDF_NAME, superAdminGuidePdf } from '@/lib/panduan';
import { saveFile } from '@/lib/save-file';

/**
 * **`/admin/panduan` — the Super Admin's guide, INTERNAL** (P19.6-T5 AC-4; ADR-0219 §4; §B6: *"only Super Admins can open
 * it, and it must never be reachable by a public link"*), opened in a tab of its own from *📘 Panduan*.
 *
 * - **Its own gate, `platform_guide:read`**, inside the platform's. A reader without it gets the permission-denied state
 *   (L-01) and asks the API for nothing; the API refuses them all the same (`403 PERM_DENIED`).
 * - **The page holds no copy of the guide.** It reads the HTML with the session (`GET /admin/panduan`) and draws it in a
 *   sandboxed `srcdoc` frame, as delivered (OD-271). The frame takes the page's height below the title and the guide
 *   scrolls inside it: its origin is opaque, so its own height cannot be read from here.
 * - **The *PDF* control** reads `GET /admin/panduan/pdf` the same way and saves it, `panduan-super-admin.pdf`.
 * - No sub-line (UI-136); the guide is in Bahasa whatever the language (acceptance 5).
 */
export default function SuperAdminGuidePage() {
  const COPY = useMessages(adminPanduanMessages);
  const [saving, setSaving] = useState(false);
  const [pdfError, setPdfError] = useState<ApiError | null>(null);

  const savePdf = () => {
    setSaving(true);
    setPdfError(null);
    superAdminGuidePdf()
      .then((blob) => saveFile(blob, SUPER_ADMIN_GUIDE_PDF_NAME))
      .catch((err) => setPdfError(toDisplayError(err)))
      .finally(() => setSaving(false));
  };

  return (
    <Page
      title={COPY.title}
      permission="platform_guide:read"
      actions={(
        <Button variant="secondary" onClick={savePdf} disabled={saving} aria-label={COPY.pdfName} aria-busy={saving || undefined}>
          {saving ? COPY.savingPdf : COPY.pdf}
        </Button>
      )}
    >
      {pdfError && <div className="mb-3"><ErrorBanner {...pdfError} /></div>}
      <Guide />
    </Page>
  );
}

function Guide() {
  const COPY = useMessages(adminPanduanMessages);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    setHtml(null);
    readSuperAdminGuide()
      .then(setHtml)
      .catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div>
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={load}>{COPY.tryAgain}</Button>
      </div>
    );
  }

  // The frame's own shape while the guide is read: a card the height the guide will take.
  const box = 'block h-[calc(100dvh-12rem)] min-h-[30rem] w-full rounded-card border border-card-edge bg-card';
  if (html === null) {
    return (
      <Skeleton label={COPY.loading}>
        <div className={box} />
      </Skeleton>
    );
  }

  return (
    <iframe
      title={COPY.frameTitle}
      srcDoc={html}
      sandbox={GUIDE_FRAME.sandbox}
      allow={GUIDE_FRAME.allow}
      referrerPolicy={GUIDE_FRAME.referrerPolicy}
      data-guide-frame=""
      className={box}
    />
  );
}
