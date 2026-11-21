'use client';

import { useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import { cn } from '@/lib/cn';
import { KpmReportDialog } from './kpm-report-dialog';

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
}

export function KpmReportSlot({ kpm, placement }: { kpm: KpmReportTarget; placement: 'row' | 'header' }) {
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
        )}
      >
        <NavIcon name="ti-file-type-pdf" className="h-5 w-5" />
      </button>
      {open && (
        <KpmReportDialog kpmId={kpm.kpmId} kpmName={kpm.name} companyName={kpm.companyName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
