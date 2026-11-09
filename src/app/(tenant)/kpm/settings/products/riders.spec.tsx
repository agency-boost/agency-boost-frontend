import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import KpmProductsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/products',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
    status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write', 'sales_script:approve'],
});

const field = <T,>(value: T, overridden = false) => ({ value, overridden });
const row = (over: Record<string, unknown> = {}) => ({
  productId: 'p1', code: 'SOFI', companyName: 'SOFI Critical Infinity', channel: 'conventional', category: 'ci',
  kind: 'base', attachesTo: [], lifecycle: 'active', sellable: true, active: field(true),
  displayName: field('SOFI Critical Infinity'), description: field('Proteksi penyakit kritis.'),
  script: {
    goodFit: field('Keluarga muda'), opening: field('Halo.'), benefits: field(['Santunan']), fullScript: field('Halo.'),
    objections: field([{ objection: 'Mahal.', answer: 'Bisa disesuaikan.' }]), nextAction: field('Siapkan ilustrasi.'),
  },
  reviewState: 'none', rejectionReason: null,
  documents: [{ slot: 'brochure', label: 'Brochure', storageKey: null, filename: null, source: 'none' }],
  ...over,
});
const SOFI = row();
const LADY = row({ productId: 'p2', code: 'LADY', companyName: 'Lady', displayName: field('Lady'), active: field(false, true) });
const RIDER = row({
  productId: 'p3', code: 'CI_COVERAGE_PLUS', companyName: 'CI Coverage+ Insurance', kind: 'rider', attachesTo: ['p1', 'p2'],
  displayName: field('CI Coverage+ Insurance'), active: field(true),
});

function render(rows: unknown[] = [SOFI, LADY, RIDER], extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/kpm/settings/products': { body: rows },
    '/kpm/settings/products/script-reviews': { body: [] },
    '/kpm/settings/branch-info': { body: { _id: 'k1', companyId: 'c1', companyName: 'Sequis', code: '0417' } },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    ...extra,
  });
  renderWithSession(<KpmProductsPage />, { me: OWNER });
  return stub;
}

/**
 * **P19.4-T4 AC-8 — an office's riders follow their bases** (the riders spec's rule 6; ADR-0209 §6): on
 * `/kpm/settings/products` a rider sits under each of its bases with no switch of its own, on exactly when one of them
 * is — the server's answer; and an office's own objection cards (AC-1).
 */
describe('P19.4-T4 an office’s products: riders under their bases, and the objection cards', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T4 AC-8 lists the rider under each base it attaches to, never as a product with a switch of its own', async () => {
    render();
    await screen.findByRole('heading', { name: 'SOFI Critical Infinity' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['SOFI Critical Infinity', 'Lady']);
    const sofi = screen.getByRole('heading', { name: 'SOFI Critical Infinity' }).closest('li')!;
    const under = within(sofi).getByText('CI Coverage+ Insurance').closest('[data-rider]')!;
    expect(under).toHaveTextContent('Rider');
    expect(under).toHaveTextContent('Sold with its base products — it has no switch of its own.');
    expect(within(under as HTMLElement).queryByRole('switch')).not.toBeInTheDocument();
    // Under Lady too, which the office does not sell: the rider is on through SOFI.
    const lady = screen.getByRole('heading', { name: 'Lady' }).closest('li')!;
    expect(within(lady).getByText('CI Coverage+ Insurance')).toBeInTheDocument();
    // One switch per base, none for the rider.
    expect(screen.getAllByRole('switch', { name: 'Agents sell it' })).toHaveLength(2);
  });

  it('P19.4-T4 AC-8 says a rider is not sold when none of its bases is', async () => {
    render([SOFI, { ...RIDER, attachesTo: ['p1'], active: field(false) }]);
    const sofi = (await screen.findByRole('heading', { name: 'SOFI Critical Infinity' })).closest('li')!;
    expect(within(sofi).getByText('Not sold: none of its base products is. It has no switch of its own.')).toBeInTheDocument();
  });

  it('P19.4-T4 AC-8 on a phone: the rider is no row of its own, and sits in its base’s sheet', async () => {
    atWidth(375);
    render();
    await screen.findByRole('button', { name: 'SOFI Critical Infinity' });
    expect(screen.queryByRole('button', { name: 'CI Coverage+ Insurance' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-list-row]')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'SOFI Critical Infinity' }));
    const sheet = await screen.findByRole('dialog', { name: 'SOFI Critical Infinity' });
    expect(within(sheet).getByText('CI Coverage+ Insurance')).toBeInTheDocument();
  });

  it('P19.4-T4 AC-1 an office edits the whole list of cards and saves it as its own', async () => {
    const stub = render([SOFI], {
      'PATCH /kpm/settings/products/p1/overrides': { body: SOFI },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    const cards = screen.getByRole('group', { name: '4 · If they push back' });
    expect(within(cards).getByLabelText('Objection 1 — they say')).toHaveValue('Mahal.');
    await userEvent.click(within(cards).getByRole('button', { name: '+ Add objection' }));
    await userEvent.type(within(cards).getByLabelText('Objection 2 — they say'), 'Nanti saja.');
    await userEvent.type(within(cards).getByLabelText('Objection 2 — you say'), 'Makin awal makin ringan.');
    await userEvent.click(within(cards.parentElement as HTMLElement).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent).toEqual({
      objections: [
        { objection: 'Mahal.', answer: 'Bisa disesuaikan.' },
        { objection: 'Nanti saja.', answer: 'Makin awal makin ringan.' },
      ],
    });
  });
});
