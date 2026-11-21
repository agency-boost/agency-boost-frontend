'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformMessages } from '@/i18n/messages/admin-platform';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { nationalNumber, readPlatformSettings, savePlatformSettings, type PlatformSettings } from '@/lib/platform';

/** The mockup's example number (frame f54), as the field's placeholder: digits, the same in both languages. */
const WHATSAPP_EXAMPLE = '0811 2000 300';

/** A value the page shows and does not take: the field's box, its words in navy, read-only by being no input. */
const SHOWN = 'flex min-h-11 items-center rounded-md border border-hairline bg-card px-3 text-base text-navy';

/**
 * ***Platform* › *Pengaturan platform*** (P19.23-T6 AC-3; ADR-0279; frame f54): four fields in two columns from 768px, one
 * column on a phone, and *Simpan*.
 *
 * - ***Kunci AI untuk membaca file*** — **its state, never a value** (OD-358, ADR-0262 §4): *•••• tersimpan* when the
 *   deployment's environment carries one, *Belum diatur* when not. No input: the key is set on the server, and the API
 *   never sends it.
 * - ***Nomor WhatsApp pengirim*** — the one field saved: the number AgencyBoost's messages give, typed as people write
 *   it; the server stores `+62…` and says under the field when it is not a number.
 * - ***Tampilan bawaan*** — shown, not changed here (OD-426's default).
 * - ***Tabel premi*** — not a setting: where premium tables are uploaded, a link to *Perusahaan & template*.
 */
export function SettingsSection() {
  const t = useMessages(adminPlatformMessages);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(() => {
    setLoadError(null);
    readPlatformSettings()
      .then((read) => {
        setSettings(read);
        setNumber(nationalNumber(read.whatsappNumber));
      })
      .catch((err) => setLoadError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  if (loadError) {
    return (
      <div>
        <ErrorBanner code={loadError.code} message={t.failed} requestId={loadError.requestId} />
        <Button variant="secondary" className="mt-3" onClick={load}>{t.retry}</Button>
      </div>
    );
  }
  if (!settings) {
    return (
      <Skeleton label={t.loading}>
        <div className="grid gap-4 rounded-lg bg-card p-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2"><SkeletonBar className="w-40" /><SkeletonBar className="h-11 w-full" /></div>
          ))}
        </div>
      </Skeleton>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await savePlatformSettings({ whatsappNumber: number.trim() === '' ? null : number.trim() });
      setSettings(saved);
      setNumber(nationalNumber(saved.whatsappNumber));
      show(t.settings.saved);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form
        className="rounded-lg bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-navy">{t.settings.aiKey}</p>
            <p className={SHOWN}>
              {settings.aiReadingKey === 'set' ? t.settings.aiSet : t.settings.aiNotSet}
            </p>
          </div>
          <Field label={t.settings.whatsapp} htmlFor="platform-whatsapp" error={error?.message}>
            <TextInput
              id="platform-whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder={WHATSAPP_EXAMPLE}
              value={number}
              invalid={Boolean(error)}
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-navy">{t.settings.defaultLook}</p>
            <p className={SHOWN}>
              {t.settings.defaultLookValue({ name: settings.defaultLook.systemName })}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-navy">{t.settings.premium}</p>
            <Link href="/admin/companies" className={`${SHOWN} underline-offset-2 hover:underline`}>
              {t.settings.premiumValue}
            </Link>
          </div>
        </div>
        <Button type="submit" className="mt-4 min-h-11 max-md:w-full" disabled={busy}>{t.settings.save}</Button>
      </form>
      <Toast toast={toast} />
    </>
  );
}
