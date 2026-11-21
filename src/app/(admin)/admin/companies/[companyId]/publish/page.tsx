'use client';

import { use, useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  needsKpms, overwrittenBy, publishToKpms, readPublication, type PublicationChange, type PublicationSetting,
  type PublicationView,
} from '@/lib/companies-console';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

type Words = ReturnType<typeof useConsoleWords>;
const useConsoleWords = () => useMessages(adminCompaniesConsoleMessages);

/** A setting's name, as *Pengaturan template* names its row. */
function settingName(t: Words, setting: PublicationSetting | null): string {
  const n = t.settings.names;
  switch (setting) {
    case 'recruitment': return `${n.recruitment_pitch} · ${n.objection_handling}`;
    case null: return '';
    default: return n[setting];
  }
}

/** A change's title in step 1: *Activity types · 2 baru*, *Produk baru · PRUWell Medical*. */
function titleOf(t: Words, c: PublicationChange): string {
  if (c.type === 'product_new') return t.publish.productNew({ name: c.productName ?? '' });
  if (c.type === 'product_change') return t.publish.productChange({ name: c.productName ?? '' });
  const counts = t.publish.counts({ added: c.added, changed: c.changed, removed: c.removed });
  const tail = counts || (!c.draft && c.missing > 0 ? t.publish.behind({ n: c.missing }) : '');
  return tail ? `${settingName(t, c.setting)} · ${tail}` : settingName(t, c.setting);
}

/**
 * ***Terbitkan ke KPM*** (`/admin/companies/[companyId]/publish`; P19.23-T4 AC-5; ADR-0278 §5–§7; frames 36–40).
 *
 * **Nothing is published automatically and nothing is pre-selected.** Step ① *Pilih perubahan*: every change waiting
 * (`GET …/publication`), none ticked — a setting with *⚠ Menimpa daftar … di KPM*, a new product *Menambah produk + tabel
 * premi · tidak mengubah pengaturan KPM*. Step ② *Pilih KPM*: every KPM of the company, none ticked — one that changed a
 * setting itself says so, and once that setting is ticked *· akan tertimpa*, in amber. The bar under them says what is
 * chosen, and *Terbitkan…* asks once: what, to which KPMs, and either *Hanya menambah · pengaturan KPM tidak berubah* or
 * *Ini akan menimpa pengaturan KPM* with the tick ***Saya paham pengaturan KPM ini akan ditimpa***, without which
 * *Terbitkan* stays held — and the server, which works the KPMs' own changes out again, refuses it too.
 *
 * A change that reaches every KPM by itself — a product's edit, *Campaigns*, the recruitment playbook (ADR-0278 §4, §5) —
 * needs no KPM ticked, and says so. Two columns from 1024px, stacked below; the bar's button full width on a phone, the
 * question a bottom sheet (§12).
 */
