'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, ErrorBanner, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { ChoicePill, RowMenu } from '@/components/ui/rows-and-sheets';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminRequestsMessages } from '@/i18n/messages/admin-requests';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { listInsurers, type Insurer } from '@/lib/companies';
import { formatDay } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  approveKpmRequest,
  checkKpmCode,
  declineKpmRequest,
  deleteKpmRequest,
  readKpmRequests,
  type CodeAvailability,
  type KpmRequestRow,
  type StartFrom,
} from '@/lib/admin';
import { allSources, TemplateSourceSelect, useTemplateSources } from '@/components/kpm-template/template-sources';

/** A KPM code as approval takes it: four digits. */
const KPM_CODE = /^\d{4}$/;

/**
 * KPMs pending approval (`Superadmin.html:322-333`).
 *
 * The prototype's table is **read-only** — four columns, an alert-red `Pending` pill, and
 * no action anywhere: no approve, no decline, no reason, no drawer. So every control here
 * is ours, and it is registered as such. The interaction follows the leader-side pending
 * row (`User_Management_Section.html:891-908`), which is the nearest thing the prototype
 * does specify: Decline secondary, Approve primary, decided inline rather than in a modal.
 *
 * **Approving asks for the office code.** It has to be unique within the company and
 * nobody outside the platform can know what is free, which is why the prototype's `KPM
 * name` column is a branch name and the number is ours to issue.
 *
 * **P19-T3 (ADR-0191 §2–§5; UI-168, the client's explicit request).** Each card names the applicant — name, email,
 * phone, the day they asked — and the company is a picker, since a request filed by the old *Daftar KPM* may carry the
 * wrong one; the card says which company the applicant signed up with when the two differ. The code is checked as it
 * is typed and names the office that holds it. **"Setujui & jadikan Owner"** makes the office and its Owner in one
 * step. *Hapus* removes a wrong or duplicate request, asked first. A decided row names what its approval made.
 */
