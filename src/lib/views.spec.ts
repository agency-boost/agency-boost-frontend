import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe } from '@test/harness';
import { joinInFlight } from './in-flight';
import type { Me } from './session';
import {
  VIEW_KEY, VIEW_LANDING, clearCachedReads, forgetView, isOfficePage, isOfficeView, rememberView, rememberedView,
  resetViewsForTest, resolveView, viewKindsOf,
} from './views';

function member(over: Partial<NonNullable<Me['membership']>> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
  });
}

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
});

afterEach(() => {
  vi.restoreAllMocks();
  resetViewsForTest();
});

describe('P19.2-T1 AC-5 the views a person has (ADR-0198 §1)', () => {
  it('P19.2-T1 AC-5 an Owner has Akun saya and KPM Owner; an Admin Akun saya and KPM Admin', () => {
    expect(viewKindsOf(member({ isKpmOwner: true }))).toEqual(['self', 'kpm_owner']);
    expect(viewKindsOf(member({ isKpmAdmin: true }))).toEqual(['self', 'kpm_admin']);
    // Somebody who is the Owner and holds admin access is the Owner, as the console's chip named them.
    expect(viewKindsOf(member({ isKpmOwner: true, isKpmAdmin: true }))).toEqual(['self', 'kpm_owner']);
  });

  it('P19.2-T1 AC-5 everybody else has one view: an AB, an AAB, an Agent, somebody pending or in no office, a Super Admin', () => {
    expect(viewKindsOf(member())).toEqual(['self']);
    expect(viewKindsOf(member({ orgLevelCode: 'AAB', hierarchyRole: 'aab' }))).toEqual(['self']);
    expect(viewKindsOf(member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' }))).toEqual(['self']);
    expect(viewKindsOf(member({ isKpmOwner: true, status: 'pending' }))).toEqual(['self']);
    expect(viewKindsOf(makeMe({ membership: null }))).toEqual(['self']);
    expect(viewKindsOf(null)).toEqual(['self']);
    // A Super Admin login belongs to no office; its *Superadmin* reaches an Owner only through a linked login (AC-8).
    expect(viewKindsOf(SUPER_ADMIN)).toEqual(['super_admin']);
  });

  it('P19.2-T1 AC-5 a support session offers the member’s own views: it is the member’s session (ADR-0198 §6)', () => {
    const supporting = { ...member({ isKpmOwner: true }), isImpersonating: true, impersonatedBy: 'u-root' };
    expect(viewKindsOf(supporting)).toEqual(['self', 'kpm_owner']);
  });
});

describe('P19.2-T1 AC-4, AC-7 where a view lands (ADR-0198 §4)', () => {
  it('P19.2-T1 AC-7 Akun saya on Home, the office view on the KPM Overview, Superadmin on /admin', () => {
    expect(VIEW_LANDING).toEqual({
      self: '/home', kpm_owner: '/kpm/overview', kpm_admin: '/kpm/overview', super_admin: '/admin',
    });
    expect(isOfficeView('kpm_owner')).toBe(true);
    expect(isOfficeView('kpm_admin')).toBe(true);
    expect(isOfficeView('self')).toBe(false);
    expect(isOfficeView('super_admin')).toBe(false);
  });
});

describe('P19.2-T1 AC-7 which view a page is in (ADR-0198 §5)', () => {
  const OWNER = viewKindsOf(member({ isKpmOwner: true }));

  it('P19.2-T1 AC-7 /kpm/* and /people/* are the office view’s; nothing else is', () => {
    for (const path of ['/kpm', '/kpm/overview', '/kpm/settings/products', '/kpm/analytics', '/people/members', '/people']) {
      expect([path, isOfficePage(path)]).toEqual([path, true]);
    }
    for (const path of ['/home', '/leader-meetings', '/profile', '/notifications', '/kpmx', '/peoples', '/admin']) {
      expect([path, isOfficePage(path)]).toEqual([path, false]);
    }
  });

  it('P19.2-T1 AC-7 an office page is in the office view whatever the tab remembers', () => {
    expect(resolveView(OWNER, 'self', '/kpm/overview')).toBe('kpm_owner');
    expect(resolveView(OWNER, null, '/people/members')).toBe('kpm_owner');
  });

  it('P19.2-T1 AC-7 a field or shared page keeps the tab’s view, and is in Akun saya when the tab has none', () => {
    expect(resolveView(OWNER, 'kpm_owner', '/home')).toBe('kpm_owner');
    expect(resolveView(OWNER, 'kpm_owner', '/leader-meetings')).toBe('kpm_owner');
    expect(resolveView(OWNER, 'self', '/home')).toBe('self');
    expect(resolveView(OWNER, null, '/home')).toBe('self');
  });

  it('P19.2-T1 AC-7 a view the person does not have is never the page’s: a stale tab falls back to Akun saya', () => {
    expect(resolveView(OWNER, 'super_admin', '/home')).toBe('self');
    expect(resolveView(OWNER, 'kpm_admin', '/home')).toBe('self');
    // One view is always that view, whatever the page or the tab.
    expect(resolveView(['self'], 'kpm_owner', '/kpm/analytics')).toBe('self');
    expect(resolveView(['super_admin'], 'self', '/profile')).toBe('super_admin');
  });
});

describe('P19.2-T1 AC-7 the tab’s view, in sessionStorage (ADR-0198 §5)', () => {
  it('P19.2-T1 AC-7 remembers a view for the tab, in sessionStorage alone — never localStorage, never a cookie', () => {
    rememberView('kpm_owner');
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBe('kpm_owner');
    expect(window.localStorage.getItem(VIEW_KEY)).toBeNull();
    expect(document.cookie).not.toContain(VIEW_KEY);
    expect(rememberedView()).toBe('kpm_owner');
  });

  it('P19.2-T1 AC-4 forgetting it — sign-in and sign-out — starts the tab on Akun saya', () => {
    rememberView('kpm_owner');
    forgetView();
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBeNull();
    expect(rememberedView()).toBeNull();
    expect(resolveView(['self', 'kpm_owner'], rememberedView(), '/home')).toBe('self');
  });

  it('P19.2-T1 AC-7 reads nothing it does not know as a view', () => {
    window.sessionStorage.setItem(VIEW_KEY, 'owner-console');
    expect(rememberedView()).toBeNull();
  });

  it('P19.2-T1 AC-7 with storage refused nothing fails: the switch holds for the page’s life, and a reload lets the page decide', () => {
    const refuse = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse);
    expect(rememberedView()).toBeNull();
    expect(() => rememberView('kpm_owner')).not.toThrow();
    expect(rememberedView()).toBe('kpm_owner');
    expect(() => forgetView()).not.toThrow();
    // A reload, storage still refused: nothing held, so an office page is the office view and every other Akun saya.
    resetViewsForTest();
    expect(resolveView(['self', 'kpm_owner'], rememberedView(), '/kpm/overview')).toBe('kpm_owner');
    expect(resolveView(['self', 'kpm_owner'], rememberedView(), '/home')).toBe('self');
  });
});

describe('P19.2-T1 AC-7 a switch clears the client’s cached reads (ADR-0198 §6)', () => {
  it('P19.2-T1 AC-7 a read still out is not handed to the next page after a switch: it reads afresh', async () => {
    let release: (value: string) => void = () => undefined;
    const first = vi.fn(() => new Promise<string>((resolve) => { release = resolve; }));
    const second = vi.fn(async () => 'fresh');
    const before = joinInFlight('GET /kpm/overview', first);
    clearCachedReads();
    const after = joinInFlight('GET /kpm/overview', second);
    expect(second).toHaveBeenCalledTimes(1);
    release('stale');
    await expect(before).resolves.toBe('stale');
    await expect(after).resolves.toBe('fresh');
  });
});
