'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusPill } from '@/components/ui/status-pill';
import { useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { cn } from '@/lib/cn';
import { drillsAnywhere, unitDashboardHref } from '@/lib/kpm-analytics';
import { COMPLIANCE_PILL_CLASS, type CompliancePerson, type PillWords, type TagTone } from '@/lib/kpm-compliance';
import { useSession } from '@/lib/session';

/** `.status-pill` (`KPM_Owner.html:564-568`): the words always drawn, the tint behind them. */
export function CompliancePill({ words }: { words: PillWords }) {
  return words.tone === 'watch'
    ? <StatusPill status="watch" label={words.label} className={COMPLIANCE_PILL_CLASS} />
    : <StatusPill status={words.tone} label={words.label} className={COMPLIANCE_PILL_CLASS} />;
}

/**
 * A name in the tree (D-drill; the prototype's alerts, `:4855-4867`, contradiction 13): somebody who leads opens
 * their Unit Dashboard in a new tab, as the comparison's leaders do, and says so; anybody else opens their
 * person page in this tab. **Inside a support session the Unit Dashboard opens in the same tab**: the session's
 * token lives in this tab's memory only, so a new tab would open as the Super Admin, who has no office.
 * Following one writes nothing.
 */
export function PersonLink({ person, className, children }: { person: CompliancePerson; className?: string; children?: ReactNode }) {
  // The new-tab hint is the comparison's own, so the two drills say it in the same words.
  const t = useMessages(kpmAnalyticsMessages);
  const { me } = useSession();
  const isReader = person.membershipId === me?.membership?.membershipId;
  const style = cn('text-navy hover:text-amber-ink hover:underline', className);
  // A Core Leader opens their own unit alone (ADR-0159 §2): anybody else's name is plain text, not a link to a refusal.
  if (!drillsAnywhere(me, isReader && person.leads)) return <span className={cn('text-navy', className)}>{children ?? person.name}</span>;
  if (!person.leads) {
    return <Link href={`/people/members/${person.membershipId}`} className={style}>{children ?? person.name}</Link>;
  }
  const newTab = !me?.isImpersonating;
  return (
    <Link
      href={unitDashboardHref({ membershipId: person.membershipId, isReader })}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className={style}
    >
      {children ?? person.name}
      {newTab && <span className="sr-only">{isReader ? t.newTabOwn : t.newTab}</span>}
    </Link>
  );
}

/**
 * `.role-tag` (`:168-171`). **Navy words on each tint**: the prototype's blue on its 10% wash and amber-dark on
 * its 14% are under 4.5:1 at this size, so the tint carries the colour and the words the meaning, as the
 * comparison's tags do (F-126's paint for *Personal*).
 */
const ROLE_TAG: Record<'AB' | 'AAB' | 'personal', string> = {
  AB: 'bg-navy/[0.08] text-navy',
  AAB: 'bg-info/10 text-navy-soft',
  personal: 'bg-amber/[0.14] text-navy',
};

export function RoleTag({ kind, children }: { kind: keyof typeof ROLE_TAG; children: ReactNode }) {
  return (
    <span
      className={cn(
        'ml-1.5 inline-block whitespace-nowrap rounded-pill px-[7px] py-0.5 align-[1px] text-2xs font-bold uppercase tracking-wide',
        ROLE_TAG[kind],
      )}
    >
      {children}
    </span>
  );
}

/**
 * `.type-tag` (`:132-137`): the picked event's or campaign's kind. *Structural* is `--color-club-chairman`, F-182's
 * token for the prototype's raw `#5B3CC4` (contradiction 19), its words on its own 12% tint at 6.03:1; *Upcoming*
 * navy-soft on the blue wash, where the prototype's blue on it is under 4.5:1.
 */
const TYPE_TAG: Record<TagTone, string> = {
  upcoming: 'bg-info/10 text-navy-soft',
  past: 'bg-navy/[0.08] text-navy',
  structural: 'bg-club-chairman/[0.12] text-club-chairman',
  ongoing: 'bg-success/10 text-success',
};

export function TypeTag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return (
    <span className={cn('whitespace-nowrap rounded-pill px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide', TYPE_TAG[tone])}>
      {children}
    </span>
  );
}
