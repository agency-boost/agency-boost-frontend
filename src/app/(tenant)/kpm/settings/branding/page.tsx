'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BrandingEditor, draftOf, EMPTY_DRAFT, type BrandingDraft, type ColourCheck,
} from '@/components/branding/branding-editor';
import { SettingsScreen } from '@/components/settings-screen';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card } from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { brandingMessages } from '@/i18n/messages/branding';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { brandingApi, type BrandingSettings } from '@/lib/branding';
import { useCan, useSession } from '@/lib/session';

/**
 * ***Pengaturan → Tampilan KPM*** (`/kpm/settings/branding`; P19.6-T1 AC-2 to AC-17; ADR-0218; §B7). The KPM's logo,
 * square logo, two colours and mascot, with the live preview, *Simpan* and *Kembalikan ke default*. No prototype draws
 * it: it is built in the *Pengaturan* pages' idiom (`branch-info`), registered *Improve — explicit client request (B7)*.
 *
 * - **The Owner's and the Admins'** (`tenant_config:write`); every other reader, and a view-as session, sees the same
 *   page with every input disabled and no *Simpan* (AC-17) — and the API refuses them regardless.
 * - ***Simpan*** is blocked while a colour carries unreadable words (acceptance 2). After it, the session is read again,
 *   so the Owner's own screens take the new look at once; every member sees it after a refresh (acceptance 1).
 */
export default function BrandingPage() {
  const t = useMessages(brandingMessages);
  const { reload } = useSession();
  const canWrite = useCan('tenant_config:write');
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [draft, setDraft] = useState<BrandingDraft>(EMPTY_DRAFT);
  const [check, setCheck] = useState<ColourCheck>({ state: 'idle' });
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const show = useCallback((next: BrandingSettings) => {
    setSettings(next);
    setDraft(draftOf(next.own));
  }, []);

  const load = useCallback(async () => {
    try {
      show(await brandingApi.read());
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [show]);

  useEffect(() => { void load(); }, [load]);

  const writable = canWrite && settings?.canWrite === true;
  const blocked = check.state === 'unreadable' || check.state === 'invalid';

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
    expectedVersion: settings?.version ?? 0,
  }), t.saved);

  return (
    <SettingsScreen title={t.title} subtitle={t.subtitle} permission="tenant_config:read" error={error}>
      <Card>
        {settings === null ? (
          <SkeletonText lines={8} />
        ) : (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(e) => { e.preventDefault(); if (writable && !blocked) void save(); }}
          >
            {!writable && <p role="note" className="m-0 text-md text-muted">{t.viewOnly}</p>}
            <BrandingEditor owner={{ kind: 'kpm' }} draft={draft} onChange={setDraft} disabled={!writable || busy} onCheck={setCheck} />
            <p className="m-0 text-sm text-muted">{t.homeIcon}</p>
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
      </Card>
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
