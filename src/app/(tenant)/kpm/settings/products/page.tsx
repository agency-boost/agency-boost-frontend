'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, Field, ReadOnlyField, TextInput, Textarea } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  kpmProductDocumentUrl, listKpmProducts, readBranchInfo, resetKpmProductDocument,
  resetKpmProductOverride, saveKpmProductOverrides, setKpmProductActive,
  type KpmProductRow,
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

const REVIEW: Record<string, { tone: 'won' | 'open'; text: string }> = {
  pending: { tone: 'open', text: 'Waiting for your approval' },
  approved: { tone: 'won', text: 'Approved' },
  rejected: { tone: 'open', text: 'Sent back' },
};

const asText = (value: string | string[]) => (Array.isArray(value) ? value.join('\n') : value);

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
export default function KpmProductsPage() {
  const canWrite = useCan('tenant_config:write');
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

  useEffect(() => { void load(); }, [load]);

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
          <p className="text-md text-navy">
            <strong>This catalog is your company’s.</strong>{' '}
            <span className="text-muted">
              Which of it you sell, and the words you sell it with, are yours — and they apply to
              this office only. Anything you have not changed follows your company, so when they
              improve a script you get it without doing anything.
            </span>
          </p>
          {/*
            * Counted from what is actually sellable. The prototype's header reads "6 active" over
            * seven toggles, because it counts a list it no longer matches (P5-T5 AC-8).
            */}
          <p className="mt-2 text-sm text-muted">
            {rows.length} products · <strong>{selling}</strong> your agents can sell
            {rows.some((p) => !p.sellable) && (
              <> · {rows.filter((p) => !p.sellable).length} withdrawn by {company}</>
            )}
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
                <div className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
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
                      <code className="text-sm text-muted">{product.code}</code>
                      <ConfigBadge tone="open">{product.category}</ConfigBadge>
                      {!product.sellable && (
                        <ConfigBadge tone="open">Withdrawn by {company}</ConfigBadge>
                      )}
                      {product.sellable && product.active.value && (
                        <ConfigBadge tone="won">Your agents sell it</ConfigBadge>
                      )}
                      {product.reviewState !== 'none' && (
                        <ConfigBadge tone={REVIEW[product.reviewState].tone}>
                          {REVIEW[product.reviewState].text}
                        </ConfigBadge>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canWrite && product.sellable && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void run(() =>
                          setKpmProductActive(product.productId, !product.active.value))}
                      >
                        {product.active.value ? 'Stop selling' : 'Sell this'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const next = open === product.productId ? null : product.productId;
                        setOpen(next);
                        setDraft(next ? draftOf(product) : {});
                      }}
                    >
                      {open === product.productId ? 'Close' : 'Customise'}
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

  const draftOf = (product: KpmProductRow): Record<string, string> => ({
    displayName: product.displayName.value,
    ...Object.fromEntries(
      SCRIPT_FIELDS.map((f) => [f.key, asText(product.script[f.key]?.value ?? '')]),
    ),
  });

  /** One product opened: the name, the seven script fields, and the three document slots. */
  function panel(product: KpmProductRow) {
    const save = (key: string) => {
      const value = key === 'benefits'
        ? draft.benefits.split('\n').map((l) => l.trim()).filter(Boolean)
        : draft[key];
      return run(() => saveKpmProductOverrides(product.productId, { [key]: value }));
    };

    return (
      <div className="border-t border-hairline px-4 py-4 sm:px-5">
        <ReadOnlyField
          label="Code"
          value={product.code}
          reason={`Your company’s. Every office of ${company} uses the same one.`}
          className="max-w-xs"
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
            onChange={(e) => setDraft((n) => ({ ...n, displayName: e.target.value }))}
          />
        </Field>
        {canWrite && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void save('displayName')}>Save the name</Button>
            {product.displayName.overridden && (
              <Button
                variant="secondary"
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
                <Button variant="secondary" disabled={busy} onClick={() => void save(f.key)}>
                  Save
                </Button>
                {product.script[f.key]?.overridden && (
                  <Button
                    variant="secondary"
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
                  variant="secondary"
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
              {canWrite && doc.source === 'kpm' && (
                <Button
                  variant="secondary"
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
      permission="tenant_config:read"
      error={rows === null ? error : null}
      bars={<PublishBar />}
    >
      {body()}
    </SettingsScreen>
  );
}
