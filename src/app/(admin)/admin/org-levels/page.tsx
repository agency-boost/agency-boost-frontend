'use client';

import { Children, isValidElement, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { InlineSaveField, useInlineSave, type InlineSaveOutcome } from '@/components/ui/inline-save-status';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  createOrgLevel,
  deleteOrgLevel,
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
import { useMediaQuery } from '@/lib/use-media-query';
import { AddButton, AddSheet, ChoicePill, ChoiceRows, InfoTip, RowMenu } from '@/components/ui/rows-and-sheets';

type LadderWords = MessagesOf<typeof adminTemplateOrgLevelsMessages.en>;

/** The server's own rule, so the form cannot offer a code the API will refuse. */
const CODE = /^[A-Za-z][A-Za-z0-9_]{1,31}$/;

/** A rung's *Leader tier* select, in its *Saving… → Saved ✓* (P18.7-T1 AC-5): by its id, unique across companies. */
const tierKey = (orgLevelId: string) => `${orgLevelId}\ntier`;
/** A rung's label, in its own *Saving… → Tersimpan ✓* (ADR-0213 §1). */
const labelKey = (orgLevelId: string) => `${orgLevelId}\nlabel`;

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
 * Org role ladder (P3.1-T7, ADR-0012).
 *
 * **No prototype counterpart.** `AgencyBoost_Superadmin.html:188` makes `Org role ladder` a
 * disabled `Soon` link; the only thing the prototype says about a ladder is the company
 * card's meta line, *"Role ladder: Agent → AAB → AB"* (`:311`), which this screen is what
 * finally puts data behind. Registered as a Fill.
 *
 * **The Leader tier column and field** (P18.5-T1, ADR-0156) are the client's request of
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
 *
 * **Every change names the rung's version as read** (P19-T6 AC-2; the 11-03 handover's B1-10): a rung somebody else
 * changed since is refused `409 VERSION_CONFLICT`, nothing written. The ladder is read again at once and the banner
 * says what happened in this screen's words, so the table shows what is stored before anybody tries again.
 *
 * **The label is edited in its cell, and an archived rung nothing names can be deleted** (P19.4-T5 AC-1, AC-2; ADR-0213
 * §1, §2; the 11-03 handover's B1-6). The label saves as the field is left, with *Saving… → Tersimpan ✓* beside it, as
 * the tier's select does; its code is never in the request. *Hapus* sits beside *Pulihkan* on an archived row, asks
 * first, and a rung something names is refused by the server with what names it, said in the banner. **The table answers
 * every write at once** (AC-3): the company's ladder the write answers replaces the company's rows. The production report
 * that it did not after *Arsipkan* could not be reproduced against this code; a test pins the table's answer to it.
 *
 * **Rows below 1024px, the table from it, and *Tambah jenjang* in a sheet** (P19.2-T2 AC-1, AC-3, AC-4, AC-5; UI-126,
 * UI-133, UI-134, UI-135; `admin-mobile` screen 4). Below 1024px: the company a pill opening its choices, the active
 * ladder beside it, and one 56px row per rung — its order in a circle, its label, its code, its tier a pill opening three
 * choice rows (saved as it is chosen, *Menyimpan… → Tersimpan ✓* under it), and ⋯ holding *Ganti nama*, *Arsipkan* or
 * *Pulihkan*, and *Hapus* on an archived rung. From 1024px the table as it was, at the content's full width — its selects,
 * which a laptop may keep (UI-134), and its row actions. *+ Tambah jenjang* on the title row opens the add sheet at every
 * size, the tier as three choice rows; its main button is enabled, and a field left empty says so when it is pressed.
 */
/** A message's words as one string, for an ⓘ's bubble: its strings and its elements' strings, in order. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return Children.toArray(node.props.children).map(textOf).join('');
  return '';
}

export default function OrgLevelsPage() {
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const tablet = useMediaQuery('tablet');
  const phone = useMediaQuery('phone');
  const t = useMessages(adminTemplateOrgLevelsMessages);
  const columns = columnsOf(t.columns);
  const tiers = tiersOf(t.tiers);
  const [levels, setLevels] = useState<OrgLevel[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  /** *Tambah jenjang*'s sheet, open or not (UI-133). */
  const [adding, setAdding] = useState(false);
  /** The rung whose label is being changed from its row's ⋯, below 1024px. */
  const [renaming, setRenaming] = useState<OrgLevel | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Each rung's label as typed, by id, until it is saved or left unchanged. */
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<OrgLevel | null>(null);
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

  const takenCode = error?.code === 'ORG_LEVEL_CODE_TAKEN' ? error.message : undefined;
  const forCompany = (levels ?? []).filter((l) => l.companyId === companyId);
  // Junior first, and the next rung goes on the end — the reader is extending a ladder,
  // not inserting into one. Reordering is what `displayOrder` is for, once there is a
  // reason to.
  const nextOrder = forCompany.reduce((n, l) => Math.max(n, l.displayOrder), 0) + 1;

  /** *Tambah jenjang*: appended to the chosen company's ladder; the sheet closes on the ladder the write answers. */
  async function add(input: { code: string; label: string; tier: LeaderTier | '' }) {
    setBusy('add');
    setError(null);
    try {
      const ladder = await createOrgLevel({
        companyId,
        code: input.code,
        label: input.label,
        displayOrder: nextOrder,
        leaderTier: input.tier || null,
      });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== companyId), ...ladder]);
      setAdding(false);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  /** Somebody else changed the rung first (P19-T6 AC-2): said in this screen's words, and the ladder read again. */
  async function readAgain(refusal: ApiError, level: OrgLevel) {
    setError({ ...refusal, message: t.savedElsewhere({ rung: level.label }) });
    try {
      setLevels(await listOrgLevels());
    } catch {
      // The banner already says the change did not land; the table keeps what it showed.
    }
  }

  async function setStatus(level: OrgLevel, status: 'active' | 'archived') {
    setBusy(level.orgLevelId);
    setError(null);
    try {
      replaceLadder(level.companyId, await updateOrgLevel(level.orgLevelId, { status, expectedVersion: level.version }));
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') await readAgain(shown, level);
      else setError(shown);
    } finally {
      setBusy(null);
    }
  }

  /** The company's rows replaced by the ladder a write answered: what the table shows at once (AC-3). */
  const replaceLadder = (companyOf: string, ladder: OrgLevel[]) =>
    setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== companyOf), ...ladder]);

  /**
   * **A rung's label, saved as its field is left** (ADR-0213 §1): unchanged or blank is no save, and its words go back to
   * the stored ones. `null` — a refusal sending it again cannot change — leaves no retry; the banner says why.
   */
  async function saveLabel(level: OrgLevel, typed: string): Promise<InlineSaveOutcome> {
    const label = typed.trim();
    setError(null);
    try {
      replaceLadder(level.companyId, await updateOrgLevel(level.orgLevelId, { label, expectedVersion: level.version }));
      setLabels((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== level.orgLevelId)));
      return true;
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') await readAgain(shown, level);
      else setError(shown);
      return err instanceof ApiRequestError && err.status < 500 ? null : false;
    }
  }

  function leaveLabel(level: OrgLevel) {
    const typed = labels[level.orgLevelId];
    if (typed === undefined) return;
    if (!typed.trim() || typed.trim() === level.label) {
      setLabels((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== level.orgLevelId)));
      return;
    }
    void inline.save(labelKey(level.orgLevelId), () => saveLabel(level, typed));
  }

  /** *Hapus*, asked first (ADR-0213 §2): the server refuses a live rung, or one anything names, and says why. */
  async function remove(level: OrgLevel) {
    setDeleting(null);
    setBusy(level.orgLevelId);
    setError(null);
    try {
      replaceLadder(level.companyId, await deleteOrgLevel(level.orgLevelId, level.version));
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') await readAgain(shown, level);
      else setError(shown);
    } finally {
      setBusy(null);
    }
  }

  /*
   * **Saved on change**, like Archive beside it: one value, and the server is the one that can say
   * no — while anybody stands on the rung it refuses, with the count, and the select still shows the
   * stored tier because it reads the ladder, which only a success replaces.
   *
   * **And it says so beside the select** (P18.7-T1 AC-5): *Saving… → Saved ✓*, or *Couldn't save —
   * retry*, which sends this same tier again. A `409` — the rung is held, or it changed — is a refusal
   * sending the same tier again cannot change, so it leaves no retry (`null`): the banner says why.
   */
  async function setLeaderTier(level: OrgLevel, value: LeaderTier | ''): Promise<InlineSaveOutcome> {
    setBusy(level.orgLevelId);
    setError(null);
    try {
      const ladder = await updateOrgLevel(level.orgLevelId, { leaderTier: value || null, expectedVersion: level.version });
      setLevels((all) => [...(all ?? []).filter((l) => l.companyId !== level.companyId), ...ladder]);
      return true;
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') await readAgain(shown, level);
      else setError(shown.code === 'ORG_LEVEL_TIER_IN_USE' ? tierInUse(shown, level, t) : shown);
      return err instanceof ApiRequestError && err.status === 409 ? null : false;
    } finally {
      setBusy(null);
    }
  }

  const company = companies.find((c) => c._id === companyId);
  const activeLadder = forCompany.filter((l) => l.status === 'active').map((l) => l.label).join(' → ') || null;
  const libraryChosen = company ? isTemplateLibrary(company) : false;

  /** A rung's ⋯ below 1024px (UI-126: *⋯ (Arsipkan / Pulihkan)*; UI-135): its label, its state, and *Hapus* when archived. */
  const menuOf = (l: OrgLevel) => [
    { label: t.rename, onSelect: () => { setError(null); setRenaming(l); } },
    l.status === 'active'
      ? { label: t.archive, tone: 'alert' as const, onSelect: () => void setStatus(l, 'archived') }
      : { label: t.restore, onSelect: () => void setStatus(l, 'active') },
    ...(l.status === 'archived'
      ? [{ label: t.delete, tone: 'alert' as const, onSelect: () => setDeleting(l) }] : []),
  ];

  const tierChoices = tiers.map((x) => ({ key: x.value || 'none', label: x.label }));

  return (
    <Page
      title={t.title}
      permission="org_level:crud"
      // The add button on the title row at every size (UI-133): `actions` alone is the row's at every width.
      actions={companyId ? <AddButton label={t.add} phone={phone} onClick={() => { setError(null); setAdding(true); }} /> : undefined}
    >
      {error && !takenCode && !adding && !renaming && <ErrorBanner {...error} />}

      {belowLaptop ? (
        // **The company as a pill** (UI-134: *a pill that opens a sheet for long lists (company)*), the active ladder
        // beside it as `admin-mobile` screen 4 draws it.
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ChoicePill
            name={t.company}
            options={companies.map((c) => ({ key: c._id, label: c.name }))}
            value={companyId}
            onChange={setCompanyId}
            narrows
          />
          {libraryChosen && <ConfigBadge tone="navy">{t.templateLibrary}</ConfigBadge>}
          {activeLadder && <span data-ladder-line="" className="text-sm text-muted">{activeLadder}</span>}
        </div>
      ) : (
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
      )}

      {levels === null && <SkeletonTable caption={t.ladder} columns={columns} rows={3} />}

      {levels !== null && forCompany.length === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState
            title={company ? t.noLadder({ company: company.name }) : t.noCompany}
          />
        </div>
      )}

      {forCompany.length > 0 && belowLaptop && (
        <ListCard label={t.ladderCaption}>
          {forCompany.map((l) => (
            <ListRow
              key={l.orgLevelId}
              data-row={l.orgLevelId}
              lead={(
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-sm font-bold ${
                    l.status === 'active' ? 'bg-secondary text-secondary-contrast' : 'bg-pill-grey text-muted'}`}
                >
                  {l.displayOrder}
                </span>
              )}
              title={l.label}
              meta={l.status === 'active' ? l.code : t.rowArchived({ code: l.code })}
              trailing={(
                <>
                  {/* The tier, saved as it is chosen, its *Menyimpan… → Tersimpan ✓* under the pill (P18.7-T1 AC-5). */}
                  <InlineSaveField status={inline.statusOf(tierKey(l.orgLevelId))} label={t.tierStatus({ rung: l.label })}>
                    <ChoicePill
                      name={t.tierOf({ rung: l.label })}
                      options={tierChoices}
                      value={l.leaderTier ?? 'none'}
                      shows="value"
                      narrows={false}
                      disabled={busy !== null}
                      onChange={(key) => {
                        const value = (key === 'none' ? '' : key) as LeaderTier | '';
                        if (value === (l.leaderTier ?? '')) return;
                        void inline.save(tierKey(l.orgLevelId), () => setLeaderTier(l, value));
                      }}
                    />
                  </InlineSaveField>
                  <RowMenu name={l.label} items={menuOf(l)} />
                </>
              )}
            />
          ))}
        </ListCard>
      )}

      {forCompany.length > 0 && !belowLaptop && (
        // The content's full width from 1024px: the add form is a sheet now (UI-126, UI-133), not a column beside it.
        <DataTable caption={t.ladderCaption} columns={columns}>
          {forCompany.map((l) => (
            <Row key={l.orgLevelId}>
              <Cell className="text-muted">{l.displayOrder}</Cell>
              <Cell>
                {/* The label, edited where it is read and saved as it is left (ADR-0213 §1). */}
                <InlineSaveField status={inline.statusOf(labelKey(l.orgLevelId))} label={t.labelStatus({ rung: l.code })}>
                  <TextInput
                    density="cell"
                    className="font-semibold"
                    aria-label={t.labelOf({ rung: l.code })}
                    maxLength={60}
                    value={labels[l.orgLevelId] ?? l.label}
                    disabled={busy !== null}
                    onChange={(e) => setLabels((now) => ({ ...now, [l.orgLevelId]: e.target.value }))}
                    onBlur={() => leaveLabel(l)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                </InlineSaveField>
              </Cell>
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
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Button
                    variant="inlineDanger"
                    disabled={busy !== null}
                    onClick={() => void setStatus(l, l.status === 'active' ? 'archived' : 'active')}
                  >
                    {l.status === 'active' ? t.archive : t.restore}
                  </Button>
                  {/* Only an archived rung may go, and only when nothing names it — which the server decides. */}
                  {l.status === 'archived' && (
                    <Button variant="inlineDanger" disabled={busy !== null} onClick={() => setDeleting(l)}>
                      {t.delete}
                    </Button>
                  )}
                </span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      {forCompany.length > 0 && (
        <>
          {/*
            * **The reading order** (P19.2-T2 AC-7; UI-136, Appendix A's org-levels row: *Remove · ⓘ · Show*, wording
            * unchanged): written out from 1024px, behind an ⓘ on a tablet, not drawn on a phone.
            */}
          <p data-explains="reading-order" className="mt-3 text-sm text-muted max-lg:hidden">
            {t.readingOrder({ ladder: activeLadder, strong: (words) => <strong>{words}</strong> })}
          </p>
          {tablet && (
            <p data-explains="reading-order-tip" className="mt-3 flex items-center gap-1 text-sm text-muted">
              {t.ladder}
              <InfoTip about={t.ladder} tip={textOf(t.readingOrder({ ladder: activeLadder, strong: (words) => words }))} />
            </p>
          )}
        </>
      )}

      {adding && (
        <RungSheet
          busy={busy === 'add'}
          error={error}
          position={nextOrder}
          belowLaptop={belowLaptop}
          onClose={() => { setAdding(false); setError(null); }}
          onAdd={add}
        />
      )}

      {renaming && (
        <LabelSheet
          key={renaming.orgLevelId}
          level={renaming}
          busy={busy !== null}
          error={error}
          onClose={() => { setRenaming(null); setError(null); }}
          onSave={async (typed) => {
            const level = levels?.find((l) => l.orgLevelId === renaming.orgLevelId) ?? renaming;
            setBusy(level.orgLevelId);
            const saved = await saveLabel(level, typed);
            setBusy(null);
            if (saved === true) setRenaming(null);
          }}
        />
      )}

      <Dialog
        open={deleting !== null}
        message={deleting ? t.deleteQuestion({ rung: deleting.label, code: deleting.code }) : ''}
        confirmLabel={t.delete}
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void remove(deleting); }}
      />
    </Page>
  );
}

/**
 * ***Tambah jenjang*, as a sheet** (P19.2-T2 AC-3, AC-4; UI-133, UI-134): the code, the label and the tier as three choice
 * rows, with where the rung goes. **The main button is enabled**: a field left empty says so when it is pressed, and a
 * code of a shape the server refuses says so as it is typed — neither is sent. A taken code comes back as its own code
 * and is said on the Code field. The code's rule (Appendix A: *ⓘ · ⓘ · Show*): the field's hint from 1024px, an ⓘ beside
 * it below.
 */
function RungSheet({
  busy,
  error,
  position,
  belowLaptop,
  onClose,
  onAdd,
}: {
  busy: boolean;
  error: ApiError | null;
  position: number;
  belowLaptop: boolean;
  onClose: () => void;
  onAdd: (input: { code: string; label: string; tier: LeaderTier | '' }) => Promise<void>;
}) {
  const t = useMessages(adminTemplateOrgLevelsMessages);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [tier, setTier] = useState<LeaderTier | ''>('');
  const [pressed, setPressed] = useState(false);
  const badCode = code.length > 0 && !CODE.test(code);
  const takenCode = error?.code === 'ORG_LEVEL_CODE_TAKEN' ? error.message : undefined;
  const codeError = badCode ? t.codeShape : pressed && !code.trim() ? t.required : takenCode;
  const labelError = pressed && !label.trim() ? t.required : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setPressed(true);
    if (!code.trim() || !label.trim() || badCode || busy) return;
    void onAdd({ code: code.trim(), label: label.trim(), tier });
  }

  return (
    <AddSheet open title={t.addTitle} submitLabel={busy ? t.adding : t.add} busy={busy} onClose={onClose} onSubmit={submit}>
      {error && !takenCode && <ErrorBanner {...error} />}
      <div className="flex items-start gap-1">
        <Field
          label={t.code}
          htmlFor="code"
          hint={belowLaptop ? undefined : t.codeHint}
          error={codeError}
          className="min-w-0 flex-1"
        >
          <TextInput id="code" value={code} onChange={(e) => setCode(e.target.value)} invalid={Boolean(codeError)} />
        </Field>
        {belowLaptop && <InfoTip about={t.code} tip={t.codeHint} className="mt-0.5" />}
      </div>
      <Field label={t.label} htmlFor="label" hint={t.labelHint} error={labelError}>
        <TextInput id="label" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} invalid={Boolean(labelError)} />
      </Field>
      <div>
        <p id="rung-tier" className="mb-1.5 text-md font-semibold text-navy">{t.tier}</p>
        <ChoiceRows
          labelledBy="rung-tier"
          value={tier || 'none'}
          onChange={(key) => setTier((key === 'none' ? '' : key) as LeaderTier | '')}
          disabled={busy}
          options={tiersOf(t.tiers).map((x) => ({ key: x.value || 'none', label: x.label }))}
        />
      </div>
      <p className="text-xs text-muted">{t.position({ n: position })}</p>
    </AddSheet>
  );
}

/**
 * **A rung's label from its row's ⋯, below 1024px** (P19.2-T2 AC-1; ADR-0213 §1): the label alone, saved with *Simpan*
 * and pinned to the version read, as the table's field saves it when left; its code is never in the request. Blank or
 * unchanged is no save.
 */
function LabelSheet({
  level,
  busy,
  error,
  onClose,
  onSave,
}: {
  level: OrgLevel;
  busy: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSave: (typed: string) => Promise<void>;
}) {
  const t = useMessages(adminTemplateOrgLevelsMessages);
  const [typed, setTyped] = useState(level.label);
  const [pressed, setPressed] = useState(false);
  const labelError = pressed && !typed.trim() ? t.required : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setPressed(true);
    if (!typed.trim() || busy) return;
    if (typed.trim() === level.label) {
      onClose();
      return;
    }
    void onSave(typed);
  }

  return (
    <AddSheet open title={t.labelOf({ rung: level.code })} submitLabel={t.save} busy={busy} onClose={onClose} onSubmit={submit}>
      {error && <ErrorBanner {...error} />}
      <Field label={t.label} htmlFor="rename-label" hint={t.labelHint} error={labelError}>
        <TextInput
          id="rename-label"
          maxLength={60}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          invalid={Boolean(labelError)}
        />
      </Field>
    </AddSheet>
  );
}
