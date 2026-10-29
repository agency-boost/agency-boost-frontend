import { kept } from '@/i18n/kept';
import { api } from './api-client';

/**
 * **An office's activity binding** (ADR-0163): which of its activity types each cascade role counts. A role's count
 * is the sum over its codes, so replacing an activity is `[A]` → `[A, B]` — the old code's history keeps counting,
 * the new one counts from now. The server validates and decides; this file only carries it.
 */

/** The three cascade roles, in the prototype's order. */
export const BINDING_ROLES = ['leads', 'appointments', 'closings'] as const;
export type BindingRole = (typeof BINDING_ROLES)[number];

/**
 * The cascade's words (ADR-0160 §4) — the same three stages `/goals` and the Summary name: the client's own, and kept
 * English in both languages (the approved glossary's §A.6; P18.98-T4).
 */
export const BINDING_ROLE_LABEL: Record<BindingRole, string> = {
  leads: kept('Set appointment'),
  appointments: kept('Sales meeting'),
  closings: kept('Submission polis'),
};

export interface ActivityBinding {
  leads: string[];
  appointments: string[];
  closings: string[];
}

/** The binding as the API answers it: the three lists, and the version a save names. 0 is no binding yet. */
export interface ActivityBindingView extends ActivityBinding {
  version: number;
  updatedAt: string | null;
}

/** One of an office's activity types, as the Super Admin's card offers it — archived ones included. */
export interface BindableType {
  code: string;
  label: string;
  categoryCode: string;
  displayOrder: number;
  status: 'active' | 'archived';
}

/** `GET`/`PUT /admin/tenants/:kpmId/activity-binding`. */
export interface OfficeActivityBinding extends ActivityBindingView {
  kpmId: string;
  types: BindableType[];
}

/** The Super Admin's read of one office's binding, with every type it may name. */
export const readOfficeActivityBinding = (kpmId: string) =>
  api<OfficeActivityBinding>(`/admin/tenants/${encodeURIComponent(kpmId)}/activity-binding`);

/** The whole binding, every time, with the version read: a stale one is `409 VERSION_CONFLICT`. */
export const saveOfficeActivityBinding = (kpmId: string, binding: ActivityBinding, expectedVersion: number) =>
  api<OfficeActivityBinding>(`/admin/tenants/${encodeURIComponent(kpmId)}/activity-binding`, {
    method: 'PUT',
    body: { leads: binding.leads, appointments: binding.appointments, closings: binding.closings, expectedVersion },
  });

/** The Owner's and the Admin's read of their own office's binding, for the activity types screen. */
export const readOwnActivityBinding = () => api<ActivityBindingView>('/kpm/settings/activity-binding');

/** Which role each bound code counts in — one each; the first wins on a binding older than that rule. */
export function rolesByCode(binding: ActivityBinding | null): Map<string, BindingRole> {
  const out = new Map<string, BindingRole>();
  if (!binding) return out;
  for (const role of BINDING_ROLES) {
    for (const code of binding[role] ?? []) if (!out.has(code)) out.set(code, role);
  }
  return out;
}
