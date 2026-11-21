'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { Avatar } from '@/components/ui/avatar';
import { buttonClass } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { rungShort } from '@/components/ui/role-badge';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent, formatRupiahCompactPair } from '@/lib/format';
import { whatsAppLink } from '@/lib/phone-number';
import { useCan } from '@/lib/session';
import { progressTone, rowHref, rowName, type UnitRow } from '@/lib/unit-dashboard';
import { CoachingStatusTile } from './coaching-status-tile';

/**
 * **The KPM Owner's person card** (P19.18-T1 AC-9; ADR-0266 §3, ADR-0271 §6; the brief of 19 November 2026, part A, *Tap a
 * person*; `unit-overview-*` frame 19 on a phone, 15 on a laptop): what a tap on a person opens first for the KPM Owner and
 * an Admin (`view.personCard`) — **a bottom sheet on a phone, a centred card from 1024px** (`Modal`, responsive). Downloaded
 * the first time a person is tapped (the bundle).
 *
 * - **The head**: the photo (initials without one), the NAME in capitals, **the role once** — *AAB · Unit AGUS PRASETYO*.
 * - **Four numbers** — two by two on a phone, **in one row from 768px**: ***Leads penjualan*** *n* over *n potensi*,
 *   ***Leads rekrut*** *n* over *n potensi* — the period's leads and their potensi this month, the word *potensi*, never
 *   *closing* — ***Progres goal*** *19%* over *Rp 145 Jt / 750 Jt*, navy below 100% and green from it (AC-5, the rows'
 *   rule; the mockup's red is the rule it replaced), and ***Aktivitas*** *n* over *7 hari terakhir*.
 * - **The coaching status tile** across the card: red *Belum pernah coaching*, green *Coaching X hari lalu* up to 14 days,
 *   yellow after (`COACHING_STATUS`).
 * - **Orange *Buka profil*** (no arrow) — the same Personal Summary page a leader's tap opens (`rowHref`) — and green
 *   ***WhatsApp***. **No Proposal line** (ADR-0266 §3). Without a page the reader may open, no *Buka profil*; without a
 *   number, WhatsApp offers *Isi nomor WhatsApp* to a reader who may save one, and nothing to one who may not.
 */
export default function UnitPersonCard({
  row, unit, from, onClose, onLeave,
}: {
  row: UnitRow;
  /** The unit line the person sits under: *Unit Anda*, *Unit AGUS PRASETYO*. */
  unit: string;
  /** This page's address, for the profile's ‹. */
  from: string;
  onClose: () => void;
  /** *Buka profil* followed: the screen keeps the scroll, so ‹ comes back to it. */
  onLeave?: () => void;
}) {
  const t = useMessages(unitDashboardMessages);
  const ui = useMessages(uiV1Messages);
  const o = t.overview;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const canSavePhone = useCan('member:update_phone');
  const [phone, setPhone] = useState<string | null>(row.phone);
  const number = (n: number) => formatNumber(n, {}, figures);
  const href = rowHref(row, from);
  const name = rowName(row, language).toLocaleUpperCase('id-ID');
  const role = `${rungShort(row.rung)} · ${unit}`;
  const { goal } = row;
  const measured = goal.set !== false && goal.targetMinor !== null && goal.targetMinor > 0 && goal.actualMinor !== null;
  const pct = measured ? goal.attainmentPct ?? 0 : null;
  const tone = pct === null ? null : progressTone(pct);
  const wa = whatsAppLink(phone);

  return (
    // `ResponsiveSheet`'s own box (`placement="responsive"`): a sheet below 1024px, a centred card from it — with the photo.
    <Modal
      open
      title={name}
      description={role}
      onClose={onClose}
      placement="responsive"
      handle
      closeLabel={ui.close}
      // The photo beside the name and the role, as the card draws it: the head's three as a grid.
      className={cn(
        '[&_[data-modal-head]]:grid [&_[data-modal-head]]:grid-cols-[3.5rem_minmax(0,1fr)] [&_[data-modal-head]]:gap-x-3',
        '[&_[data-modal-handle]]:col-span-2 [&_[data-person-card-photo]]:row-span-2 [&_[data-person-card-photo]]:self-center',
        'lg:max-w-[36rem]',
      )}
      eyebrow={(
        <span data-person-card-photo="" className="flex">
          <Avatar name={row.name} photoUrl={row.photoUrl ?? null} seed={row.membershipId} size={56} />
        </span>
      )}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {href ? (
            <Link href={href} onClick={onLeave} className={buttonClass('primary', 'h-12 w-full rounded-pill text-md font-bold')}>
              {o.openProfile}
            </Link>
          ) : <span aria-hidden="true" />}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              data-card-whatsapp=""
              className="flex h-12 items-center justify-center gap-1.5 rounded-pill bg-whatsapp text-md font-bold text-white"
            >
              <LineIcon name="whatsapp" className="h-5 w-5" />
              {o.whatsApp}
            </a>
          ) : canSavePhone && !row.isReader ? (
            <span className="flex items-center justify-center">
              <MemberContactButtons membershipId={row.membershipId} name={row.name} phone={null} channels={['whatsapp']} onSaved={setPhone} />
            </span>
          ) : <span aria-hidden="true" />}
        </div>
      )}
    >
      <dl data-person-card-numbers="" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Figure label={o.cardSalesLeads} value={number(row.periodLeads.sales)}>
          <span className="text-primary-ink">{o.potensiCount({ n: row.potensi.sales })}</span>
        </Figure>
        <Figure label={o.cardRecruitLeads} value={number(row.periodLeads.recruitment)}>
          <span className="text-lavender">{o.potensiCount({ n: row.potensi.recruitment })}</span>
        </Figure>
        <Figure
          label={o.goalProgress}
          value={pct === null ? '–' : formatPercent(pct, {}, figures)}
          tone={tone === 'green' ? 'text-signal-green' : tone === 'navy' ? 'text-navy' : undefined}
        >
          {measured
            ? formatRupiahCompactPair(goal.actualMinor!, goal.targetMinor!, '/', figures)
            : goal.set === false || goal.targetMinor === null ? t.own.noGoal
              : goal.targetMinor === 0 ? t.own.targetMade : t.own.notUploaded}
        </Figure>
        <Figure label={o.activity} value={number(row.activity7d)}>{o.last7}</Figure>
      </dl>
      <CoachingStatusTile status={row.coaching.status} days={row.coaching.days} fill className="mt-3 rounded-[10px] py-2" />
    </Modal>
  );
}

/** One of the card's four: its name, the figure, and the line under it. */
function Figure({ label, value, tone, children }: { label: string; value: string; tone?: string; children: ReactNode }) {
  return (
    <div data-card-figure="" className="min-w-0 rounded-[14px] bg-hover-row px-3 py-2.5">
      <dt className="whitespace-nowrap text-sm text-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-xl font-bold leading-tight tabular-nums text-ink', tone)}>{value}</dd>
      <dd className="mt-0.5 truncate text-sm text-muted">{children}</dd>
    </div>
  );
}
