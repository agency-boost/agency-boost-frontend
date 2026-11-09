import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderWithSession, routeParams, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import {
  ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, EVENT_TYPES, PIPELINE, PRUDENTIAL, RATIOS, SUPER_ADMIN, TAXONOMY, kindView,
} from '@test/kpm-template-fixtures';
import SectionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/activity',
}));

/** A template's section page inside the shared shell's frame (`data-surface="v1"`, P19.2-T1), as a reader meets it. */
function show(section: 'activity' | 'leads') {
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    '/admin/companies/c1/template/activity_taxonomy': { body: kindView('activity_taxonomy', TAXONOMY, { version: 3, publishedVersion: 3 }) },
    '/admin/companies/c1/template/ratio_set': { body: kindView('ratio_set', RATIOS) },
    '/admin/companies/c1/template/lead_pipeline': { body: kindView('lead_pipeline', PIPELINE) },
    '/metrics': { body: [] },
  });
  renderWithSession(
    <div data-surface="v1"><main><SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section })} /></main></div>,
    { me: SUPER_ADMIN },
  );
}

/**
 * **P19.2-T2 AC-5 — a template's section at 375 and 768** (UI-135, the full report of 2 November: *tabs … 25px*, *⠿
 * 11×20*; *≥ 44px on mobile and tablet; tab rows become 44px segmented controls; ⠿ gets a 44px hit area at every
 * size*): the parts' tabs 44px below 1024px, and each ⠿ an invisible 44px area round its glyph at every width.
 */
describe('P19.2-T2 AC-5 a template’s section, its targets (UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['activity', 375], ['activity', 768], ['leads', 375], ['leads', 768],
  ] as const)('P19.2-T2 AC-5 %s at %ipx finds no target under 44px in the page', async (section, px) => {
    atWidth(px);
    show(section);
    await screen.findAllByRole('button', { name: 'Edit' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1024, 1280])('P19.2-T2 AC-5 at %ipx each ⠿ keeps its glyph and takes the tap over a 44px area', async (px) => {
    atWidth(px);
    show('activity');
    const handles = await screen.findAllByRole('button', { name: /^Reorder / });
    expect(handles.length).toBeGreaterThan(0);
    for (const handle of handles) {
      const worn = wears(handle, px).split(' ');
      expect(worn).toEqual(expect.arrayContaining(['relative', 'after:h-[max(100%,2.75rem)]', 'after:w-[max(100%,2.75rem)]', 'text-md']));
    }
  });
});

/** The other sections' payloads: as `screens.a11y.spec.tsx` and each section's own spec read them. */
const TRAINING = {
  categories: [{ code: 'SALES', label: 'Sales', description: null }],
  skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
  modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' }],
};
const CAPABILITY = {
  stages: [{ code: 'COMPETENT', label: 'Competent', requiredMilestoneCodes: ['SELLS'], stageOrder: 1 }],
  milestones: [{ code: 'SELLS', label: 'Sells independently' }],
  grids: [{ code: 'PERSONAL', label: 'Personal selling', requiresDownline: false, items: [{ code: 'APPROACH', label: 'Approach' }] }],
};
const PLAYBOOK = {
  profiles: {
    retiree: {
      label: 'Retiree', tagline: 'Re-entering the workforce after time away.', goodFitFor: 'Someone who needs flexibility.',
      benefits: ['Flexible schedule.'], openings: { flexibility: 'What time do you have in a normal week?' },
    },
  },
  objections: { time: { theySay: 'How long does it take?', youSay: 'Activity is tracked, not hours.' } },
  profileObjections: {},
  nextAction: 'Send them the Opportunity Overview.',
};
const PLAYBOOK_EDITOR = {
  defaults: PLAYBOOK,
  vocabulary: {
    types: [{ code: 'retiree', label: 'Retiree' }],
    motivations: [{ code: 'flexibility', label: 'Flexibility / time freedom' }],
    hesitations: [{ code: 'time', label: 'Worried about time commitment' }],
  },
  limits: { textMax: 600, benefitsMax: 6 },
};

/**
 * **P19.2-T2 AC-5 — the sections measured last** (UI-135): *Training*, *Events*, *Capability Mapping* (both its parts) and
 * *Rekrutmen* at 375 and 768, inside the shell's frame, as *Aktivitas* and *Leads* are above.
 */
describe('P19.2-T2 AC-5 the other sections, their targets (UI-135)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  function showSection(section: 'training' | 'events' | 'capability' | 'recruitment', hash = '') {
    window.history.replaceState(null, '', `/${hash}`);
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL] },
      '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
      '/admin/companies/c1/template/training_taxonomy': { body: kindView('training_taxonomy', TRAINING) },
      '/admin/companies/c1/template/event_types': { body: kindView('event_types', EVENT_TYPES) },
      '/admin/companies/c1/template/capability_ladder': { body: kindView('capability_ladder', CAPABILITY) },
      '/admin/companies/c1/template/recruitment_playbook': { body: kindView('recruitment_playbook', PLAYBOOK, { playbook: PLAYBOOK_EDITOR }) },
    });
    renderWithSession(
      <div data-surface="v1"><main><SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section })} /></main></div>,
      { me: SUPER_ADMIN },
    );
  }

  it.each([
    ['training', '', 'Sales'], ['events', '', 'Training'],
    ['capability', '#ladder', 'Sells independently'], ['capability', '#skills', 'Approach'],
    ['recruitment', '', 'Retiree'],
  ] as const)('P19.2-T2 AC-5 %s%s at 375 and 768 finds no target under 44px in the page', async (section, hash, shown) => {
    for (const px of [375, 768]) {
      atWidth(px);
      showSection(section, hash);
      expect((await screen.findAllByText(shown)).length).toBeGreaterThan(0);
      expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
      cleanup();
    }
  });
});
