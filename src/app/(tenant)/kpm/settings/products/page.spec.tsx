import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import KpmProductsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/products',
}));

const member = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({
  membership: member,
  permissions: ['tenant_config:read', 'tenant_config:write', 'sales_script:approve'],
});
/** Someone who may edit a script and not approve one — the grant ADR-0037 kept separate. */
const WRITER = makeMe({
  membership: member, permissions: ['tenant_config:read', 'tenant_config:write'],
});
const READER = makeMe({ membership: member, permissions: ['tenant_config:read'] });

const BRANCH = { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' };

const field = <T,>(value: T, overridden = false) => ({ value, overridden });

const script = (over: Record<string, unknown> = {}) => ({
  goodFit: field('Young families'),
  opening: field('Halo, boleh saya tanya sebentar?'),
  benefits: field(['Proteksi jiwa']),
  fullScript: field('Halo. Ini scriptnya.'),
  objectionTheySay: field('Terlalu mahal.'),
  objectionYouSay: field('Preminya bisa disesuaikan.'),
  nextAction: field('Boleh saya siapkan ilustrasinya?'),
  ...over,
});

const product = (over: Record<string, unknown> = {}) => ({
  productId: 'p1',
  code: 'PRUMAPAN',
  companyName: 'PRUMapan',
  channel: 'conventional',
  category: 'life',
  lifecycle: 'active',
  sellable: true,
  active: field(true),
  displayName: field('PRUMapan'),
  script: script(),
  reviewState: 'none',
  rejectionReason: null,
  documents: [
    { slot: 'brochure', label: 'Brochure', storageKey: null, filename: null, source: 'none' },
    { slot: 'illustration', label: 'Illustration / Simulation', storageKey: null, filename: null, source: 'none' },
    { slot: 'productDoc', label: 'Product Document', storageKey: null, filename: null, source: 'none' },
  ],
  ...over,
});

/**
 * The queue is stubbed on its **own** route, not left to the shelf's prefix.
 *
 * `stubFetch` matches on `url.includes(key)`, so `/kpm/settings/products` would answer the queue
 * too — and the screen would look right while calling nothing. The gate
 * (`check-api-consumers.py`) caught exactly that, so the spec now names the route it expects.
 */
function render(rows: unknown[] = [product()], me = OWNER, extra: Record<string, unknown> = {}) {
  const waiting = (rows as { reviewState?: string }[])
    .filter((p) => p.reviewState === 'pending' || p.reviewState === 'rejected');
  const stub = stubFetch({
    '/kpm/settings/products': { body: rows },
    '/kpm/settings/products/script-reviews': { body: waiting },
    '/kpm/settings/products/p1/script/effective': {
      body: { source: 'company', script: script() },
    },
    '/kpm/settings/branch-info': { body: BRANCH },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    ...extra,
  });
  renderWithSession(<KpmProductsPage />, { me });
  return stub;
}

const open = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Customise' }));
};

/**
 * What an office sells (P5-T5, ADR-0033).
 *
 * The two things this screen must get right, and the prototype does not: it names **this office's
 * own insurer** rather than the hardcoded *Prudential*, and every *"use my company's again"* is an
 * unset rather than a copy — so the office follows the company again instead of freezing today's
 * wording.
 */
