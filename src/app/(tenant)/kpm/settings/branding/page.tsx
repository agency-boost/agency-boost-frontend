'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMessagesAsWritten } from '@/components/branding/as-written';
import {
  BrandingEditor, draftOf, EMPTY_DRAFT, type BrandingDraft, type ColourCheck,
} from '@/components/branding/branding-editor';
import { useOfficeName } from '@/components/kpm-brand';
import { SettingsScreen } from '@/components/settings-screen';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card } from '@/components/ui/field';
import { SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { brandingMessages } from '@/i18n/messages/branding';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { brandingApi, type BrandingSettings } from '@/lib/branding';
import { useCan, useSession } from '@/lib/session';

/**
 * ***Pengaturan → Tampilan KPM*** (`/kpm/settings/branding`; P19.6-T1; *redrawn 2026-11-20 by P19.21-T4, ADR-0274*,
 * frame 24 of `data-upload-pengaturan-{mobile,tablet,laptop}`). One card of rows — *Nama sistem*, *Logo*, *Logo
 * persegi*, *Maskot*, *Warna utama*, *Warna kedua* — beside *Pratinjau langsung*, a phone that changes as they are typed,
 * then *Simpan*. Saved live: there is no draft to publish.
 *
 * - **Nama sistem** (AC-1): what this KPM calls the app. Its members read it wherever the app says *AgencyBoost* — every
 *   message, the sidebar's wordmark, their emails (`functional/branding.md`, *As built — P19.21-T4*). Emptied, the app is
 *   *AgencyBoost* again.
 * - **Whoever holds `tenant_config:write`** — the Owner, an Admin, a core leader, the Super Admin inside the KPM; every
 *   other reader, and a view-as session, sees the same page with every input disabled and no *Simpan* — and the API
 *   refuses them regardless.
 * - ***Simpan*** is blocked only while a colour is not `#rrggbb` (P19.12-T3; ADR-0246). After it, the session is read
 *   again, so the reader's own screens take the new look and name at once; every member sees it after a refresh.
 * - **Read as written** (`useMessagesAsWritten`): the word *AgencyBoost* on this page is the default being replaced.
 */
export default function BrandingPage() {
  const t = useMessagesAsWritten(brandingMessages);
  const { me, reload } = useSession();
  const branch = useOfficeName();
  const canWrite = useCan('tenant_config:write');
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [draft, setDraft] = useState<BrandingDraft>(EMPTY_DRAFT);
  const [name, setName] = useState('');
  const [check, setCheck] = useState<ColourCheck>({ state: 'idle' });
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const show = useCallback((next: BrandingSettings) => {
    setSettings(next);
    setDraft(draftOf(next.own));
    setName(next.shown.systemName ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      show(await brandingApi.read());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [show]);

  useEffect(() => { void load(); }, [load]);

  const writable = canWrite && settings?.canWrite === true;
  const blocked = check.state === 'invalid';
  const firstName = me?.user.preferredName?.trim() || me?.user.fullName.trim().split(/\s+/)[0] || null;

  async function run(action: () => Promise<BrandingSettings>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      show(await action());
      setNotice(done);
      await reload();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        await load();
        setNotice(t.conflict);
      } else {
        setError(toDisplayError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => brandingApi.save({
    logo: draft.logo ? { key: draft.logo.key } : null,
    logoSquare: draft.logoSquare ? { key: draft.logoSquare.key } : null,
    primary: draft.primary,
    secondary: draft.secondary,
    mascot: draft.mascot
      ? {
        default: draft.mascot.default.key,
        poses: Object.fromEntries(Object.entries(draft.mascot.poses).map(([pose, img]) => [pose, img!.key])),
      }
      : null,
    // P19.21-T4 AC-1: emptied, the app is AgencyBoost again.
    systemName: name.trim() === '' ? null : name.trim(),
    expectedVersion: settings?.version ?? 0,
  }), t.saved);

  return (
    <SettingsScreen title={t.title} permission="tenant_config:read" error={error}>
      {settings === null ? (
        error ? null : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" aria-busy="true">
            <Card density="compact"><SkeletonText lines={8} /></Card>
            <Card density="compact" className="flex justify-center"><SkeletonBar className="h-[480px] w-[248px] rounded-[34px]" /></Card>
          </div>
        )
      ) : (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => { e.preventDefault(); if (writable && !blocked) void save(); }}
        >
          {!writable && <p role="note" className="m-0 text-md text-muted">{t.viewOnly}</p>}
          <BrandingEditor
            owner={{ kind: 'kpm' }}
            draft={draft}
            onChange={setDraft}
            disabled={!writable || busy}
            onCheck={setCheck}
            name={{ value: name, onChange: setName }}
            preview={{ branch, firstName }}
          />
          {writable && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy || blocked}>{busy ? t.saving : t.save}</Button>
              <Button
                variant="secondary"
                disabled={busy || (settings.own === null)}
                onClick={() => setConfirming(true)}
              >
                {t.reset}
              </Button>
              {notice && <p role="status" className="m-0 text-md text-muted">{notice}</p>}
            </div>
          )}
        </form>
      )}
      <Dialog
        open={confirming}
        message={`${t.resetTitle} ${settings?.template ? t.resetToTemplate : t.resetToAgencyBoost}`}
        confirmLabel={t.resetConfirm}
        cancelLabel={t.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void run(() => brandingApi.reset(settings?.version ?? 0), t.saved);
        }}
      />
    </SettingsScreen>
  );
}
