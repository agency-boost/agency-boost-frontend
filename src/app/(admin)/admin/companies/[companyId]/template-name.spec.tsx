import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderWithSession, routeParams, stubFetch } from '@test/harness';
import {
  ALLIANZ, ALLIANZ_DEFAULT, ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, LIBRARY, LIBRARY_DEFAULT, PRUDENTIAL, SUPER_ADMIN,
} from '@test/kpm-template-fixtures';
import CompanyPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1',
}));

/** SA UI-017's sentence, as the API answers it to a reader in Indonesian (`template.messages.ts`). */
const TAKEN = 'Nama ini sudah dipakai template lain.';

/**
 * **P19.4-T3 AC-12 (SA UI-017): a template's name is unique within its company, archived ones included.** The server
 * refuses — `409 TEMPLATE_NAME_TAKEN`, `details.archived` when the holder is archived — and *Template baru* says it
 * under *Nama*, in the API's words, the dialog kept open. At a phone's width and a laptop's.
 */
describe('P19.4-T3 AC-12 a taken template name', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 1280])('P19.4-T3 AC-12 at %ipx says an archived template’s name is taken, under Name', async (px) => {
    atWidth(px);
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
      '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
      '/admin/companies/c2/templates': { body: [ALLIANZ_DEFAULT] },
      '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
      'POST /admin/companies/c1/templates': {
        status: 409,
        body: {
          error: {
            code: 'TEMPLATE_NAME_TAKEN', message: TAKEN, requestId: 'r',
            details: { name: ARCHIVED.name, archived: true },
          },
        },
      },
    });
    renderWithSession(<CompanyPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
    const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
    await userEvent.type(dialog.getByLabelText('Name'), ARCHIVED.name);
    await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));

    expect(await dialog.findByText(TAKEN)).toBeInTheDocument();
    expect(dialog.getByLabelText('Name')).toHaveAccessibleDescription(TAKEN);
    expect(screen.getByRole('dialog', { name: 'New template' })).toBeInTheDocument();
  });
});
