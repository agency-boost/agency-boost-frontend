import { messagesIn } from '@/i18n/catalogue';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { api, apiBlob } from './api-client';
import { formatMonthLong, formatOfficeDay, monthInZone, OFFICE_TIME_ZONE } from './format';
import { INVITEE_LANGUAGE } from './invites';
import { whatsAppHref } from './phone-number';
import { saveFile } from './save-file';

/**
 * ***Laporan KPM*** (P19.24; ADR-0280; the Super Admin spec §4): *Unduh PDF* and *Kirim ke owner* for any KPM and month,
 * the Super Admin's (`kpm_report:read`), and the Owner opening the link (`kpm_report:download_link`). The file is the API's
 * — built on the server from the KPM's own pages' readings — and nothing here computes a figure.
 */

/** How many months before the KPM's own a report may be made for (`KPM_REPORT.MONTHS_BACK`; the API refuses others). */
export const REPORT_MONTHS_BACK = 12;

/** `POST /admin/tenants/:id/report/link`'s answer. The link is in it and nowhere else. */
export interface KpmReportLink {
  link: string;
  month: string;
  expiresAt: string;
  kpmName: string;
  kpmCode: string;
  companyName: string;
  ownerName: string | null;
  ownerPhone: string | null;
}

/**
 * **The months the dialog offers**, newest first: the office's month (`Asia/Jakarta`, ADR-0016) and the twelve before it.
 * The first choice is the month before — the last whole month — as the template's *Laporan KPM Oktober* is made in
 * November.
 */
export function reportMonths(now: Date = new Date()): { months: string[]; initial: string } {
  const current = monthInZone(OFFICE_TIME_ZONE, now);
  const [y, m] = current.split('-').map(Number);
  const months = Array.from({ length: REPORT_MONTHS_BACK + 1 }, (_, i) => {
    const at = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  return { months, initial: months[1] };
}

/** The report's file name, as the API names it: `Laporan-KPM-{KPM}-{YYYY-MM}.pdf`. */
export function reportFileName(kpmName: string, month: string): string {
  const kpm = kpmName.normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'KPM';
  return `Laporan-KPM-${kpm}-${month}.pdf`;
}

/** ***Unduh PDF***: **`GET /admin/tenants/:id/report?month=`** — the PDF itself — saved under its name. */
export const downloadKpmReport = async (kpmId: string, kpmName: string, month: string): Promise<void> => {
  const file = await apiBlob(`/admin/tenants/${encodeURIComponent(kpmId)}/report?month=${encodeURIComponent(month)}`);
  saveFile(file, reportFileName(kpmName, month));
};

/** **`GET /kpm-report/shared/:token`** — the Owner (or a KPM Admin), signed in, opening the link. */
export const fetchSharedKpmReport = (token: string) => apiBlob(`/kpm-report/shared/${encodeURIComponent(token)}`);

/**
 * **The words WhatsApp opens with**, to the Owner: their name, the KPM and its company, the month, the link and until when
 * — in the Owner's language (`INVITEE_LANGUAGE`), whatever language the Super Admin's screen is in.
 */
export function kpmReportMessage(view: KpmReportLink): string {
  const say = messagesIn(kpmReportMessages, INVITEE_LANGUAGE);
  return say.message({
    name: view.ownerName ?? say.ownerFallback,
    kpm: view.kpmName,
    company: view.companyName,
    month: `${formatMonthLong(view.month, INVITEE_LANGUAGE)} ${view.month.slice(0, 4)}`,
    link: view.link,
    until: formatOfficeDay(view.expiresAt, OFFICE_TIME_ZONE, INVITEE_LANGUAGE),
  });
}

/** The browser refused the window WhatsApp opens in — pop-ups blocked for the app. */
export class KpmReportBlocked extends Error {
  constructor() {
    super('The browser blocked the window the WhatsApp message opens in.');
    this.name = 'KpmReportBlocked';
  }
}

/**
 * ***Kirim ke owner***: AgencyBoost sends nothing (OD-359). A window opens **inside the click** — a browser only lets a
 * page open one while the press is handled, and the link is not known yet — then the link is asked for and the window
 * pointed at WhatsApp: to the Owner's number when one is on file, or to nobody, so WhatsApp asks whom to send it to. On a
 * failure the window is closed again and the error rethrown. Answers the link's view, so the caller can name the Owner.
 */
export const sendKpmReportToOwner = async (kpmId: string, month: string): Promise<KpmReportLink> => {
  const opened = window.open('about:blank', '_blank');
  if (!opened) throw new KpmReportBlocked();
  // The new window never reaches back into this one.
  opened.opener = null;
  try {
    // **`POST /admin/tenants/:id/report/link`**: a fresh link for the KPM's Owner.
    const view = await api<KpmReportLink>(`/admin/tenants/${encodeURIComponent(kpmId)}/report/link`, { method: 'POST', body: { month } });
    const text = kpmReportMessage(view);
    opened.location.href = whatsAppHref(view.ownerPhone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
    return view;
  } catch (err) {
    opened.close();
    throw err;
  }
};

/** **The month a link names**, read from its token's first half for the Owner's page heading; `null` if it names none. */
export function reportLinkMonth(token: string): string | null {
  try {
    const half = token.split('.')[0] ?? '';
    const json = atob(half.replace(/-/g, '+').replace(/_/g, '/'));
    const month = (JSON.parse(json) as { m?: unknown }).m;
    return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
  } catch {
    return null;
  }
}
