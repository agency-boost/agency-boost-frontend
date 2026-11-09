import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ActivityBindingCard } from './activity-binding-card';

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // P19.4-T3 F2 (ADR-0206 §1): the read stays the Super Admin's; the write is the KPM's Owner's and Admin's.
  permissions: ['kpm:read_profile', 'activity_binding:read'],
});

const BINDING = {
  kpmId: 'kpm-0417', leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'],
  version: 3, updatedAt: null,
  types: [
    { code: 'LEADS_CONTACTED', label: 'Leads dihubungi', categoryCode: 'SELLING', displayOrder: 1, status: 'active' },
    { code: 'SELL_PRESENTATION', label: 'Presentasi', categoryCode: 'SELLING', displayOrder: 2, status: 'active' },
    { code: 'SELL_SUBMISSION', label: 'Submission', categoryCode: 'SELLING', displayOrder: 3, status: 'active' },
  ],
};

/**
 * **The Super Admin's *Activity binding* card, read-only** (P19.4-T3 F2; ADR-0206 §1): the KPM's binding as it stands,
 * no control that writes, and a line saying the KPM's Owner or Admin sets it — at a phone's width and a laptop's.
 */
describe('P19.4-T3 F2 the Super Admin’s activity binding card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 1280])('P19.4-T3 F2 at %ipx: the binding as it stands, nothing to change, and who sets it', async (px) => {
    atWidth(px);
    const { calls } = stubFetch({ '/admin/tenants/kpm-0417/activity-binding': { body: BINDING } });
    renderWithSession(<ActivityBindingCard kpmId="kpm-0417" />, { me: SUPER_ADMIN });
    const card = (await screen.findByRole('heading', { name: 'Activity binding' })).closest('section, div')!;
    expect(await screen.findByText('Presentasi')).toBeInTheDocument();
    expect(screen.getByText('The KPM’s Owner or an Admin sets this on their Activity types page.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save binding' })).not.toBeInTheDocument();
    for (const select of within(card as HTMLElement).getAllByRole('combobox')) expect(select).toBeDisabled();
    for (const remove of screen.getAllByRole('button', { name: /^Remove / })) expect(remove).toBeDisabled();
    expect(calls.every((c) => (c.init.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('P19.4-T3 F2 in Indonesian, the line names the Owner or an Admin', async () => {
    stubFetch({ '/admin/tenants/kpm-0417/activity-binding': { body: BINDING } });
    renderInIndonesian(<ActivityBindingCard kpmId="kpm-0417" />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Pemilik atau Admin KPM mengaturnya di halaman Activity types mereka.')).toBeInTheDocument();
  });
});
