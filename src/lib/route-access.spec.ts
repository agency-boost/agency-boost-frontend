import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { parse, SRC } from '@test/copy-scan';
import { landingFor } from './landing';
import type { Me } from './session';
import {
  canOpen, FAMILY_GATES, familyAllows, GATES, gatesFor, readsOfficeAnalytics, routeFor, ROUTES, stewardsOffice, type RouteFamily,
} from './route-access';
import { enterKpm, leaveKpm } from './super-admin-kpm';

/*
 * Who is who, with the grants the server resolves for each (`backend/src/modules/rbac/permissions.ts`), cut
 * to the ones the gates in `route-access.ts` name.
 */
const FIELD = [
  'member:read_profile', 'tenant_config:read', 'org_tree:read', 'profile:read_self', 'notification:read_inbox',
  'leader_meeting:read', 'leader_meeting:read_shared_link', 'unit_dashboard:read', 'calendar_entry:read', 'goal:read',
  'lead:read', 'coaching_session:read', 'activity_log:read_raw', 'training_progress:read', 'product_catalog:read',
  'recruitment:read', 'activation:read', 'new_hires:read_roster', 'campaign:read_list', 'event:read_list',
  'personal_summary:read',
];
const LEADING = [...FIELD, 'member:search_untagged_pool', 'leader_request:read_inbox', 'coaching_profile:read'];
const OFFICE = [
  ...FIELD, 'member:search_untagged_pool', 'leader_request:read_inbox', 'kpm_overview:read',
  'data_upload:read', 'kpm:read_profile', 'kpm:import_roster', 'activation_settings:read', 'training_settings:read',
  'product_settings:read', 'campaign_settings:read', 'event_settings:read', 'kpm_admin:list',
];

const membership = (over: Partial<NonNullable<Me['membership']>> = {}): NonNullable<Me['membership']> => ({
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
  isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});

/**
 * Platform-wide and in no office, holding most of an office's read grants besides (`all`) but not the roster's — nor,
 * since P19.4-T2 (ADR-0206 §2), the import's or the data upload's.
 */
const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' },
  membership: null,
  permissions: [
    ...OFFICE.filter((p) => ![
      'member:read_profile', 'org_tree:read', 'calendar_entry:read', 'activation:read', 'new_hires:read_roster',
      'kpm:import_roster', 'data_upload:read',
    ].includes(p)),
    'kpm:list_all', 'kpm_admin:grant', 'platform_analytics:read', 'billing:read_prices', 'org_level:crud',
    'company_template:read',
  ],
});
/** Every permission any gate names: what is left to refuse is the family. */
const EVERY_GATE = [...new Set([...GATES.map((g) => g.permission), ...Object.values(FAMILY_GATES)])];
const OWNER = makeMe({
  membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 3 }),
  permissions: [...OFFICE, 'kpm_admin:grant'],
});
const ADMIN = makeMe({
  membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmAdmin: true, directCount: 2 }),
  permissions: OFFICE,
});
const AB = makeMe({ membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }), permissions: LEADING });
const AAB = makeMe({ membership: membership({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 }), permissions: LEADING });
const AGENT = makeMe({ membership: membership(), permissions: FIELD });
const AGENT_WITH_REPORTS = makeMe({ membership: membership({ directCount: 1 }), permissions: FIELD });
const PENDING = makeMe({ membership: membership({ status: 'pending' }), permissions: ['profile:read_self', 'notification:read_inbox'] });
const REMOVED = makeMe({ membership: membership({ status: 'removed' }), permissions: ['profile:read_self'] });
const NOBODY_S = makeMe({ membership: null, permissions: ['profile:read_self', 'notification:read_inbox'] });
/**
 * **A core leader** (ADR-0268 §1): an AB tagged *Core leader*, holding the Owner's grants in KPM, Pengaturan and People —
 * but neither the KPM admins' (`kpm_admin:list`) nor the core leader tag's.
 */
const CORE_LEADER = makeMe({
  membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4, isCoreLeader: true }),
  permissions: [...LEADING, ...OFFICE.filter((p) => p !== 'kpm_admin:list')],
});