export default function KpmRequestsPage() {
  const t = useMessages(adminRequestsMessages);
  const figures = useFigureLanguage();
  /**
   * **Below 1024px the decided requests are rows** (P19.2-T2 AC-1; UI-126): the branch — opening the KPM it made, where
   * there is one — *company · proposed Owner* under it, then what it made, when it was decided and why; its state on
   * the right and *Hapus* in ⋯ (UI-135). From 1024px the table as before.
   */
  const rowsBelowLaptop = useMediaQuery(['phone', 'tablet']);
  const [rows, setRows] = useState<KpmRequestRow[] | null>(null);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<KpmRequestRow | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await readKpmRequests());
    } catch (err) {
      setError(toDisplayError(err));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    // The picker's companies: the insurers an office can belong to — the Template library is none.
    void listInsurers().then(setInsurers).catch(() => setInsurers([]));
  }, [load]);

  /** Every decision answers the queue as it now stands. */
  async function act(row: KpmRequestRow, work: () => Promise<KpmRequestRow[]>) {
    setBusy(row.requestId);
    setError(null);
    try {
      setRows(await work());
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  const pending = rows?.filter((r) => r.status === 'pending') ?? [];
  const decided = rows?.filter((r) => r.status !== 'pending') ?? [];

  return (
    // The nav item's words (P18.7-T9 AC-2; UI-027): *Pending KPM requests* (`Superadmin.html:189`).
    <Page
      title={t.kpm.title}
    >
      {error && <ErrorBanner {...error} />}

      {rows === null && !error && (
        <SkeletonCards count={3} label={t.kpm.loading} className="mb-3" />
      )}

      {rows && pending.length === 0 && (
        <Card>
          <EmptyState title={t.kpm.empty} />
        </Card>
      )}

      {pending.map((row) => (
        <RequestCard
          key={row.requestId}
          row={row}
          insurers={insurers}
          busy={busy}
          onApprove={(code, companyId, startFrom) => act(row, () => approveKpmRequest(
            row.requestId, code, companyId !== row.companyId ? companyId : undefined, startFrom,
          ))}
          onDecline={(reason) => act(row, () => declineKpmRequest(row.requestId, reason || undefined))}
          onRemove={() => setRemoving(row)}
        />
      ))}

      {decided.length > 0 && rowsBelowLaptop && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">{t.decided}</h2>
          <ListCard label={t.kpm.caption}>
            {decided.map((row) => {
              const made = row.createdKpm;
              return (
                <ListRow
                  key={row.requestId}
                  data-row={row.requestId}
                  href={made && !made.deleted ? `/admin/tenants/${made.kpmId}` : undefined}
                  title={row.branchName}
                  meta={`${row.companyName} · ${t.kpm.proposedOwner({ name: row.requestedByName })}`}
                  note={(
                    <span className="flex flex-col text-muted">
                      {made && (
                        <span className="text-navy">{made.deleted ? t.kpm.madeDeleted({ code: made.code }) : t.kpm.made({ code: made.code })}</span>
                      )}
                      {row.decidedAt && <span>{t.kpm.decidedOn({ date: formatDay(row.decidedAt, figures) })}</span>}
                      {row.reason && <span>{row.reason}</span>}
                    </span>
                  )}
                  trailing={(
                    <>
                      <StatusPill
                        status={row.status === 'approved' ? 'success' : 'neutral'}
                        label={row.status === 'approved' ? t.status.approved : t.status.declined}
                      />
                      <RowMenu
                        name={row.branchName}
                        items={[{ label: t.kpm.remove, tone: 'alert', disabled: busy !== null, onSelect: () => setRemoving(row) }]}
                      />
                    </>
                  )}
                />
              );
            })}
          </ListCard>
        </>
      )}

      {decided.length > 0 && !rowsBelowLaptop && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">{t.decided}</h2>
          <DataTable
            caption={t.kpm.caption}
            columns={[t.kpm.columns.name, t.kpm.columns.company, t.kpm.columns.requestedBy, t.kpm.columns.status]}
          >
            {decided.map((row) => (
              <Row key={row.requestId}>
                <Cell className="font-semibold">
                  {row.branchName}
                  {/* AC-3: the request moves here with its result — the office it made. */}
                  {row.createdKpm && (
                    <span className="block text-sm font-normal">
                      {row.createdKpm.deleted
                        ? <span className="text-muted">{t.kpm.madeDeleted({ code: row.createdKpm.code })}</span>
                        : (
                          <Link href={`/admin/tenants/${row.createdKpm.kpmId}`} className="text-navy underline">
                            {t.kpm.made({ code: row.createdKpm.code })}
                          </Link>
                        )}
                    </span>
                  )}
                </Cell>
                <Cell className="text-muted">{row.companyName}</Cell>
                <Cell className="text-muted">
                  {t.kpm.proposedOwner({ name: row.requestedByName })}
                  {row.reason && <span className="block text-sm">{row.reason}</span>}
                </Cell>
                <Cell>
                  <StatusPill
                    status={row.status === 'approved' ? 'success' : 'neutral'}
                    label={row.status === 'approved' ? t.status.approved : t.status.declined}
                  />
                  {row.decidedAt && (
                    <span className="mt-1 block text-sm text-muted">
                      {t.kpm.decidedOn({ date: formatDay(row.decidedAt, figures) })}
                    </span>
                  )}
                  <Button
                    variant="inlineDanger"
                    className="mt-1"
                    disabled={busy !== null}
                    onClick={() => setRemoving(row)}
                  >
                    {t.kpm.remove}
                  </Button>
                </Cell>
              </Row>
            ))}
          </DataTable>
        </>
      )}

      {/* AC-7: *Hapus* asks first; a soft delete, audited, and nothing the request made is touched. */}
      <Dialog
        open={removing !== null}
        message={removing ? t.kpm.removeAsk({ branch: removing.branchName }) : ''}
        confirmLabel={t.kpm.remove}
        tone="danger"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const row = removing;
          setRemoving(null);
          if (row) void act(row, () => deleteKpmRequest(row.requestId));
        }}
      />
    </Page>
  );
}

