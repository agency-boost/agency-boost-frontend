'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { createTenant, listCompanies, type Company } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

const CODE = /^[A-Za-z0-9-]{2,16}$/;

export default function NewTenantPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    companyId: '',
    code: '',
    branchName: '',
    address: '',
    contactPhone: '',
    timezone: '',
  });
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCompanies()
      .then((cos) => {
        setCompanies(cos);
        setForm((f) => (f.companyId ? f : { ...f, companyId: cos[0]?._id ?? '' }));
      })
      .catch(() => setCompanies([]));
  }, []);

  const badCode = form.code.length > 0 && !CODE.test(form.code);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const kpm = await createTenant({
        companyId: form.companyId,
        code: form.code,
        branchName: form.branchName,
        ...(form.address ? { address: form.address } : {}),
        ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
        ...(form.timezone ? { timezone: form.timezone } : {}),
      });
      router.push(`/admin/tenants/${kpm._id}`);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="New office"
      subtitle="Provisioning seeds the office's settings from the platform defaults; the office owns them afterwards."
    >
      <Card className="max-w-2xl">
        {companies.length === 0 ? (
          <div>
            <p className="text-md text-navy">There is no principal insurer to attach an office to.</p>
            <Link href="/admin/companies" className="mt-2 inline-block text-md text-navy underline">
              Create a company first
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}

            <Field label="Company" htmlFor="companyId">
              <Select id="companyId" required value={form.companyId} onChange={set('companyId')}>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Office code"
              htmlFor="code"
              hint="Unique within the insurer, and the prefix on every agent code it issues. Effectively permanent."
              error={badCode ? '2–16 characters: letters, digits and hyphens.' : undefined}
            >
              <TextInput id="code" required value={form.code} onChange={set('code')} invalid={badCode} />
            </Field>

            <Field label="Branch name" htmlFor="branchName">
              <TextInput id="branchName" required minLength={2} value={form.branchName} onChange={set('branchName')} />
            </Field>

            <Field label="Address" htmlFor="address" hint="Optional.">
              <TextInput id="address" value={form.address} onChange={set('address')} />
            </Field>

            <Field label="Contact phone" htmlFor="contactPhone" hint="Optional.">
              <TextInput id="contactPhone" value={form.contactPhone} onChange={set('contactPhone')} />
            </Field>

            <Field
              label="Time zone"
              htmlFor="timezone"
              hint="Every day boundary in this office is computed in this zone. Blank inherits the insurer's."
            >
              <TextInput id="timezone" placeholder="Asia/Jakarta" value={form.timezone} onChange={set('timezone')} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy || badCode || !form.code || !form.branchName}>
                {busy ? 'Creating…' : 'Create office'}
              </Button>
              <ButtonLink href="/admin/tenants" variant="secondary">
                Cancel
              </ButtonLink>
            </div>
          </form>
        )}
      </Card>
    </AdminShell>
  );
}
