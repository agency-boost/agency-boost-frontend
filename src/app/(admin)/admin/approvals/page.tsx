'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApproveKpmDialog, approvableAsAsked, DeclineDialog } from '@/components/admin/approval-dialogs';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { RowMenu } from '@/components/ui/rows-and-sheets';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useToast } from '@/components/ui/toast';
import { rungShort } from '@/components/ui/role-badge';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminApprovalsMessages } from '@/i18n/messages/admin-approvals';
import { approveKpmRequest, declineKpmRequest, deleteKpmRequest, type KpmRequestRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { APPROVALS_CHANGED, readApprovals, type Approval } from '@/lib/approvals';
import { listInsurers, type Insurer } from '@/lib/companies';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  approveLeaderLimitRequest, declineLeaderLimitRequest, LEADER_LIMIT_QUEUE_CHANGED, requestedChange,
  type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';

type Tab = 'waiting' | 'decided';

/**
 * ***Persetujuan*** (`/admin/approvals`; P19.23-T3 AC-2; the Super Admin spec of 20 November 2026, §8; mockup `saApr`,
 * tablet and phone frames 41–42; ADR-0277) — everything waiting for the Super Admin, in one list, the rail's fifth item.
 * It replaces *Pending KPM requests* and *Leaders past the limit*, whose addresses now redirect here.
 *
 * - **Two tabs, one row of equal widths** (§12): *Menunggu n* and *Sudah diputuskan*.
 * - **Menunggu**: a row per request, newest first, its kind's icon — **a new KPM registration** (*KPM baru · <name>*,
 *   *<company> · diajukan <NAME> (calon owner) · <when>*) and **a leader past the plan limit** (*Leader melewati batas ·
 *   <KPM> (<company>)*, *<NAME> Agent → AAB · paket n leader, sekarang m · diajukan <NAME>*) — each with *Tolak* and
 *   *Setujui*. **Setujui is one press** (OD-421's sibling, ADR-0277): a KPM registration is made with the next free code
 *   and the company's template, its applicant its Owner; where the applicant cannot own it as asked (another company, no
 *   company, an unverified address) the press opens *Atur & setujui* instead. ⋯ on a KPM registration keeps *Atur &
 *   setujui* (company, code, *Mulai dari*) and *Hapus permintaan* (ADR-0191, ADR-0213; parity I-1188).
 * - ***Tolak*** asks a reason — optional for a KPM registration, required for a leader past the limit (sent to the asker).
 * - **Sudah diputuskan**: the result (*Disetujui* green · *Ditolak* red · *Dibatalkan* grey), the day and who decided.
 * - **Every state**: a skeleton while both queues are read, each tab's own empty line, the refusal with *Coba lagi*; a
 *   decision's refusal (a stale leader request, a code taken) above the list, and the queues read again.
 */
export default function ApprovalsPage() {
  const t = useMessages(adminApprovalsMessages);
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>('waiting');
  const [rows, setRows] = useState<Approval[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Approval | null>(null);
  const [settingUp, setSettingUp] = useState<KpmRequestRow | null>(null);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    try {
      setRows(await readApprovals());
      setLoadError(null);
    } catch (err) {
      setLoadError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load, attempt]);
  useEffect(() => { void listInsurers().then(setInsurers).catch(() => setInsurers([])); }, []);

  /** Every decision: its own write, then both queues read again, and the nav's count told. */
  async function decide(id: string, work: () => Promise<unknown>, said: string) {
    setBusy(id);
    setError(null);
    try {
      await work();
      show(said);
    } catch (err) {
      setError(toDisplayError(err));
      throw err;
    } finally {
      setBusy(null);
      await load();
      window.dispatchEvent(new Event(APPROVALS_CHANGED));
      window.dispatchEvent(new Event(LEADER_LIMIT_QUEUE_CHANGED));
    }
  }

  const approve = (a: Approval) => {
    if (a.kind === 'kpm' && !approvableAsAsked(a.row)) {
      setSettingUp(a.row);
      return;
    }
    void decide(a.id, () => (a.kind === 'kpm' ? approveKpmRequest(a.id) : approveLeaderLimitRequest(a.id)), t.approvedToast)
      .catch(() => undefined);
  };

  const waiting = rows?.filter((r) => r.status === 'pending') ?? [];
  const decided = rows?.filter((r) => r.status !== 'pending') ?? [];

  return (
    <Page title={t.title} permission="kpm_request:read">
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      <Segmented
        label={t.tabs}
        tabs={[{ id: 'waiting', label: t.waiting({ n: waiting.length }) }, { id: 'decided', label: t.decided }]}
        active={tab}
        onSelect={(id) => setTab(id as Tab)}
        phoneLayout="wrap"
        className="sm:max-w-md"
      >
        {(active) => (
          <div className="flex flex-col gap-3 pt-3">
            {loadError && (
              <div className="flex flex-col gap-2">
                <ErrorBanner {...loadError} />
                <Button variant="secondary" className="min-h-11 self-start" onClick={() => setAttempt((n) => n + 1)}>
                  {t.retry}
                </Button>
              </div>
            )}
            {!loadError && rows === null && <SkeletonCards count={3} label={t.loading} />}
            {rows && (
              <ApprovalList
                rows={active === 'waiting' ? waiting : decided}
                waiting={active === 'waiting'}
                busy={busy}
                onApprove={approve}
                onDecline={setDeclining}
                onSetUp={setSettingUp}
                onRemove={(row) => decide(row.requestId, () => deleteKpmRequest(row.requestId), t.removedToast).catch(() => undefined)}
              />
            )}
            {rows && (
              // *"Semua yang perlu persetujuan…"* is not said on a phone (UI-213 (21 Nov)); from 768px as before.
              <p className={cn('text-xs text-muted', active === 'waiting' && 'max-md:hidden')}>{active === 'waiting' ? t.waitingNote : t.decidedNote}</p>
            )}
          </div>
        )}
      </Segmented>

      {declining && (
        <DeclineDialog
          subject={declining.kind === 'kpm' ? t.kpmTitle({ branch: declining.row.branchName }) : declining.row.subjectName}
          required={declining.kind === 'limit'}
          onCancel={() => setDeclining(null)}
          onConfirm={async (reason) => {
            const a = declining;
            await decide(
              a.id,
              () => (a.kind === 'kpm' ? declineKpmRequest(a.id, reason || undefined) : declineLeaderLimitRequest(a.id, reason)),
              t.declinedToast,
            );
            setDeclining(null);
          }}
        />
      )}

      {settingUp && (
        <ApproveKpmDialog
          row={settingUp}
          insurers={insurers}
          onCancel={() => setSettingUp(null)}
          onApprove={async (choice) => {
            const row = settingUp;
            await decide(row.requestId, () => approveKpmRequest(row.requestId, choice.code, choice.companyId, choice.startFrom), t.approvedToast);
            setSettingUp(null);
          }}
          onRemove={async () => {
            const row = settingUp;
            await decide(row.requestId, () => deleteKpmRequest(row.requestId), t.removedToast);
            setSettingUp(null);
          }}
        />
      )}
    </Page>
  );
}

/** One tab's rows, or its empty line. */
function ApprovalList({
  rows, waiting, busy, onApprove, onDecline, onSetUp, onRemove,
}: {
  rows: Approval[];
  waiting: boolean;
  busy: string | null;
  onApprove: (a: Approval) => void;
  onDecline: (a: Approval) => void;
  onSetUp: (row: KpmRequestRow) => void;
  onRemove: (row: KpmRequestRow) => void;
}) {
  const t = useMessages(adminApprovalsMessages);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-card-edge bg-card">
        <EmptyState title={waiting ? t.emptyWaiting : t.emptyDecided} />
      </div>
    );
  }
  return (
    <ul aria-label={waiting ? t.caption.waiting : t.caption.decided} className="rounded-lg border border-card-edge bg-card">
      {rows.map((a) => (
        <li
          key={`${a.kind}-${a.id}`}
          data-row={a.id}
          className="flex flex-col gap-3 border-b border-hairline px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center"
        >
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <KindIcon kind={a.kind} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-md font-bold text-navy">{titleOf(a, t)}</b>
              <Meta a={a} />
            </span>
          </span>
          {waiting ? (
            <span className="flex items-center gap-2 max-sm:w-full">
              <Button
                variant="secondary"
                className="min-h-11 max-sm:flex-1"
                disabled={busy !== null}
                onClick={() => onDecline(a)}
              >
                {t.decline}
              </Button>
              <Button className="min-h-11 max-sm:flex-1" disabled={busy !== null} onClick={() => onApprove(a)}>
                {busy === a.id ? t.approving : t.approve}
              </Button>
              {a.kind === 'kpm' && (
                <RowMenu
                  name={a.row.branchName}
                  items={[
                    { label: t.setUp, disabled: busy !== null, onSelect: () => onSetUp(a.row) },
                    { label: t.remove, tone: 'alert', disabled: busy !== null, onSelect: () => onRemove(a.row) },
                  ]}
                />
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2 self-start sm:self-center">
              <Result status={a.status} />
              {a.kind === 'kpm' && (
                <RowMenu
                  name={a.row.branchName}
                  items={[{ label: t.remove, tone: 'alert', disabled: busy !== null, onSelect: () => onRemove(a.row) }]}
                />
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

type Words = MessagesOf<typeof adminApprovalsMessages.en>;

/** *KPM baru · Surabaya Barat Branch*, or *Leader melewati batas · Tangerang Branch (Prudential)* — a KPM by its name. */
function titleOf(a: Approval, t: Words): string {
  return a.kind === 'kpm'
    ? t.kpmTitle({ branch: a.row.branchName })
    : t.limitTitle({ kpm: a.row.kpmBranchName, company: a.row.companyName });
}

/** The row's second line: who asked and when, or — decided — the facts, the day and who decided. */
function Meta({ a }: { a: Approval }) {
  const t = useMessages(adminApprovalsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const upper = (name: string) => name.toLocaleUpperCase('id-ID');
  const facts = a.kind === 'kpm'
    ? (a.status === 'pending'
      ? t.kpmMeta({ company: a.row.companyName, name: upper(a.row.requestedByName), when: when(a.row.requestedAt, t) })
      : t.kpmDecidedMeta({ company: a.row.companyName, name: upper(a.row.requestedByName) }))
    : (() => {
      const row = a.row as LeaderLimitRequestRow;
      const change = requestedChange(row, (code) => rungShort(code), language);
      const limit = row.maxLeaders === null ? t.noLimit : String(row.maxLeaders);
      return a.status === 'pending'
        ? t.limitMeta({ name: upper(row.subjectName), change, limit, used: row.leadersUsed, asker: upper(row.requestedByName) })
        : t.limitDecidedMeta({ name: upper(row.subjectName), change, limit });
    })();
  const reason = a.status === 'pending' ? null : a.kind === 'kpm' ? a.row.reason : a.row.declineReason;
  const decidedOn = a.decidedAt ? formatShortDay(dayInZone(OFFICE_TIME_ZONE, new Date(a.decidedAt)), {}, figures) : null;
  return (
    <span className="flex flex-col text-sm text-muted">
      <span>
        {facts}
        {decidedOn && ` · ${t.decidedBy({ date: decidedOn, name: upper(a.decidedByName ?? '—') })}`}
      </span>
      {reason && <span className="text-ink">{reason}</span>}
    </span>
  );
}

/** *hari ini*, *2 hari lalu* — whole office days since it was asked (invariant §9: the office's zone). */
function when(iso: string, t: Words): string {
  const day = (at: Date) => Date.parse(`${dayInZone(OFFICE_TIME_ZONE, at)}T00:00:00Z`);
  const days = Math.max(0, Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000));
  return days === 0 ? t.today : t.daysAgo({ days });
}

const KIND_ICON: Record<Approval['kind'], NavIconName> = { kpm: 'office', limit: 'userPlus' };

function KindIcon({ kind }: { kind: Approval['kind'] }) {
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pill-grey text-secondary-ink">
      <NavIcon name={KIND_ICON[kind]} className="h-5 w-5" />
    </span>
  );
}

/** *Disetujui* green, *Ditolak* red, *Dibatalkan* grey — the word carries it, the colour is never the only cue. */
function Result({ status }: { status: Approval['status'] }) {
  const t = useMessages(adminApprovalsMessages);
  if (status === 'pending') return null;
  const tone = status === 'approved' ? 'green' : status === 'declined' ? 'red' : 'grey';
  return <TonePill tone={tone} className="shrink-0">{t.result[status]}</TonePill>;
}