/** The addresses each family's checks are read against, one per kind of gate. */
const ADDRESSES = {
  console: ['/admin', '/admin/billing', '/admin/tenants/kpm-1/roster'],
  office: ['/kpm/overview', '/kpm/settings/activity-types', '/people/members/mem-2'],
  field: ['/activity/log', '/unit/dashboard', '/coaching/mem-2/session', '/training/onboarding/m-1'],
};

const opens = (me: Me | null, paths: readonly string[]) => paths.filter((path) => canOpen(path, me));

describe('canOpen — by family and role (2026-10-11)', () => {
  it('nobody signed in opens nothing', () => {
    expect(opens(null, [...ADDRESSES.console, ...ADDRESSES.office, ...ADDRESSES.field, '/', '/profile'])).toEqual([]);
  });

  it('a Super Admin opens the console, and no office or field page — not even holding every grant there is', () => {
    expect(opens(SUPER_ADMIN, ADDRESSES.console)).toEqual(ADDRESSES.console);
    expect(opens(SUPER_ADMIN, [...ADDRESSES.office, ...ADDRESSES.field])).toEqual([]);
    const holdsAll = makeMe({ ...SUPER_ADMIN, permissions: EVERY_GATE });
    expect(opens(holdsAll, [...ADDRESSES.office, ...ADDRESSES.field])).toEqual([]);
  });

  it('a member holding every grant there is still opens no page of the platform console', () => {
    for (const me of [OWNER, ADMIN, AB, AGENT]) {
      expect(opens(makeMe({ ...me, permissions: EVERY_GATE }), ADDRESSES.console)).toEqual([]);
    }
  });

  it('the Owner opens the console of their office and the field view (ADR-0114), never the platform console', () => {
    expect(opens(OWNER, ADDRESSES.office)).toEqual(ADDRESSES.office);
    expect(opens(OWNER, ADDRESSES.field)).toEqual(ADDRESSES.field);
    // They hold `kpm:import_roster`, the import's grant: the platform console, its retired roster address included, is
    // still not theirs (P19.4-T2: the address redirects under the console's own gate).
    expect(opens(OWNER, ADDRESSES.console)).toEqual([]);
  });

  it('an Admin opens the same — the KPM admins page included, read-only, since ADR-0268 §2', () => {
    expect(opens(ADMIN, ADDRESSES.office)).toEqual(ADDRESSES.office);
    expect(opens(ADMIN, ADDRESSES.field)).toEqual(ADDRESSES.field);
    expect(opens(ADMIN, ADDRESSES.console)).toEqual([]);
    expect(canOpen('/people/admins', ADMIN)).toBe(true);
  });

  it('ADR-0268 §2 /people/admins is decided by its gate, kpm_admin:list: the Owner and an Admin, never a core leader', () => {
    expect(gatesFor('/people/admins')).toEqual(['member:read_profile', 'kpm_admin:list']);
    expect(canOpen('/people/admins', OWNER)).toBe(true);
    expect(canOpen('/people/admins', ADMIN)).toBe(true);
    expect(canOpen('/people/admins', CORE_LEADER)).toBe(false);
    // Whoever lacks the grant is refused by the page's own gate.
    expect(canOpen('/people/admins', makeMe({ ...OWNER, permissions: OFFICE.filter((p) => p !== 'kpm_admin:list') }))).toBe(false);
  });

  it('ADR-0268 §1 a core leader opens the KPM, People and Pengaturan pages their grants allow, and the field view', () => {
    expect(opens(CORE_LEADER, ADDRESSES.office)).toEqual(ADDRESSES.office);
    expect(opens(CORE_LEADER, ['/kpm/data-upload', '/people/import', '/people/org-tree', '/people/members'])).toEqual([
      '/kpm/data-upload', '/people/import', '/people/org-tree', '/people/members',
    ]);
    expect(opens(CORE_LEADER, ADDRESSES.field)).toEqual(ADDRESSES.field);
    expect(opens(CORE_LEADER, ADDRESSES.console)).toEqual([]);
    // The tag alone, on an AB holding only a leader's grants, opens no office page: the gates still decide.
    const untagged = makeMe({ ...AB, membership: { ...AB.membership!, isCoreLeader: true } });
    expect(opens(untagged, ['/kpm/overview', '/people/import'])).toEqual([]);
  });

  it('ADR-0268 §3 a Super Admin inside a KPM opens its office pages as its Owner, and the console; outside, none', () => {
    const inside = makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, ...OFFICE, 'kpm_admin:grant'] });
    expect(opens(inside, ADDRESSES.office)).toEqual([]);
    enterKpm('65b1f0c2a4d3e5f6a7b8c9e0');
    try {
      expect(opens(inside, ADDRESSES.office)).toEqual(ADDRESSES.office);
      expect(canOpen('/people/admins', inside)).toBe(true);
      expect(opens(inside, ADDRESSES.console)).toEqual(ADDRESSES.console);
      // The field view is a member's: the Super Admin is nobody's member in the KPM.
      expect(opens(inside, ADDRESSES.field)).toEqual([]);
      // A support session is a member's, never the Super Admin inside: it follows the member.
      expect(opens(makeMe({ ...AGENT, isImpersonating: true, impersonatedBy: 'u-root' }), ADDRESSES.office)).toEqual([]);
    } finally {
      leaveKpm();
    }
    expect(opens(inside, ADDRESSES.office)).toEqual([]);
  });

  it('an AB and an AAB open the field view, the coaching of a person they lead included, and no console', () => {
    for (const leader of [AB, AAB]) {
      expect(opens(leader, ADDRESSES.field)).toEqual(ADDRESSES.field);
      expect(canOpen('/coaching/mem-2/leader-notes', leader)).toBe(true);
      expect(canOpen('/user-management/pending', leader)).toBe(true);
      expect(opens(leader, [...ADDRESSES.office, ...ADDRESSES.console])).toEqual([]);
    }
  });

  it('an Agent opens their field pages and no console — not even a settings page whose every grant they hold', () => {
    expect(canOpen('/activity/log', AGENT)).toBe(true);
    expect(canOpen('/leads', AGENT)).toBe(true);
    // `tenant_config:read` and `member:read_profile` are every member's: the console is still not theirs.
    expect(gatesFor('/kpm/settings/activity-types').every((p) => AGENT.permissions.includes(p))).toBe(true);
    expect(canOpen('/kpm/settings/activity-types', AGENT)).toBe(false);
    expect(opens(AGENT, [...ADDRESSES.office, ...ADDRESSES.console])).toEqual([]);
    // What only a leader holds.
    expect(canOpen('/coaching/mem-2/leader-notes', AGENT)).toBe(false);
    expect(canOpen('/user-management/add', AGENT)).toBe(false);
  });

  it('an Agent with a report opens what their grants allow, as an Agent without one does', () => {
    expect(opens(AGENT_WITH_REPORTS, ADDRESSES.field)).toEqual(ADDRESSES.field);
    expect(opens(AGENT_WITH_REPORTS, ADDRESSES.office)).toEqual([]);
  });

  it('a pending member opens only the page they land on, and no other page of the field view', () => {
    expect(canOpen('/user-management/leader', PENDING)).toBe(true);
    expect(opens(PENDING, ['/user-management/kpm', '/activity/log', ...ADDRESSES.office, ...ADDRESSES.console])).toEqual([]);
  });

  it('somebody in no office, or removed from one, opens only finding an office', () => {
    for (const me of [NOBODY_S, REMOVED]) {
      expect(canOpen('/user-management/kpm', me)).toBe(true);
      expect(opens(me, ['/user-management/leader', '/activity/log', ...ADDRESSES.office, ...ADDRESSES.console])).toEqual([]);
    }
  });

  it('a page outside every group is decided by its gates alone, for every family', () => {
    for (const me of [SUPER_ADMIN, OWNER, AGENT, PENDING, NOBODY_S]) {
      expect(canOpen('/profile', me)).toBe(true);
      expect(canOpen('/', me)).toBe(true);
      expect(canOpen('/join', me)).toBe(true);
    }
    expect(canOpen('/leader-meetings/shared/tok', AGENT)).toBe(true);
    expect(canOpen('/leader-meetings/shared/tok', PENDING)).toBe(false);
    expect(canOpen('/notifications', REMOVED)).toBe(false);
  });

  it('P19.19-T4 AC-1 KPM Analytics is gone for everyone: neither route is a page any more (ADR-0272 §1)', () => {
    expect(ROUTES['/kpm/analytics']).toBeUndefined();
    expect(ROUTES['/kpm/analytics/compliance']).toBeUndefined();
    expect(ROUTES['/admin/tenants/[kpmId]/analytics']).toBeUndefined();
    expect(opens(OWNER, ['/kpm/analytics', '/kpm/analytics/compliance'])).toEqual([]);
  });

  it('the screens for somebody not signed in are nowhere to return to', () => {
    for (const me of [SUPER_ADMIN, OWNER, AGENT, NOBODY_S]) {
      expect(opens(me, [
        '/login', '/register', '/forgot-password', '/reset-password/t', '/verify-email/t', '/verify-email-change/t',
        // P19.2-T1 AC-8 (ADR-0199 §2): a linked login's link — an emailed page, never somewhere to land after signing in.
        '/link-account/t',
      ])).toEqual([]);
    }
  });
});

