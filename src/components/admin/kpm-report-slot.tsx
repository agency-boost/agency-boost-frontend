'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { cn } from '@/lib/cn';

/**
 * The dialog, loaded the first time an icon opens it (the integration round, 2026-11-22): the KPM page and the Dashboard
 * carry the icon on first load, not the month picker, the recipients and the toast behind it — the KPM page stood at the
 * 200 kB First Load JS budget (`performance-and-scale.md`).
 */
const KpmReportDialog = dynamic(() => import('./kpm-report-dialog').then((m) => m.KpmReportDialog), { ssr: false });

/**
 * **Where the KPM report's PDF icon goes** (the Super Admin spec §4: *"PDF icon per KPM (dashboard and inside a KPM) →
 * dialog: month, Kirim ke owner (WhatsApp) / Unduh PDF"*; ADR-0277 §5, built by Phase 19.24 — ADR-0280).
 *
 * Two places render this slot: each KPM row of the Dashboard's *Adopsi per KPM* (`placement="row"`, the *Laporan*
 * column) and a KPM page's header beside the KPM switcher (`placement="header"`). **Since Phase 19.24 `KPM_REPORT_READY`
 * is `true`**: the icon (`ti-file-type-pdf`, 40px, the orange tint), named for its KPM (*"Laporan KPM {nama} (PDF)"*), opens
 * the report's dialog for `kpm` (`kpm-report-dialog.tsx`). The pages carry no hunk of their own.
 */
export const KPM_REPORT_READY = true;

export interface KpmReportTarget {
  kpmId: string;
  name: string;
  code: string;
  companyName: string;
  /** How many owners it has, where the page knows (`KpmReportDialog`'s `ownerCount`). */
  owners?: number;
}

/**
 * `round` (P19.29-T1 AC-2; UI-200 (21 Nov), ADR-0287 §1): the KPM page's phone header — a white round button, 44px, in
 * the row of the *Super Admin · akses penuh* pill and ⋯. The same icon, name and dialog.
 */
export function KpmReportSlot({ kpm, placement }: { kpm: KpmReportTarget; placement: 'row' | 'header' | 'round' }) {
  const t = useMessages(kpmReportMessages);
  const [open, setOpen] = useState(false);
  if (!KPM_REPORT_READY) return null;
  const name = t.open({ kpm: kpm.name });
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // On the Dashboard the row itself opens the KPM: the icon is its own action.
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={name}
        title={name}
        aria-haspopup="dialog"
        data-kpm-report={kpm.kpmId}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-ink',
          'hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring',
          placement === 'row' && 'mx-auto',
          placement === 'round' && 'h-11 w-11 rounded-full border border-hairline bg-card hover:bg-hover-row',
        )}
      >
        <NavIcon name="ti-file-type-pdf" className="h-5 w-5" />
      </button>
      {open && (
        <KpmReportDialog kpmId={kpm.kpmId} kpmName={kpm.name} companyName={kpm.companyName} ownerCount={kpm.owners} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
