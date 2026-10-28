'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { PdfUploadNotice, usePdfUpload } from '@/components/recruitment/pdf-upload';
import { SettingsScreen } from '@/components/settings-screen';
import { BelowDesktopTip } from '@/components/ui/below-desktop-tip';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, Switch, Textarea, TextInput,
} from '@/components/ui/field';
import { InlineSaveStatus, useInlineSave } from '@/components/ui/inline-save-status';
import { CONTROL_PHONE } from '@/components/ui/phone';
import { SkeletonCards } from '@/components/ui/skeleton';
import { SHOWN_FROM_DESKTOP } from '@/components/ui/tablet';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useCan } from '@/lib/session';
import { useHashTab } from '@/lib/use-hash-tab';
import {
  approveScript, kpmProductDocumentUrl, listKpmProducts, listScriptReviews, readBranchInfo,
  readEffectiveScript, rejectScript, requestProductUpload, resetKpmProductDocument,
  resetKpmProductOverride, saveKpmProductOverrides, setKpmProductActive, setKpmProductDocument,
  PRODUCT_DESCRIPTION_MAX, type KpmProductRow,
} from '@/lib/tenant-config';

/** The seven the override modal names, in its order (`KPM_Owner.html:1785-1791`). */
const SCRIPT_FIELDS: { key: string; label: string; lines?: number; list?: true }[] = [
  { key: 'goodFit', label: '0 · Good fit for', lines: 2 },
  { key: 'opening', label: '1 · Opening line', lines: 2 },
  { key: 'benefits', label: '2 · Lead with these benefits', lines: 5, list: true },
  { key: 'fullScript', label: '3 · Full script — how to narrate it', lines: 5 },
  { key: 'objectionTheySay', label: '4a · If they push back — they say', lines: 2 },
  { key: 'objectionYouSay', label: '4b · If they push back — you say', lines: 3 },
  { key: 'nextAction', label: '5 · Next action', lines: 2 },
];

/**
 * The prototype's own label, guidance folded into it (`KPM_Owner.html:1781`; parity L-20). The
 * field replaces the company's tagline wherever agents read one, once approved (OD-136).
 */
const DESCRIPTION_LABEL = 'Short description (shown to agents)';

/**
 * **The shelf's one grey sentence, in the client's words** (P18.97-T4 AC-6, ADR-0176 §6; the grey-text table, UI-027):
 * the 50 words on whose catalog this is read as this, shown from 1024px and behind an ⓘ below it.
 */
const SHELF_NOTE = 'Your changes apply to this office only.';

const REVIEW: Record<string, { tone: 'won' | 'open'; text: string }> = {
  pending: { tone: 'open', text: 'Waiting for your approval' },
  approved: { tone: 'won', text: 'Approved' },
  rejected: { tone: 'open', text: 'Sent back' },
};

const asText = (value: string | string[]) => (Array.isArray(value) ? value.join('\n') : value);

/** A product's *Agents sell it* switch, in its *Saving… → Saved ✓* (P18.95-T1 AC-5). */
const sellKey = (productId: string) => `${productId}\nactive`;

/**
 * A product document's upload (P17-T9, D-productdocs): the office's own PDF for one slot, through the
 * control the recruitment pitch uses — refused here when it is not a PDF or larger than the bound,
 * signed into the office's own folder, sent straight to storage, then attached by
 * `PUT /kpm/settings/products/:productId/documents/:slot`, which confirms what landed.
 *
 * The prototype's words and place (`KPM_Owner.html:2404`): a row action beside *Open link →*, *Replace*
 * when the slot holds a file — the company's or the office's — and *+ Upload* when it holds none.
 * Offered on a product the office keeps on only (AC-1), and never without `tenant_config:write`, which
 * a read-only support session does not hold. The name says which document, since every row has one.
 */
