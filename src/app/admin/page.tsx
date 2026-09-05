'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui/field';
import { listCompanies, listTenants, type Company, type Kpm } from '@/lib/admin';

export default function AdminOverviewPage() {
  const [tenants, setTenants] = useState<Kpm[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    void listTenants().then(setTenants).catch(() => setTenants([]));
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const active = tenants?.filter((t) => t.status === 'active').length ?? 0;
  const suspended = tenants?.filter((t) => t.status === 'suspended').length ?? 0;
  const unowned = tenants?.filter((t) => !t.ownerUserId).length ?? 0;

  return (
    <AdminShell
      title="Platform overview"
      subtitle="Tenant management only — this console never reads an office's business data."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Offices" value={tenants?.length} />
        <Stat label="Active" value={tenants ? active : undefined} />
        <Stat label="Suspended" value={tenants ? suspended : undefined} />
        <Stat label="Principals" value={companies?.length} />
      </div>

      {unowned > 0 && (
        <Card className="mt-4 border-alert/30">
          <h2 className="font-display text-lg font-bold text-navy">
            {unowned} office{unowned === 1 ? '' : 's'} without an owner
          </h2>
          <p className="mt-1 text-md text-muted">
            Nobody can administer an office until an owner is assigned. Open the office
            and assign one.
          </p>
          <Link href="/admin/tenants" className="mt-3 inline-block text-md text-navy underline">
            Go to tenants
          </Link>
        </Card>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-navy">
        {value === undefined ? '—' : value}
      </p>
    </Card>
  );
}
