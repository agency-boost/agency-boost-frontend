import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **What a route's first load must not carry** (P18.11-T16, the bundle, 2026-10-30; the 200 kB budget in
 * `docs/02-specs/nfr/performance-and-scale.md`).
 *
 * Importing one export loads the whole module it lives in, and everything that module imports; a dialog imported
 * statically is in the first load although nothing draws it before a tap. Both put five routes past 200 kB: New Hires
 * took a calendar link from `lib/calendar.ts` and a WhatsApp rule from `lib/leads.ts`, the forum's list a sign-in helper
 * from the meeting screen, the Summary's chasing card a toast from the campaigns list, the Coaching Session the record's
 * parts and the PDF's paper, and the forms, sheets and dialogs below were static imports. Each is now loaded with
 * `next/dynamic` (or `import()` in the handler that needs it) or kept in a module of its own.
 *
 * This walks each page's **static** imports — `import type` and `import()` are not loads — and fails when one of
 * them reaches a module the route must fetch only when asked. *Widened 2026-11-06 (the bundle; 15 routes past 190 kB,
 * the worst 255):* the page header and the shell, which every page loads, and the routes whose tabs, section editors
 * and sheets now load on demand. The build's own figure is `scripts/check-bundle-size.mjs`;
 * this names the import that moved it.
 */
const SRC = join(__dirname, '..');

const IMPORT = /^(?:import|export)\s+(?!type\s)([^;]*?)\s+from\s+'([^']+)';/gm;
const SIDE_EFFECT = /^import\s+'([^']+)';/gm;

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2))
    : spec.startsWith('.') ? normalize(join(dirname(from), spec)) : null;
  if (!base) return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && !(base + ext).endsWith('/') && /\.tsx?$/.test(base + ext)) return base + ext;
  }
  return null;
}

/** A named import whose every name is `type …` loads nothing. */
const typeOnly = (names: string) => {
  const list = names.trim();
  if (!list.startsWith('{')) return false;
  const parts = list.slice(1, -1).split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => p.startsWith('type '));
};

/** Every module a file loads, statically, with the import chain that reached each. */
function closure(entry: string): Map<string, string | null> {
  const seen = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    const text = readFileSync(file, 'utf8');
    const specs = [
      ...[...text.matchAll(IMPORT)].filter((m) => !typeOnly(m[1])).map((m) => m[2]),
      ...[...text.matchAll(SIDE_EFFECT)].map((m) => m[1]),
    ];
    for (const spec of specs) {
      const next = resolve(spec, file);
      if (next && !seen.has(next)) {
        seen.set(next, file);
        queue.push(next);
      }
    }
  }
  return seen;
}

function chain(seen: Map<string, string | null>, file: string): string {
  const steps: string[] = [];
  for (let at: string | null | undefined = file; at; at = seen.get(at)) steps.push(relative(SRC, at));
  return steps.join(' <- ');
}

