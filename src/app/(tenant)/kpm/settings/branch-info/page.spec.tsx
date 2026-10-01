import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import BranchInfoPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/branch-info',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({
  membership,
  permissions: ['kpm:read_profile', 'tenant_config:write'],
});
// The same permissions as the Owner: every page under Settings is both of theirs (ADR-0027).
const ADMIN = makeMe({
  membership: { ...membership, isKpmOwner: false, isKpmAdmin: true },
  permissions: ['kpm:read_profile', 'tenant_config:write'],
});
// A read-only support session holds the read and none of the writes.
const READ_ONLY = makeMe({
  membership,
  permissions: ['kpm:read_profile'],
});

const OFFICE = {
  _id: 'kpm-1', companyId: 'c1', companyName: 'Prudential', code: '0417',
  branchName: 'BSD City Branch', address: 'Jl. BSD Grand Boulevard No. 1, Tangerang',
  contactPhone: '+62 21 5555 0417', ownerName: 'Wilson Tanoto',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', fiscalYearStartMonth: 1,
};

function render(me = OWNER) {
  const stub = stubFetch({ '/kpm/settings/branch-info': { body: OFFICE } });
  renderWithSession(<BranchInfoPage />, { me });
  return stub;
}

describe('branch info (P4-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the office the prototype shows', async () => {
    render();
    expect(await screen.findByDisplayValue('BSD City Branch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+62 21 5555 0417')).toBeInTheDocument();
  });

  it('keeps Company read-only, and says who can change it', async () => {
    /*
     * The prototype disables this field and labels it "tagged by Superadmin" — which is
     * where the platform-owned boundary was first written down. The label is the answer
     * to "why can't I change this", so it has to be on screen rather than implied.
     */
    render();
    await screen.findByDisplayValue('BSD City Branch');
    expect(screen.getByText('Company (tagged by Superadmin)')).toBeInTheDocument();
    expect(screen.getByText('Prudential')).toBeInTheDocument();
    expect(screen.getByText(/Only the platform can change it/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Prudential')).toBeNull();
  });

  it('keeps the financial year field, and says nothing about when it will be used', async () => {
    // Its hint read "Used by the reporting periods that arrive in a later phase." — our schedule,
    // not something a reader can act on (ADR-0062 §3, P10.1-T2). The field itself stays: it saves.
    render();
    await screen.findByDisplayValue('BSD City Branch');
    expect(screen.getByLabelText('Financial year starts')).toHaveValue('1');
    expect(document.body).not.toHaveTextContent(/later phase|reporting periods/i);
  });

  it('offers no time zone, language or currency control', async () => {
    // ADR-0016 fixes all three for v1. They are shown, and not offered.
    render();
    await screen.findByDisplayValue('BSD City Branch');
    expect(screen.getByText('Asia/Jakarta · id-ID · IDR')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Time zone$/)).toBeNull();
    expect(screen.queryByLabelText('Currency')).toBeNull();
  });

  it('sends what changed, and nothing the platform owns', async () => {
    const { calls } = render();
    const name = await screen.findByLabelText('Branch name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Serpong Branch');
    await userEvent.selectOptions(screen.getByLabelText('Financial year starts'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const call = calls.find((c) => c.init.method === 'PATCH')!;
    const body = JSON.parse(call.init.body as string);
    expect(body).toMatchObject({ branchName: 'Serpong Branch', fiscalYearStartMonth: 4 });
    expect(body).not.toHaveProperty('companyId');
    expect(body).not.toHaveProperty('timezone');
  });

  it('lets an Admin change it, exactly as the Owner can (ADR-0027)', async () => {
    // It rendered read-only for an Admin until 2026-09-17.
    const { calls } = render(ADMIN);
    const name = await screen.findByLabelText('Branch name');
    expect(name).toBeEnabled();
    await userEvent.clear(name);
    await userEvent.type(name, 'Serpong Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const call = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(call.init.body as string)).toMatchObject({ branchName: 'Serpong Branch' });
  });

  it('shows somebody without the write the office and no way to change it', async () => {
    // A read-only support session. The API refuses them too — this is convenience, not
    // control.
    render(READ_ONLY);
    expect(await screen.findByDisplayValue('BSD City Branch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
