'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  createOrgLevel,
  insurersOf,
  listCompanies,
  listOrgLevels,
  updateOrgLevel,
  type Company,
  type LeaderTier,
  type OrgLevel,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';

/** The server's own rule, so the form cannot offer a code the API will refuse. */
const CODE = /^[A-Za-z][A-Za-z0-9_]{1,31}$/;

/**
 * The skeleton and the table read the same array, so the placeholder is the width of the
 * ladder it stands in for.
 */
const COLUMNS = ['Order', 'Rung', 'Leader tier', 'Status', { label: 'Actions', visuallyHidden: true }] as const;

/**
 * The tiers, in the client's words (ADR-0156, 2026-10-26). *Not a leader* is the empty value:
 * the wire's `null`, which a `<select>` cannot hold.
 */
const TIERS: { value: LeaderTier | ''; label: string }[] = [
  { value: 'senior', label: 'Senior Leader' },
  { value: 'associate', label: 'Associate Leader' },
  { value: '', label: 'Not a leader' },
];

/**
 * A refused tier change, in this screen's words: the count from the refusal's details and the rung
 * by its label. The API's own sentence when the details are missing, so a refusal never goes unsaid.
 */
function tierInUse(error: ApiError, level: OrgLevel | undefined): ApiError {
  const members = Number(error.details?.members);
  if (!level || !Number.isInteger(members) || members < 1) return error;
  const who = members === 1 ? '1 person stands' : `${members} people stand`;
  return {
    ...error,
    message: `${who} on ${level.label}, so its leader tier cannot change. Move them to another rung first, or add a new rung.`,
  };
}

/**
 * Org role ladder (P3.5-T7, ADR-0012).
 *
 * **No prototype counterpart.** `AgencyBoost_Superadmin.html:188` makes `Org role ladder` a
 * disabled `Soon` link; the only thing the prototype says about a ladder is the company
 * card's meta line, *"Role ladder: Agent → AAB → AB"* (`:311`), which this screen is what
 * finally puts data behind. Registered as a Fill.
 *
 * **The Leader tier column and field** (P18.8-T1, ADR-0156) are the client's request of
 * 2026-10-26 — mark which rungs lead, as *Senior Leader* or *Associate Leader* — in the
 * table's own select-in-a-cell idiom and the side card's own field. Registered as an Improve.
 *
 * Built in the console's own idiom — the list-plus-side-panel of `/admin/companies` —
 * rather than a new visual language for one screen.
 */
