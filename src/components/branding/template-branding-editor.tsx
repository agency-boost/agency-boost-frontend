'use client';

import { BrandingEditor, POSES, type BrandingDraft, type DraftImage, type Pose } from './branding-editor';

type Payload = Record<string, unknown>;

/** A template section's payload as the editor's working copy (keys only: a saved picture has no preview link here). */
export function draftOfPayload(payload: Payload): BrandingDraft {
  const logo = payload.logo as { key?: string; width?: number; height?: number } | null | undefined;
  const square = payload.logoSquare as { key?: string } | null | undefined;
  const mascot = payload.mascot as { default?: string; poses?: Record<string, string> } | null | undefined;
  const poses: Partial<Record<Pose, DraftImage>> = {};
  for (const pose of POSES) if (mascot?.poses?.[pose]) poses[pose] = { key: mascot.poses[pose] };
  return {
    logo: logo?.key ? { key: logo.key, width: logo.width, height: logo.height } : null,
    logoSquare: square?.key ? { key: square.key } : null,
    primary: typeof payload.primary === 'string' ? payload.primary : null,
    secondary: typeof payload.secondary === 'string' ? payload.secondary : null,
    mascot: mascot?.default ? { default: { key: mascot.default }, poses } : null,
  };
}

/** The working copy as the section's payload: what the template's draft saves (ADR-0218 §3). */
export function payloadOfDraft(draft: BrandingDraft): Payload {
  return {
    logo: draft.logo ? { key: draft.logo.key, width: draft.logo.width ?? 0, height: draft.logo.height ?? 0 } : null,
    logoSquare: draft.logoSquare ? { key: draft.logoSquare.key } : null,
    primary: draft.primary,
    secondary: draft.secondary,
    mascot: draft.mascot
      ? { default: draft.mascot.default.key, poses: Object.fromEntries(Object.entries(draft.mascot.poses).map(([p, img]) => [p, img!.key])) }
      : null,
  };
}

/**
 * **A template's *Tampilan*** (P19.6-T1 AC-11; ADR-0218 §3): the same fields and preview as a KPM's page, its pictures
 * uploaded into the company's folder and its colours previewed under `company_template:write`. Drafted and published as
 * every section is; every KPM on the template reads the published version live, and a KPM's own always wins.
 */
export function TemplateBrandingEditor({ payload, onChange, disabled, companyId, templateId }: {
  payload: Payload; onChange: (next: Payload) => void; disabled: boolean; companyId: string; templateId: string;
}) {
  const draft = draftOfPayload(payload);
  return (
    <BrandingEditor
      owner={{ kind: 'template', companyId, templateId }}
      draft={draft}
      disabled={disabled}
      onChange={(next) => onChange(payloadOfDraft(next))}
    />
  );
}