describe('familyAllows — whose chrome a reader may be in, which the shells ask too (2026-10-11)', () => {
  const PENDING_OWNER = makeMe({ membership: membership({ status: 'pending', isKpmOwner: true }), permissions: [] });
  const AS_AGENT = makeMe({ ...AGENT, isImpersonating: true, impersonatedBy: 'u-root' });
  const families: RouteFamily[] = ['admin', 'tenant', 'agent'];
  const allowed = (me: Me) => families.filter((family) => familyAllows(family, me));

  it.each([
    ['a Super Admin', SUPER_ADMIN, ['admin']],
    ['the Owner', OWNER, ['tenant', 'agent']],
    ['an Admin', ADMIN, ['tenant', 'agent']],
    ['an AB', AB, ['agent']],
    ['a core leader, an AB tagged (ADR-0268 §1)', CORE_LEADER, ['tenant', 'agent']],
    ['an AAB', AAB, ['agent']],
    ['an Agent', AGENT, ['agent']],
    ['an Agent with a report', AGENT_WITH_REPORTS, ['agent']],
    ['a pending member', PENDING, ['agent']],
    ['a pending Owner, as RoleShell chooses for them', PENDING_OWNER, ['tenant', 'agent']],
    ['somebody in no office', NOBODY_S, ['agent']],
    ['a support session as an Agent, which follows the Agent', AS_AGENT, ['agent']],
  ] as const)('%s', (_who, me, expected) => {
    expect(allowed(me)).toEqual(expected);
  });

  it('ADR-0268 §3 a Super Admin inside a KPM is in the office’s chrome too, and out of it on leaving', () => {
    enterKpm('65b1f0c2a4d3e5f6a7b8c9e0');
    try {
      expect(allowed(SUPER_ADMIN)).toEqual(['admin', 'tenant']);
      expect(stewardsOffice(SUPER_ADMIN)).toBe(true);
      expect(readsOfficeAnalytics(SUPER_ADMIN)).toBe(true);
      // Entering a KPM makes nobody else a steward of it: the header is ignored for them, and so is the state here.
      expect(allowed(AB)).toEqual(['agent']);
      expect(allowed(AS_AGENT)).toEqual(['agent']);
    } finally {
      leaveKpm();
    }
    expect(allowed(SUPER_ADMIN)).toEqual(['admin']);
    expect(readsOfficeAnalytics(SUPER_ADMIN)).toBe(false);
  });

  it('the screens for somebody not signed in are nobody’s chrome, and the routes outside every group everybody’s', () => {
    for (const me of [SUPER_ADMIN, OWNER, AGENT]) {
      expect(familyAllows('auth', me)).toBe(false);
      expect(familyAllows('shared', me)).toBe(true);
    }
  });

  it('every landing is in a family that admits its reader, so a shell’s redirect cannot go round in a circle', () => {
    for (const me of [SUPER_ADMIN, OWNER, ADMIN, CORE_LEADER, AB, AAB, AGENT, AGENT_WITH_REPORTS, PENDING, PENDING_OWNER, REMOVED, NOBODY_S]) {
      const landing = landingFor(me);
      expect(familyAllows(ROUTES[routeFor(landing)!], me), landing).toBe(true);
    }
  });
});

