'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { CompanyFrame, useCompany, useCompanyName } from '@/components/kpm-template/company-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { RowMenu } from '@/components/ui/rows-and-sheets';
import { SkeletonCards } from '@/components/ui/skeleton';
import { listOrgLevels, type OrgLevel } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

/** Where a rung is changed: the ladder editor, this company chosen (`?company=`). */
const editorHref = (companyId: string) => `/admin/org-levels?company=${companyId}`;

/**
 * **A company's page, tab *Jenjang*** (`/admin/companies/[companyId]`; P19.23-T4 AC-2; ADR-0278 §1; frame 29): the
 * company's active rungs junior first — *1. Agent*, *2. AAB*, *3. AB* — each with its tier on a pill (*Bukan leader*,
 * *Leader · Associate*, *Leader · Senior*) and ⋯, then *+ Tambah jenjang*, and the line *Urutan dari yang paling junior ·
 * dipakai semua KPM {company}*.
 *
 * **A rung is changed on the ladder editor** (`/admin/org-levels`, ADR-0168 §3), this company chosen: ⋯'s *Ubah* and *+
 * Tambah jenjang* open it there, where the label, the tier, archiving and deleting keep their checks (a tier a member
 * holds, a rung something names, a version somebody else saved). The drag handle is not drawn: the API keeps no reorder
 * of a ladder. Parity I-1191.
 */
export default function CompanyLadderPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminCompaniesConsoleMessages);
  const router = useRouter();
  const company = useCompany(companyId);
  const name = useCompanyName(company);
  const [rungs, setRungs] = useState<OrgLevel[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    void listOrgLevels(companyId)
      .then((rows) => {
        if (live) setRungs(rows.filter((r) => r.status === 'active').sort((a, b) => a.displayOrder - b.displayOrder));
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [companyId, attempt]);

  const tierOf = (r: OrgLevel) => (r.leaderTier === 'senior' ? t.ladder.senior
    : r.leaderTier === 'associate' ? t.ladder.associate : t.ladder.notLeader);

  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read" active="ladder">
      {error && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}
      {!error && rungs === null && <SkeletonCards count={3} label={t.ladder.caption} />}
      {rungs?.length === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={t.ladder.empty} action={<AddRung companyId={companyId} />} />
        </div>
      )}
      {rungs && rungs.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
            <ol aria-label={t.ladder.caption} className="[&>li+li]:border-t [&>li+li]:border-divider">
              {rungs.map((r, i) => (
                <li key={r.orgLevelId} data-rung={r.code} className="flex min-h-12 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-md font-bold text-navy">{`${i + 1}. ${r.label}`}</span>
                  <span className="rounded-pill bg-pill-grey px-2.5 py-0.5 text-sm font-semibold text-navy">{tierOf(r)}</span>
                  <RowMenu
                    name={t.ladder.menu({ rung: r.label })}
                    items={[{ label: t.ladder.edit, onSelect: () => router.push(editorHref(companyId)) }]}
                  />
                </li>
              ))}
            </ol>
            <div className="border-t border-divider px-4 py-2"><AddRung companyId={companyId} /></div>
          </div>
          <p className="mt-2 text-sm text-muted">{t.ladder.note({ company: name })}</p>
        </>
      )}
    </CompanyFrame>
  );
}

/** *+ Tambah jenjang*: the ladder editor, this company chosen. */
function AddRung({ companyId }: { companyId: string }) {
  const t = useMessages(adminCompaniesConsoleMessages).ladder;
  return (
    <Link href={editorHref(companyId)} className="inline-flex min-h-10 items-center gap-1 text-md font-bold text-primary-ink">
      <LineIcon name="plus" className="h-4 w-4" />
      {t.add}
    </Link>
  );
}