export default function PublishToKpmsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useConsoleWords();
  const company = useCompany(companyId);
  const [view, setView] = useState<PublicationView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [changes, setChanges] = useState<ReadonlySet<string>>(new Set());
  const [kpms, setKpms] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      setError(null);
      setView(await readPublication(companyId));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  let body: ReactNode;
  if (error) {
    body = (
      <div className="flex flex-col gap-2">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="self-start" onClick={() => { void load(); }}>{t.retry}</Button>
      </div>
    );
  } else if (!view) {
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCards count={3} label={t.publish.loading} />
        <SkeletonCards count={3} />
      </div>
    );
  } else if (view.library) {
    body = <p className="rounded-lg bg-card p-4 text-md text-navy">{t.publish.library}</p>;
  } else {
    const kpmsNeeded = needsKpms(view, changes);
    const overwritten = overwrittenBy(view, changes, kpms);
    const overwriting = view.changes.some((c) => changes.has(c.id) && c.overwrites);
    const ready = changes.size > 0 && (!kpmsNeeded || kpms.size > 0);
    const chosenSettings = new Map(view.changes.map((c) => [c.id, c]));
    body = (
      <>
        {refusals.length > 0 && (
          <div className="mb-4 flex flex-col gap-1 rounded-lg bg-alert/5 p-3 text-md text-alert" role="alert">
            {refusals.map((r) => <p key={r}>{r}</p>)}
          </div>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <StepCard n={1} title={t.publish.step1} count={t.publish.chosen({ n: changes.size, of: view.changes.length })}>
            {view.changes.length === 0 && <p className="px-4 py-3 text-md text-muted">{t.publish.empty}</p>}
            {view.changes.map((c) => (
              <CheckRow
                key={c.id}
                id={c.id}
                checked={changes.has(c.id)}
                onChange={() => setChanges((s) => toggle(s, c.id))}
                title={titleOf(t, c)}
                line={c.type === 'product_new' ? t.publish.addsOnly
                  : c.type === 'product_change' ? t.publish.allHolders
                    : c.reach === 'all' ? t.publish.allKpms : t.publish.overwrites({ setting: settingName(t, c.setting) })}
                warn={c.overwrites}
              />
            ))}
          </StepCard>
          <StepCard n={2} title={t.publish.step2} count={t.publish.chosen({ n: kpms.size, of: view.kpms.length })}>
            {view.kpms.length === 0 && <p className="px-4 py-3 text-md text-muted">{t.publish.noKpms}</p>}
            {view.kpms.map((k) => {
              const own = k.ownEdits.map((id) => chosenSettings.get(id)).filter((c): c is PublicationChange => Boolean(c));
              const hit = own.filter((c) => changes.has(c.id));
              const has = changes.size > 0 && [...changes].every((id) => k.upToDate.includes(id));
              const line = hit.length > 0
                ? `${hit.map((c) => t.publish.changedHere({ setting: settingName(t, c.setting) })).join(' · ')} · ${t.publish.willOverwrite}`
                : own.length > 0 ? own.map((c) => t.publish.changedHere({ setting: settingName(t, c.setting) })).join(' · ')
                  : has ? t.publish.hasIt : undefined;
              return (
                <CheckRow
                  key={k.id}
                  id={k.id}
                  checked={kpms.has(k.id)}
                  onChange={() => setKpms((s) => toggle(s, k.id))}
                  title={k.name}
                  line={line}
                  warn={hit.length > 0}
                />
              );
            })}
          </StepCard>
        </div>
        <div
          data-publish-bar=""
          className="mt-4 flex flex-col gap-3 rounded-lg bg-card p-4 md:flex-row md:items-center md:justify-between"
        >
          <p className="text-md text-navy">
            {changes.size === 0 ? t.publish.nothingYet
              : kpmsNeeded ? t.publish.summary({ changes: changes.size, kpms: kpms.size })
                : t.publish.summaryAll({ changes: changes.size })}
            {overwriting && kpms.size > 0 && <strong className="text-primary-ink">{` · ${t.publish.overwritesKpm}`}</strong>}
          </p>
          <Button className="max-md:w-full" disabled={!ready} onClick={() => setAsking(true)}>{t.publish.open}</Button>
        </div>
        {asking && (
          <ConfirmPublish
            view={view}
            changes={changes}
            kpms={kpms}
            overwritten={overwritten.map((k) => k.name)}
            onCancel={() => setAsking(false)}
            onDone={(refused) => {
              setAsking(false);
              setRefusals(refused);
              show(t.publish.done({ n: changes.size - refused.length }));
              setChanges(new Set());
              setKpms(new Set());
              void load();
            }}
          />
        )}
      </>
    );
  }

  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read" active="publish">
      {body}
      <Toast toast={toast} />
    </CompanyFrame>
  );
}

/** One step's card: its number in a navy circle, its title, and how many are chosen. */
function StepCard({ n, title, count, children }: { n: number; title: string; count: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg bg-card">
      <header className="flex items-center gap-2 border-b border-divider px-4 py-3">
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-pill bg-secondary text-sm font-bold text-secondary-contrast">{n}</span>
        <h2 id={id} className="min-w-0 flex-1 text-md font-bold text-navy">{title}</h2>
        <span className="text-sm text-muted">{count}</span>
      </header>
      <ul role="list" className="[&>li+li]:border-t [&>li+li]:border-divider">{children}</ul>
    </section>
  );
}

