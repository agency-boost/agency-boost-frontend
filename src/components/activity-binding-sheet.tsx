'use client';

import { useEffect, useState } from 'react';
import { ActivityBindingFields } from '@/components/activity-binding-fields';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { activityBindingMessages } from '@/i18n/messages/activity-binding';
import {
  BINDING_ROLES, readOfficeActivityBinding, saveOfficeActivityBinding,
  type ActivityBinding, type OfficeActivityBinding,
} from '@/lib/activity-binding';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan, useSession } from '@/lib/session';

const same = (a: ActivityBinding, b: ActivityBinding) =>
  BINDING_ROLES.every((role) => a[role].length === b[role].length && a[role].every((code, i) => code === b[role][i]));

/**
 * ***Pengaitan aktivitas*, the Owner's and the Admin's** (P19.4-T3; ADR-0206 §1; ADR-0163 §3) — a button on their
 * *Activity types* page and the sheet it opens: which of the office's activity types each cascade stage counts, saved at
 * once (no Publish), as the Super Admin's card saved it until the write became the office's.
 *
 * - **The smallest footprint** (ADR-0062's item 3): a dialog opened from one button in the page's toolbar, which already
 *   holds its controls. The editor is the shared `ActivityBindingFields`; the save is `PUT
 *   /admin/tenants/:kpmId/activity-binding` with the reader's own office, which the API answers for no other.
 * - **Only for a reader who may write it** (`activity_binding:write`, the Owner and the Admin): a view-as session and
 *   every other reader see nothing here, and the server refuses them in any case.
 * - `onSaved` hands the page the binding, so a type's *Counts as* marker follows it without a reload.
 */
export function ActivityBindingSheet({ onSaved }: { onSaved: (binding: ActivityBinding) => void }) {
  const t = useMessages(activityBindingMessages).office;
  const { me } = useSession();
  const canWrite = useCan('activity_binding:write');
  const kpmId = me?.membership?.kpmId ?? null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<OfficeActivityBinding | null>(null);
  const [draft, setDraft] = useState<ActivityBinding | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || kpmId === null) return;
    let live = true;
    setError(null);
    readOfficeActivityBinding(kpmId)
      .then((read) => {
        if (!live) return;
        setView({ ...read, types: read.types ?? [] });
        setDraft({ leads: read.leads ?? [], appointments: read.appointments ?? [], closings: read.closings ?? [] });
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [open, kpmId]);

  if (!canWrite || kpmId === null) return null;

  async function save() {
    if (!view || !draft || kpmId === null) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveOfficeActivityBinding(kpmId, draft, view.version);
      setView({ ...next, types: next.types ?? view.types });
      const binding = { leads: next.leads, appointments: next.appointments, closings: next.closings };
      setDraft(binding);
      setSaved(true);
      onSaved(binding);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => { setSaved(false); setOpen(true); }}>{t.open}</Button>
      <ResponsiveSheet
        open={open}
        title={t.open}
        description={t.lead}
        onClose={() => setOpen(false)}
        footer={view && draft ? (
          <Button className="w-full" disabled={busy || same(draft, view)} onClick={() => void save()}>
            {t.save}
          </Button>
        ) : undefined}
      >
        <div className="flex flex-col gap-3">
          {error && <ErrorBanner {...error} />}
          {view === null || draft === null ? (
            !error && <SkeletonText lines={4} />
          ) : (
            <ActivityBindingFields
              idPrefix="own-binding"
              value={draft}
              types={view.types}
              disabled={busy}
              onChange={(next) => { setSaved(false); setDraft(next); }}
            />
          )}
          <p role="status" className={saved ? 'text-md text-navy' : 'sr-only'}>{saved ? t.saved : ''}</p>
        </div>
      </ResponsiveSheet>
    </>
  );
}
