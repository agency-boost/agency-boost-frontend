import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { surveyMessages } from '@/i18n/messages/surveys';
import type { Me } from '@/lib/session';
import { resetPending } from '@/lib/surveys';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import CoacheeSurveyTab from './(agent)/coaching/[membershipId]/survey/page';
import SurveyFormPage from './(agent)/surveys/[runId]/page';
import SurveysPage from './(agent)/surveys/page';
import AdvancedAnalyticsNpsPage from './kpm/advanced-analytics/nps/page';
import AdvancedAnalyticsQualPage from './kpm/advanced-analytics/qual/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/surveys',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/coaching-person', () => ({
  useCoachee: () => ({ membershipId: 'mem-indah', name: 'Indah Permatasari' }),
  useCoacheeNotFound: () => vi.fn(),
}));

const OWNER: Me = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
});
const ENGLISH = englishOnly(surveyMessages);
const RUN = {
  runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', daysLeft: 6,
  answeredCount: 1, totalCount: 6, minutes: 3, anonymous: true, notice: 'anonymous',
};
const RESULTS = {
  kind: 'nps', today: '2026-11-05', visible: true, sectionOn: true, canWrite: true, audience: 'office',
  template: { cadence: 'quarter', qualMonths: [6, 12], defaults: { anonymous: true, perPerson: false, remindHalfway: true } },
  runs: [{ ...RUN, state: 'open', invitedRoleClasses: ['agent'], perPerson: false, remindHalfway: true, responses: { sent: 0, invited: 4, pct: 0 } }],
  selected: null,
};

/**
 * **The surveys in Indonesian** (P19.5-T4; ADR-0179 §7): the *Survei* page, the form, the coaching *Survei* tab and the
 * KPM's NPS and *Kualitatif* tabs, read in ID mode — the reminder mockup's and the coaching mockup's words, and no
 * English message of the area's own left on the screen. English is every other spec's.
 */
describe('P19.5-T4 the surveys in Indonesian', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetPending(); });

  it('/surveys', async () => {
    stubFetch({ '/surveys': { body: { today: '2026-11-05', open: [RUN], history: [] } } });
    renderInIndonesian(<SurveysPage />, { me: OWNER });
    expect(await screen.findByText('Survei NPS KPM Q4 2026')).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('/surveys/[runId]', async () => {
    stubFetch({
      '/surveys/run-nps': {
        body: {
          run: { runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', notice: 'anonymous', anonymous: true, kpmCode: '0417' },
          state: 'open',
          questions: [{ kode: 'P1', type: 'score', text: { id: 'Seberapa jelas visi KPM ini?', en: 'How clear?' }, items: [], askWhy: true, required: true, blockKode: null, blockTitle: null, scale: { min: 0, max: 10 } }],
          answers: {}, answeredCount: 0, totalCount: 1, resumeIndex: 0, downlineLeaders: [],
        },
      },
    });
    renderInIndonesian(<SurveyFormPage params={routeParams({ runId: 'run-nps' })} />, { me: OWNER });
    expect(await screen.findByText('Pertanyaan 1 dari 1 · ditutup 9 Nov')).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('/coaching/[membershipId]/survey', async () => {
    stubFetch({
      '/coaching/mem-indah/survey': {
        body: {
          state: 'not_answered', run: { runId: 'r', periodKey: '2026-06', opensOn: '2026-06-01', closesOn: '2026-06-30', submittedOn: null },
          person: null, issueMaxRating: null, issueCounts: [], aspiration: null, sections: [],
        },
      },
    });
    renderInIndonesian(<CoacheeSurveyTab />, { me: OWNER });
    expect(await screen.findByText('Indah belum mengisi survei Jun 2026')).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it.each([
    ['/kpm/advanced-analytics/nps', AdvancedAnalyticsNpsPage, 'nps'],
    ['/kpm/advanced-analytics/qual', AdvancedAnalyticsQualPage, 'qual'],
  ] as const)('%s', async (_route, Page, kind) => {
    stubFetch({ [`/kpm/advanced-analytics/${kind}`]: { body: { ...RESULTS, kind } } });
    renderInIndonesian(<Page />, { me: OWNER });
    expect(await screen.findByText('Periode survei')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mulai survei' })).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });
});
