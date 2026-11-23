import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enterKpm, enteredKpmId, insideKpm, KPM_HEADER, kpmHeaderFor, leaveKpm, onKpmChange,
} from './super-admin-kpm';

/**
 * **The KPM a Super Admin works inside** (ADR-0268 §3; P19.17 F2): held per tab, sent as `X-Kpm-Id`, and the Super
 * Admin alone is ever *inside* — a member, and a support session, never are.
 */
describe('super-admin-kpm (ADR-0268 §3)', () => {
  const KPM = '65b1f0c2a4d3e5f6a7b8c9e0';
  const OTHER = '65b1f0c2a4d3e5f6a7b8c9e1';
  const sa = { user: { platformRole: 'super_admin' }, isImpersonating: false };

  afterEach(() => {
    leaveKpm();
    vi.restoreAllMocks();
  });

  it('starts outside every KPM, and enters and leaves one, kept in the tab’s session storage', () => {
    expect(enteredKpmId()).toBeNull();
    enterKpm(KPM);
    expect(enteredKpmId()).toBe(KPM);
    expect(window.sessionStorage.getItem('agencyboost.superAdminKpm')).toBe(KPM);
    leaveKpm();
    expect(enteredKpmId()).toBeNull();
    expect(window.sessionStorage.getItem('agencyboost.superAdminKpm')).toBeNull();
  });

  it('refuses an id that is no KPM’s, and keeps the one entered', () => {
    enterKpm(KPM);
    for (const bad of ['', 'kpm-1', `${KPM}0`, '{"$ne":null}']) expect(() => enterKpm(bad)).toThrow(/Not a KPM id/);
    expect(enteredKpmId()).toBe(KPM);
  });

  it('tells whoever listens of a change, once per change, until they stop listening', () => {
    const heard: (string | null)[] = [];
    const stop = onKpmChange((id) => heard.push(id));
    enterKpm(KPM);
    enterKpm(KPM);
    enterKpm(OTHER);
    leaveKpm();
    leaveKpm();
    stop();
    enterKpm(KPM);
    expect(heard).toEqual([KPM, OTHER, null]);
  });

  it('the header: X-Kpm-Id inside a KPM, never on a platform route, nothing outside', () => {
    expect(kpmHeaderFor('/kpm/overview')).toEqual({});
    enterKpm(KPM);
    expect(KPM_HEADER).toBe('X-Kpm-Id');
    expect(kpmHeaderFor('/kpm/overview')).toEqual({ 'X-Kpm-Id': KPM });
    expect(kpmHeaderFor('/members?limit=5')).toEqual({ 'X-Kpm-Id': KPM });
    for (const platform of ['/admin', '/admin/tenants', '/admin?x=1']) expect(kpmHeaderFor(platform)).toEqual({});
    // P19.30-T2: Import people's own routes under /admin carry it — for the KPM entered, never another.
    expect(kpmHeaderFor(`/admin/tenants/${KPM}/roster/file/preview`)).toEqual({ 'X-Kpm-Id': KPM });
    expect(kpmHeaderFor(`/admin/tenants/${KPM}/roster`)).toEqual({ 'X-Kpm-Id': KPM });
    expect(kpmHeaderFor(`/admin/tenants/roster-template?format=xlsx&kpmId=${KPM}`)).toEqual({ 'X-Kpm-Id': KPM });
    const other = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    for (const platform of [
      `/admin/tenants/${other}/roster`, `/admin/tenants/${KPM}`, `/admin/tenants/${KPM}/report?month=2026-10`,
      `/admin/tenants/${KPM}/rosterx`, `/admin/tenants/roster-template?format=xlsx&kpmId=${other}`,
      `/admin/tenants/roster-template?format=xlsx&kpmId=${KPM}x`,
    ]) {
      expect([platform, kpmHeaderFor(platform)]).toEqual([platform, {}]);
    }
  });

  it('only a Super Admin acting as themselves is inside — never a member, never a support session', () => {
    expect(insideKpm(sa)).toBe(false);
    enterKpm(KPM);
    expect(insideKpm(sa)).toBe(true);
    expect(insideKpm({ user: { platformRole: 'super_admin' } })).toBe(true);
    expect(insideKpm({ user: { platformRole: 'none' }, isImpersonating: false })).toBe(false);
    expect(insideKpm({ user: { platformRole: 'super_admin' }, isImpersonating: true })).toBe(false);
  });

  it('a tab whose storage refuses still enters and leaves, in memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    enterKpm(KPM);
    expect(enteredKpmId()).toBe(KPM);
    leaveKpm();
    expect(enteredKpmId()).toBeNull();
  });
});

describe('super-admin-kpm on load', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('a reload stays inside the KPM the tab entered', async () => {
    window.sessionStorage.setItem('agencyboost.superAdminKpm', '65b1f0c2a4d3e5f6a7b8c9e0');
    vi.resetModules();
    const fresh = await import('./super-admin-kpm');
    expect(fresh.enteredKpmId()).toBe('65b1f0c2a4d3e5f6a7b8c9e0');
  });

  it('a stored value that is no KPM id, or storage that refuses, starts outside every KPM', async () => {
    window.sessionStorage.setItem('agencyboost.superAdminKpm', 'garbage');
    vi.resetModules();
    expect((await import('./super-admin-kpm')).enteredKpmId()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.resetModules();
    expect((await import('./super-admin-kpm')).enteredKpmId()).toBeNull();
  });
});
