'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { buttonClass, ErrorBanner, Switch } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonText } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminMembersMessages } from '@/i18n/messages/admin-members';
import {
  readMemberDetail, setTestAccount, type AnggotaRow, type LastActiveStatus, type MemberDetail,
} from '@/lib/admin-members';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonth } from '@/lib/format';
import { whatsAppHref } from '@/lib/phone-number';
import { enterKpm } from '@/lib/super-admin-kpm';
import { MemberName } from './member-name';


/** A detail nobody gave: a dash, the same in both languages (no message holds it). */
const NONE = '—';
/**
 * ***Anggota*'s detail** (P19.23-T3 AC-1; the Super Admin spec §6; mockup `memDet`, tablet and phone frame 26): a dialog
 * from 1024px, a bottom sheet below it (§12, `ResponsiveSheet`). The person's photo, the orange label and NAME, the
 * *Owner* tag, *KPM · company*; then *Telepon · Email · Bergabung · Terakhir pakai · Status · Upline* in a two-column grid
 * (one on a phone); then *WhatsApp* and *Buka di KPM*, and the line saying where the role, the leader and removal are
 * changed. **Below them the *Akun tes* switch** (ADR-0267 §1; OD-421): the platform's one place to flag an account, or
 * unflag one flagged by mistake — written on the account and every membership together, audited.
 *
 * - **The row's facts are drawn at once**; the phone and the email arrive with the detail read (`GET
 *   /admin/members/:id`, audited per read), a skeleton where they will be meanwhile, its error in place of them.
 * - ***Buka di KPM*** enters the member's KPM as its Owner (`enterKpm`, ADR-0268 §3) and opens their page in the KPM's own
 *   *All members* — where the role, the leader and removal are changed (the spec: *"role / leader / remove are changed
 *   inside that KPM"*).
 * - ***WhatsApp*** opens the chat (`wa.me`, OD-359) on the number on file; with none it is not offered as a link.
 */
export function MemberDetailSheet({
  row,
  onClose,
  onTestAccountChanged,
}: {
  row: AnggotaRow;
  onClose: () => void;
  /** The flag changed: the list is read again, since the person leaves it (or joins *Akun tes*). */
  onTestAccountChanged: () => void;
}) {
  const t = useMessages(adminMembersMessages);
  const figures = useFigureLanguage();
  const router = useRouter();
  const { show } = useToast();
  const switchId = useId();
  const hintId = useId();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [testAccount, setTestFlag] = useState(row.testAccount);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readMemberDetail(row.membershipId)
      .then((next) => {
        if (!live) return;
        setDetail(next);
        setTestFlag(next.testAccount);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [row.membershipId]);

  const shown = detail ?? row;
  const chat = detail ? whatsAppHref(detail.phone) : null;

  async function flip(next: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      const answer = await setTestAccount(shown.userId, next);
      setTestFlag(answer.testAccount);
      show(answer.testAccount ? t.detail.testOn({ name: shown.fullName }) : t.detail.testOff({ name: shown.fullName }));
      onTestAccountChanged();
    } catch (err) {
      setSaveError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  }

  const openInKpm = () => {
    enterKpm(shown.kpm.id);
    router.push(`/people/members/${encodeURIComponent(shown.membershipId)}`);
  };

  const facts: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    {
      label: t.detail.phone,
      value: detail === null
        ? <Pending error={error} />
        : detail.phone ?? <span className="text-muted">{t.detail.noPhone}</span>,
    },
    { label: t.detail.email, value: detail === null ? <Pending error={error} /> : <span className="break-all">{detail.email}</span> },
    { label: t.detail.joined, value: shown.joinedOn ? formatMonth(shown.joinedOn.slice(0, 7), figures) : NONE },
    { label: t.detail.lastUsed, value: <LastUsedPill days={shown.lastActive.days} status={shown.lastActive.status} /> },
    { label: t.detail.status, value: <StatusPill status={shown.status} /> },
    { label: t.detail.upline, value: shown.leader ? <span className="font-bold uppercase text-ink">{shown.leader.fullName}</span> : NONE },
  ];

  return (
    <ResponsiveSheet
      open
      title={t.detail.title}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {chat ? (
            <a
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('secondary', 'min-h-11 w-full justify-center')}
            >
              <NavIcon name="whatsapp" className="h-5 w-5" />
              {t.detail.whatsApp}
            </a>
          ) : (
            <button type="button" disabled className={buttonClass('secondary', 'min-h-11 w-full justify-center')}>
              <NavIcon name="whatsapp" className="h-5 w-5" />
              {t.detail.whatsApp}
            </button>
          )}
          <button type="button" onClick={openInKpm} className={buttonClass('primary', 'min-h-11 w-full justify-center')}>
            <NavIcon name="building" className="h-5 w-5" />
            {t.detail.openInKpm}
          </button>
        </div>
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar name={shown.fullName} photoUrl={shown.avatarUrl} seed={shown.userId} size={48} />
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <MemberName name={shown.fullName} role={shown.role} className="text-lg" />
            <MemberTags row={shown} testAccount={testAccount} />
          </span>
          <span className="block truncate text-sm text-muted">{`${shown.kpm.branch} · ${shown.company.name}`}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg bg-base p-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs font-semibold text-muted">{f.label}</dt>
            <dd className="min-w-0 text-md font-semibold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-center text-xs text-muted">{t.detail.changeNote}</p>

      <div className="mt-4 border-t border-hairline pt-3">
        <Switch
          id={switchId}
          label={t.detail.testSwitch}
          checked={testAccount}
          disabled={saving}
          describedBy={hintId}
          onChange={(next) => void flip(next)}
          phoneTarget
          tabletTarget
        />
        <p id={hintId} className="mt-1 text-xs text-muted">{t.detail.testHint}</p>
        {saveError && <div className="mt-2"><ErrorBanner {...saveError} /></div>}
      </div>
    </ResponsiveSheet>
  );
}

