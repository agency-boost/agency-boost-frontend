'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActivityBindingFields } from '@/components/activity-binding-fields';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import {
  BINDING_ROLES, readOfficeActivityBinding, saveOfficeActivityBinding, type ActivityBinding, type OfficeActivityBinding,
} from '@/lib/activity-binding';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

const same = (a: ActivityBinding, b: ActivityBinding) =>
  BINDING_ROLES.every((role) => a[role].length === b[role].length && a[role].every((code, i) => code === b[role][i]));

/**
 * **The office's activity binding, kept by the Super Admin** (ADR-0163 §3; P18.9-T2 AC-3) — a card on
 * `/admin/tenants/[kpmId]` beside the office's other provisioning cards.
 *
 * The product owner's request of 2026-10-26: when an activity is deleted or replaced, bind the summary to it again
 * so it stays right. Replacing is adding the new activity beside the old — the old one's history keeps counting —
 * and the server refuses what would break a count. Saved, it counts at once: no Publish.
 */
export function ActivityBindingCard({ kpmId }: { kpmId: string }) {
  // Convenience, as every gate here is: the API refuses a reader without `activity_binding:read` too.
  return useCan('activity_binding:read') ? <BindingCard kpmId={kpmId} /> : null;
}

function BindingCard({ kpmId }: { kpmId: string }) {
  const all = useMessages(adminTemplateMessages);
  const t = all.binding;
  // Convenience: the API refuses anybody without it (`activity_binding:write`, the Super Admin's).
  const canWrite = useCan('activity_binding:write');
  const [view, setView] = useState<OfficeActivityBinding | null>(null);
  const [draft, setDraft] = useState<ActivityBinding | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const read = await readOfficeActivityBinding(kpmId);
      setView({ ...read, types: read.types ?? [] });
      setDraft({ leads: read.leads ?? [], appointments: read.appointments ?? [], closings: read.closings ?? [] });
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [kpmId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!view || !draft) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveOfficeActivityBinding(kpmId, draft, view.version);
      setView(next);
      setDraft({ leads: next.leads, appointments: next.appointments, closings: next.closings });
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{t.title}</h2>
      <p className="mt-1 text-md text-muted">{t.lead}</p>
      <div className="mt-3 flex flex-col gap-3">
        {error && <ErrorBanner {...error} />}
        {view === null || draft === null ? (
          !error && <SkeletonText lines={4} />
        ) : (
          <>
            <ActivityBindingFields
              idPrefix="office-binding"
              value={draft}
              types={view.types}
              disabled={!canWrite || busy}
              onChange={(next) => { setSaved(false); setDraft(next); }}
            />
            {canWrite && (
              <Button className="self-start" disabled={busy || same(draft, view)} onClick={() => void save()}>
                {busy ? all.saving : t.save}
              </Button>
            )}
          </>
        )}
        <p role="status" className={saved ? 'text-md text-navy' : 'sr-only'}>
          {saved ? t.saved : ''}
        </p>
      </div>
    </Card>
  );
}