export default function OrgLevelsPage() {
  const [levels, setLevels] = useState<OrgLevel[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [tier, setTier] = useState<LeaderTier | ''>('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listOrgLevels(), listCompanies()])
      .then(([ladder, all]) => {
        // The insurers' ladders: the Template library's is the one a new company copies, and is not an
        // insurer's to edit here (ADR-0164 §3).
        const cos = insurersOf(all);
        setLevels(ladder);
        setCompanies(cos);
        setCompanyId((c) => c || (cos[0]?._id ?? ''));
      })
      .catch((err) => {
        setError(toDisplayError(err));
        setLevels([]);
      });
  }, []);

  const badCode = code.length > 0 && !CODE.test(code);
  const takenCode = error?.code === 'ORG_LEVEL_CODE_TAKEN' ? error.message : undefined;
  const forCompany = (levels ?? []).filter((l) => l.companyId === companyId);
  // Junior first, and the next rung goes on the end — the reader is extending a ladder,
  // not inserting into one. Reordering is what `displayOrder` is for, once there is a
  // reason to.
  const nextOrder = forCompany.reduce((n, l) => Math.max(n, l.displayOrder), 0) + 1;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy('add');
    setError(null);
    try {
      const ladder = await createOrgLevel({
        companyId,
        code: code.trim(),
        label: label.trim(),
        displayOrder: nextOrder,
        leaderTier: tier || null,
      });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== companyId), ...ladder]);
      setCode('');
      setLabel('');
      setTier('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(level: OrgLevel, status: 'active' | 'archived') {
    setBusy(level.orgLevelId);
    setError(null);
    try {
      const ladder = await updateOrgLevel(level.orgLevelId, { status });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== level.companyId), ...ladder]);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  /*
   * **Saved on change**, like Archive beside it: one value, and the server is the one that can say
   * no — while anybody stands on the rung it refuses, with the count, and the select still shows the
   * stored tier because it reads the ladder, which only a success replaces.
   */
  async function setLeaderTier(level: OrgLevel, value: LeaderTier | '') {
    setBusy(level.orgLevelId);
    setError(null);
    try {
      const ladder = await updateOrgLevel(level.orgLevelId, { leaderTier: value || null });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== level.companyId), ...ladder]);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown.code === 'ORG_LEVEL_TIER_IN_USE' ? tierInUse(shown, level) : shown);
    } finally {
      setBusy(null);
    }
  }

  const company = companies.find((c) => c._id === companyId);

  return (
    <Page
      title="Org role ladder"
      subtitle="The rungs a company promotes people along. An office cannot invent one — this is the company's to define, and only the platform writes it."
      permission="org_level:crud"
    >
      {error && !takenCode && <ErrorBanner {...error} />}

      <Field label="Company" htmlFor="company" className="mb-6 max-w-sm">
        <Select id="company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {levels === null && <SkeletonTable caption="Role ladder" columns={COLUMNS} rows={3} />}

          {levels !== null && forCompany.length === 0 && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState
                title={
                  company
                    ? `${company.name} has no ladder yet. Add the most junior rung first.`
                    : 'Create a company before defining a ladder.'
                }
              />
            </div>
          )}

          {forCompany.length > 0 && (
            <>
              <DataTable caption="Role ladder, junior first" columns={COLUMNS}>
                {forCompany.map((l) => (
                  <Row key={l.orgLevelId}>
                    <Cell className="text-muted">{l.displayOrder}</Cell>
                    <Cell className="font-semibold">{l.label}</Cell>
                    <Cell>
                      <Select
                        density="cell"
                        aria-label={`Leader tier of ${l.label}`}
                        value={l.leaderTier ?? ''}
                        disabled={busy !== null}
                        onChange={(e) => void setLeaderTier(l, e.target.value as LeaderTier | '')}
                      >
                        {TIERS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </Cell>
                    <Cell>
                      <StatusPill
                        status={l.status === 'active' ? 'success' : 'neutral'}
                        label={l.status === 'active' ? 'Active' : 'Archived'}
                      />
                    </Cell>
                    <Cell>
                      <Button
                        variant="inlineDanger"
                        disabled={busy !== null}
                        onClick={() => void setStatus(l, l.status === 'active' ? 'archived' : 'active')}
                      >
                        {l.status === 'active' ? 'Archive' : 'Restore'}
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </DataTable>

              <p className="mt-3 text-sm text-muted">
                Reading order is junior first:{' '}
                <strong>
                  {forCompany
                    .filter((l) => l.status === 'active')
                    .map((l) => l.label)
                    .join(' → ') || 'nothing active'}
                </strong>
                . Archiving retires a rung without deleting it, so everybody who ever stood on it
                still renders.
              </p>
            </>
          )}
        </div>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Add a rung</h2>
          <form onSubmit={add} className="mt-3 flex flex-col gap-4" noValidate>
            <Field
              label="Code"
              htmlFor="code"
              hint="Stable and semantic — AGENT, AAB, AB. Upper-cased on the way in, and never changed or reused afterwards."
              error={badCode ? 'Letters, digits and underscores, starting with a letter.' : takenCode}
            >
              <TextInput
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                invalid={badCode || Boolean(takenCode)}
              />
            </Field>
            <Field label="Label" htmlFor="label" hint="What a reader sees. This one you can change.">
              <TextInput
                id="label"
                required
                maxLength={60}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Field label="Leader tier" htmlFor="leader-tier">
              <Select
                id="leader-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as LeaderTier | '')}
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">
              It goes on the end of the ladder, at position {nextOrder}.
            </p>
            <Button
              type="submit"
              disabled={busy !== null || badCode || !companyId || !code.trim() || !label.trim()}
            >
              {busy === 'add' ? 'Adding…' : 'Add rung'}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
