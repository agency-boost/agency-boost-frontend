import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { ALLIANZ, LIBRARY, PRUDENTIAL, SUPER_ADMIN, kindView, namedTemplate, sections } from '@test/kpm-template-fixtures';
import { analyticsV1, EDITOR_VIEW } from '@test/analytics-fixtures';
import TemplatePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-pru',
}));

const PRU = namedTemplate({
  id: 't-pru', name: 'Prudential template', isDefault: true, officeCount: 12,
  sections: sections({ publishedVersion: 1, hasDraft: false }, {
    lead_pipeline: { publishedVersion: 1, hasDraft: true },
    advanced_analytics: { publishedVersion: 1, hasDraft: true },
  }),
});

function render(width = 1280) {
  atWidth(width);
  const payload = analyticsV1();
  payload.sections[5].enabled = false;
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
    '/admin/companies/c1/templates': { body: [PRU] },
    '/admin/companies/c1/templates/t-pru/offices': { body: [] },
    '/admin/companies/c1/template/advanced_analytics': {
      body: kindView('advanced_analytics', payload as unknown as Record<string, unknown>, {
        status: 'draft', version: 2, publishedVersion: 1, analytics: EDITOR_VIEW,
      }),
    },
  });
  return renderInIndonesian(<TemplatePage params={routeParams({ companyId: 'c1', templateId: 't-pru' })} />, { me: SUPER_ADMIN });
}

/**
 * **P19.5-T1 — the template's checklist row, and *Terbitkan semua*** (AC-1, AC-16; spec §6 *Overview row*; AA UI-020).
 */
describe('P19.5-T1 the Advanced analytics row and Terbitkan semua', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([1280, 375])('P19.5-T1 AC-1 reads “N dari 6 bagian aktif · M kolom data upload” with Draf, at %ipx', async (width) => {
    render(width);
    const row = (await screen.findByText('Advanced analytics')).closest('a') as HTMLElement;
    expect(row).toHaveAttribute('href', '/admin/companies/c1/templates/t-pru/analytics');
    expect(await within(row).findByText('5 dari 6 bagian aktif · 7 kolom data upload')).toBeInTheDocument();
    expect(within(row).getByText('Draf')).toBeInTheDocument();
  });

  it('P19.5-T1 AC-16 (AA UI-020) sets Advanced analytics apart, for every KPM that exists, only when it is in the batch', async () => {
    render();
    await screen.findByText('5 dari 6 bagian aktif · 7 kolom data upload');
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan semua (2)' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Pipeline lead']);
    expect(within(dialog).getByText(
      'Advanced analytics berlaku untuk semua KPM yang sudah ada (12 KPM), termasuk kolom data upload dan survei berikutnya.',
    )).toBeInTheDocument();
  });
});