/** Where the phone or the email will be: a short skeleton while the read runs, a dash if it failed (the banner says why). */
function Pending({ error }: { error: ApiError | null }) {
  if (error) {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-muted">{NONE}</span>
        <span className="text-xs font-normal text-alert" role="alert">{error.message}</span>
      </span>
    );
  }
  return <SkeletonText lines={1} className="w-28" />;
}

/** *Owner* (and *Admin*) beside the name, and *Akun tes* on a test account — each a word, never a colour alone. */
export function MemberTags({ row, testAccount = row.testAccount }: { row: Pick<AnggotaRow, 'role'> & { testAccount: boolean }; testAccount?: boolean }) {
  const t = useMessages(adminMembersMessages);
  return (
    <>
      {row.role.isOwner && <Chip>{t.owner}</Chip>}
      {!row.role.isOwner && row.role.isAdmin && <Chip>{t.admin}</Chip>}
      {testAccount && <Chip tone="test">{t.testTag}</Chip>}
    </>
  );
}

function Chip({ children, tone = 'steward' }: { children: React.ReactNode; tone?: 'steward' | 'test' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill px-1.5 text-2xs font-bold leading-4',
        tone === 'steward' ? 'bg-pill-blue text-pill-blue-ink' : 'bg-pill-grey text-pill-grey-ink',
      )}
    >
      {children}
    </span>
  );
}

const LAST_USED_TONE: Record<LastActiveStatus, 'green' | 'red'> = { recent: 'green', lapsed: 'red', never: 'red' };

/**
 * ***Terakhir pakai*** (the mockup's pill): *Hari ini*, *n hari lalu*, *Belum pernah* — green while the server's bucket
 * is `recent` (within 14 days), red otherwise (the spec: *"green ≤ 14 days, red otherwise"*). The words carry it; the
 * colour is never the only cue.
 */
export function LastUsedPill({ days, status }: { days: number | null; status: LastActiveStatus }) {
  const t = useMessages(adminMembersMessages);
  const words = days === null ? t.lastUsed.never : days === 0 ? t.lastUsed.today : t.lastUsed.daysAgo({ days });
  return <TonePill tone={LAST_USED_TONE[status]}>{words}</TonePill>;
}

function StatusPill({ status }: { status: AnggotaRow['status'] }) {
  const t = useMessages(adminMembersMessages);
  return <TonePill tone={status === 'active' ? 'green' : status === 'pending' ? 'amber' : 'grey'}>{t.memberStatus[status]}</TonePill>;
}