/**
 * **One pending request** (P19-T3 AC-1 to AC-3, AC-7): who asked and how to reach them, the company the office would
 * belong to — a picker, starting on the request's — the code, checked as it is typed, and the three decisions.
 */
function RequestCard({
  row,
  insurers,
  busy,
  onApprove,
  onDecline,
  onRemove,
}: {
  row: KpmRequestRow;
  insurers: Insurer[];
  busy: string | null;
  onApprove: (code: string, companyId: string, startFrom?: StartFrom) => void;
  onDecline: (reason: string) => void;
  onRemove: () => void;
}) {
  const t = useMessages(adminRequestsMessages);
  const figures = useFigureLanguage();
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134): the company and *Mulai dari* are pills opening their choices. */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [companyId, setCompanyId] = useState(row.companyId);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [check, setCheck] = useState<CodeAvailability | null>(null);
  /**
   * ***Mulai dari*, only for a company with no template** (ADR-0213 §3; P19.4-T5 AC-5): the same picker a new KPM has,
   * holding the built-in templates and *Kosong*, the built-in default chosen. A company with a template of its own starts
   * the office from its default, as approval always has, and draws no picker.
   */
  const sources = useTemplateSources(Boolean(companyId), { companyId, others: false, archived: false });
  const noTemplate = sources.groups !== null && !sources.groups.some((g) => g.companyId === companyId);
  const options = allSources(sources.groups);
  const [startFrom, setStartFrom] = useState('');
  useEffect(() => { setStartFrom(''); }, [companyId]);
  const pick = startFrom || (options[0]?.value ?? 'empty');
  const option = options.find((o) => o.value === pick) ?? null;

  /*
   * **The code, checked as it is typed** (AC-2): once it is four digits, against the company now chosen, a moment after
   * the last keystroke. A clash names the office holding it, as the approval's refusal would.
   */
  const shaped = KPM_CODE.test(code.trim());
  useEffect(() => {
    setCheck(null);
    if (!shaped || !companyId) return;
    let live = true;
    const timer = setTimeout(() => {
      checkKpmCode(companyId, code.trim())
        .then((answer) => { if (live) setCheck(answer); })
        .catch(() => { if (live) setCheck(null); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [code, companyId, shaped]);

  // Said before *Setujui* is pressed, and the button waits: the server refuses both anyway (ADR-0191 §3, ADR-0190 §4).
  const otherCompany = row.requesterCompanyId !== null && row.requesterCompanyId !== companyId;
  const cannotOwn = row.requesterCompanyId === null || otherCompany || !row.requesterEmailVerified;
  const taken = check !== null && !check.available;
  // The request's company stays on offer even when it is not an insurer the registration list names.
  const choices = insurers.some((c) => c._id === row.companyId)
    ? insurers
    : [{ _id: row.companyId, name: row.companyName }, ...insurers];

  return (
    <Card className="mb-3">
      <div className="flex flex-wrap items-start gap-4">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-md font-bold text-navy">
            {row.branchName}
          </span>
          <span className="block text-sm text-muted">
            {t.kpm.meta({
              name: <strong>{row.requestedByName}</strong>,
              email: row.requestedByEmail,
              phone: row.requestedByPhone,
              date: formatDay(row.requestedAt, figures),
            })}
          </span>
          {row.note && <span className="mt-1 block text-md text-navy">{row.note}</span>}
        </span>
        <StatusPill status="alert" label={t.status.pending} />
      </div>

      <FieldRow className="mt-3">
        <Field label={t.kpm.company} htmlFor={`company-${row.requestId}`} className="min-w-[12rem]">
          {belowLaptop ? (
            <ChoicePill
              id={`company-${row.requestId}`}
              name={t.kpm.company}
              options={choices.map((c) => ({ key: c._id, label: c.name }))}
              value={companyId}
              onChange={setCompanyId}
              narrows={false}
              shows="value"
              className="self-start"
            />
          ) : (
            <Select
              id={`company-${row.requestId}`}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {choices.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field
          label={t.kpm.code}
          htmlFor={`code-${row.requestId}`}
          className="w-40"
          error={taken && check?.takenBy
            ? t.kpm.codeTaken({
              office: `KPM ${check.takenBy.code} · ${check.takenBy.branchName}`, company: check.takenBy.companyName,
            })
            : undefined}
          hint={check?.available ? t.kpm.codeFree : undefined}
        >
          <TextInput
            id={`code-${row.requestId}`}
            inputMode="numeric"
            placeholder="0629"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            invalid={taken}
          />
        </Field>
        <FieldRow.Actions>
          <Button
            disabled={busy !== null || !shaped || taken || cannotOwn}
            onClick={() => onApprove(code.trim(), companyId, noTemplate
              ? (option ? { kind: 'template', templateLibrary: true, templateId: option.templateId } : { kind: 'empty' })
              : undefined)}
          >
            {busy === row.requestId ? t.approving : t.kpm.approveAndOwn}
          </Button>
        </FieldRow.Actions>
      </FieldRow>

      {noTemplate && (
        <Field
          label={t.kpm.startFrom}
          htmlFor={`start-${row.requestId}`}
          hint={t.kpm.startFromHint}
          className="mt-3 max-w-md"
        >
          {belowLaptop ? (
            // The select's options in its order, each under whose it is, *Kosong* last (as *KPM baru*'s pill).
            <ChoicePill
              id={`start-${row.requestId}`}
              name={t.kpm.startFrom}
              options={[
                ...(sources.groups ?? []).flatMap((g) => g.options.map((o) => ({ key: o.value, label: o.label, hint: g.label }))),
                { key: 'empty', label: t.kpm.startEmpty },
              ]}
              value={pick}
              onChange={setStartFrom}
              narrows={false}
              shows="value"
              className="self-start"
            />
          ) : (
            <TemplateSourceSelect
              id={`start-${row.requestId}`}
              groups={sources.groups ?? []}
              value={pick}
              onChange={setStartFrom}
            >
              <option value="empty">{t.kpm.startEmpty}</option>
            </TemplateSourceSelect>
          )}
        </Field>
      )}

      {/* What stands in the way of the applicant owning it, in the card's own words. */}
      {otherCompany && row.requesterCompanyName && (
        <p className="mt-2 text-md text-alert">
          {t.kpm.signedUpWith({ name: row.requestedByName, company: row.requesterCompanyName })}
        </p>
      )}
      {row.requesterCompanyId === null && (
        <p className="mt-2 text-md text-alert">{t.kpm.noCompany({ name: row.requestedByName })}</p>
      )}
      {!row.requesterEmailVerified && (
        <p className="mt-2 text-md text-alert">{t.kpm.unverified({ name: row.requestedByName })}</p>
      )}
      {/* Approving provisions an office and hands somebody the keys to it, so the
          button says what it will do before it does it. */}
      <p className="mt-2 text-sm text-muted">
        {t.kpm.approvingMeans({ name: row.requestedByName })}
      </p>

      <FieldRow className="mt-3">
        <Field label={t.whyNot} htmlFor={`why-${row.requestId}`} className="min-w-[16rem] flex-1">
          <TextInput
            id={`why-${row.requestId}`}
            placeholder={t.sentBack}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <FieldRow.Actions>
          <Button variant="danger" disabled={busy !== null} onClick={() => onDecline(reason)}>
            {t.decline}
          </Button>
        </FieldRow.Actions>
        <FieldRow.Actions>
          <Button variant="inlineDanger" disabled={busy !== null} onClick={onRemove}>
            {t.kpm.remove}
          </Button>
        </FieldRow.Actions>
      </FieldRow>
    </Card>
  );
}