function DocumentUpload({
  productId,
  slot,
  label,
  hasFile,
  disabled,
  onAttached,
}: {
  productId: string;
  slot: string;
  label: string;
  hasFile: boolean;
  disabled: boolean;
  onAttached: (row: KpmProductRow) => void;
}) {
  const upload = usePdfUpload<KpmProductRow>({
    sign: requestProductUpload,
    // The label is the file's own name, cut to the 200 characters the attach takes, so a long name that
    // signed and uploaded is never refused afterwards.
    attach: (storageKey, file) => setKpmProductDocument(productId, slot, { storageKey, label: file.name.slice(0, 200) }),
    onAttached,
  });
  const blocked = disabled || upload.busy;

  return (
    <>
      <Button
        variant="inline"
        aria-label={hasFile ? `Replace ${label}` : `Upload ${label}`}
        // Not `disabled`, which would drop the focus while the file is on its way.
        aria-disabled={blocked || undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        onClick={() => { if (!blocked) upload.choose(); }}
      >
        {hasFile ? 'Replace' : '+ Upload'}
      </Button>
      {upload.picker}
      {/* Under the row, whichever of its actions comes after: the row wraps it onto its own line. */}
      <PdfUploadNotice state={upload} className="order-last flex basis-full flex-col gap-2" />
    </>
  );
}

/**
 * What this office sells, and the words it sells it with (P5-T5, ADR-0033).
 *
 * **The catalog is the company's and is read live.** Nothing here copies a product: each row shows
 * the company's value with this office's decision laid over it, field by field, so a company edit
 * to something this office has not touched arrives on the next read with nobody publishing
 * anything — and a product the company withdraws stops being sellable with no action here at all.
 *
 * **Every "use my company's again" is an unset, never a copy.** The prototype's Reset copies the
 * default into the form, which looks identical today and silently freezes today's wording into the
 * office for ever.
 */
/** The two halves of this screen: the shelf, and what is waiting on somebody (P5-T10). */
const TABS = [
  { label: 'Products', href: '#products' },
  { label: 'Script approvals', href: '#approvals' },
];

export default function KpmProductsPage() {
  const canWrite = useCan('tenant_config:write');
  /** The screen's own read: without it the gate refuses, and nothing here asks the API for the drafts. */
  const canRead = useCan('product_settings:read');
  /**
   * Approving is its **own** permission (ADR-0037), and the one deliberate exception to
   * ADR-0027's single settings permission — so somebody may be able to edit a script and not to
   * approve it the day that grant moves.
   */
  const canApprove = useCan('sales_script:approve');
  const [tab, setTab] = useHashTab(TABS);
  /**
   * The product whose *Review* was chosen on the shelf (P18.97-T4 AC-7, ADR-0176 §7; UI-028): its card on *Script
   * approvals* takes the focus once the queue holds it, so the reader lands on the script they asked to review.
   */
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<KpmProductRow[] | null>(null);
  /**
   * The office's own insurer, read rather than assumed.
   *
   * The prototype writes **Prudential** into this screen eleven times (`KPM_Owner.html:1705`,
   * `:1784`, `:2397`…). A second insurer's office would read another company's name on every row
   * of its own settings.
   */
  const [company, setCompany] = useState('your company');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  /**
   * The queue, read from its own route rather than filtered out of the shelf.
   *
   * The shelf is 31 rows and the queue is usually none of them; asking the server which ones are
   * waiting is both the cheaper read and the one whose answer cannot drift from the gate's own
   * idea of what is pending.
   */
  const [queue, setQueue] = useState<KpmProductRow[] | null>(null);
  /** What agents are reading **right now**, per product — the comparison a decision needs. */
  const [served, setServed] = useState<Record<string, { source: 'kpm' | 'company' }>>({});
  const inline = useInlineSave();

  const load = useCallback(async () => {
    try {
      const [shelf, branch] = await Promise.all([listKpmProducts(), readBranchInfo()]);
      setRows(shelf);
      setCompany(branch.companyName);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { if (canRead) void load(); }, [load, canRead]);

  const loadQueue = useCallback(async () => {
    try {
      const waiting = await listScriptReviews();
      setQueue(waiting);
      // What each one's agents are reading today, so an approval is a comparison rather than a
      // leap: this is the same read Phase 12 serves an agent, so what is shown here is what they
      // have, not a reconstruction of it.
      const now = await Promise.all(waiting.map(async (p) => {
        const { source } = await readEffectiveScript(p.productId);
        return [p.productId, { source }] as const;
      }));
      setServed(Object.fromEntries(now));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { if (canRead && tab === '#approvals') void loadQueue(); }, [tab, loadQueue, canRead]);

  // *Review*'s landing: the product's card, once it is drawn — the queue read may still be on its way.
  useEffect(() => {
    if (tab !== '#approvals' || reviewing === null || queue === null) return;
    const card = document.getElementById(`review-${reviewing}`);
    if (!card) return;
    card.scrollIntoView?.({ block: 'center' });
    card.focus();
    setReviewing(null);
  }, [tab, reviewing, queue]);

  const run = async (action: () => Promise<KpmProductRow>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setRows((now) => now?.map((p) => (p.productId === row.productId ? row : p)) ?? now);
      return row;
    } catch (err) {
      setError(toDisplayError(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** A decision leaves the queue: it changes both halves, so both are re-read. */
  const decide = async (action: () => Promise<KpmProductRow>) => {
    const row = await run(action);
    if (row) await loadQueue();
    return row;
  };

  function body() {
    if (rows === null) return error ? null : <SkeletonCards count={4} />;
    if (rows.length === 0) {
      return (
        <EmptyState title={`${company} has no products on its catalog yet.`} />
      );
    }

    const selling = rows.filter((p) => p.sellable && p.active.value).length;

    return (
      <div className="flex flex-col gap-4">
        <Card>
          <p className={cn('text-md text-muted', SHOWN_FROM_DESKTOP)}>{SHELF_NOTE}</p>
          {/*
            * Counted from what is actually sellable. The prototype's header reads "6 active" over
            * seven toggles, because it counts a list it no longer matches (P5-T5 AC-8). Below 1024px it is the card's
            * first line, and the sentence above it is the ⓘ after it (P18.97-T4 AC-6).
            */}
          <p className="text-sm text-muted lg:mt-2">
            {rows.length} products · <strong>{selling}</strong> your agents can sell
            {rows.some((p) => !p.sellable) && (
              <> · {rows.filter((p) => !p.sellable).length} withdrawn by {company}</>
            )}
            <BelowDesktopTip text={SHELF_NOTE} className="ml-1" />
          </p>
        </Card>

        {error && (
          <div role="alert" className="rounded-md border border-amber bg-card p-4">
            <p className="text-md text-navy">{error.message}</p>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {rows.map((product) => (
            <li key={product.productId}>
              <Card className="p-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-md font-semibold text-navy">
                      {product.displayName.value}
                    </h2>
                    {product.displayName.overridden && (
                      <p className="mt-0.5 text-sm text-muted">
                        {company} calls it {product.companyName}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <ConfigBadge tone="open">{product.category}</ConfigBadge>
                      {/*
                        * Syariah green, conventional grey, exactly as the prototype has them
                        * (`KPM_Owner.html:1714`, `:1748`). The field arrived from the API from the
                        * day this screen was built and nothing rendered it, so an office selling
                        * both could not tell one shelf from the other.
                        */}
                      <ConfigBadge tone={product.channel === 'syariah' ? 'won' : 'open'}>
                        {product.channel === 'syariah' ? 'Syariah' : 'Conventional'}
                      </ConfigBadge>
                      {!product.sellable && (
                        <ConfigBadge tone="open">Withdrawn by {company}</ConfigBadge>
                      )}
                      {product.reviewState !== 'none' && (
                        <ConfigBadge tone={REVIEW[product.reviewState].tone}>
                          {REVIEW[product.reviewState].text}
                        </ConfigBadge>
                      )}
                      {/*
                        * **The badge's action, beside it** (P18.97-T4 AC-7, ADR-0176 §7; UI-028: *"WAITING FOR YOUR
                        * APPROVAL"* with no way to act on it from the row): the product's script review, where it is
                        * approved or sent back — for whoever holds `sales_script:approve`, which the API checks again.
                        */}
                      {product.reviewState === 'pending' && canApprove && (
                        <Button
                          variant="inline"
                          aria-label={`Review ${product.displayName.value}`}
                          onClick={() => {
                            setReviewing(product.productId);
                            setTab('#approvals');
                          }}
                        >
                          Review
                        </Button>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {product.sellable && (
                      /*
                        * The prototype's switch (`KPM_Owner.html:1715`), which is also why there
                        * is no *"Your agents sell it"* badge any more: the switch's state **is**
                        * that sentence, and two things saying it invites them to disagree.
                        *
                        * A reader who cannot write still sees it, disabled — the shelf is worth
                        * reading even when it is not yours to change.
                        */
                      <>
                        <Switch
                          id={`sell-${product.productId}`}
                          label="Agents sell it"
                          checked={product.active.value}
                          disabled={busy || !canWrite}
                          // A 44 × 44px target on a phone, the track as drawn (P18.97-T7 AC-6; UI-040).
                          phoneTarget
                          // It saves itself, and says so beside it (P18.95-T1 AC-5): a retry sends this same value
                          // again. The reason for a refusal stays in the alert above the shelf, where it was.
                          onChange={(next) => void inline.save(sellKey(product.productId), async () =>
                            (await run(() => setKpmProductActive(product.productId, next))) !== null)}
                        />
                        <InlineSaveStatus
                          state={inline.stateOf(sellKey(product.productId))}
                          label={`Agents sell it, ${product.displayName.value}`}
                          onRetry={() => {
                            inline.retry(sellKey(product.productId));
                            document.getElementById(`sell-${product.productId}`)?.focus();
                          }}
                        />
                      </>
                    )}
                    <Button
                      variant="inline"
                      disabled={busy}
                      onClick={() => {
                        const next = open === product.productId ? null : product.productId;
                        setOpen(next);
                        setDraft(next ? draftOf(product) : {});
                      }}
                    >
                      {open === product.productId ? 'Close' : 'Customize'}
                    </Button>
                  </div>
                </div>

                {open === product.productId && panel(product)}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /**
   * What is waiting on somebody here.
   *
   * A queue rather than a hunt through 31 products: the point of a gate is that whoever holds it
   * can see what is behind it.
   */
  function approvalsTab() {
    if (queue === null) return error ? null : <SkeletonCards count={2} />;
    const waiting = queue.filter((p) => p.reviewState === 'pending');
    const sentBack = queue.filter((p) => p.reviewState === 'rejected');

    return (
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-md text-navy">
            <strong>This is your office’s own check, not a review by anybody else.</strong>{' '}
            <span className="text-muted">
              Nobody at {company} and nobody on the platform looks at these. What it gives you is
              that no half-finished script reaches your agents, and that every script they read
              carries a name and a time.
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Until you approve one, your agents keep reading whatever they read today — the last
            version your office approved, or {company}’s own words. Each row below says which.
          </p>
        </Card>

        {waiting.length === 0 && sentBack.length === 0 ? (
          <EmptyState title="Nothing is waiting on you. A script comes here when somebody in your office rewrites one." />
        ) : (
          <ul className="flex flex-col gap-3">
            {[...waiting, ...sentBack].map((product) => (
              <li key={product.productId}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Where the shelf's *Review* lands (P18.97-T4 AC-7): focusable by script, never a tab stop. */}
                      <h2 id={`review-${product.productId}`} tabIndex={-1} className="text-md font-semibold text-navy">
                        {product.displayName.value}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <ConfigBadge tone={REVIEW[product.reviewState].tone}>
                          {REVIEW[product.reviewState].text}
                        </ConfigBadge>
                      </p>
                      {product.rejectionReason && (
                        <p className="mt-1 text-sm text-muted">
                          Sent back: {product.rejectionReason}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted">
                        {served[product.productId]?.source === 'kpm'
                          ? 'Your agents are reading an earlier version your office approved.'
                          : `Your agents are reading ${company}’s words until this is approved.`}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {/* Held with the script since OD-136, so it is decided with it. */}
                        {product.description?.overridden && (
                          <li className="text-md text-navy">
                            <span className="text-sm font-semibold text-muted">{DESCRIPTION_LABEL}: </span>
                            {product.description.value}
                          </li>
                        )}
                        {SCRIPT_FIELDS.filter((f) => product.script[f.key]?.overridden).map((f) => (
                          <li key={f.key} className="text-md text-navy">
                            <span className="text-sm font-semibold text-muted">{f.label}: </span>
                            {asText(product.script[f.key].value)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {canApprove && product.reviewState === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy}
                          className={CONTROL_PHONE}
                          onClick={() => void decide(() => approveScript(product.productId))}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="inline"
                          disabled={busy}
                          onClick={() => { setSendingBack(product.productId); setReason(''); }}
                        >
                          Send back
                        </Button>
                      </div>
                    )}
                  </div>

                  {sendingBack === product.productId && (
                    <div className="mt-3 border-t border-hairline pt-3">
                      <Field
                        label="Why are you sending it back?"
                        htmlFor={`reason-${product.productId}`}
                        hint="Required — somebody has to act on it, and “no” on its own is not something anybody can act on."
                      >
                        <Textarea
                          id={`reason-${product.productId}`}
                          rows={2}
                          value={reason}
                          disabled={busy}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          disabled={busy || !reason.trim()}
                          className={CONTROL_PHONE}
                          onClick={() => void decide(async () => {
                            const next = await rejectScript(product.productId, reason.trim());
                            setSendingBack(null);
                            return next;
                          })}
                        >
                          Send it back
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          className={CONTROL_PHONE}
                          onClick={() => setSendingBack(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const draftOf = (product: KpmProductRow): Record<string, string> => ({
    displayName: product.displayName.value,
    description: product.description?.value ?? '',
    ...Object.fromEntries(
      SCRIPT_FIELDS.map((f) => [f.key, asText(product.script[f.key]?.value ?? '')]),
    ),
  });

  /**
   * One product opened: the name, the description, the seven script fields, and the three
   * document slots.
   */
  function panel(product: KpmProductRow) {
    const save = async (key: string) => {
      const value = key === 'benefits'
        ? draft.benefits.split('\n').map((l) => l.trim()).filter(Boolean)
        : draft[key];
      const row = await run(() => saveKpmProductOverrides(product.productId, { [key]: value }));
      // A blank description is given back to the company, so the box shows the company's again.
      if (row && key === 'description') {
        setDraft((n) => ({ ...n, description: row.description?.value ?? '' }));
      }
      return row;
    };

    return (
      <div className="border-t border-hairline px-4 py-4 sm:px-5">
        <CodeField
          id={`code-product-code-${product.code}`}
          value={product.code}
          reason={`Your company’s. Every office of ${company} uses the same one.`}
          className="max-w-xs"
          inputClassName={CONTROL_PHONE}
        />

        <Field
          label="What your office calls it"
          htmlFor={`name-${product.productId}`}
          hint={product.displayName.overridden
            ? `Yours. ${company} calls it ${product.companyName}.`
            : `Following ${company}.`}
          className="mt-3"
        >
          <TextInput
            id={`name-${product.productId}`}
            value={draft.displayName ?? ''}
            disabled={!canWrite || busy}
            className={CONTROL_PHONE}
            onChange={(e) => setDraft((n) => ({ ...n, displayName: e.target.value }))}
          />
        </Field>
        {canWrite && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} className={CONTROL_PHONE} onClick={() => void save('displayName')}>Save the name</Button>
            {product.displayName.overridden && (
              <Button
                variant="inline"
                disabled={busy}
                onClick={() => void run(async () => {
                  const row = await resetKpmProductOverride(product.productId, 'displayName');
                  setDraft(draftOf(row));
                  return row;
                })}
              >
                Use {company}’s name
              </Button>
            )}
          </div>
        )}

        {/*
          * The Details tab's one field (`KPM_Owner.html:1781`), which nothing built until OD-136.
          * Held for approval with the script (ADR-0120): a tagline is a sentence an agent may repeat
          * to a customer, so agents read the company's until the office approves its own.
          */}
        <div className="mt-3">
          <Field
            label={DESCRIPTION_LABEL}
            htmlFor={`description-${product.productId}`}
            hint={product.description?.overridden ? 'Yours.' : `Following ${company}.`}
          >
            <Textarea
              id={`description-${product.productId}`}
              rows={2}
              maxLength={PRODUCT_DESCRIPTION_MAX}
              value={draft.description ?? ''}
              disabled={!canWrite || busy}
              onChange={(e) => setDraft((n) => ({ ...n, description: e.target.value }))}
            />
          </Field>
          {canWrite && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save('description')}>
                Save
              </Button>
              {product.description?.overridden && (
                <Button
                  variant="inline"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const row = await resetKpmProductOverride(product.productId, 'description');
                    setDraft(draftOf(row));
                    return row;
                  })}
                >
                  Use {company}’s
                </Button>
              )}
            </div>
          )}
        </div>

        <h3 className="mt-5 font-display text-md font-bold text-navy">The attack plan</h3>
        <p className="text-sm text-muted">
          Starts from {company}’s script — anything you change is saved for this office only, and
          your agents keep reading the approved words until you approve the new ones.
        </p>
        {product.reviewState === 'rejected' && product.rejectionReason && (
          <p role="alert" className="mt-2 text-md text-navy">
            <strong>Sent back:</strong> {product.rejectionReason}
          </p>
        )}

        {SCRIPT_FIELDS.map((f) => (
          <div key={f.key} className="mt-3">
            <Field
              label={f.label}
              htmlFor={`${f.key}-${product.productId}`}
              hint={product.script[f.key]?.overridden
                ? 'Yours.'
                : `Following ${company}.`}
            >
              <Textarea
                id={`${f.key}-${product.productId}`}
                rows={f.lines}
                value={draft[f.key] ?? ''}
                disabled={!canWrite || busy}
                onChange={(e) => setDraft((n) => ({ ...n, [f.key]: e.target.value }))}
              />
            </Field>
            {canWrite && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save(f.key)}>
                  Save
                </Button>
                {product.script[f.key]?.overridden && (
                  <Button
                    variant="inline"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      const row = await resetKpmProductOverride(product.productId, f.key);
                      setDraft(draftOf(row));
                      return row;
                    })}
                  >
                    Use {company}’s
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        <h3 className="mt-5 font-display text-md font-bold text-navy">Documents</h3>
        <ul className="mt-2 flex flex-col divide-y divide-hairline">
          {product.documents.map((doc) => (
            <li key={doc.slot} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-md text-navy">{doc.label}</p>
                <p className="text-sm text-muted">
                  {doc.source === 'kpm' && <>Uploaded by your office — {doc.filename}</>}
                  {doc.source === 'company' && <>From {company}’s catalog</>}
                  {doc.source === 'none' && <>Nobody has attached one yet.</>}
                </p>
              </div>
              {doc.storageKey && (
                <Button
                  variant="inline"
                  onClick={() => void (async () => {
                    try {
                      const { url } = await kpmProductDocumentUrl(product.productId, doc.slot);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } catch (err) {
                      setError(toDisplayError(err));
                    }
                  })()}
                >
                  Open
                </Button>
              )}
              {canWrite && product.sellable && product.active.value && (
                <DocumentUpload
                  productId={product.productId}
                  slot={doc.slot}
                  label={doc.label}
                  hasFile={doc.storageKey !== null}
                  disabled={busy}
                  onAttached={(row) => {
                    setError(null);
                    setRows((now) => now?.map((p) => (p.productId === row.productId ? row : p)) ?? now);
                  }}
                />
              )}
              {canWrite && doc.source === 'kpm' && (
                <Button
                  variant="inline"
                  disabled={busy}
                  onClick={() => void run(() =>
                    resetKpmProductDocument(product.productId, doc.slot))}
                >
                  Use {company}’s
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <SettingsScreen
      title="Products"
      subtitle={`What your office sells from ${company}’s catalog, and the words you sell it with.`}
      /*
       * The office's drafts and review state live here (ADR-0037), so its read is the Owner's and the
       * Admin's alone — `product_settings:read`, not `tenant_config:read`, which every member holds
       * (the Phase 14 exit review). A field member reads the approved words on `/product-catalog`.
       */
      permission="product_settings:read"
      tabs={TABS}
      tabsLabel="Product sections"
      activeHref={tab}
      onSelectTab={setTab}
      error={rows === null ? error : null}
      bars={<PublishBar />}
    >
      {tab === '#approvals' ? approvalsTab() : body()}
    </SettingsScreen>
  );
}
