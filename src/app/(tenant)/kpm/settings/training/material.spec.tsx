import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ModuleContentEditor } from '@/components/module-content';
import TrainingSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/training',
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'training_settings:read'],
});
const ADMIN = makeMe({ ...OWNER, membership: { ...OWNER.membership!, isKpmOwner: false, isKpmAdmin: true } });

const moduleRow = (code: string, material: 'own' | 'company' | 'none', over: Record<string, unknown> = {}) => ({
  id: `m-${code}`, code, skillCode: 'PROSPECTING', title: code, publishState: 'published', displayOrder: 1, version: 1,
  status: 'active', material, ...over,
});

/** Four active modules: the template's material on two, the office's own on one, none on one; one archived with some. */
const TREE = [{
  id: 'c-sales', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
  skills: [{
    id: 's-p', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting', displayOrder: 1, version: 1, status: 'active',
    modules: [
      moduleRow('A', 'company'), moduleRow('B', 'company'), moduleRow('C', 'own'), moduleRow('D', 'none'),
      moduleRow('E', 'company', { status: 'archived' }),
    ],
  }],
}];

function render(me = OWNER) {
  stubFetch({
    '/kpm/settings/training': { body: TREE },
    '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
  });
  renderWithSession(<TrainingSettingsPage />, { me });
}

/** **x / y modul punya materi**, and ***Urungkan perubahan saya*** (P19.4-T1 AC-4, AC-5; UI-162; ADR-0208 §1, §3). */
describe('P19.4-T1 the office’s Training settings: its material', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([['the Owner', OWNER], ['the Admin', ADMIN]] as const)(
    'P19.4-T1 AC-5 %s sees how many active modules have material, the template’s or the office’s own',
    async (_who, me) => {
      render(me);
      expect(await screen.findByText('3 / 4 modules have material')).toBeInTheDocument();
      await clean();
    },
  );

  it('P19.4-T1 AC-5 the count stays on Modules, after its filters', async () => {
    render();
    await screen.findByText('3 / 4 modules have material');
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Training sections' })).getByRole('link', { name: 'Modules' }));
    expect(screen.getByText('3 / 4 modules have material')).toBeInTheDocument();
  });

  it('P19.4-T1 AC-5 in Indonesian', async () => {
    stubFetch({
      '/kpm/settings/training': { body: TREE },
      '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
    });
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    expect(await screen.findByText('3 / 4 modul punya materi')).toBeInTheDocument();
  });

  it('P19.4-T1 AC-4 a module with its own material offers Urungkan perubahan saya, which returns the template’s', async () => {
    const url = '/kpm/settings/training/modules/C/content';
    const own = {
      moduleCode: 'C', title: 'C', overridden: true,
      content: { files: [], videos: [], links: [{ id: 'o', label: 'Milik KPM', url: 'https://kpm.example/' }] },
      companyContent: { files: [], videos: [], links: [{ id: 't', label: 'Dari template', url: 'https://example.com/' }] },
    };
    const stub = stubFetch({
      [`DELETE ${url}`]: { body: { ...own, overridden: false, content: own.companyContent } },
      [url]: { body: own },
    });
    renderWithSession(<ModuleContentEditor moduleCode="C" canWrite />, { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Undo my changes' }));
    expect(stub.calls.some((c) => c.init.method === 'DELETE')).toBe(true);
    expect(await screen.findByText('This is your company’s material.')).toBeInTheDocument();
  });

  it('P19.4-T1 AC-4 in Indonesian the two controls have two names: the revert, and discarding unsaved edits', async () => {
    stubFetch({
      '/kpm/settings/training/modules/C/content': {
        body: {
          moduleCode: 'C', title: 'C', overridden: true,
          content: { files: [], videos: [], links: [] }, companyContent: { files: [], videos: [], links: [] },
        },
      },
    });
    renderInIndonesian(<ModuleContentEditor moduleCode="C" canWrite />, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Urungkan perubahan saya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buang suntingan saya' })).toBeInTheDocument();
  });
});