describe('canOpen — matching an address to its page', () => {
  it('fills a [segment] with one segment of the address, and a fixed segment beats it, as Next resolves them', () => {
    expect(routeFor('/coaching/me')).toBe('/coaching/me');
    expect(routeFor('/coaching/mem-2')).toBe('/coaching/[membershipId]');
    expect(routeFor('/coaching/me/training')).toBe('/coaching/me/training');
    expect(routeFor('/coaching/mem-2/training')).toBe('/coaching/[membershipId]/training');
    expect(routeFor('/admin/tenants/new')).toBe('/admin/tenants/new');
    expect(routeFor('/admin/tenants/kpm-1')).toBe('/admin/tenants/[kpmId]');
    expect(routeFor('/leader-meetings/shared/tok')).toBe('/leader-meetings/shared/[token]');
    expect(routeFor('/training/cat/mod')).toBe('/training/[categoryCode]/[moduleCode]');
    expect(routeFor('/')).toBe('/');
  });

  it('holds a page to its own gate, and to its layouts’ gates, which reach every page beneath them', () => {
    expect(gatesFor('/kpm/overview')).toEqual(['member:read_profile', 'kpm_overview:read']);
    expect(gatesFor('/coaching/[membershipId]/activity')).toEqual(['coaching_session:read', 'activity_log:read_raw']);
    expect(gatesFor('/training/[categoryCode]/[moduleCode]')).toEqual(['training_progress:read']);
    expect(gatesFor('/admin')).toEqual(['kpm:list_all']);
    expect(gatesFor('/join')).toEqual([]);

    const readsSessions = makeMe({ ...AB, permissions: ['coaching_session:read'] });
    expect(canOpen('/coaching/mem-2/session', readsSessions)).toBe(true);
    expect(canOpen('/coaching/mem-2/activity', readsSessions)).toBe(false);
    // The page's own gate without the layout's is not enough.
    expect(canOpen('/coaching/mem-2/activity', makeMe({ ...AB, permissions: ['activity_log:read_raw'] }))).toBe(false);
    // A layout reaches the pages in its directory, not a sibling route: `/coaching/me/*` is under none of it.
    expect(gatesFor('/coaching/me/activation')).toEqual(['coaching_session:read']);
    expect(gatesFor('/coaching')).toEqual(['coaching_session:read']);
  });

  it('a page that declares its gate twice, as capability mapping does loading and loaded, has the one gate', () => {
    expect(gatesFor('/kpm/settings/capability-mapping')).toEqual(['member:read_profile', 'tenant_config:read']);
  });

  it('ignores the query and the hash, and a trailing slash', () => {
    expect(canOpen('/kpm/overview?group=none#compliance', OWNER)).toBe(true);
    expect(canOpen('/kpm/overview#x', AGENT)).toBe(false);
    expect(canOpen('/kpm/overview/', OWNER)).toBe(true);
    expect(canOpen('/leader-meetings/shared/tok?from=wa', AGENT)).toBe(true);
  });

  it('an address that is no page of the app is not openable, by anybody', () => {
    for (const me of [SUPER_ADMIN, OWNER, AGENT]) {
      expect(opens(me, [
        '/kpm/advanced-analytics', '/nope', '/kpm', '/coaching/mem-2/nope', '', 'kpm/overview', '/coaching//activity',
      ])).toEqual([]);
    }
    // `shared` alone is a meeting id as far as the address goes, as Next reads it.
    expect(routeFor('/leader-meetings/shared')).toBe('/leader-meetings/[meetingId]');
  });
});

