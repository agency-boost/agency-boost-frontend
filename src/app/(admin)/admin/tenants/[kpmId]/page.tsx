'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SaveAsTemplateDialog } from '@/components/save-as-template-dialog';
import { ActivityBindingCard } from '@/components/activity-binding-card';
import { Button, ButtonLink, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import {
  readTenant,
  setTenantStatus,
  subscriptionLine,
  tenantStatusLabels,
  tenantStatusTone,
  tenantStatusWord,
  type TenantRow,
  type TenantStatus,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { savedTemplateSentence } from '@/lib/templates';
import { useCan } from '@/lib/session';

export default function TenantDetailPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const t = useMessages(adminOfficesMessages).detail;
  const language = useLanguage();
  const [kpm, setKpm] = useState<TenantRow | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** *Save as template* (P13.2-T7): the dialog, and what the last save made, said once it is made. */
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Convenience: the API refuses anybody without it (`company_template:write`, the Super Admin's).
  const canSaveTemplate = useCan('company_template:write');
  // *Open as Owner* (ADR-0162): the API refuses anybody without it, and a setup session into an office that is not active.
  const canImpersonate = useCan('impersonation:start');

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
      subtitle={t.subtitle}
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
      <p role="status" className={saved ? 'mb-4 text-md text-navy' : 'sr-only'}>{saved ?? ''}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.profile}</h2>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-md">
            {/* The one id on this screen that stays, and the only one AC-7 exempts:
                `04-managing-a-kpm.md` tells the reader support will ask for it. The term
                was `Tenant id`, which is the vocabulary I-49 retired. `select-all` makes
                one click take the whole string — `CopyableValue` would be the obvious
                reach, but it is a boxed card with its own heading and would both repeat
                this row's label and make a support id the loudest thing on the card. */}
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
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.owner}</h2>
          {kpm.ownerName ? (
            <p className="mt-2 text-md text-navy">
              <span className="font-semibold">{kpm.ownerName}</span>
              {kpm.ownerEmail && <span className="block text-sm text-muted">{kpm.ownerEmail}</span>}
            </p>
          ) : (
            <p className="mt-2 text-md text-alert">
              {t.noOwner}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* A setup session as the Owner (ADR-0162): the start screen names them and asks what it is for.
                Only for an office somebody can use: the API refuses a session into any other. */}
            {canImpersonate && kpm.ownerUserId && kpm.status === 'active' && (
              <ButtonLink
                href={`/admin/impersonate/${kpm.ownerUserId}?purpose=setup&kpmId=${kpm._id}`}
                variant="secondary"
              >
                {t.openAsOwner}
              </ButtonLink>
            )}
            <ButtonLink href={`/admin/tenants/${kpm._id}/owner`} variant="secondary">
              {kpm.ownerName ? t.transferOwner : t.assignOwner}
            </ButtonLink>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.people}</h2>
          <p className="mt-1 text-md text-muted">{t.peopleLine}</p>
          <ButtonLink
            href={`/admin/tenants/${kpm._id}/roster`}
            variant="secondary"
            className="mt-3"
          >
            {t.importRoster}
          </ButtonLink>
        </Card>

        <StatusCard kpm={kpm} onChanged={load} />

        {/* P18.9-T2 (ADR-0163): which activities the summary counts at each cascade stage, kept here. */}
        <ActivityBindingCard kpmId={kpm._id} />

        {/* No *Seeded settings* card, and no sign in its place (P10.1-T2). It listed the office's
            ten settings by their raw keys for "a reviewer" to confirm provisioning, under a
            sentence naming a phase; no prototype has it, and nothing is coming to this slot, so
            a placeholder would promise a feature that does not exist. */}
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

function StatusCard({ kpm, onChanged }: { kpm: TenantRow; onChanged: () => Promise<void> }) {
  const { detail: t, saving } = useMessages(adminOfficesMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const labels = tenantStatusLabels(language);
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
    </Card>
  );
}
