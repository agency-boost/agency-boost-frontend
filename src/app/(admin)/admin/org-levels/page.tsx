'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { InlineSaveField, useInlineSave, type InlineSaveOutcome } from '@/components/ui/inline-save-status';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  createOrgLevel,
  insurersOf,
  isTemplateLibrary,
  listCompanies,
  listOrgLevels,
  updateOrgLevel,
  type Company,
  type LeaderTier,
  type OrgLevel,
} from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import type { MessagesOf } from '@/i18n/catalogue';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateOrgLevelsMessages } from '@/i18n/messages/admin-template-org-levels';

type LadderWords = MessagesOf<typeof adminTemplateOrgLevelsMessages.en>;

/** The server's own rule, so the form cannot offer a code the API will refuse. */
const CODE = /^[A-Za-z][A-Za-z0-9_]{1,31}$/;

/** A rung's *Leader tier* select, in its *Saving… → Saved ✓* (P18.95-T1 AC-5): by its id, unique across companies. */
const tierKey = (orgLevelId: string) => `${orgLevelId}\ntier`;

/**
 * The skeleton and the table read the same array, so the placeholder is the width of the
 * ladder it stands in for. Its words are the catalogue's, in the reader's language.
 */
const columnsOf = (t: LadderWords['columns']) =>
  [t.order, t.rung, t.tier, t.status, { label: t.actions, visuallyHidden: true }] as const;

/**
 * The tiers, in the client's words (ADR-0156, 2026-10-26), kept English. *Not a leader* is the empty value:
 * the wire's `null`, which a `<select>` cannot hold.
 */
const tiersOf = (t: LadderWords['tiers']): { value: LeaderTier | ''; label: string }[] => [
  { value: 'senior', label: t.senior },
  { value: 'associate', label: t.associate },
  { value: '', label: t.none },
];

/**
 * A refused tier change, in this screen's words: the count from the refusal's details and the rung
 * by its label. The API's own sentence when the details are missing, so a refusal never goes unsaid.
 */