/*
 * **The table is the app directory's.** It is written by hand, so it is read back against `src/app`: a new
 * page with no row, a new gate with no row, or a row for a page or a gate that has gone, fails here. The scan
 * reads the syntax tree, so a gate mentioned in a comment does not count.
 */
const APP = join(SRC, 'app');
const GROUP = /^\((.+)\)$/;

interface RouteFile {
  file: string;
  route: string;
  family: string;
  kind: 'page' | 'layout';
  /** A group's own layout, `(agent)/layout.tsx`: it gates through its shell's default, `FAMILY_GATES`. */
  groupRoot: boolean;
}

function routeFiles(): RouteFile[] {
  return readdirSync(APP, { encoding: 'utf8', recursive: true })
    .filter((f) => /(^|[\\/])(page|layout)\.tsx$/.test(f))
    .map((file) => {
      const parts = file.split(/[\\/]/);
      const kind = parts.pop()!.replace('.tsx', '') as 'page' | 'layout';
      const group = parts.map((p) => GROUP.exec(p)?.[1]).find(Boolean);
      const segments = parts.filter((p) => !GROUP.test(p));
      return {
        file, kind, route: `/${segments.join('/')}`, family: group ?? 'shared', groupRoot: Boolean(group) && segments.length === 0,
      };
    });
}

