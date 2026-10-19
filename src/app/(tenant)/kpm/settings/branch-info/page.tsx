'use client';

import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen } from '@/components/settings-screen';
import {
  Button, Card, Field, ReadOnlyField, Select, TextInput, Textarea,
} from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { readBranchInfo, updateBranchInfo, type BranchInfo } from '@/lib/tenant-config';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * What this office is (P4-T5, `KPM_Owner.html:1807-1812`).
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

  return (
    <SettingsScreen
      title="Branch info"
      subtitle="What this office is called, and where it is."
      permission="kpm:read_profile"
      error={error}
    >

      <Card>
        {office === null ? (
          <SkeletonText lines={6} />
        ) : (
          <form onSubmit={submit} className="flex max-w-xl flex-col gap-4" noValidate>
            <ReadOnlyField
              label="KPM code"
              value={office.code}
              reason="Set when the office was created, and unique within your company."
            />

            <Field label="Branch name" htmlFor="branchName">
              <TextInput
                id="branchName"
                value={form.branchName}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              />
            </Field>

            {/* Disabled and labelled, exactly as the prototype has it: the label is the
                answer to "why can't I change this". */}
            <ReadOnlyField
              label="Company (tagged by Superadmin)"
              value={office.companyName}
              reason="The insurer this office belongs to. Only the platform can change it."
            />

            <Field label="Address" htmlFor="address">
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>

            <Field label="Contact phone" htmlFor="contactPhone">
              <TextInput
                id="contactPhone"
                value={form.contactPhone}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </Field>

            <ReadOnlyField
              label="KPM Owner"
              value={office.ownerName ?? 'Nobody yet'}
              reason="Assigned and transferred by the platform, not from inside the office."
            />

            {/* No hint. It said "Used by the reporting periods that arrive in a later phase.": our
                schedule, which a reader can do nothing with (ADR-0062 §3, P10.1-T2). */}
            <Field label="Financial year starts" htmlFor="fiscalYearStartMonth">
              <Select
                id="fiscalYearStartMonth"
                value={String(form.fiscalYearStartMonth)}
                disabled={!canWrite}
                onChange={(e) => setForm({
                  ...form, fiscalYearStartMonth: Number(e.target.value),
                })}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </Select>
            </Field>

            <ReadOnlyField
              label="Time zone, language and currency"
              value={`${office.timezone} · ${office.locale} · ${office.currency}`}
              reason="Every office runs on these in this version of AgencyBoost."
            />

            {canWrite && (
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={busy || !form.branchName.trim()}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
                {saved && <p role="status" className="text-md text-muted">Saved.</p>}
              </div>
            )}
          </form>
        )}
      </Card>
    </SettingsScreen>
  );
}
