'use client';

import { KpmReportSlot, type KpmReportTarget } from '@/components/admin/kpm-report-slot';
import { KpmSwitcher } from '@/components/admin/kpm-switcher';
import { TitleAvatar, useFieldChrome } from '@/components/field-chrome';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';

/**
 * **A KPM's page header on a phone** (P19.29-T1 AC-1, AC-2, AC-4; UI-200 (21 Nov); ADR-0287 §1; the stop motion's
 * `KPMHEAD`, section D frames 1–2). Below 768px it stands where the title row, the switcher chip and the thin bar stood;
 * from 768px the page draws those as it always did.
 *
 * - **Row 1: the title is the switcher** — *"<KPM> ⌄"* at 20/800 (`KpmSwitcher variant="heading"`, the page's `<h1>`),
 *   tapping it opens the other KPMs and *Semua KPM* under it; one meta line *"<perusahaan> · KPM <kode>"* at 13/400 grey;
 *   the 36px avatar on the right (`TitleAvatar`, as every title row has it). **The KPM's name is here once.**
 * - **Row 2: one 44px row in one type style, 13/600** (D-38): the navy pill *Super Admin · akses penuh* (the shield a
 *   line icon), which takes the room left; the white round *PDF*, 44px — the report's own slot (`placement="round"`); and
 *   the white round ⋯, 44px, whose menu holds `menu` — *Simpan sebagai template*, moved here from the foot of the page,
 *   and since P19.30-T1 *Unduh akun & password (PDF)* (ADR-0288). A reader with nothing in it gets no ⋯.
 */
export function KpmPhoneHeader({ kpm, menu }: { kpm: KpmReportTarget; menu: readonly ActionMenuItem[] }) {
  const t = useMessages(adminConsoleMessages).inside;
  const chrome = useFieldChrome();
  return (
    <div className="mb-3 flex flex-col gap-3" data-kpm-header="">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <KpmSwitcher variant="heading" current={{ kpmId: kpm.kpmId, name: kpm.name, companyName: kpm.companyName }} />
          <p className="truncate text-base text-muted" data-kpm-meta="">{t.meta({ company: kpm.companyName, code: kpm.code })}</p>
        </div>
        {chrome && <TitleAvatar chrome={chrome} />}
      </div>
      <div className="flex h-11 min-w-0 items-center gap-2" data-kpm-controls="">
        <p
          className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-pill bg-secondary px-3.5 text-base font-semibold text-secondary-contrast"
          data-kpm-pill=""
        >
          <NavIcon name="ti-shield-check" className="h-[18px] w-[18px] shrink-0" />
          <span className="min-w-0 truncate">{t.pill}</span>
        </p>
        <KpmReportSlot kpm={kpm} placement="round" />
        {menu.length > 0 && (
          <ActionMenu
            label={t.more}
            items={menu}
            glyph={<LineIcon name="more" className="h-5 w-5" />}
            triggerClassName="h-11 w-11 rounded-full border border-hairline bg-card text-base font-semibold text-navy"
          />
        )}
      </div>
    </div>
  );
}
