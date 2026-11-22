'use client';

import { useId, useMemo, useState } from 'react';
import { Button, ErrorBanner, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { PickerMenu } from '@/components/ui/picker-menu';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong } from '@/lib/format';
import { kpmOwnersMessages } from '@/i18n/messages/kpm-owners';
import {
  downloadKpmReport, KpmReportBlocked, kpmReportHref, kpmReportRecipients, reportMonths, sendKpmReportToOwner, type KpmReportLink,
} from '@/lib/kpm-report';
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
  ownerCount,
  onClose,
}: {
  kpmId: string;
  kpmName: string;
  companyName: string;
  /**
   * How many owners the KPM has, where the page knows: one or none, and *Kirim ke owner* opens WhatsApp in the press;
   * several, or not known, and it lists each owner's link to tap — never a blank window opened and shut (OD-455).
   */
  ownerCount?: number;
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
  // P19.27-T5 AC-1 (ADR-0285 §5; OD-455): with several owners, the link answered and who of them is chosen.
  const [several, setSeveral] = useState<KpmReportLink | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const o = useMessages(kpmOwnersMessages);
  const monthId = useId();
  const explainId = useId();

  const label = (m: string) => `${formatMonthLong(m, language)} ${m.slice(0, 4)}`;

  async function send() {
    setBusy('send');
    setError(null);
    try {
      const openNow = ownerCount !== undefined && ownerCount <= 1;
      const view = await sendKpmReportToOwner(kpmId, month, openNow);
      if (!openNow || (view.owners ?? []).length > 1) {
        // Every owner chosen by default; each sends with their own tap below.
        setSeveral(view);
        setChosen(new Set(kpmReportRecipients(view).map((_, i) => i)));
        return;
      }
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
          {/* On a phone the app's own picker, never a native select (P19.26-T6 AC-3; UI-218 (21 Nov)); from 768px as before. */}
          {phone ? (
            <PickerMenu
              id={monthId}
              label={t.month}
              value={month}
              options={months.map((m) => ({ value: m, label: label(m) }))}
              onChange={setMonth}
              disabled={busy !== null}
              className="w-full"
            />
          ) : (
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
          )}
        </div>
        {/* Not on a phone (the integration round's walk, 2026-11-22; UI-213 (21 Nov): no grey explanation there). */}
        <p id={explainId} className={cn('text-sm leading-relaxed text-muted', REMOVED_ON_PHONE)}>{t.explain}</p>
        {several && several.month === month && (
          /*
           * ***Kirim ke owner* to every owner** (P19.27-T5 AC-1; ADR-0285 §5; OD-455): one pick-list, each owner ticked,
           * and each ticked owner's own WhatsApp link — one window per tap. A month changed since asks again.
           */
          <fieldset className="flex flex-col gap-1" data-report-recipients="">
            <legend className="mb-1 text-sm font-semibold text-muted">{o.report.pick}</legend>
            {kpmReportRecipients(several).map((owner, i) => (
              <div key={owner.userId ?? owner.name} className="flex min-h-11 items-center gap-3 border-b border-divider last:border-b-0">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={chosen.has(i)}
                    onChange={() => setChosen((now) => {
                      const next = new Set(now);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      return next;
                    })}
                    className="h-5 w-5 shrink-0 accent-secondary"
                  />
                  <span className="min-w-0 truncate text-base font-bold uppercase text-ink">{owner.name}</span>
                </label>
                {chosen.has(i) && (
                  <a
                    href={kpmReportHref(several, owner)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={o.report.openFor({ name: owner.name })}
                    onClick={() => show(owner.phone ? t.sent({ name: owner.name }) : t.sentNobody)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-hairline px-3.5 text-base font-semibold text-navy"
                  >
                    <NavIcon name="ti-brand-whatsapp" className="h-[18px] w-[18px] shrink-0 text-whatsapp" />
                    {o.report.open}
                  </a>
                )}
              </div>
            ))}
          </fieldset>
        )}
      </div>
      <Toast toast={toast} />
    </Modal>
  );
}
