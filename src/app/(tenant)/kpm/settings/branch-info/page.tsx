'use client';

import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen } from '@/components/settings-screen';
import { SettingsReviewed } from '@/components/settings-reviewed';
import {
  Button, Card, Field, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { branchInfoMessages } from '@/i18n/messages/settings-branch-info';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { readBranchInfo, updateBranchInfo, type BranchInfo } from '@/lib/tenant-config';

/** The financial year's first month, 1 to 12: the select's values, each named in the reader's language. */
const MONTHS = Array.from({ length: 12 }, (_, at) => at + 1);

/**
 * What this office is (P4-T5, `KPM_Owner.html:1807-1812`; **P19.21-T3 AC-7**, `data-upload-pengaturan-*` frame 23: a
 * simple two-column form, the platform's fields grey).
 *
 * **Two fields are read-only, and the prototype is where that came from.** It disables
 * Company and labels it *"tagged by Superadmin"*, and disables KPM Owner. Those are the
 * platform's to set, and showing them greyed rather than hiding them is the prototype's
 * own answer to "why can't I change this" — the label says who can.
 *
 * **Locale, timezone and currency are not here at all.** ADR-0016 fixes all three for v1
 * and no screen offers them; the office overview shows them read-only.
 *
 * **The Owner's and the Admin's, like every page under Settings** (ADR-0027), and under the
 * same permission. It was the Owner's alone until the product owner gave the Admin the write.
 * Somebody without it — a read-only support session — sees the same form with every field
 * disabled and no Save, and the API refuses them regardless.
 */
export default function BranchInfoPage() {
  const t = useMessages(branchInfoMessages);
  const s = useMessages(settingsMessages);
  const canWrite = useCan('tenant_config:write');
  const [office, setOffice] = useState<BranchInfo | null>(null);
  const [form, setForm] = useState({
    branchName: '', address: '', contactPhone: '', fiscalYearStartMonth: 1,
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const row = await readBranchInfo();
      setOffice(row);
      setForm({
        branchName: row.branchName,
        address: row.address ?? '',
        contactPhone: row.contactPhone ?? '',
        fiscalYearStartMonth: row.fiscalYearStartMonth,
      });
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const row = await updateBranchInfo({
        branchName: form.branchName,
        address: form.address,
        contactPhone: form.contactPhone,
        fiscalYearStartMonth: form.fiscalYearStartMonth,
      });
      setOffice(row);
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  /** A field the platform sets: grey, its value as stored, and who sets it under it (frame 23). */
  const fixed = (label: React.ReactNode, value: string, reason: string) => (
    <ReadOnlyField layout="field" label={label} value={value} reason={reason} />
  );

  return (
    <SettingsScreen
      title={kept('Branch info')}
      permission="kpm:read_profile"
      // P19.3-T2 AC-5 (UI-149): *Sudah sesuai*, step 1 of the KPM setup card.
      actions={<SettingsReviewed page="branch-info" />}
      error={error}
    >
      {/*
        * P19.21-T3 AC-7 (frame 23): **a simple two-column form** — one column on a phone — in the mockup's order: *Kode
        * KPM*, *Nama cabang*; *Perusahaan*, *KPM Owner*; *Alamat*, *Telepon kontak*; *Tahun buku dimulai*, *Zona waktu ·
        * bahasa · mata uang*; *Simpan*. The platform's four grey, each saying so. Saved live: nothing here waits on
        * *Terbitkan*. From 1024px the two columns keep the form layout, at most 720px from the frame's left edge
        * (P19.13-T4 AC-3, UI-198; parity I-996).
        */}
      <Card className="lg:max-w-form">
        {office === null ? (
          <SkeletonText lines={8} />
        ) : (
          <form onSubmit={submit} className="grid gap-x-4 gap-y-4 md:grid-cols-2" noValidate>
            {fixed(t.kpmCode, office.code, t.kpmCodeReason)}

            <Field label={t.branchName} htmlFor="branchName">
              <TextInput
                id="branchName"
                value={form.branchName}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              />
            </Field>

            {fixed(t.company, office.companyName, t.companyReason)}
            {fixed(kept('KPM Owner'), office.ownerName ?? t.nobodyYet, t.ownerReason)}

            <Field label={t.address} htmlFor="address">
              <TextInput
                id="address"
                value={form.address}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>

            <Field label={t.contactPhone} htmlFor="contactPhone">
              <TextInput
                id="contactPhone"
                type="tel"
                value={form.contactPhone}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </Field>

            {/* No hint. It said "Used by the reporting periods that arrive in a later phase.": our
                schedule, which a reader can do nothing with (ADR-0062 §3, P10.1-T2). */}
            <Field label={t.financialYear} htmlFor="fiscalYearStartMonth">
              <Select
                id="fiscalYearStartMonth"
                value={String(form.fiscalYearStartMonth)}
                disabled={!canWrite}
                onChange={(e) => setForm({
                  ...form, fiscalYearStartMonth: Number(e.target.value),
                })}
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>{t.month({ month })}</option>
                ))}
              </Select>
            </Field>

            {fixed(t.timeLanguageCurrency, `${office.timezone} · ${office.locale} · ${office.currency}`, t.timeLanguageCurrencyReason)}

            {canWrite && (
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" disabled={busy || !form.branchName.trim()}>
                  {busy ? s.saving : s.save}
                </Button>
                {saved && <p role="status" className="text-md text-muted">{s.saved}</p>}
              </div>
            )}
          </form>
        )}
      </Card>
    </SettingsScreen>
  );
}
