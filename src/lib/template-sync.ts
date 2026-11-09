import { api } from './api-client';

/**
 * ***Sinkron dari template*** (P19.6-T4, ADR-0220 §4; OD-270, UI-161): what this KPM's training names would take from
 * the template it was made from, and taking them. The Owner's and the Admins'; a view-as session reads the list and is
 * refused the apply by the API.
 */

export type TemplateSyncLevel = 'category' | 'skill' | 'module' | 'capability_item';

/** One name or description that would change, old beside new. */
export interface TemplateSyncDifference {
  level: TemplateSyncLevel;
  /** By code; a capability item's is `<GRID>:<ITEM>`. */
  code: string;
  field: 'name' | 'description';
  from: string | null;
  to: string | null;
}

export interface TemplateSyncVersions {
  training_taxonomy: number | null;
  capability_ladder: number | null;
}

export interface TemplateSyncView {
  template: { id: string; name: string | null } | null;
  templateVersions: TemplateSyncVersions;
  revision: string;
  /** Empty: nothing differs, and the control is not shown. */
  differences: TemplateSyncDifference[];
}

export interface TemplateSyncResult {
  outcome: 'published' | 'awaiting_publish' | 'unchanged';
  differences: TemplateSyncDifference[];
  revision: string;
}

/** `GET /kpm/settings/training/template-sync` — `training_settings:read`. */
export const readTemplateSync = () => api<TemplateSyncView>('/kpm/settings/training/template-sync');

/**
 * `POST /kpm/settings/training/template-sync` — `tenant_config:write`, pinned to what the preview read: a template that
 * published again, or training that changed since, is `409 VERSION_CONFLICT` and nothing is written.
 */
export const applyTemplateSync = (preview: Pick<TemplateSyncView, 'templateVersions' | 'revision'>) =>
  api<TemplateSyncResult>('/kpm/settings/training/template-sync', {
    method: 'POST',
    body: { templateVersions: preview.templateVersions, expectedRevision: preview.revision },
  });