/** A row with its box: the title its label, the line under it its description, amber with ⚠ where it overwrites. */
function CheckRow({
  id, checked, onChange, title, line, warn,
}: { id: string; checked: boolean; onChange: () => void; title: string; line?: string; warn: boolean }) {
  const inputId = useId();
  const lineId = useId();
  return (
    <li data-check-row={id} className="flex items-start gap-3 px-4 py-3">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-describedby={line ? lineId : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="block text-md font-bold text-navy">{title}</label>
        {line && (
          <p id={lineId} className={cn('mt-0.5 flex items-start gap-1 text-sm', warn ? 'font-semibold text-primary-ink' : 'text-muted')}>
            {warn && <LineIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            {line}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * **The one question** (frames 38, 40): what, to which KPMs, and the consequence — the tick held until it is ticked where
 * a KPM's own settings would go. `409 TEMPLATE_APPLY_UNCONFIRMED` (the server found more since the page was read) is
 * said here, in the API's words, and the page read again.
 */
function ConfirmPublish({
  view, changes, kpms, overwritten, onCancel, onDone,
}: {
  view: PublicationView;
  changes: ReadonlySet<string>;
  kpms: ReadonlySet<string>;
  overwritten: string[];
  onCancel: () => void;
  onDone: (refused: string[]) => void;
}) {
  const t = useConsoleWords();
  const tickId = useId();
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const chosen = view.changes.filter((c) => changes.has(c.id));
  const kpmsNeeded = needsKpms(view, changes);
  const names = view.kpms.filter((k) => kpms.has(k.id)).map((k) => k.name);
  const overwriting = chosen.filter((c) => c.overwrites);
  const needsTick = overwritten.length > 0;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const { results } = await publishToKpms(view.companyId, {
        changes: chosen.map((c) => c.id),
        kpmIds: [...kpms],
        ...(needsTick ? { overwriteConfirmed: ticked } : {}),
      });
      const byId = new Map(chosen.map((c) => [c.id, c]));
      onDone(results.flatMap((r) => (r.outcome === 'refused'
        ? [t.publish.refused({ name: titleOf(t, byId.get(r.id)!), reason: r.error.message })] : [])));
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={kpmsNeeded ? t.publish.confirmTitle({ changes: chosen.length, kpms: kpms.size }) : t.publish.confirmAllTitle({ changes: chosen.length })}
      placement="responsive"
      handle
      closeLabel={t.setup.close}
      onClose={onCancel}
      footer={(
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>{t.publish.cancel}</Button>
          <Button onClick={() => { void publish(); }} disabled={busy || (needsTick && !ticked)}>
            {busy ? t.publish.publishing : t.publish.confirm}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <ul className="list-disc pl-5 text-md text-navy">
          {chosen.map((c) => <li key={c.id}>{titleOf(t, c)}</li>)}
        </ul>
        {names.length > 0 && <p className="text-md text-muted">{t.publish.to({ names: names.join(', ') })}</p>}
        {overwriting.length > 0 && kpms.size > 0 ? (
          <p data-confirm-tone="overwrite" className="rounded-md bg-primary-50 p-3 text-md text-primary-ink">
            <strong>{t.publish.overwriteStrong}</strong>
            {' '}
            {t.publish.overwriteRest({ settings: overwriting.map((c) => settingName(t, c.setting)).join(', ') })}
          </p>
        ) : (
          <p data-confirm-tone="adds" className="rounded-md bg-success/10 p-3 text-md font-semibold text-success">{t.publish.onlyAdds}</p>
        )}
        {needsTick && (
          <label htmlFor={tickId} className="flex min-h-10 items-center gap-2 text-md font-semibold text-navy">
            <input id={tickId} type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="h-5 w-5 accent-primary" />
            {t.publish.tick}
          </label>
        )}
        {error && <ErrorBanner {...error} />}
      </div>
    </Modal>
  );
}
