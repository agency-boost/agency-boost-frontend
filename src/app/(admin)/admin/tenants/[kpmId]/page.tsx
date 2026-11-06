'use client';

import { useRouter } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Dialog } from '@/components/ui/dialog';
import { SaveAsTemplateDialog } from '@/components/save-as-template-dialog';
import { ActivityBindingCard } from '@/components/activity-binding-card';
import { KpmBillingTab } from '@/components/admin/kpm-billing-tab';
import { KpmDataTab, KpmMonthGrid, KpmMonthGridSkeleton, useKpmData } from '@/components/admin/kpm-data-tab';
import { KpmOwnerCard } from '@/components/admin/kpm-owner-card';
import { PlatformMembers } from '@/components/admin/platform-members';
import { RouteTabs } from '@/components/ui/route-tabs';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { ChoiceField, ChoicePill } from '@/components/ui/rows-and-sheets';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import {
  deleteTenant,
  moveTenantCompany,
  readTenant,
  readTenantContents,
  setTenantStatus,
  subscriptionLine,
  tenantStatusLabels,
  tenantStatusTone,
  tenantStatusWord,
  type TenantRow,
  type TenantStatus,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { listInsurers, type Insurer } from '@/lib/companies';
import { savedTemplateSentence } from '@/lib/templates';
import { useCan } from '@/lib/session';
import { formatNumber } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { useQuery } from '@/lib/use-query';

export default function TenantDetailPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const t = useMessages(adminOfficesMessages).detail;
  const r = useMessages(adminPlatformReadsMessages).kpm;
  const language = useLanguage();
  const [kpm, setKpm] = useState<TenantProfile | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** *Save as template* (P13.2-T7): the dialog, and what the last save made, said once it is made. */
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Convenience: the API refuses anybody without it (`company_template:write`, the Super Admin's).
  const canSaveTemplate = useCan('company_template:write');
  // P19-T3 (ADR-0191 §5): moving and deleting an office are the Super Admin's; the API refuses anybody else.
  const canMove = useCan('kpm:update_company_tag');
  const canDelete = useCan('kpm:archive');
  // P19.4-T3 (ADR-0207, ADR-0211): the tabs the Super Admin's grants open; the API refuses anybody else in any case.
  const canMembers = useCan('platform_members:read');
  const canFigures = useCan('platform_kpm_figures:read');
  const canBilling = useCan('billing:read_prices');
  /** What the last move said, once it is done. */
  const [moved, setMoved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKpm(await readTenant(kpmId) as TenantProfile);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [kpmId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Page title={t.title}>
        <ErrorBanner {...error} />
      </Page>
    );
  }

  if (!kpm) {
    return (
      <Page title={t.title}>
        <SkeletonCards count={3} label={t.loading} />
      </Page>
    );
  }

  return (
    <Page
      title={`${kpm.code} · ${kpm.branchName}`}
      actions={(
        <div className="flex flex-wrap items-center gap-3">
          {/* The list's word, so an ended office reads the same on both (P13.2-T3 AC-8). */}
          <StatusPill status={tenantStatusTone(kpm)} label={tenantStatusWord(kpm, language)} />
          {/* P13.2-T7 (ADR-0115 §5): this office's published settings, as a company's template. */}
          {canSaveTemplate && (
            <Button variant="secondary" onClick={() => { setSaved(null); setSaving(true); }}>
              {t.saveAsTemplate}
            </Button>
          )}
        </div>
      )}
    >
      <SaveAsTemplateDialog
        open={saving}
        kpm={kpm}
        onClose={() => setSaving(false)}
        onSaved={(template, company) => {
          setSaving(false);
          // With what it left out because it names something archived, in the API's words (exit review, finding 2).
          setSaved(savedTemplateSentence(template, company?.name ?? kpm.companyName, language));
        }}
      />
      {/* Polite, and only once there is something to say: the dialog has closed on it. */}
      <p role="status" className={saved || moved ? 'mb-4 text-md text-navy' : 'sr-only'}>{saved ?? moved ?? ''}</p>
      <Suspense fallback={null}>
        <KpmTabs
          kpm={kpm}
          tabs={{ members: canMembers, figures: canFigures, billing: canBilling }}
          summary={(
            <SummaryTab
              kpm={kpm}
              figures={canFigures}
              onChanged={async (next) => { setKpm((now) => (now ? { ...now, ...next } : now)); await load(); }}
              profile={(
                <Card>
                  <h2 className="font-display text-lg font-bold text-navy">{t.profile}</h2>
                  <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-md">
                    {/* The one id on this screen that stays (`04-managing-a-kpm.md`: support asks for it). */}
                    <Detail
                      term={t.kpmId}
                      detail={<code className="select-all text-sm">{kpm._id}</code>}
                    />
                    <Detail term={t.company} detail={kpm.companyName} />
                    <Detail term={t.code} detail={kpm.code} />
                    <Detail term={t.branch} detail={kpm.branchName} />
                    <Detail term={t.address} detail={kpm.address ?? '—'} />
                    <Detail term={t.phone} detail={kpm.contactPhone ?? '—'} />
                    <Detail term={t.timeZone} detail={kpm.timezone} />
                    <Detail term={t.currency} detail={kpm.currency} />
                  </dl>
                  {canMove && (
                    <MoveCompany
                      kpm={kpm}
                      onMoved={(next) => { setSaved(null); setKpm((now) => ({ ...now, ...next } as TenantProfile)); setMoved(t.moved({ company: next.companyName })); }}
                    />
                  )}
                </Card>
              )}
              lifecycle={<StatusCard kpm={kpm} onChanged={load} canDelete={canDelete} />}
            />
          )}
        />
      </Suspense>
      <span className="sr-only">{r.tabs}</span>
    </Page>
  );
}

/** The Super Admin's read of a KPM: the admin view, and *Ringkasan*'s Admins and counts by rung (P19.4-T3 AC-9). */
type TenantProfile = TenantRow & {
  admins?: { fullName: string; state: 'active' | 'invited' | 'not_invited' }[];
  membersByRole?: { code: string; label: string; count: number }[];
};

type KpmTab = 'ringkasan' | 'anggota' | 'data' | 'billing';

/**
 * ***Ringkasan · Anggota · Data bulanan · Lihat sebagai KPM · Billing*** (P19.4-T3 AC-9, AC-10; the setup spec's A2;
 * the route registry: four in the query, `?tab=`, *Ringkasan* when absent; *Lihat sebagai KPM* its own route). A tab the
 * reader's grants do not open is not drawn.
 */
function KpmTabs({ kpm, tabs, summary }: {
  kpm: TenantProfile;
  tabs: { members: boolean; figures: boolean; billing: boolean };
  summary: React.ReactNode;
}) {
  const r = useMessages(adminPlatformReadsMessages).kpm;
  const query = useQuery();
  const asked = typeof query.tab === 'string' ? query.tab : 'ringkasan';
  const allowed: Record<KpmTab, boolean> = { ringkasan: true, anggota: tabs.members, data: tabs.figures, billing: tabs.billing };
  const tab: KpmTab = (asked in allowed && allowed[asked as KpmTab]) ? asked as KpmTab : 'ringkasan';
  const base = `/admin/tenants/${kpm._id}`;
  const href = (key: KpmTab) => (key === 'ringkasan' ? base : `${base}?tab=${key}`);
  return (
    <>
      <RouteTabs
        label={r.tabs}
        activeHref={href(tab)}
        tabs={[
          { href: href('ringkasan'), label: r.tab.ringkasan },
          ...(tabs.members ? [{ href: href('anggota'), label: r.tab.anggota }] : []),
          ...(tabs.figures ? [{ href: href('data'), label: r.tab.data }] : []),
          ...(tabs.figures ? [{ href: `${base}/analytics`, label: r.tab.lihat }] : []),
          ...(tabs.billing ? [{ href: href('billing'), label: r.tab.billing }] : []),
        ]}
      />
      {tab === 'ringkasan' && summary}
      {tab === 'anggota' && (
        <div className="flex flex-col gap-3">
          <p className="text-md text-muted">{r.membersReadOnly}</p>
          <PlatformMembers kpmId={kpm._id} />
        </div>
      )}
      {tab === 'data' && <KpmDataTab kpmId={kpm._id} />}
      {tab === 'billing' && <KpmBillingTab kpm={kpm} />}
    </>
  );
}

/**
 * ***Ringkasan*** (P19.4-T3 AC-9; A2): with no member, *"Belum ada anggota"* saying the Owner imports — no link to an
 * import (UI-151); the Owner's card (*Kirim ulang undangan*, *Ganti pemilik*); the Admins, read-only (delegation is the
 * Owner's, roles §3.3: no *+ Tambah admin*); the members by rung; the 12-month grid; then the KPM's own cards — its
 * profile, its lifecycle and its activity binding, which only the KPM's Owner or an Admin sets.
 */
function SummaryTab({ kpm, figures, onChanged, profile, lifecycle }: {
  kpm: TenantProfile;
  figures: boolean;
  onChanged: (next: TenantRow) => void | Promise<void>;
  profile: React.ReactNode;
  lifecycle: React.ReactNode;
}) {
  const r = useMessages(adminPlatformReadsMessages).kpm;
  const fig = useFigureLanguage();
  const admins = kpm.admins ?? [];
  const byRole = kpm.membersByRole ?? [];
  return (
    <div className="flex flex-col gap-4">
      {kpm.membersBesidesOwner === 0 && (
        <div role="note" className="rounded-lg border border-primary/40 bg-primary/15 px-4 py-3 text-md text-navy">
          <strong className="font-semibold">{r.noMembers}</strong> {r.noMembersLine}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <KpmOwnerCard kpm={kpm} onChanged={onChanged} />
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{r.admins}</h2>
          {admins.length === 0 ? (
            <p className="mt-2 text-md text-muted">{r.adminsNone}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {admins.map((a) => (
                <li key={a.fullName} className="flex flex-wrap items-center gap-2 text-md text-navy">
                  {a.fullName}
                  <StatusPill status={a.state === 'active' ? 'success' : 'neutral'} label={r.adminState[a.state]} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted">{r.adminsHint}</p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{r.membersCard}</h2>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-navy">{formatNumber(kpm.memberCount, {}, fig)}</p>
          {byRole.length > 0 && (
            <p className="text-sm text-muted" aria-label={r.membersByRole}>
              {byRole.map((rung) => `${rung.label} ${formatNumber(rung.count, {}, fig)}`).join(' · ')}
            </p>
          )}
        </Card>
      </div>
      {figures && <SummaryGrid kpmId={kpm._id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {profile}
        {lifecycle}
        {/* P18.6-T2 (ADR-0163): which activities the summary counts at each cascade stage — read-only here since
            P19.4-T3: the KPM's Owner or an Admin sets it (ADR-0206 §1). */}
        <ActivityBindingCard kpmId={kpm._id} />
      </div>
    </div>
  );
}

/** *Ringkasan*'s 12-month grid, read from `GET /admin/tenants/:id/data` (audited per read). */
function SummaryGrid({ kpmId }: { kpmId: string }) {
  const { view, error } = useKpmData(kpmId);
  if (error) return <ErrorBanner {...error} />;
  if (!view) return <KpmMonthGridSkeleton />;
  return <KpmMonthGrid months={view.months} />;
}

function Detail({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="break-words text-navy">{detail}</dd>
    </>
  );
}

/**
 * ***Pindahkan ke perusahaan lain*** (ADR-0191 §5, P19-T3 AC-6; UI-168 point 4): a company and one button, under the
 * Profile's *Company*. The API moves only an office with no member but its Owner, provisioning its settings again from
 * the new company's default template, and refuses anything else with the reason, shown here.
 */
function MoveCompany({ kpm, onMoved }: { kpm: TenantRow; onMoved: (next: TenantRow) => void }) {
  const { detail: t, cancel } = useMessages(adminOfficesMessages);
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134: *a pill that opens a sheet for long lists (company)*). */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [open, setOpen] = useState(false);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    void listInsurers().then(setInsurers).catch(() => setInsurers([]));
  }, [open]);

  if (!open) {
    return (
      <Button variant="inline" className="mt-3" onClick={() => setOpen(true)}>
        {t.changeCompany}
      </Button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onMoved(await moveTenantCompany(kpm._id, target));
      setOpen(false);
      setTarget('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
      {error && <ErrorBanner {...error} />}
      <Field label={t.newCompany} htmlFor="new-company" hint={t.moveHint}>
        {belowLaptop ? (
          // Says *Perusahaan baru* until one is chosen, as the select's empty option did.
          <ChoicePill
            id="new-company"
            name={t.newCompany}
            options={insurers.filter((c) => c._id !== kpm.companyId).map((c) => ({ key: c._id, label: c.name }))}
            value={target}
            onChange={setTarget}
            narrows={false}
            shows="value"
            className="self-start"
          />
        ) : (
          <Select id="new-company" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="" />
            {insurers.filter((c) => c._id !== kpm.companyId).map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !target}>{busy ? t.moving : t.move}</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setError(null); }}>{cancel}</Button>
      </div>
    </form>
  );
}

function StatusCard({
  kpm, onChanged, canDelete,
}: { kpm: TenantRow; onChanged: () => Promise<void>; canDelete: boolean }) {
  const { detail: t, saving, office } = useMessages(adminOfficesMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const router = useRouter();
  const labels = tenantStatusLabels(language);
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134: *choice rows for 2–5 options*): the three states. */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [status, setStatus] = useState<TenantStatus>(kpm.status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** *Hapus KPM*'s question, with the counts it was asked with (P19-T3 AC-7). */
  const [asking, setAsking] = useState<{ members: number; records: number; deletable: boolean } | null>(null);
  const named = office({ code: kpm.code, branch: kpm.branchName });

  /** Count first: an empty office is deleted, one with people or data is offered *Arsipkan* (ADR-0191 §5). */
  async function askToDelete() {
    setError(null);
    try {
      setAsking(await readTenantContents(kpm._id));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  async function confirmed() {
    const contents = asking;
    setAsking(null);
    if (!contents) return;
    setBusy(true);
    setError(null);
    try {
      if (contents.deletable) {
        await deleteTenant(kpm._id);
        router.push('/admin/tenants');
        return;
      }
      await setTenantStatus(kpm._id, 'archived');
      await onChanged();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setTenantStatus(kpm._id, status, reason || undefined);
      setReason('');
      await onChanged();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{t.lifecycle}</h2>
      <p className="mt-1 text-md text-muted">{t.lifecycleLine}</p>
      {kpm.suspendedReason && (
        <p className="mt-2 text-md text-alert">{t.suspended({ reason: kpm.suspendedReason })}</p>
      )}
      {/* P13.2-T3 AC-8: where the subscription stands, beside the office's own status. It is edited
          on the offices list, where the client asked for it. */}
      <p className="mt-2 text-md text-navy">
        <span className="text-muted">{t.subscription}</span>
        {subscriptionLine(kpm, figures, language)}
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        {error && <ErrorBanner {...error} />}
        {belowLaptop ? (
          <ChoiceField<TenantStatus>
            id="status"
            label={t.status}
            value={status}
            onChange={setStatus}
            disabled={busy}
            options={(Object.keys(labels) as TenantStatus[]).map((s) => ({ key: s, label: labels[s] }))}
          />
        ) : (
          <Field label={t.status} htmlFor="status">
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantStatus)}
            >
              {(Object.keys(labels) as TenantStatus[]).map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t.reason} htmlFor="reason" hint={t.reasonHint}>
          <TextInput
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={status === 'suspended'}
          />
        </Field>
        <Button type="submit" disabled={busy || (status === kpm.status && !reason)}>
          {busy ? saving : t.apply}
        </Button>
      </form>
      {canDelete && (
        <Button variant="inlineDanger" className="mt-3" disabled={busy} onClick={() => void askToDelete()}>
          {t.deleteOffice}
        </Button>
      )}
      <Dialog
        open={asking !== null}
        message={asking
          ? (asking.deletable ? t.deleteAsk : t.cannotDelete)({ office: named, members: asking.members, records: asking.records })
          : ''}
        confirmLabel={asking?.deletable ? t.deleteOffice : t.archive}
        tone="danger"
        onCancel={() => setAsking(null)}
        onConfirm={() => void confirmed()}
      />
    </Card>
  );
}
