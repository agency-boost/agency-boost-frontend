'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonBar, Skeleton } from '@/components/ui/skeleton';
import {
  applyTemplate, listTemplateOfficeStandings,
  type ApplyOfficeResult, type OfficeTemplateKind, type PushDifference, type TemplateOfficeStanding,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { sectionOfKind } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * ***Terapkan juga ke KPM yang sudah ada?*** (ADR-0208 §4; SA UI-012, SA R3): asked after a section's *Terbitkan* or
 * *Terbitkan semua*, and opened from *Dipakai N KPM* and *N KPM memakai versi lama*, so the newest version can be pushed
 * later too.
 *
 * - The KPMs made from the template in two groups: ***Belum diubah KPM***, ticked, and ***Sudah diubah KPM***, unticked,
 *   each saying what differs — *Ditambah / Dihapus / Diubah*, by code, and *"31 modul memakai materi sendiri"*. KPMs
 *   already on the newest version are counted in one line: a push skips them.
 * - ***Tidak sekarang*** publishes for new KPMs only, as before: nothing is sent.
 * - **Ticking a changed KPM asks a second time**, naming what will be replaced, and only then sends it in
 *   `replaceChanged`. The server works the groups out again when it applies, and refuses a changed KPM not confirmed.
 *
 * A titled `Modal`, as *Terbitkan semua*'s question is: a list is more than one message.
 */
export function ApplyToOfficesDialog({
  open,
  companyId,
  templateId,
  kinds,
  onClose,
}: {
  open: boolean;
  companyId: string;
  templateId: string;
  /** The sections just published, or every published one when opened from the count. */
  kinds: OfficeTemplateKind[];
  onClose: () => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.apply;
  const [offices, setOffices] = useState<TemplateOfficeStanding[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'choose' | 'replace' | 'done'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [results, setResults] = useState<ApplyOfficeResult[]>([]);
  const key = kinds.join(',');

  useEffect(() => {
    if (!open || kinds.length === 0) return;
    let live = true;
    setOffices(null);
    setLoadError(null);
    setStep('choose');
    setError(null);
    setResults([]);
    void listTemplateOfficeStandings(companyId, templateId, kinds)
      .then((rows) => {
        if (!live) return;
        setOffices(rows);
        // *Belum diubah KPM* ticked; *Sudah diubah KPM* unticked (SA R3).
        setTicked(new Set(rows.filter((o) => stateOf(o) === 'unchanged').map((o) => o.id)));
      })
      .catch((err) => { if (live) setLoadError(toDisplayError(err)); });
    return () => { live = false; };
    // `kinds` is read through its key: a new array of the same kinds is the same question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId, templateId, key, attempt]);

  const nameOf = (kind: OfficeTemplateKind) => {
    const section = sectionOfKind(kind);
    return section ? words.sections[section.slug] : kind;
  };
  const sections = [...new Set(kinds.map(nameOf))].join(', ');
  const rows = offices ?? [];
  const unchanged = rows.filter((o) => stateOf(o) === 'unchanged');
  const changed = rows.filter((o) => stateOf(o) === 'changed');
  const current = rows.filter((o) => stateOf(o) === 'current');
  const chosen = rows.filter((o) => ticked.has(o.id) && stateOf(o) !== 'current');
  const replacing = chosen.filter((o) => stateOf(o) === 'changed');

  const toggle = (id: string) => setTicked((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const answer = await applyTemplate(companyId, templateId, {
        kinds, kpmIds: chosen.map((o) => o.id), replaceChanged: replacing.map((o) => o.id),
      });
      setResults(answer.offices);
      setStep('done');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  /** What one changed KPM did, one line per kind of change, then its own material. */
  const differencesOf = (office: TemplateOfficeStanding) => {
    const all: PushDifference[] = (office.kinds ?? []).flatMap((k) => k.differences ?? []);
    const codes = (change: PushDifference['change']) => [...new Set(all.filter((d) => d.change === change && !(d.fields?.length === 1 && d.fields[0] === 'material')).map((d) => d.code))].join(', ');
    const own = (office.kinds ?? []).reduce((n, k) => n + (k.ownMaterialModules ?? 0), 0);
    return [
      codes('added') && t.added({ items: codes('added') }),
      codes('removed') && t.removed({ items: codes('removed') }),
      codes('changed') && t.changedItems({ items: codes('changed') }),
      own > 0 && t.ownMaterial({ n: own }),
    ].filter((line): line is string => Boolean(line));
  };

  const group = (title: string, list: TemplateOfficeStanding[], withDifferences: boolean) => list.length > 0 && (
    <fieldset className="mt-3">
      <legend className="text-sm font-semibold text-navy">{title}</legend>
      <ul className="mt-1 divide-y divide-divider">
        {list.map((office) => (
          <li key={office.id} className="py-2">
            <label className="flex min-h-11 items-start gap-3 text-md text-navy">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-primary"
                checked={ticked.has(office.id)}
                disabled={busy}
                onChange={() => toggle(office.id)}
              />
              <span>
                <span className="block font-semibold">{t.office({ code: office.code, branch: office.branchName })}</span>
                {withDifferences && differencesOf(office).map((line) => (
                  <span key={line} className="block text-sm text-muted">{line}</span>
                ))}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );

  const footer = step === 'done' ? (
    <Button variant="secondary" onClick={onClose}>{t.close}</Button>
  ) : step === 'replace' ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="danger" onClick={() => void send()} disabled={busy}>{busy ? t.applying : t.replaceConfirm}</Button>
      <Button variant="secondary" onClick={() => setStep('choose')} disabled={busy}>{t.back}</Button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => (replacing.length > 0 ? setStep('replace') : void send())}
        disabled={busy || offices === null || chosen.length === 0}
      >
        {busy ? t.applying : t.confirm({ n: chosen.length })}
      </Button>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{t.notNow}</Button>
    </div>
  );

  return (
    <Modal open={open} title={step === 'replace' ? t.replaceTitle : t.title} onClose={onClose} className="max-w-[34rem]" footer={footer}>
      {error && <ErrorBanner {...error} />}
      {step === 'choose' && (
        <>
          <p className="text-md text-navy">{t.lead({ sections })}</p>
          {loadError && (
            <div className="mt-3 flex flex-col gap-2">
              <ErrorBanner {...loadError} />
              <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
            </div>
          )}
          {!loadError && offices === null && (
            <Skeleton label={t.loading}>
              <div className="mt-3 flex flex-col gap-2">
                <SkeletonBar className="h-4 w-48" />
                <SkeletonBar className="h-4 w-40" />
              </div>
            </Skeleton>
          )}
          {offices !== null && rows.length === 0 && <p className="mt-3 text-md text-muted">{t.none}</p>}
          {group(t.unchanged, unchanged, false)}
          {group(t.changed, changed, true)}
          {current.length > 0 && <p className="mt-3 text-sm text-muted">{t.current({ n: current.length })}</p>}
        </>
      )}
      {step === 'replace' && (
        <>
          <p className="text-md text-navy">{t.replaceLead}</p>
          <ul className="mt-2 divide-y divide-divider">
            {replacing.map((office) => (
              <li key={office.id} className="py-2">
                <span className="block text-md font-semibold text-navy">{t.office({ code: office.code, branch: office.branchName })}</span>
                {differencesOf(office).map((line) => <span key={line} className="block text-sm text-muted">{line}</span>)}
              </li>
            ))}
          </ul>
        </>
      )}
      {step === 'done' && <ApplyReport results={results} />}
    </Modal>
  );
}

/** What the push did: the KPMs it reached, those waiting for their own publish, and each refusal in the API's words. */
function ApplyReport({ results }: { results: ApplyOfficeResult[] }) {
  const t = useMessages(adminTemplateMessages).apply;
  const applied = results.filter((r) => r.results.some((k) => k.outcome === 'applied'));
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-md font-semibold text-navy">{t.applied({ n: applied.length })}</p>
      {applied.filter((r) => r.awaitingPublish).map((r) => (
        <p key={`w-${r.id}`} className="text-sm text-muted">{t.waiting({ code: r.code })}</p>
      ))}
      {results.flatMap((r) => r.results
        .filter((k): k is Extract<typeof k, { outcome: 'refused' }> => k.outcome === 'refused')
        .slice(0, 1)
        .map((k) => (
          <p key={`r-${r.id}`} role="alert" className="text-sm text-alert">{t.refused({ code: r.code, message: k.error.message })}</p>
        )))}
    </div>
  );
}

/** An office's standing, read defensively: a list read without `?kind=` carries none, and reads as unchanged. */
function stateOf(office: TemplateOfficeStanding) {
  return office.state ?? 'unchanged';
}
