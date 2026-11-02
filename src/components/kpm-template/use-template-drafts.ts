'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sameValue } from '@/components/ui/save-state';
import {
  publishTemplate, readTemplate, saveTemplateDraft, type CompanyTemplate, type TemplateKind,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';

/** One kind's draft: the server's last answer, what the editor holds, and what was last saved. */
export interface KindDraft {
  /** The server's last answer for the kind — read, saved or published. */
  view: CompanyTemplate;
  /** What the editor holds now. */
  payload: Record<string, unknown>;
  /** What the server last accepted as the draft — or, before any save, what it read. */
  saved: Record<string, unknown>;
  saving: boolean;
  /** The last save, refused or never arrived: the draft is not saved, and leaving would lose it. */
  error: ApiError | null;
}

/** How long a pause in typing is before the draft is saved. */
export const AUTOSAVE_MS = 800;

/** A kind holds a draft the server knows of: something to publish. */
export const hasServerDraft = (view: CompanyTemplate) => view.status === 'draft' && view.id !== '';

/**
 * **A section's drafts, saved as they are made** (ADR-0185 §3; P18.99-T20 AC-3): each kind read once, every edit held
 * and — after {@link AUTOSAVE_MS} without another — `PUT` as the kind's draft, whole (the API's contract: a template
 * kind is one document). An edit made while a save is on its way is saved after it, so the last one always lands.
 *
 * **Nothing is lost by leaving.** A draft still waiting when the section closes is sent as it closes; there is no
 * *one tab at a time* any more, because nothing is held anywhere but the server. A save the server refused keeps the
 * editor's words and says so (`error`), and `flush` tries again.
 *
 * `templateId` is the named template's, or `null` for the company's own carrier rules (`campaign_kinds`). `readOnly`
 * (an archived template) reads and never writes.
 */
export function useTemplateDrafts({
  companyId,
  templateId,
  kinds,
  readOnly = false,
}: {
  companyId: string;
  templateId: string | null;
  kinds: readonly TemplateKind[];
  readOnly?: boolean;
}) {
  const [drafts, setDrafts] = useState<Partial<Record<TemplateKind, KindDraft>>>({});
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<Partial<Record<TemplateKind, Record<string, unknown>>>>({});
  const savedRef = useRef<Partial<Record<TemplateKind, Record<string, unknown>>>>({});
  const timers = useRef<Partial<Record<TemplateKind, ReturnType<typeof setTimeout>>>>({});
  const inflight = useRef<Partial<Record<TemplateKind, Promise<boolean>>>>({});
  /** The server's last answer per kind, as soon as it lands — what `publish` reads, a render before state has it. */
  const views = useRef<Partial<Record<TemplateKind, CompanyTemplate>>>({});
  const key = kinds.join(',');

  const patch = useCallback((kind: TemplateKind, change: Partial<KindDraft>) => {
    setDrafts((all) => (all[kind] ? { ...all, [kind]: { ...all[kind]!, ...change } } : all));
  }, []);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    setDrafts({});
    void Promise.all(kinds.map((kind) => readTemplate(companyId, kind, templateId)))
      .then((read) => {
        if (!live) return;
        const next: Partial<Record<TemplateKind, KindDraft>> = {};
        read.forEach((view, i) => {
          const kind = kinds[i];
          latest.current[kind] = view.payload;
          savedRef.current[kind] = view.payload;
          views.current[kind] = view;
          next[kind] = { view, payload: view.payload, saved: view.payload, saving: false, error: null };
        });
        setDrafts(next);
      })
      .catch((err) => { if (live) setLoadError(toDisplayError(err)); });
    return () => { live = false; };
    // `kinds` is read through its key: a new array of the same kinds is the same section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, templateId, key, attempt]);

  /** Save one kind's draft now: whatever the editor holds. `true` once the server has it. */
  const saveNow = useCallback(async (kind: TemplateKind): Promise<boolean> => {
    clearTimeout(timers.current[kind]);
    timers.current[kind] = undefined;
    if (readOnly) return false;
    const pending = inflight.current[kind];
    if (pending) {
      await pending;
      return saveNow(kind);
    }
    const payload = latest.current[kind];
    if (payload === undefined || sameValue(payload, savedRef.current[kind])) return true;
    patch(kind, { saving: true, error: null });
    const run = saveTemplateDraft(companyId, kind, payload, templateId)
      .then((view) => {
        savedRef.current[kind] = payload;
        views.current[kind] = view;
        patch(kind, { view, saved: payload, saving: false, error: null });
        return true;
      }, (err) => {
        patch(kind, { saving: false, error: toDisplayError(err) });
        return false;
      })
      .finally(() => { inflight.current[kind] = undefined; });
    inflight.current[kind] = run;
    return run;
  }, [companyId, templateId, readOnly, patch]);

  /** The editor's change: held at once, saved after a pause. */
  const change = useCallback((kind: TemplateKind, payload: Record<string, unknown>) => {
    if (readOnly) return;
    latest.current[kind] = payload;
    setDrafts((all) => (all[kind] ? { ...all, [kind]: { ...all[kind]!, payload } } : all));
    clearTimeout(timers.current[kind]);
    timers.current[kind] = setTimeout(() => { void saveNow(kind); }, AUTOSAVE_MS);
  }, [readOnly, saveNow]);

  /** Every kind saved, as far as the server will take it. `false` when a save was refused. */
  const flush = useCallback(async (): Promise<boolean> => {
    const done = await Promise.all(kinds.map((kind) => saveNow(kind)));
    return done.every(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, saveNow]);

  /**
   * **Publish the section**: every kind saved first, then each kind holding a draft published, in the section's order
   * (the taxonomy before the ratios checked against it). Stops at the first refusal, which it returns. `ok: false` with
   * no error when a save was refused first — that refusal is the kind's own `error`.
   */
  const publish = useCallback(async (): Promise<{ ok: boolean; error: ApiError | null }> => {
    if (!(await flush())) return { ok: false, error: null };
    for (const kind of kinds) {
      const view = views.current[kind];
      if (!view || !hasServerDraft(view)) continue;
      try {
        const published = await publishTemplate(companyId, kind, templateId);
        views.current[kind] = published;
        patch(kind, { view: published });
      } catch (err) {
        return { ok: false, error: toDisplayError(err) };
      }
    }
    return { ok: true, error: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, flush, companyId, templateId, patch]);

  // Leaving with a draft still waiting sends it as the section closes: nothing is lost by leaving.
  useEffect(() => () => {
    for (const kind of Object.keys(timers.current) as TemplateKind[]) {
      if (!timers.current[kind]) continue;
      clearTimeout(timers.current[kind]);
      const payload = latest.current[kind];
      if (payload !== undefined && !readOnly) void saveTemplateDraft(companyId, kind, payload, templateId).catch(() => undefined);
    }
  }, [companyId, templateId, readOnly]);

  const all = kinds.map((kind) => drafts[kind]).filter((d): d is KindDraft => Boolean(d));
  const ready = all.length === kinds.length;
  return {
    drafts,
    ready,
    loadError,
    retryLoad: () => setAttempt((n) => n + 1),
    change,
    flush,
    publish,
    saving: all.some((d) => d.saving),
    dirty: all.some((d) => !sameValue(d.payload, d.saved)),
    error: all.find((d) => d.error)?.error ?? null,
    /** Something waits to be published: a draft the server holds, or an edit on its way to becoming one. */
    publishable: all.some((d) => hasServerDraft(d.view) || !sameValue(d.payload, d.saved)),
  };
}
