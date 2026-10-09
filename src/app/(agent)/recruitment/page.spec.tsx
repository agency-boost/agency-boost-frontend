import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import { RINA_ME, SHELL_STUBS } from '@test/recruitment-plan-fixtures';
import RecruitmentLayout from './layout';
import RecruitmentIndex from './page';

const route = vi.hoisted(() => ({ path: '/recruitment', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: route.replace, push: route.push }),
  usePathname: () => route.path,
}));

/** `/recruitment` hands off to the first tab and nothing else (D-urls; P17-T3). */
describe('/recruitment', () => {
  afterEach(() => {
    route.replace.mockClear();
    route.push.mockClear();
    route.path = '/recruitment';
    vi.unstubAllGlobals();
  });

  it('hands off to /recruitment/attack-plan, replacing itself in the history', () => {
    // `replace`, not `push`: Back from the tab must not land on a page whose only act is to leave.
    renderWithSession(<RecruitmentIndex />, { me: RINA_ME });
    expect(route.replace).toHaveBeenCalledWith('/recruitment/attack-plan');
    expect(route.push).not.toHaveBeenCalled();
  });

  it('renders no content of its own while it goes, and reads nothing', () => {
    const { calls } = stubFetch({ ...SHELL_STUBS });
    renderWithSession(<RecruitmentIndex />, { me: RINA_ME });
    expect(screen.getByRole('status')).toHaveTextContent('Taking you to Attack Plan');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/recruitment'))).toEqual([]);
  });
});

/** The title, the sub-line and the tabs, shared by both tabs (P17-T3 AC-2), and the `recruitment:read` gate. */
describe('the Recruitment layout', () => {
  afterEach(() => {
    route.path = '/recruitment';
    vi.unstubAllGlobals();
  });

  it('P17-T3 AC-2 on Pitch Materials, that tab is the current one, under the same title', () => {
    route.path = '/recruitment/pitch-materials';
    stubFetch({ ...SHELL_STUBS });
    renderInLayout(AgentLayout, <RecruitmentLayout><p>tab</p></RecruitmentLayout>, { me: RINA_ME });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Recruitment$/);
    const tabs = within(screen.getByRole('navigation', { name: 'Recruitment' })).getAllByRole('link');
    expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-current')])).toEqual([
      ['Attack Plan', null], ['Pitch Materials', 'page'],
    ]);
    expect(screen.getByText('tab')).toBeInTheDocument();
    // The sidebar's item stays current on every tab.
    expect(screen.getByRole('link', { name: 'Recruitment' })).toHaveAttribute('aria-current', 'page');
  });

  it('P17-T3 AC-9 refuses a member without recruitment:read, the tab beneath it not drawn', () => {
    route.path = '/recruitment/pitch-materials';
    stubFetch({ ...SHELL_STUBS });
    renderInLayout(AgentLayout, <RecruitmentLayout><p>tab</p></RecruitmentLayout>, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('heading', { name: 'Not available to you' })).toBeInTheDocument();
    expect(screen.queryByText('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Recruitment' })).not.toBeInTheDocument();
    // The refusal names no permission code (P11-T6); the code is kept where a test can read it.
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'recruitment:read');
    expect(screen.getByRole('alert').textContent).not.toMatch(/recruitment:read/);
  });
});
