'use client';

import { useEffect, useState } from 'react';
import { InviteQr } from '@/components/ui/invite-qr';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { inviteShareMessages } from '@/i18n/messages/invite-share';
import { uiMessages } from '@/i18n/messages/ui';
import { cn } from '@/lib/cn';

/**
 * **The invite share block** (UI V1, Phase 18.99 T9: UI-084, UI-090; D-08, D-22) — a leader's code and the four ways
 * to hand it on: *Salin tautan*, *Salin kode*, the QR, and WhatsApp. Built once for User Management's *Undang seseorang*
 * and for New Hires' *+ Tambah agent* modal (UI-024, T6), which reuses it.
 *
 * - **`variant="page"`** (UI-084, *Add New Agents*): **below 768px** the code at 22px and one row of pill buttons —
 *   *Salin tautan* · *Salin kode* · *QR* — with the round green WhatsApp at the end; the link is not shown (*Salin
 *   tautan* copies it) and *QR* opens a sheet with a large code. **From 768px** the link · the code · WhatsApp · the QR
 *   tile in one row, each copy a pill button (≥ 36px; 44px on a tablet), never an underlined link.
 * - **`variant="modal"`** (UI-024's centred modal): the code, then four equal buttons — the QR drawn inline under them.
 * - **A copy that worked toasts** *Tersalin ✓* (UI-090) through the shell's toast — above the tab bar on a phone,
 *   bottom-right on a desktop (UI-070) — or the caller's words (`copiedLink`, `copiedCode`: New Hires' *Tautan disalin*).
 *   **A copy the browser refused** shows the value, selectable, and the shared sentence to copy it by hand — on a phone
 *   too, where the link is otherwise not on the screen.
 * - **WhatsApp opens `https://wa.me/?text=<the link>`** — the reader picks the chat; `whatsAppText` replaces the text.
 */
export function InviteShareBlock({
  code,
  link,
  variant = 'page',
  copiedLink,
  copiedCode,
  whatsAppText,
  className,
}: {
  /** The leader's code, *AGUS01*, as stored. */
  code: string;
  /** The invite link the code makes, as the server sends it. */
  link: string;
  variant?: 'page' | 'modal';
  /** The toast once the link is copied; *Tersalin ✓* when absent (UI-090). */
  copiedLink?: string;
  /** The toast once the code is copied; *Tersalin ✓* when absent. */
  copiedCode?: string;
  /** What WhatsApp's message says; the link alone when absent (UI-084). */
  whatsAppText?: string;
  className?: string;
}) {
  const t = useMessages(inviteShareMessages);
  const confirmed = useMessages(confirmationMessages);
  const copyWords = useMessages(uiMessages).copy;
  const { toast, show } = useToast();
  const [failed, setFailed] = useState<'link' | 'code' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // The fallback stays long enough to select the text, then goes.
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(null), 8000);
    return () => clearTimeout(timer);
  }, [failed]);

  async function copy(kind: 'link' | 'code') {
    const value = kind === 'link' ? link : code;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setFailed(null);
      show(kind === 'link' ? copiedLink ?? confirmed.copied : copiedCode ?? confirmed.copied);
    } catch {
      setFailed(kind);
    }
  }

  const whatsApp = `https://wa.me/?text=${encodeURIComponent(whatsAppText ?? link)}`;
  const pill = cn(
    'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-card px-2.5 text-md font-semibold text-navy',
    'hover:bg-hover-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber md:px-3.5 lg:h-9',
  );
  const copyLink = (
    <button type="button" className={pill} onClick={() => void copy('link')}>
      <LineIcon name="link" className="h-4 w-4 max-md:hidden" />
      {t.copyLink}
    </button>
  );
  const copyCode = (
    <button type="button" className={pill} onClick={() => void copy('code')}>{t.copyCode}</button>
  );
  const whatsAppButton = (round: string) => (
    <a
      href={whatsApp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.whatsApp}
      data-channel="whatsapp"
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-whatsapp text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber', round)}
    >
      <LineIcon name="whatsapp" className="h-5 w-5" />
    </a>
  );
  const fallback = failed && (
    <div role="status" className="mt-2">
      <p className="select-all break-all text-md font-semibold text-navy">{failed === 'link' ? link : code}</p>
      <p className="mt-0.5 text-sm text-alert">{copyWords.failed}</p>
    </div>
  );
  const codeLine = (size: string) => (
    <span className={cn('font-extrabold tracking-[1px] text-navy', size)}>{code}</span>
  );

  if (variant === 'modal') {
    return (
      <div data-invite-share="modal" className={className}>
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-muted">{t.codeLabel}</span>
          {codeLine('text-[1.375rem]')}
        </p>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {copyLink}
          {copyCode}
          <button type="button" className={pill} aria-expanded={qrOpen} aria-label={qrOpen ? t.hideQr : t.showQr} onClick={() => setQrOpen((o) => !o)}>
            {t.qr}
          </button>
          <a
            href={whatsApp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.whatsApp}
            data-channel="whatsapp"
            className={pill}
          >
            <LineIcon name="whatsapp" className="h-5 w-5 text-whatsapp" />
            <span className="max-sm:sr-only">{t.whatsAppShort}</span>
          </a>
        </div>
        {qrOpen && (
          <div className="mt-2.5 flex flex-col items-center gap-1.5 rounded-row bg-base p-3 text-sm text-muted">
            <InviteQr url={link} size={150} />
            <span>{t.scanToJoin} · {t.scanCode({ code })}</span>
          </div>
        )}
        {fallback}
        <Toast toast={toast} />
      </div>
    );
  }

  return (
    <div data-invite-share="page" className={className}>
      {/* Below 768px (UI-084): the code, one row of pills and WhatsApp; the link behind *Salin tautan*, the QR in a sheet. */}
      <div className="md:hidden" data-testid="invite-share-phone">
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-muted">{t.codeLabel}</span>
          {codeLine('text-[1.375rem]')}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          {copyLink}
          {copyCode}
          <button type="button" className={cn(pill, 'min-w-11')} aria-label={t.showQr} aria-haspopup="dialog" onClick={() => setQrOpen(true)}>
            {t.qr}
          </button>
          {whatsAppButton('ml-auto h-11 w-11')}
        </div>
      </div>

      {/* From 768px (UI-084): link · code · WhatsApp · the QR tile in one row. */}
      <div className="flex items-end gap-6 max-md:hidden" data-testid="invite-share-wide">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{t.linkLabel}</p>
          <p className="mb-2 mt-0.5 break-all text-md text-ink">{link}</p>
          {copyLink}
        </div>
        <div className="shrink-0">
          <p className="text-sm text-muted">{t.codeLabel}</p>
          <p className="mb-1.5">{codeLine('text-xl')}</p>
          {copyCode}
        </div>
        {whatsAppButton('h-11 w-11 lg:h-9 lg:w-9')}
        <div className="self-center">
          <InviteQr url={link} />
        </div>
      </div>

      {fallback}

      <ResponsiveSheet open={qrOpen} title={t.scanToJoin} description={t.scanCode({ code })} onClose={() => setQrOpen(false)}>
        <div className="flex justify-center py-2">
          <InviteQr url={link} size={240} />
        </div>
      </ResponsiveSheet>
      <Toast toast={toast} />
    </div>
  );
}