/** The route's page, and the modules its first load must not reach. */
const HELD_BACK: readonly [page: string, modules: readonly string[]][] = [
  ['app/(agent)/new-hires/page.tsx', [
    'lib/calendar.ts', 'lib/coaching.ts', 'lib/leads.ts', 'components/add-agent-form.tsx', 'components/request-inbox.tsx',
  ]],
  ['app/(agent)/new-hires/[membershipId]/page.tsx', [
    'lib/calendar.ts', 'lib/coaching.ts', 'lib/leads.ts', 'components/phone-number-sheet.tsx',
  ]],
  ['app/(agent)/unit/dashboard/page.tsx', ['components/add-agent-form.tsx']],
  ['app/(agent)/coaching/[membershipId]/session/page.tsx', [
    'components/lead-sheet.tsx', 'components/coaching-print-view.tsx', 'components/coaching-record-parts.tsx',
    'components/coaching-reopen-dialog.tsx', 'components/coaching-activity-drill.tsx', 'components/phone-number-sheet.tsx',
  ]],
  ['app/(agent)/coaching/[membershipId]/leads/page.tsx', ['components/lead-sheet.tsx']],
  ['app/(agent)/coaching/me/page.tsx', [
    'lib/activation.ts', 'components/coaching-print-view.tsx', 'components/coaching-reopen-dialog.tsx',
    'components/coaching-activity-drill.tsx',
  ]],
  ['app/(agent)/coaching/me/training/page.tsx', ['lib/activation.ts']],
  ['app/(agent)/summary/page.tsx', ['components/campaigns/campaign-list.tsx', 'components/campaigns/campaign-dialog.tsx']],
  ['app/(agent)/coaching/[membershipId]/summary/page.tsx', [
    'components/campaigns/campaign-list.tsx', 'components/campaigns/campaign-dialog.tsx',
  ]],
  ['app/(agent)/calendar/page.tsx', ['components/calendar/entry-dialog.tsx', 'components/calendar/detail-dialog.tsx']],
  ['app/leader-meetings/page.tsx', [
    'components/leader-forum/meeting-screen.tsx', 'components/leader-forum/meeting-dialog.tsx',
  ]],
  ['app/leader-meetings/[meetingId]/page.tsx', [
    'components/leader-forum/meeting-dialog.tsx', 'components/leader-forum/share-dialog.tsx',
  ]],
  // ADR-0185: the company's page and a template's checklist draw no editor; a section draws one, and no activation client.
  ['app/(admin)/admin/companies/[companyId]/page.tsx', [
    'components/template-editor.tsx', 'components/products-tab.tsx', 'components/recruitment-playbook-tab.tsx',
  ]],
  ['app/(admin)/admin/companies/[companyId]/templates/[templateId]/page.tsx', [
    'components/template-editor.tsx', 'components/products-tab.tsx', 'components/recruitment-playbook-tab.tsx',
  ]],
  // P19.4-T5: the Rekrutmen section's editor loads when that section is opened, never with the others.
  ['app/(admin)/admin/companies/[companyId]/templates/[templateId]/[section]/page.tsx', [
    'lib/activation.ts', 'components/recruitment-playbook-tab.tsx',
    // The bundle, 2026-11-06: each section's editor, its two dialogs and Advanced analytics' publish dialogs.
    'components/template-editor.tsx', 'components/branding/template-branding-editor.tsx',
    'components/kpm-template/template-module-material.tsx', 'components/kpm-template/apply-to-offices-dialog.tsx',
    'components/kpm-template/analytics/analytics-publish-dialogs.tsx',
  ]],
  ['app/(admin)/admin/companies/[companyId]/settings/page.tsx', [
    'lib/activation.ts', 'components/products-tab.tsx', 'components/recruitment-playbook-tab.tsx',
    'components/template-editor.tsx',
  ]],
  // The bundle, 2026-11-06 (`performance-and-scale.md`): what each of these draws only after a tap, or on another tab.
  ['app/(admin)/admin/companies/[companyId]/templates/[templateId]/page.tsx', [
    'components/kpm-template/publish-all-dialog.tsx', 'components/kpm-template/apply-to-offices-dialog.tsx',
  ]],
  ['app/(admin)/admin/tenants/[kpmId]/page.tsx', [
    'components/admin/platform-members.tsx', 'components/admin/kpm-billing-tab.tsx', 'components/save-as-template-dialog.tsx',
    // *Data bulanan*'s read needs neither analytics client (`platform-reads.ts`).
    'lib/kpm-analytics.ts', 'lib/kpm-compliance.ts',
  ]],
  ['app/(admin)/admin/tenants/[kpmId]/analytics/page.tsx', [
    'components/analytics/compliance-screen.tsx', 'components/advanced-analytics/advanced-analytics-screen.tsx',
  ]],
  ['app/(tenant)/kpm/settings/products/page.tsx', ['components/product-proposal-editor.tsx', 'components/ui/modal.tsx']],
  ['app/leader-meetings/[meetingId]/page.tsx', [
    'components/leader-forum/agenda.tsx', 'components/leader-forum/action-items.tsx', 'components/leader-forum/v1-minutes.tsx',
    'components/leader-forum/print-layout.tsx', 'lib/goals.ts', 'lib/use-inbox.ts',
  ]],
  ['app/profile/page.tsx', ['lib/calendar.ts', 'components/session-list.tsx', 'lib/tenant-config.ts']],
  ['app/(agent)/summary/page.tsx', ['lib/leads.ts', 'components/ui/modal.tsx']],
  ['app/(agent)/coaching/[membershipId]/summary/page.tsx', ['lib/leads.ts', 'components/ui/modal.tsx']],
  ['app/(agent)/coaching/[membershipId]/session/page.tsx', [
    'i18n/messages/surveys.ts', 'components/ui/person-row.tsx', 'components/ui/modal.tsx',
  ]],
  /*
   * **A page's header is not the shell** (the bundle, 2026-11-06): every page draws it, so it reaches none of the
   * sidebar's parts — and the shell itself reaches nothing it draws only after a tap: the bell's inbox, the surveys'
   * client, the leader-limit requests' client, the branding settings' uploads, a dialog.
   */
  ['components/page.tsx', [
    'components/app-shell.tsx', 'components/field-nav.tsx', 'components/notification-bell.tsx',
    'components/sidebar-user-menu.tsx', 'lib/use-inbox.ts', 'lib/surveys.ts',
  ]],
  ['components/shell.tsx', [
    'components/notification-popover.tsx', 'lib/use-inbox.ts', 'lib/surveys.ts', 'lib/leader-limit-requests.ts',
    'lib/branding.ts', 'lib/tenant-config.ts', 'components/ui/modal.tsx',
  ]],
];

describe('a route loads at first only what its first paint draws (P18.11-T16, the bundle)', () => {
  it.each(HELD_BACK)('%s reaches none of the modules it fetches on demand', (page, modules) => {
    const entry = join(SRC, page);
    expect(existsSync(entry), page).toBe(true);
    const seen = closure(entry);
    const reached = modules.map((m) => join(SRC, m)).filter((m) => seen.has(m)).map((m) => chain(seen, m));
    expect(reached).toEqual([]);
  });

  it('lib/hrefs.ts, which screens link through instead of loading a module, imports nothing', () => {
    const text = readFileSync(join(SRC, 'lib', 'hrefs.ts'), 'utf8');
    expect(text.match(/^\s*(?:import|export\s[^;]*\sfrom)\s/m)).toBeNull();
  });

  it('the walker sees what it guards: New Hires still reaches the activation client it draws', () => {
    // A walker that resolved nothing would pass every case above.
    const seen = closure(join(SRC, 'app', '(agent)', 'new-hires', 'page.tsx'));
    expect(seen.has(join(SRC, 'lib', 'activation.ts'))).toBe(true);
    expect(seen.has(join(SRC, 'lib', 'hrefs.ts'))).toBe(true);
  });
});
