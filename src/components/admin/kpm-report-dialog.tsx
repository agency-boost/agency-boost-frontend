'use client';

import { useId, useMemo, useState } from 'react';
import { Button, ErrorBanner, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonthLong } from '@/lib/format';
import { downloadKpmReport, KpmReportBlocked, reportMonths, sendKpmReportToOwner } from '@/lib/kpm-report';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Laporan KPM*** **— the dialog** (P19.24-T2 AC-1; ADR-0280; the Super Admin spec §4: *"PDF icon per KPM (dashboard and
 * inside a KPM) → dialog: month, Kirim ke owner (WhatsApp) / Unduh PDF"*; the approved mockups' dialog). The month — the
 * KPM's month and the twelve before it, the last whole month first — the mockup's line saying what the PDF holds, then
 * the two actions:
 *
 * - ***Kirim ke owner*** opens the Super Admin's own WhatsApp with the Owner's number and a message carrying a link to the
 *   PDF (`sendKpmReportToOwner`; OD-359, OD-428) — AgencyBoost sends nothing; the link opens for the KPM's Owner or a KPM
 *   Admin, signed in, for seven days.
 * - ***Unduh PDF*** downloads the file (`downloadKpmReport`), built on the server for that month.
 *
 * Each busy while it runs, the other held still; a refusal said in the dialog in the reader's words (`toDisplayError`),
 * and a toast once done. **A centred dialog on a tablet and a laptop, a bottom sheet on a phone** (§12), the two buttons
 * full width side by side, at least 40px tall. The server makes the report and refuses everybody but the Super Admin;
 * this decides nothing.
 */
export function KpmReportDialog({
  kpmId,
  kpmName,
  companyName,
  onClose,
}: {
  kpmId: string;
  kpmName: string;
  companyName: string;
  onClose: () => void;
}) {
  const t = useMessages(kpmReportMessages);
  const ui = useMessages(uiV1Messages);
  const language = useFigureLanguage();
  const phone = useMediaQuery('phone');
  const { toast, show } = useToast();
  const { months, initial } = useMemo(() => reportMonths(), []);
  const [month, setMonth] = useState(initial);
  const [busy, setBusy] = useState<'send' | 'download' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const monthId = useId();
  const explainId = useId();

  const label = (m: string) => `${formatMonthLong(m, language)} ${m.slice(0, 4)}`;

  async function send() {
    setBusy('send');
    setError(null);
    try {
      const view = await sendKpmReportToOwner(kpmId, month);
      show(view.ownerPhone && view.ownerName ? t.sent({ name: view.ownerName }) : t.sentNobody);
    } catch (err) {
      setError(err instanceof KpmReportBlocked ? { code: 'POPUP_BLOCKED', message: t.blocked, requestId: '' } : toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy('download');
    setError(null);
    try {
      await downloadKpmReport(kpmId, kpmName, month);
      show(t.downloaded);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open
      title={t.title}
      description={t.subtitle({ kpm: kpmName, company: companyName })}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="grid grid-cols-2 gap-2" data-kpm-report-actions>
          <Button
            variant="secondary"
            className="min-h-10 w-full gap-1.5"
            onClick={() => void send()}
            disabled={busy !== null}
            aria-busy={busy === 'send' || undefined}
          >
            <NavIcon name="ti-brand-whatsapp" className="h-[18px] w-[18px] shrink-0 text-whatsapp" />
            {busy === 'send' ? t.sending : t.send}
          </Button>
          <Button
            className="min-h-10 w-full gap-1.5"
            onClick={() => void download()}
            disabled={busy !== null}
            aria-busy={busy === 'download' || undefined}
          >
            <NavIcon name="ti-download" className="h-[18px] w-[18px] shrink-0" />
            {busy === 'download' ? t.downloading : t.download}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pb-2">
        {error && <ErrorBanner {...error} />}
        <div className="flex flex-col gap-1">
          <label htmlFor={monthId} className="text-sm font-semibold text-muted">{t.month}</label>
          <Select
            id={monthId}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={busy !== null}
            aria-describedby={explainId}
            className="min-h-10"
          >
            {months.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </Select>
        </div>
        <p id={explainId} className="text-sm leading-relaxed text-muted">{t.explain}</p>
      </div>
      <Toast toast={toast} />
    </Modal>
  );
}
