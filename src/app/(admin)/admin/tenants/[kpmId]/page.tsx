'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ButtonLink, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  readTenant,
  setTenantStatus,
  TENANT_STATUS_LABEL,
  type Kpm,
  type TenantStatus,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

export default function TenantDetailPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const [kpm, setKpm] = useState<Kpm | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setKpm(await readTenant(kpmId));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [kpmId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Page title="Office">
        <ErrorBanner {...error} />
      </Page>
    );
  }

  if (!kpm) {
    return (
      <Page title="Office">
        <SkeletonCards count={3} label="Loading the office…" />
      </Page>
    );
  }

  return (
    <Page
      title={`${kpm.code} · ${kpm.branchName}`}
      subtitle="Provisioning and lifecycle. This console never reads the office's business data."
      actions={
        <StatusPill
          status={kpm.status === 'active' ? 'success' : kpm.status === 'suspended' ? 'alert' : 'neutral'}
          label={TENANT_STATUS_LABEL[kpm.status]}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Profile</h2>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-md">
            {/* The one id on this screen that stays, and the only one AC-7 exempts:
                `04-managing-a-kpm.md` tells the reader support will ask for it. The term
                was `Tenant id`, which is the vocabulary I-49 retired. `select-all` makes
                one click take the whole string — `CopyableValue` would be the obvious
                reach, but it is a boxed card with its own heading and would both repeat
                this row's label and make a support id the loudest thing on the card. */}
            <Detail
              term="KPM id"
              detail={<code className="select-all text-sm">{kpm._id}</code>}
            />
            <Detail term="Company" detail={kpm.companyName} />
            <Detail term="Code" detail={kpm.code} />
            <Detail term="Branch" detail={kpm.branchName} />
            <Detail term="Address" detail={kpm.address ?? '—'} />
            <Detail term="Phone" detail={kpm.contactPhone ?? '—'} />
            <Detail term="Time zone" detail={kpm.timezone} />
            <Detail term="Currency" detail={kpm.currency} />
          </dl>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Owner</h2>
          {kpm.ownerName ? (
            <p className="mt-2 text-md text-navy">
              <span className="font-semibold">{kpm.ownerName}</span>
              {kpm.ownerEmail && <span className="block text-sm text-muted">{kpm.ownerEmail}</span>}
            </p>
          ) : (
            <p className="mt-2 text-md text-alert">
              No owner. Nobody can administer this office until one is assigned.
            </p>
          )}
          <ButtonLink href={`/admin/tenants/${kpm._id}/owner`} variant="secondary" className="mt-3">
            {kpm.ownerName ? 'Transfer owner' : 'Assign owner'}
          </ButtonLink>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">People</h2>
          <p className="mt-1 text-md text-muted">
            Fill a new office from a spreadsheet rather than one person at a time. Each account
            is created with a password to pass on, and is asked to choose its own on first
            sign-in.
          </p>
          <ButtonLink
            href={`/admin/tenants/${kpm._id}/roster`}
            variant="secondary"
            className="mt-3"
          >
            Import a roster
          </ButtonLink>
        </Card>

        <StatusCard kpm={kpm} onChanged={load} />

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Seeded settings</h2>
          <p className="mt-1 text-md text-muted">
            Copied from the platform defaults at provisioning. The office edits these
            itself from Phase 4 — they are shown here so a reviewer can confirm
            provisioning actually seeded them.
          </p>
          <dl className="mt-3 grid grid-cols-[13rem_1fr] gap-y-1.5 text-md">
            {Object.entries(kpm.settings ?? {}).map(([k, v]) => (
              <Detail key={k} term={k} detail={String(v)} />
            ))}
          </dl>
        </Card>
      </div>
    </Page>
  );
}

function Detail({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="break-words text-navy">{detail}</dd>
    </>
  );
}

function StatusCard({ kpm, onChanged }: { kpm: Kpm; onChanged: () => Promise<void> }) {
  const [status, setStatus] = useState<TenantStatus>(kpm.status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

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
      <h2 className="font-display text-lg font-bold text-navy">Lifecycle</h2>
      <p className="mt-1 text-md text-muted">
        A suspended office refuses its members with a distinct error, so they are told
        their office is suspended rather than that they lack permission.
      </p>
      {kpm.suspendedReason && (
        <p className="mt-2 text-md text-alert">Suspended: {kpm.suspendedReason}</p>
      )}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        {error && <ErrorBanner {...error} />}
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TenantStatus)}
          >
            {(Object.keys(TENANT_STATUS_LABEL) as TenantStatus[]).map((s) => (
              <option key={s} value={s}>
                {TENANT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" htmlFor="reason" hint="Recorded in the audit log. Required to suspend.">
          <TextInput
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={status === 'suspended'}
          />
        </Field>
        <Button type="submit" disabled={busy || (status === kpm.status && !reason)}>
          {busy ? 'Saving…' : 'Apply'}
        </Button>
      </form>
    </Card>
  );
}
