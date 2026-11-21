import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * ***Laporan KPM*** (P19.24; ADR-0280; the Super Admin spec of 20 November 2026 §4): the PDF icon on each KPM of the
 * Dashboard's *Adopsi per KPM* and inside a KPM (`components/admin/kpm-report-slot.tsx`), the dialog it opens
 * (`components/admin/kpm-report-dialog.tsx`), the WhatsApp message *Kirim ke owner* writes (`lib/kpm-report.ts`), and the
 * page the Owner opens from it (`app/laporan-kpm/[token]/page.tsx`).
 *
 * **The Indonesian is the approved mockup's, verbatim** (`revisions/2026-11-20-Superadmin/files/UI/mockups/superadmin-*`):
 * *Laporan PDF ±22 halaman: ringkasan eksekutif, tindakan minggu ini, KPM Overview, compliance per orang, satu halaman per AB
 * group, dan lampiran Advanced analytics.*, *Kirim ke owner*, *Unduh PDF*. The rest — the month's label, the states, the
 * Owner's page — is ours, in the console's idiom (parity I-1206, I-1207). **The message is the Owner's**, written in the
 * language a person who has chosen none reads (`INVITEE_LANGUAGE`), whichever language the Super Admin's screen is in.
 */
const en = {
  /** The icon's accessible name and tooltip, by KPM. */
  open: ({ kpm }: { kpm: string }) => `KPM report for ${kpm} (PDF)`,
  title: 'KPM report',
  /** Under the title: the KPM and its company. */
  subtitle: ({ kpm, company }: { kpm: string; company: string }) => `${kpm} · ${company}`,
  month: 'Month',
  /** The mockup's line under the month. */
  explain: 'PDF report, about 22 pages: executive summary, this week\'s actions, KPM Overview, compliance per person, one page per AB group, and the Advanced analytics appendix.',
  send: 'Send to owner',
  sending: 'Opening WhatsApp…',
  download: 'Download PDF',
  downloading: 'Making the PDF…',
  /** The toast once WhatsApp is open with the message. */
  sent: ({ name }: { name: string }) => `WhatsApp is open for ${name}. Send the message there.`,
  sentNobody: 'WhatsApp is open. Choose the owner and send the message there.',
  downloaded: 'The PDF is downloaded.',
  blocked: 'The browser blocked the new window. Allow pop-ups for AgencyBoost, then try again.',
  /** The message, to the Owner. */
  message: ({ name, kpm, company, month, link, until }: { name: string; kpm: string; company: string; month: string; link: string; until: string }) =>
    `Hello ${name}, the KPM report for ${kpm} · ${company} for ${month} is ready. Open this link to download the PDF (sign in as the KPM's owner or admin; it works until ${until}): ${link}`,
  ownerFallback: 'Owner',
  /** The Owner's page. */
  page: {
    title: 'KPM report',
    heading: ({ month }: { month: string }) => `KPM report · ${month}`,
    headingNoMonth: 'KPM report',
    explain: 'The report AgencyBoost sent you as a PDF: your KPM\'s figures for the month, name by name.',
    signedOut: 'Sign in as the KPM\'s owner or admin first — you will come back to this report.',
    signIn: 'Sign in',
    download: 'Download PDF',
    downloading: 'Making the PDF…',
    downloaded: 'The PDF is downloaded. You can open this link again until it expires.',
  },
};

const id: MessagesOf<typeof en> = {
  open: ({ kpm }) => `Laporan KPM ${kpm} (PDF)`,
  title: 'Laporan KPM',
  subtitle: ({ kpm, company }) => `${kpm} · ${company}`,
  month: 'Bulan',
  explain: 'Laporan PDF ±22 halaman: ringkasan eksekutif, tindakan minggu ini, KPM Overview, compliance per orang, satu halaman per AB group, dan lampiran Advanced analytics.',
  send: 'Kirim ke owner',
  sending: 'Membuka WhatsApp…',
  download: 'Unduh PDF',
  downloading: 'Membuat PDF…',
  sent: ({ name }) => `WhatsApp terbuka untuk ${name}. Kirim pesannya di sana.`,
  sentNobody: 'WhatsApp terbuka. Pilih owner, lalu kirim pesannya di sana.',
  downloaded: 'PDF sudah diunduh.',
  blocked: 'Browser memblokir jendela baru. Izinkan pop-up untuk AgencyBoost, lalu coba lagi.',
  message: ({ name, kpm, company, month, link, until }) =>
    `Halo ${name}, laporan KPM ${kpm} · ${company} bulan ${month} sudah siap. Buka tautan ini untuk mengunduh PDF-nya (masuk sebagai owner atau admin KPM; berlaku sampai ${until}): ${link}`,
  ownerFallback: 'Owner',
  page: {
    title: 'Laporan KPM',
    heading: ({ month }) => `Laporan KPM · ${month}`,
    headingNoMonth: 'Laporan KPM',
    explain: 'Laporan yang dikirim AgencyBoost untuk Anda dalam PDF: angka KPM Anda untuk bulan tersebut, nama per nama.',
    signedOut: 'Masuk dulu sebagai owner atau admin KPM — Anda akan kembali ke laporan ini.',
    signIn: 'Masuk',
    download: 'Unduh PDF',
    downloading: 'Membuat PDF…',
    downloaded: 'PDF sudah diunduh. Tautan ini bisa dibuka lagi sampai kedaluwarsa.',
  },
};

export const kpmReportMessages = defineMessages({ en, id });
