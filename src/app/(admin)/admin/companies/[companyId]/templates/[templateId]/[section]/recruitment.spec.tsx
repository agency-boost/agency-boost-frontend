import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderInIndonesian, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, PRUDENTIAL, SUPER_ADMIN, kindView } from '@test/kpm-template-fixtures';
import SectionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/recruitment',
}));

const VOCABULARY = {
  types: [{ code: 'retiree', label: 'Retiree' }],
  motivations: [{ code: 'flexibility', label: 'Flexibility / time freedom' }],
  hesitations: [{ code: 'time', label: 'Worried about time commitment' }],
};
const BODY = {
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
const EDITOR = { defaults: BODY, vocabulary: VOCABULARY, limits: { textMax: 600, benefitsMax: 6 } };
const PATH = '/admin/companies/c1/template/recruitment_playbook';

function render(view: Record<string, unknown>, extra: Record<string, StubReply | StubReply[]> = {}, indonesian = false) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    [`GET ${PATH}`]: { body: view },
    ...extra,
  });
  const page = <SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section: 'recruitment' })} />;
  const rendered = indonesian ? renderInIndonesian(page, { me: SUPER_ADMIN }) : renderWithSession(page, { me: SUPER_ADMIN });
  return { ...rendered, stub };
}

/**
 * **A template's *Rekrutmen* section** (P19.4-T5 AC-6; ADR-0210 §1, §4; the 11-03 handover's B1-11): the recruitment
 * playbook through the template's kind routes — its draft saved as it is made, *Terbitkan* publishing it, and no *apply to
 * existing KPMs* after, because every KPM made from the template reads it live.
 */
describe('P19.4-T5 AC-6 the Rekrutmen section', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T5 AC-6 is a section of the template: its name, its published version, and the line that KPMs read it live', async () => {
    render(kindView('recruitment_playbook', BODY, { playbook: EDITOR }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Recruitment' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Retiree' })).toBeInTheDocument();
    expect(screen.getByText('Published v1')).toBeInTheDocument();
    expect(screen.getByText('What is published here reaches every KPM made from this template at once: they read it live.'))
      .toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 Kosong: a start becomes the draft, saved through the kind route', async () => {
    const { stub } = render(kindView('recruitment_playbook', {}, { version: 0, status: 'draft', id: '', publishedVersion: null, revision: 0, playbook: EDITOR }), {
      [`PUT ${PATH}`]: { body: kindView('recruitment_playbook', BODY, { status: 'draft', version: 1, revision: 1, playbook: EDITOR }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Start from the AgencyBoost words' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), { timeout: 3000 });
    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toContain(`${PATH}?templateId=t-default`);
    expect(JSON.parse(String(put.init.body))).toEqual({ payload: BODY, expectedRevision: 0 });
  });

  it('P19.4-T5 AC-6 Terbitkan publishes it and asks nothing about existing KPMs — they read it live', async () => {
    const { stub } = render(kindView('recruitment_playbook', BODY, { status: 'draft', version: 2, revision: 3, publishedVersion: 1, playbook: EDITOR }), {
      [`POST ${PATH}/publish`]: { body: kindView('recruitment_playbook', BODY, { version: 2, publishedVersion: 2, playbook: EDITOR }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published v2')).toBeInTheDocument();
    expect(stub.calls.some((c) => c.url.includes('/offices'))).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 a refused Terbitkan puts each violation beside its field', async () => {
    render(kindView('recruitment_playbook', BODY, { status: 'draft', version: 2, revision: 3, publishedVersion: 1, playbook: EDITOR }), {
      [`POST ${PATH}/publish`]: {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED', message: 'This playbook cannot be published: body.nextAction — Must not be empty.',
            requestId: 'r-1', details: { violations: [{ field: 'body.nextAction', message: 'Must not be empty.' }] },
          },
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const next = within(await screen.findByRole('group', { name: 'Next action' }));
    expect(await next.findByText('Must not be empty.')).toBeInTheDocument();
    expect(next.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([375, 1280])('P19.4-T5 AC-6 in Indonesian at %ipx: Rekrutmen, the live line, the cards', async (px) => {
    atWidth(px);
    render(kindView('recruitment_playbook', BODY, { playbook: EDITOR }), {}, true);
    expect(await screen.findByRole('heading', { level: 1, name: 'Rekrutmen' })).toBeInTheDocument();
    expect(await screen.findByText('Yang terbit di sini langsung dibaca setiap KPM yang dibuat dari template ini.'))
      .toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Retiree' })).toBeInTheDocument();
  });
});
