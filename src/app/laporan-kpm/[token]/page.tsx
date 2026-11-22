'use client';

import { use, useState } from 'react';
import { RoleShell } from '@/components/role-shell';
import { Button, ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonthLong } from '@/lib/format';
import { fetchSharedKpmReport, reportLinkMonth } from '@/lib/kpm-report';
import { signInPathFrom } from '@/lib/return-path';
import { saveFile } from '@/lib/save-file';
import { useSession } from '@/lib/session';

/**
 * **The KPM report link the Owner opens** (`/laporan-kpm/[token]`; P19.24-T2 AC-1; ADR-0280 §5; OD-359, OD-428): what the
 * Super Admin's WhatsApp message carries. **Signed out**: *Masuk*, which comes back here — the report opens only for the
 * KPM's Owner or a KPM Admin, signed in. **Signed in**: *Unduh PDF*, which asks the API for the file
 * (`GET /kpm-report/shared/:token`) and saves it; the link stays good until it expires, so it can be opened again. Every
 * refusal is the server's own sentence — a link expired or not valid, a report for another KPM. No figure is on this page.
 */
export default function KpmReportLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { me, loading } = useSession();
  const t = useMessages(kpmReportMessages).page;
  const language = useFigureLanguage();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const month = reportLinkMonth(token);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      saveFile(await fetchSharedKpmReport(token), `Laporan-KPM-${month ?? 'KPM'}.pdf`);
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const here = { pathname: `/laporan-kpm/${encodeURIComponent(token)}`, search: '' };
  return (
    <RoleShell title={t.title} allowSignedOut>
      <Card className="max-w-xl">
        <div className="rounded-md border-l-4 border-l-primary bg-base p-3">
          <p className="font-display text-lg font-bold text-navy">
            {month ? t.heading({ month: `${formatMonthLong(month, language)} ${month.slice(0, 4)}` }) : t.headingNoMonth}
          </p>
          <p className="mt-1 text-md text-muted">{t.explain}</p>
        </div>
        {error && <div className="mt-4"><ErrorBanner {...error} /></div>}
        {loading ? (
          <div className="mt-4"><Skeleton label={t.title}><SkeletonText lines={2} /></Skeleton></div>
        ) : !me ? (
          <div className="mt-4">
            <p className="text-md text-navy">{t.signedOut}</p>
            <ButtonLink href={signInPathFrom(here)} className="mt-3 w-full sm:w-auto">{t.signIn}</ButtonLink>
          </div>
        ) : (
          <div className="mt-4">
            <Button className="min-h-10 w-full gap-1.5 sm:w-auto" disabled={busy} aria-busy={busy || undefined} onClick={() => void download()}>
              <NavIcon name="ti-download" className="h-[18px] w-[18px] shrink-0" />
              {busy ? t.downloading : t.download}
            </Button>
            {done && <p role="status" className="mt-3 text-sm text-muted">{t.downloaded}</p>}
          </div>
        )}
      </Card>
    </RoleShell>
  );
}