/**
 * The gates a file declares: `permission="…"`, `permission={'…'}` and `permission: '…'`, de-duplicated — a page
 * that renders its gate in two branches, its loading state and its loaded one, declares one gate. A gate whose
 * value is not a literal cannot be keyed, and is returned as `unreadable`.
 */
function declaredGates(fileName: string, source: string): { gates: string[]; unreadable: string[] } {
  const sf = parse(fileName, source);
  const gates = new Set<string>();
  const unreadable: string[] = [];
  const read = (value: ts.Node | undefined, node: ts.Node) => {
    if (value && ts.isStringLiteralLike(value)) gates.add(value.text);
    else unreadable.push(node.getText(sf));
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'permission') {
      const init = node.initializer;
      read(init && ts.isJsxExpression(init) ? init.expression : init, node);
    } else if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'permission') {
      read(node.initializer, node);
    } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'permission') {
      unreadable.push(node.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { gates: [...gates].sort(), unreadable };
}

const gatesIn = (file: string) => declaredGates(file, readFileSync(join(APP, file), 'utf8'));

describe('the route table is the app directory’s', () => {
  const files = routeFiles();

  it('the scan reads every spelling of a gate, once, and refuses one it cannot key', () => {
    const code = `export const P = () => (
      <>
        <Page permission="a:read">x</Page>
        <Page permission={'b:read'}>x</Page>
        <Page permission="a:read">x</Page>
        {/* <Page permission="c:read" /> */}
      </>
    );
    const tabs = [{ permission: 'd:read' }];`;
    expect(declaredGates('x.tsx', code)).toEqual({ gates: ['a:read', 'b:read', 'd:read'], unreadable: [] });
    expect(declaredGates('x.tsx', 'const P = ({ permission }) => <Page permission={permission} />;').unreadable)
      .toEqual(['permission={permission}']);
  });

  it('every page in src/app is a route in the table, in its group’s family, and the table names no other', () => {
    const pages = files.filter((f) => f.kind === 'page').map((f) => `${f.route} ${f.family}`).sort();
    expect(Object.entries(ROUTES).map(([route, family]) => `${route} ${family}`).sort()).toEqual(pages);
  });

  it('every family is one the table knows, and every segment one the matcher knows — a catch-all would fail here', () => {
    const families: RouteFamily[] = ['admin', 'tenant', 'agent', 'auth', 'shared'];
    for (const f of files) expect(families).toContain(f.family);
    for (const route of Object.keys(ROUTES)) {
      for (const segment of route.split('/').slice(1).filter(Boolean)) {
        expect(segment, route).toMatch(/^([a-z0-9-]+|\[[A-Za-z]+\])$/);
      }
    }
  });

  it('every gate a page or a layout declares is a row, and every row is declared', () => {
    const declared = files
      .filter((f) => !f.groupRoot)
      .flatMap((f) => {
        const { gates, unreadable } = gatesIn(f.file);
        expect(unreadable, `${f.file}: a gate that is not a literal cannot be keyed`).toEqual([]);
        return gates.map((permission) => `${f.kind} ${f.route} ${permission}`);
      })
      .sort();
    expect(GATES.map((g) => `${g.on} ${g.route} ${g.permission}`).sort()).toEqual(declared);
  });

  /*
   * *Changed 2026-11-05 (P19.2-T1; ADR-0197):* **one shell for every family.** The group layouts render it with their
   * family — the field's through `AgentShell` — and the shell takes the family's gate from `FAMILY_GATES` itself, so the
   * table and the gate cannot part. It read each console shell's own `permission = '…'` default until then.
   */
  it('P19.2-T1 AC-2 each group’s layout renders the one shell with its family, gated by FAMILY_GATES', () => {
    const SHELLS: Record<string, string | null> = {
      admin: '<Shell family="admin">',
      tenant: '<Shell family="tenant">',
      agent: '<AgentShell>',
      auth: null,
    };
    const roots = files.filter((f) => f.groupRoot && f.kind === 'layout');
    expect(roots.map((f) => f.family).sort()).toEqual(Object.keys(SHELLS).sort());
    for (const root of roots) {
      const source = readFileSync(join(APP, root.file), 'utf8');
      // Its own gate would reach every page in the group, which the table has no row for.
      expect(gatesIn(root.file), root.file).toEqual({ gates: [], unreadable: [] });
      const shell = SHELLS[root.family];
      if (!shell) {
        expect(FAMILY_GATES[root.family as RouteFamily]).toBeUndefined();
        continue;
      }
      expect(source, root.file).toContain(shell);
    }
    expect(readFileSync(join(SRC, 'components', 'agent-shell.tsx'), 'utf8')).toContain('<Shell family="agent"');
    // The office's and the platform's gates, as the two consoles' defaults were; the field family has none.
    expect(FAMILY_GATES).toEqual({ admin: 'kpm:list_all', tenant: 'member:read_profile' });
  });

  it('P19.2-T1 AC-2 the one shell passes its family to RequireSession, and the family’s gate when the page names none', () => {
    const source = readFileSync(join(SRC, 'components', 'shell.tsx'), 'utf8');
    expect(source.match(/<RequireSession\b[^>]*>/g)).toEqual([
      '<RequireSession permission={permission ?? (family ? FAMILY_GATES[family] : undefined)} family={family}>',
    ]);
    // The two consoles' shells are gone (ADR-0197 §1): nothing chooses between shells any more.
    expect(existsSync(join(SRC, 'components', 'tenant-shell.tsx'))).toBe(false);
    expect(existsSync(join(SRC, 'components', 'admin-shell.tsx'))).toBe(false);
  });

  /*
   * *Replaced 2026-11-20 (ADR-0268 §2):* **no page is the Owner's alone.** `OWNER_ONLY` named *Manage KPM admins*, which
   * the office menu hid from an Admin; the Admin now reads it, and the gate decides who opens it (`kpm_admin:list`).
   */
  it('ADR-0268 §2 no route is decided by being the Owner: the KPM admins page by its gate alone', () => {
    const source = readFileSync(join(SRC, 'lib', 'route-access.ts'), 'utf8');
    expect(source).not.toMatch(/export const OWNER_ONLY/);
    expect(GATES.filter((g) => g.route === '/people/admins').map((g) => g.permission)).toEqual(['kpm_admin:list']);
  });

  it('no component declares a gate of its own: a gate is on the page or the layout, where the table keys it', () => {
    const components = readdirSync(join(SRC, 'components'), { encoding: 'utf8', recursive: true })
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'));
    const found = components.flatMap((f) => {
      const { gates } = declaredGates(f, readFileSync(join(SRC, 'components', f), 'utf8'));
      return gates.map((g) => `${f}: ${g}`);
    });
    expect(found).toEqual([]);
  });
});