function tierInUse(error: ApiError, level: OrgLevel | undefined, t: LadderWords): ApiError {
  const members = Number(error.details?.members);
  if (!level || !Number.isInteger(members) || members < 1) return error;
  return { ...error, message: t.tierInUse({ n: members, rung: level.label }) };
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
 *
 * **The Template library is listed** (ADR-0168 §3, 2026-10-26): its ladder is the one a new company copies,
 * and it is edited here like any company's — *Company* offers it by its name, and beside the select the same
 * *Template library* badge `/admin/companies` puts on its row says which it is. It has no offices, so a tier
 * change on it is never refused for members; the server is where that is decided. Registered as an Improve.
 */
export default function OrgLevelsPage() {
  const t = useMessages(adminTemplateOrgLevelsMessages);
  const columns = columnsOf(t.columns);
  const tiers = tiersOf(t.tiers);
  const [levels, setLevels] = useState<OrgLevel[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [tier, setTier] = useState<LeaderTier | ''>('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inline = useInlineSave();

  useEffect(() => {
    void Promise.all([listOrgLevels(), listCompanies()])
      .then(([ladder, all]) => {
        // Every company, the Template library included (ADR-0168 §3): its ladder is what a new company copies.
        // An insurer is chosen first, as before the library was listed; the library only where there is none.
        setLevels(ladder);
        setCompanies(all);
        setCompanyId((c) => c || (insurersOf(all)[0]?._id ?? all[0]?._id ?? ''));
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
   *
   * **And it says so beside the select** (P18.95-T1 AC-5): *Saving… → Saved ✓*, or *Couldn't save —
   * retry*, which sends this same tier again. A `409` — the rung is held, or it changed — is a refusal
   * sending the same tier again cannot change, so it leaves no retry (`null`): the banner says why.
   */
  async function setLeaderTier(level: OrgLevel, value: LeaderTier | ''): Promise<InlineSaveOutcome> {
    setBusy(level.orgLevelId);
    setError(null);
    try {
      const ladder = await updateOrgLevel(level.orgLevelId, { leaderTier: value || null });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== level.companyId), ...ladder]);
      return true;
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown.code === 'ORG_LEVEL_TIER_IN_USE' ? tierInUse(shown, level, t) : shown);
      return err instanceof ApiRequestError && err.status === 409 ? null : false;
    } finally {
      setBusy(null);
    }
  }

  const company = companies.find((c) => c._id === companyId);
  const libraryChosen = company ? isTemplateLibrary(company) : false;

  return (
    <Page title={t.title} subtitle={t.subtitle} permission="org_level:crud">
      {error && !takenCode && <ErrorBanner {...error} />}

      <Field label={t.company} htmlFor="company" className="mb-6">
        {/* The badge `/admin/companies` puts on the library's row, beside the select while it is the one chosen,
            and named by the select's description so a screen reader hears it with the choice (ADR-0168 §3). */}
        <div className="flex items-center gap-3">
          <Select
            id="company"
            className="max-w-sm"
            value={companyId}
            aria-describedby={libraryChosen ? 'company-kind' : undefined}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          {libraryChosen && (
            <span id="company-kind">
              <ConfigBadge tone="navy">{t.templateLibrary}</ConfigBadge>
            </span>
          )}
        </div>
      </Field>

      {/* `minmax(0, 1fr)`, not `1fr`: a column is otherwise at least as wide as its table, which pushed the page sideways
          at every size; the table scrolls in its own frame instead (P18.98-T4 AC-6, the walk of 2026-10-29). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {levels === null && <SkeletonTable caption={t.ladder} columns={columns} rows={3} />}

          {levels !== null && forCompany.length === 0 && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState
                title={company ? t.noLadder({ company: company.name }) : t.noCompany}
              />
            </div>
          )}

          {forCompany.length > 0 && (
            <>
              <DataTable caption={t.ladderCaption} columns={columns}>
                {forCompany.map((l) => (
                  <Row key={l.orgLevelId}>
                    <Cell className="text-muted">{l.displayOrder}</Cell>
                    <Cell className="font-semibold">{l.label}</Cell>
                    <Cell>
                      {/* Its status on the line under it, inside the cell (AC-5), as a lead's cells have theirs. */}
                      <InlineSaveField status={inline.statusOf(tierKey(l.orgLevelId))} label={t.tierStatus({ rung: l.label })}>
                        <Select
                          density="cell"
                          aria-label={t.tierOf({ rung: l.label })}
                          value={l.leaderTier ?? ''}
                          disabled={busy !== null}
                          onChange={(e) => {
                            const value = e.target.value as LeaderTier | '';
                            void inline.save(tierKey(l.orgLevelId), () => setLeaderTier(l, value));
                          }}
                        >
                          {tiers.map((tier) => (
                            <option key={tier.value} value={tier.value}>
                              {tier.label}
                            </option>
                          ))}
                        </Select>
                      </InlineSaveField>
                    </Cell>
                    <Cell>
                      <StatusPill
                        status={l.status === 'active' ? 'success' : 'neutral'}
                        label={l.status === 'active' ? t.active : t.archived}
                      />
                    </Cell>
                    <Cell>
                      <Button
                        variant="inlineDanger"
                        disabled={busy !== null}
                        onClick={() => void setStatus(l, l.status === 'active' ? 'archived' : 'active')}
                      >
                        {l.status === 'active' ? t.archive : t.restore}
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </DataTable>

              <p className="mt-3 text-sm text-muted">
                {t.readingOrder({
                  ladder: forCompany.filter((l) => l.status === 'active').map((l) => l.label).join(' → ') || null,
                  strong: (words) => <strong>{words}</strong>,
                })}
              </p>
            </>
          )}
        </div>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.addTitle}</h2>
          <form onSubmit={add} className="mt-3 flex flex-col gap-4" noValidate>
            <Field
              label={t.code}
              htmlFor="code"
              hint={t.codeHint}
              error={badCode ? t.codeShape : takenCode}
            >
              <TextInput
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                invalid={badCode || Boolean(takenCode)}
              />
            </Field>
            <Field label={t.label} htmlFor="label" hint={t.labelHint}>
              <TextInput
                id="label"
                required
                maxLength={60}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Field label={t.tier} htmlFor="leader-tier">
              <Select
                id="leader-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as LeaderTier | '')}
              >
                {tiers.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">{t.position({ n: nextOrder })}</p>
            <Button
              type="submit"
              disabled={busy !== null || badCode || !companyId || !code.trim() || !label.trim()}
            >
              {busy === 'add' ? t.adding : t.add}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