describe('the office’s Products screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the office’s own company, never a hardcoded Prudential', async () => {
    // The prototype writes "Prudential" into this screen eleven times; a second insurer's office
    // would read another company's name on every row of its own settings.
    render();

    expect(await screen.findByText(/Allianz Life/)).toBeInTheDocument();
    expect(screen.queryByText(/Prudential/)).not.toBeInTheDocument();
  });

  it('counts what agents can actually sell, not the length of the list', async () => {
    // The prototype's header reads "6 active" over seven toggles.
    render([
      product(),
      product({ productId: 'p2', code: 'PRUSMART', companyName: 'PRUSmart', active: field(false) }),
      product({ productId: 'p3', code: 'PGB', companyName: 'PGB', sellable: false, lifecycle: 'withdrawn' }),
    ]);

    expect(await screen.findByText(/3 products/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/1 withdrawn by Allianz Life/)).toBeInTheDocument();
  });

  it('says a withdrawn product is the company’s doing, and offers no way to sell it', async () => {
    render([product({ sellable: false, lifecycle: 'withdrawn' })]);

    expect(await screen.findByText('Withdrawn by Allianz Life')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sell this|Stop selling/ })).not.toBeInTheDocument();
  });

  it('starts and stops selling, and sends null nowhere near it', async () => {
    const stub = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Stop selling' }));

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/active'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/active'))!.init.body)))
      .toEqual({ active: false });
  });

  it('says which fields are the office’s and which follow the company', async () => {
    render([product({
      displayName: field('Mapan Kami', true),
      script: script({ opening: field('Halo dari kami!', true) }),
    })]);
    await open();

    expect(screen.getByText('Allianz Life calls it PRUMapan')).toBeInTheDocument();
    const opening = screen.getByLabelText('1 · Opening line');
    expect(opening).toHaveValue('Halo dari kami!');
    // Every field that is not overridden says so, so nobody wonders what they are editing.
    expect(screen.getAllByText('Following Allianz Life.').length).toBeGreaterThan(0);
  });

  it('sends one field at a time, and the benefits as a list', async () => {
    const stub = render();
    await open();

    await userEvent.clear(screen.getByLabelText('2 · Lead with these benefits'));
    await userEvent.type(screen.getByLabelText('2 · Lead with these benefits'), 'Satu{enter}Dua');
    const row = screen.getByLabelText('2 · Lead with these benefits').closest('div')!.parentElement!;
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
      .toEqual({ benefits: ['Satu', 'Dua'] });
  });

  it('offers the way back only on a field the office has changed', async () => {
    const stub = render([product({ displayName: field('Mapan Kami', true) })], OWNER, {
      '/kpm/settings/products/p1/overrides/displayName': { body: product() },
    });
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Use Allianz Life’s name' }));

    // A DELETE, because giving a field back is an unset: the office follows the company again
    // rather than freezing today's wording into itself.
    await waitFor(() => expect(
      stub.calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/overrides/displayName')),
    ).toBe(true));
  });

  it('says where each document came from, in the prototype’s own three slots', async () => {
    render([product({
      documents: [
        { slot: 'brochure', label: 'Brochure', storageKey: 'k1', filename: 'ours.pdf', source: 'kpm' },
        { slot: 'illustration', label: 'Illustration / Simulation', storageKey: 'k2', filename: 'theirs.pdf', source: 'company' },
        { slot: 'productDoc', label: 'Product Document', storageKey: null, filename: null, source: 'none' },
      ],
    })]);
    await open();

    expect(screen.getByText(/Uploaded by your office — ours\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('From Allianz Life’s catalog')).toBeInTheDocument();
    expect(screen.getByText('Nobody has attached one yet.')).toBeInTheDocument();
  });

  it('shows the office its own script review state, and why something was sent back', async () => {
    render([product({ reviewState: 'rejected', rejectionReason: 'Claim about returns is too strong.' })]);

    expect(await screen.findByText('Sent back')).toBeInTheDocument();
    await open();
    expect(screen.getByText(/Claim about returns is too strong/)).toBeInTheDocument();
  });

  describe('the script approval gate (P5-T10)', () => {
    const openApprovals = async () => {
      await screen.findByText('PRUMapan');
      await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    };

    it('says plainly that this is the office’s own check, not somebody else’s review', async () => {
      // ADR-0037 calls it a gate rather than an independent review, and the manual has to say so
      // or a tick reads as a compliance sign-off nobody actually gave.
      render();
      await openApprovals();

      expect(await screen.findByText(/your office’s own check, not a review by anybody else/))
        .toBeInTheDocument();
      // Not "they read the company's words": an office with an earlier approval is serving that,
      // and saying otherwise would misdescribe what a send-back costs.
      expect(screen.getByText(/the last version your office approved, or Allianz Life’s own words/))
        .toBeInTheDocument();
    });

    it('queues what is waiting, and shows the words being approved', async () => {
      render([product({
        reviewState: 'pending',
        script: script({ opening: field('Halo dari kami!', true) }),
      })]);
      await openApprovals();

      expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
      // The overridden line is shown; the ones still following the company are not.
      expect(screen.getByText(/Halo dari kami!/)).toBeInTheDocument();
      expect(screen.queryByText(/Terlalu mahal/)).not.toBeInTheDocument();
    });

    it('approves one', async () => {
      const stub = render([product({ reviewState: 'pending' })], OWNER, {
        '/kpm/settings/products/p1/script/approve': { body: product({ reviewState: 'approved' }) },
      });
      await openApprovals();

      await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));

      await waitFor(() => expect(
        stub.calls.some((c) => c.url.includes('/script/approve')),
      ).toBe(true));
    });

    it('will not send one back without a reason', async () => {
      render([product({ reviewState: 'pending' })]);
      await openApprovals();

      await userEvent.click(await screen.findByRole('button', { name: 'Send back' }));
      expect(screen.getByRole('button', { name: 'Send it back' })).toBeDisabled();

      await userEvent.type(
        screen.getByLabelText('Why are you sending it back?'),
        'The return claim is stronger than the illustration supports.',
      );
      expect(screen.getByRole('button', { name: 'Send it back' })).toBeEnabled();
    });

    it('shows why something was sent back, so it can be acted on', async () => {
      render([product({
        reviewState: 'rejected', rejectionReason: 'Too strong a claim about returns.',
      })]);
      await openApprovals();

      expect(await screen.findByText(/Too strong a claim about returns/)).toBeInTheDocument();
    });

    it('offers no decision to somebody who may write a script but not approve one', async () => {
      // The one deliberate exception to ADR-0027, so the two grants really can come apart.
      render([product({ reviewState: 'pending' })], WRITER);
      await openApprovals();

      expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Send back' })).not.toBeInTheDocument();
    });

    it('asks the server what is waiting, and what agents read while it waits', async () => {
      // Filtering the shelf would look identical and call nothing — which is what the API-consumer
      // gate refused. The queue is its own route, and the served script is the same read Phase 12
      // gives an agent, so the line about what they are reading is theirs and not a reconstruction.
      const stub = render([product({ reviewState: 'pending' })]);
      await openApprovals();

      await waitFor(() => expect(
        stub.calls.some((c) => c.url.includes('/products/script-reviews')),
      ).toBe(true));
      await waitFor(() => expect(
        stub.calls.some((c) => c.url.includes('/p1/script/effective')),
      ).toBe(true));
      expect(await screen.findByText(/reading Allianz Life’s words until this is approved/))
        .toBeInTheDocument();
    });

    it('says nothing is waiting when nothing is', async () => {
      render();
      await openApprovals();

      expect(await screen.findByText(/Nothing is waiting on you/)).toBeInTheDocument();
    });
  });

  it('shows a reader who cannot write the shelf without a control to change it', async () => {
    render([product()], READER);
    await open();

    expect(screen.queryByRole('button', { name: 'Stop selling' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save the name' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('1 · Opening line')).toBeDisabled();
  });
});
