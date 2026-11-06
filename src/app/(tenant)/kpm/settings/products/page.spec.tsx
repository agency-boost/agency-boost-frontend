import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, digestAt, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import { GCS_UPLOAD_URL, gcsSignedUpload } from '@test/storage-fixtures';
import { smallTargets } from '@test/touch-audit';
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
  permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write', 'sales_script:approve'],
});
/** Someone who may edit a script and not approve one — the grant ADR-0037 kept separate. */
const WRITER = makeMe({
  membership: member, permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write'],
});
const READER = makeMe({ membership: member, permissions: ['tenant_config:read', 'product_settings:read'] });
/** A field member: the office's taxonomy is theirs to read, its product settings are not. */
const FIELD_MEMBER = makeMe({
  membership: { ...member, isKpmOwner: false, orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const },
  permissions: ['tenant_config:read', 'product_catalog:read'],
});

const BRANCH = { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' };

const field = <T,>(value: T, overridden = false) => ({ value, overridden });

const script = (over: Record<string, unknown> = {}) => ({
  goodFit: field('Young families'),
  opening: field('Halo, boleh saya tanya sebentar?'),
  benefits: field(['Proteksi jiwa']),
  fullScript: field('Halo. Ini scriptnya.'),
  objections: field([{ objection: 'Terlalu mahal.', answer: 'Preminya bisa disesuaikan.' }]),
  nextAction: field('Boleh saya siapkan ilustrasinya?'),
  ...over,
});

const product = (over: Record<string, unknown> = {}) => ({
  productId: 'p1',
  code: 'PRUMAPAN',
  companyName: 'PRUMapan',
  channel: 'conventional',
  category: 'life',
  kind: 'base',
  attachesTo: [],
  lifecycle: 'active',
  sellable: true,
  active: field(true),
  displayName: field('PRUMapan'),
  description: field('Endowment-style life with guaranteed retirement payouts.'),
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
  await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
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

  it('says which shelf a product is on, which nothing did', async () => {
    // `channel` arrived from the API from the day this screen was built and nothing rendered
    // it, so an office selling both could not tell one shelf from the other. Syariah green and
    // conventional grey, as the prototype has them (`KPM_Owner.html:1714`, `:1748`).
    render([
      product(),
      product({
        productId: 'p2', code: 'PRUSYARIAH', companyName: 'PRUSyariah',
        displayName: field('PRUSyariah'), channel: 'syariah',
      }),
    ]);
    await screen.findByText('PRUSyariah');

    expect(screen.getByText('Conventional')).toBeInTheDocument();
    expect(screen.getByText('Syariah')).toBeInTheDocument();
  });

  it('says a withdrawn product is the company’s doing, and offers no way to sell it', async () => {
    render([product({ sellable: false, lifecycle: 'withdrawn' })]);

    expect(await screen.findByText('Withdrawn by Allianz Life')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sell this|Stop selling/ })).not.toBeInTheDocument();
  });

  it('starts and stops selling with a switch, and sends null nowhere near it', async () => {
    // The prototype's own control (`KPM_Owner.html:1715`). It replaces a *Stop selling* button
    // and a *"Your agents sell it"* badge, which were two things saying one thing.
    const stub = render();
    await userEvent.click(await screen.findByRole('switch', { name: 'Agents sell it' }));

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/active'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/active'))!.init.body)))
      .toEqual({ active: false });
  });

  describe('P18.7-T1 AC-5 — the switch says it is saved, beside it', () => {
    /** The save confirmation in the switch's own row: the nearest ancestor with a status for a child. */
    const besides = (el: HTMLElement) => {
      for (let box = el.parentElement; box; box = box.parentElement) {
        const own = [...box.children].find((c) => c.getAttribute('role') === 'status');
        if (own) return own as HTMLElement;
        if (box.tagName === 'LI') break;
      }
      return null;
    };
    const ACTIVE = 'PUT /kpm/settings/products/p1/active';
    const sends = (stub: ReturnType<typeof stubFetch>) =>
      stub.calls.filter((c) => c.url.includes('/p1/active')).map((c) => JSON.parse(String(c.init.body)));

    it('P18.7-T1 AC-5: says Saved ✓ beside the switch once it is kept, and beside no other', async () => {
      render([product(), product({ productId: 'p2', code: 'PRUSMART', companyName: 'PRUSmart', displayName: field('PRUSmart') })], OWNER, {
        [ACTIVE]: { body: product({ active: field(false) }) },
      });
      await screen.findByText('PRUSmart');
      const [first, second] = screen.getAllByRole('switch', { name: 'Agents sell it' });

      await userEvent.click(first);

      await waitFor(() => expect(besides(first)).toHaveTextContent('Saved ✓'));
      expect(besides(first)).toHaveClass('text-success');
      expect(first).not.toBeChecked();
      expect(besides(second)).toBeNull();
      expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
    });

    it('P18.7-T1 AC-5: a refused switch says Couldn’t save — retry, and the retry sends the same value again', async () => {
      const stub = render([product()], OWNER, {
        [ACTIVE]: [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
          { body: product({ active: field(false) }) },
        ],
      });
      const toggle = await screen.findByRole('switch', { name: 'Agents sell it' });
      await userEvent.click(toggle);

      const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Agents sell it, PRUMapan" });
      expect(besides(toggle)).toContainElement(retry);
      // The reason stays in the alert above the shelf, where it always was; the switch still shows what is kept.
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(toggle).toBeChecked();

      await userEvent.click(retry);

      await waitFor(() => expect(sends(stub)).toEqual([{ active: false }, { active: false }]));
      await waitFor(() => expect(besides(toggle)).toHaveTextContent('Saved ✓'));
      expect(toggle).not.toBeChecked();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });
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

  describe('the office’s description, held for approval (OD-136)', () => {
    const LABEL = 'Short description (shown to agents)';
    /** The field and its own two controls, as each script field has. */
    const block = () => screen.getByLabelText(LABEL).closest('div')!.parentElement!;

    it('shows the prototype’s field, following the company until the office writes its own', async () => {
      render();
      await open();

      // The label is the prototype's own, guidance folded in (`KPM_Owner.html:1781`).
      const box = screen.getByLabelText(LABEL);
      expect(box).toHaveValue('Endowment-style life with guaranteed retirement payouts.');
      expect(box).toHaveAttribute('maxLength', '300');
      expect(within(block()).getByText('Following Allianz Life.')).toBeInTheDocument();
      expect(within(block()).queryByRole('button', { name: 'Use Allianz Life’s' }))
        .not.toBeInTheDocument();
    });

    it('sends the description alone, and the row waits for approval', async () => {
      const ours = 'Dana pensiun yang cair rutin dari usia 55.';
      const stub = render([product()], OWNER, {
        '/kpm/settings/products/p1/overrides': {
          body: product({ description: field(ours, true), reviewState: 'pending' }),
        },
      });
      await open();

      await userEvent.clear(screen.getByLabelText(LABEL));
      await userEvent.type(screen.getByLabelText(LABEL), ours);
      await userEvent.click(within(block()).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
        .toEqual({ description: ours });
      expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
      expect(within(block()).getByText('Yours.')).toBeInTheDocument();
    });

    it('gives it back to the company with an unset, offered only once it is the office’s', async () => {
      const stub = render([product({ description: field('Kalimat kami.', true) })], OWNER, {
        '/kpm/settings/products/p1/overrides/description': { body: product() },
      });
      await open();

      expect(screen.getByLabelText(LABEL)).toHaveValue('Kalimat kami.');
      await userEvent.click(within(block()).getByRole('button', { name: 'Use Allianz Life’s' }));

      await waitFor(() => expect(
        stub.calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/overrides/description')),
      ).toBe(true));
      await waitFor(() => expect(screen.getByLabelText(LABEL))
        .toHaveValue('Endowment-style life with guaranteed retirement payouts.'));
    });

    it('puts a pending description on the approvals queue, as the line to decide', async () => {
      render([product({ reviewState: 'pending', description: field('Kalimat kami.', true) })]);
      await screen.findByText('PRUMapan');
      await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));

      expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
      expect(screen.getByText(/Short description \(shown to agents\):/)).toBeInTheDocument();
      expect(screen.getByText('Kalimat kami.')).toBeInTheDocument();
    });

    it('lets a reader see it and not change it', async () => {
      render([product()], READER);
      await open();

      expect(screen.getByLabelText(LABEL)).toBeDisabled();
      expect(within(block()).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
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

    it('keeps the tab in the address bar, so a queue can be linked to', async () => {
      // Products, Events and Campaigns held their tab in state alone, so a link somebody pasted
      // into a message landed on the first tab whatever the hash said. Training already did
      // this; `useHashTab` is that, once.
      render();
      await openApprovals();

      expect(window.location.hash).toBe('#approvals');
    });

    it('says nothing is waiting when nothing is', async () => {
      render();
      await openApprovals();

      expect(await screen.findByText(/Nothing is waiting on you/)).toBeInTheDocument();
    });
  });

  it('P14 exit review: refuses a field member, who holds tenant_config:read but not product_settings:read, and asks for nothing', async () => {
    const { calls } = render([product({ reviewState: 'pending' })], FIELD_MEMBER);

    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'product_settings:read');
    expect(screen.getByText('Not available to you')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/kpm/settings/products'))).toEqual([]);
  });

  it('shows a reader who cannot write the shelf without a control to change it', async () => {
    render([product()], READER);
    await open();

    expect(screen.queryByRole('button', { name: 'Stop selling' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save the name' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('1 · Opening line')).toBeDisabled();
  });

  /**
   * The upload the office's product documents lacked since Phase 5 (P17-T9, D-productdocs), with the
   * recruitment pitch's control, in the prototype's words and place (`KPM_Owner.html:2404`).
   */
  describe('the office’s own document upload (P17-T9)', () => {
    /** A GCS signed POST policy, as the API answers since Phase 18.4 (ADR-0153). */
    const SIGNED = gcsSignedUpload('dev/kpm-1/products/01DOC');
    const DOCS = [
      { slot: 'brochure', label: 'Brochure', storageKey: 'k1', filename: 'ours.pdf', source: 'kpm' },
      { slot: 'illustration', label: 'Illustration / Simulation', storageKey: 'k2', filename: 'theirs.pdf', source: 'company' },
      { slot: 'productDoc', label: 'Product Document', storageKey: null, filename: null, source: 'none' },
    ];
    const withDoc = (slot: string, filename: string) => product({
      documents: DOCS.map((d) => (d.slot === slot
        ? { ...d, storageKey: SIGNED.storageKey, filename, source: 'kpm' }
        : d)),
    });
    const row = (label: string) => screen.getByText(label).closest('li') as HTMLElement;
    const pick = (label: string) => row(label).querySelector('input[type=file]') as HTMLInputElement;
    const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

    it('offers + Upload on an empty slot and Replace on a filled one, the company’s file included', async () => {
      render([product({ documents: DOCS })]);
      await open();

      expect(screen.getByRole('button', { name: 'Replace Brochure' })).toHaveTextContent('Replace');
      expect(screen.getByRole('button', { name: 'Replace Illustration / Simulation' })).toHaveTextContent('Replace');
      expect(screen.getByRole('button', { name: 'Upload Product Document' })).toHaveTextContent('+ Upload');
      // Beside the two the row already had.
      expect(within(row('Brochure')).getByRole('button', { name: 'Open' })).toBeInTheDocument();
      expect(within(row('Brochure')).getByRole('button', { name: 'Use Allianz Life’s' })).toBeInTheDocument();
    });

    it('signs a PDF into the office’s folder, sends it, and attaches it under its own name', async () => {
      const stub = render([product({ documents: DOCS })], OWNER, {
        'POST /kpm/settings/products/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/products/p1/documents/productDoc': { body: withDoc('productDoc', 'pd.pdf') },
      });
      await open();
      await userEvent.upload(pick('Product Document'), pdf('pd.pdf'));

      expect(await screen.findByText(/Uploaded by your office — pd\.pdf/)).toBeInTheDocument();
      const sign = stub.calls.find((c) => c.url.includes('/kpm/settings/products/uploads'))!;
      expect(sign.init.method).toBe('POST');
      expect(JSON.parse(sign.init.body as string)).toEqual({ filename: 'pd.pdf', mimeType: 'application/pdf', bytes: 8 });
      const put = stub.calls.find((c) => c.url.includes('/documents/productDoc'))!;
      expect(put.init.method).toBe('PUT');
      expect(JSON.parse(put.init.body as string)).toEqual({ storageKey: SIGNED.storageKey, label: 'pd.pdf' });
    });

    it('replaces an office file through the same route', async () => {
      const stub = render([product({ documents: DOCS })], OWNER, {
        'POST /kpm/settings/products/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/products/p1/documents/brochure': { body: withDoc('brochure', 'ours-v2.pdf') },
      });
      await open();
      await userEvent.upload(pick('Brochure'), pdf('ours-v2.pdf'));

      expect(await screen.findByText(/Uploaded by your office — ours-v2\.pdf/)).toBeInTheDocument();
      expect(stub.calls.filter((c) => c.url.includes('/documents/brochure') && c.init.method === 'PUT')).toHaveLength(1);
    });

    it('refuses a file that is not a PDF in the row, before anything is sent', async () => {
      const stub = render([product({ documents: DOCS })]);
      await open();
      fireEvent.change(pick('Product Document'), { target: { files: [new File(['x'], 'sheet.xlsx', { type: 'application/vnd.ms-excel' })] } });

      // P19.6-T2: an HTML page is accepted too (ADR-0217 §1), and the refusal says so.
      expect(await within(row('Product Document')).findByText('“sheet.xlsx” is not a PDF or an HTML page. Only a PDF or an HTML page can be uploaded here.')).toBeInTheDocument();
      expect(stub.calls.filter((c) => c.url.includes('/uploads'))).toEqual([]);
    });

    it('says what the server refused, under the row', async () => {
      render([product({ documents: DOCS })], OWNER, {
        'POST /kpm/settings/products/uploads': {
          status: 400, body: { error: { code: 'ASSET_TOO_LARGE', message: 'Files must be 25 MB or smaller.', requestId: 'r-1' } },
        },
      });
      await open();
      await userEvent.upload(pick('Product Document'), pdf('pd.pdf'));
      expect(await within(row('Product Document')).findByText('Files must be 25 MB or smaller.')).toBeInTheDocument();
    });

    it.each([
      ['the office has switched off', { active: field(false) }],
      ['the company has withdrawn', { sellable: false, lifecycle: 'withdrawn' }],
    ])('offers no upload on a product %s (AC-1: a product the office keeps on)', async (_why, over) => {
      render([product({ documents: DOCS, ...over })]);
      await open();
      expect(screen.queryByRole('button', { name: /^(Upload|Replace) / })).not.toBeInTheDocument();
      expect(document.querySelector('input[type=file]')).toBeNull();
    });

    it('keeps the row’s two other actions: Open signs a link, Use the company’s gives the slot back', async () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const stub = render([product({ documents: DOCS })], OWNER, {
        '/kpm/settings/products/p1/documents/brochure/url': { body: { url: 'https://cdn.test/b?sig=1' } },
        'DELETE /kpm/settings/products/p1/documents/brochure': { body: product({ documents: DOCS.slice(1) }) },
      });
      await screen.findByRole('button', { name: 'Customize' });
      await userEvent.click(screen.getByRole('button', { name: 'Customize' }));
      await userEvent.click(within(row('Brochure')).getByRole('button', { name: 'Open' }));
      await waitFor(() => expect(open).toHaveBeenCalledWith('https://cdn.test/b?sig=1', '_blank', 'noopener,noreferrer'));

      await userEvent.click(within(row('Brochure')).getByRole('button', { name: 'Use Allianz Life’s' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/documents/brochure'))).toBe(true));
    });

    it('P19.6-T2 AC-2 previews an HTML page in the sandboxed window, never a tab (ADR-0217 §4)', async () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const page = DOCS.map((d) => (d.slot === 'brochure' ? { ...d, mimeType: 'text/html' } : d));
      render([product({ documents: page })], OWNER, {
        '/kpm/settings/products/p1/documents/brochure/url': {
          body: { url: 'https://storage.googleapis.com/test-bucket/dev/kpm-1/products/01PAGE?X-Goog-Signature=abc' },
        },
      });
      await screen.findByRole('button', { name: 'Customize' });
      await userEvent.click(screen.getByRole('button', { name: 'Customize' }));
      await userEvent.click(within(row('Brochure')).getByRole('button', { name: 'Open' }));
      const frame = await screen.findByTitle('Brochure');
      expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
      expect(new URL(frame.getAttribute('src')!).origin).toBe('https://storage.googleapis.com');
      expect(open).not.toHaveBeenCalled();
    });

    it('says so when a document’s link is refused', async () => {
      render([product({ documents: DOCS })], OWNER, {
        '/kpm/settings/products/p1/documents/brochure/url': {
          status: 404, body: { error: { code: 'NOT_FOUND', message: 'Document not found.', requestId: 'r-1' } },
        },
      });
      await open();
      await userEvent.click(within(row('Brochure')).getByRole('button', { name: 'Open' }));
      expect(await screen.findByText('Document not found.')).toBeInTheDocument();
    });

    it('offers no upload to a reader who cannot write — a read-only support session among them', async () => {
      const readOnly = makeMe({ ...READER, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support' });
      render([product({ documents: DOCS })], readOnly);
      await open();
      expect(screen.queryByRole('button', { name: /^(Upload|Replace) / })).not.toBeInTheDocument();
      expect(within(row('Brochure')).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });
  });
});

/**
 * ***Review* beside *Waiting for your approval*** (P18.9-T4 AC-7, ADR-0176 §7; the client's KPM Owner review of
 * 2026-10-27, UI-028: *"WAITING FOR YOUR APPROVAL"* on PRUFuture and PRUWarisan with no action on the row). It opens
 * the product's script review on *Script approvals* — its card, where it is approved or sent back — for whoever holds
 * `sales_script:approve`; the API refuses everybody else (`kpm-product.controller.int.spec.ts`, backend).
 */
describe('P18.9-T4 AC-7 Review beside the badge', () => {
  afterEach(() => vi.unstubAllGlobals());

  const PENDING = [
    product({ reviewState: 'pending', displayName: field('PRUFuture') }),
    product({ productId: 'p2', code: 'PRUANUGERAH', displayName: field('PRUAnugerah'), reviewState: 'rejected', rejectionReason: 'Terlalu kuat.' }),
    product({ productId: 'p3', code: 'PRUTERM', displayName: field('PRUterm'), reviewState: 'approved' }),
  ];
  const ADMIN = makeMe({
    membership: { ...member, isKpmOwner: false, isKpmAdmin: true },
    permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write', 'sales_script:approve'],
  });

  it.each([['the Owner', OWNER], ['an Admin', ADMIN]])(
    'P18.9-T4 AC-7 offers %s Review beside Waiting for your approval, and on no other row', async (_who, me) => {
      render(PENDING, me);
      const review = await screen.findByRole('button', { name: 'Review PRUFuture' });
      expect(review).toHaveTextContent(/^Review$/);
      // Beside the badge, in its line.
      expect(review.parentElement).toContainElement(screen.getByText('Waiting for your approval'));
      expect(screen.getAllByRole('button', { name: /^Review / })).toHaveLength(1);
      expect(screen.getByText('Sent back')).toBeInTheDocument();
    },
  );

  it('P18.9-T4 AC-7 opens that product’s script review, its card taking the focus, Approve and Send back on it', async () => {
    render(PENDING);
    await userEvent.click(await screen.findByRole('button', { name: 'Review PRUFuture' }));
    expect(window.location.hash).toBe('#approvals');
    const heading = await screen.findByRole('heading', { name: 'PRUFuture' });
    await waitFor(() => expect(heading).toHaveFocus());
    const card = heading.closest('li')!;
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Send back' })).toBeInTheDocument();
    // A landing for script, not a tab stop of its own.
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it.each([['somebody who may write a script but not approve one', WRITER], ['a reader', READER]])(
    'P18.9-T4 AC-7 offers %s no Review: the badge is said, the action is not theirs', async (_who, me) => {
      render(PENDING, me);
      expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Review/ })).toBeNull();
    },
  );
});

/**
 * **The shelf's grey sentence per size** (P18.9-T4 AC-6, ADR-0176 §6; the client's grey-text table of 2026-10-27,
 * UI-027): *"Your changes apply to this office only."* — the 50 words it replaces — shown from 1024px, behind an ⓘ
 * after the shelf's count line at 768–1023px and below 768px (*ⓘ · ⓘ · Show*).
 */
describe('P18.9-T4 AC-6 the products’ grey text per size', () => {
  afterEach(() => vi.unstubAllGlobals());
  const NOTE = 'Your changes apply to this office only.';

  async function parts(px: number) {
    atWidth(px);
    render();
    const tip = await screen.findByRole('button', { name: NOTE });
    const sentence = screen.getAllByText(NOTE).find((el) => el.tagName === 'P')!;
    return { sentence: wears(sentence, px).split(' '), tip: wears(tip.parentElement!, px).split(' '), glyph: tip };
  }

  it.each([1024, 1280])('P18.9-T4 AC-6 at %ipx shows the sentence and draws no ⓘ', async (px) => {
    const { sentence, tip } = await parts(px);
    expect(sentence).not.toContain('hidden');
    expect(tip).toContain('hidden');
  });

  it.each([767, 768, 1023])('P18.9-T4 AC-6 at %ipx hides the sentence and keeps it behind the ⓘ after the count', async (px) => {
    const { sentence, tip, glyph } = await parts(px);
    expect(sentence).toContain('hidden');
    expect(tip).not.toContain('hidden');
    expect(glyph.closest('p')).toHaveTextContent(/^1 products · 1 your agents can sell/);
    await userEvent.click(glyph);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(NOTE);
  });

  it('P18.9-T4 AC-6 says the whole catalog sentence no more', async () => {
    render();
    await screen.findByRole('button', { name: NOTE });
    expect(screen.queryByText(/This catalog is your company’s/)).toBeNull();
    expect(screen.queryByText(/when they improve a script/)).toBeNull();
  });
});

/**
 * **44px targets on a phone** (P18.9-T7 AC-6, ADR-0178 §5; the client's KPM Owner review of 2026-10-27, UI-040: 33
 * tappable controls under 44px, the *Agents sell it* switch on every row among them). Below 768px every button, field
 * and switch is a 44 × 44 target; at 768px and wider the shelf is as it was, to the byte.
 */
describe('P18.9-T7 AC-6 the products’ targets on a phone (UI-040)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SHELF = [
    product(),
    product({ productId: 'p2', code: 'PRULINK', companyName: 'PRULink', displayName: field('PRULink'), reviewState: 'pending', active: field(false) }),
  ];

  /** The shelf's markup on the build before P18.9-T7, at rest and with a product open, from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<'rest' | 'open', Record<768 | 1280, string>> = {
    rest: {
      // Re-recorded 2026-10-30 (UI V1): UI-008's card edge (`border-card-edge`) and UI-010's 44px/48px targets below 1024px.
      // Re-recorded 2026-11-05 (P19.2-T3 AC-4; UI-142): the tabs and *Agents sell it* 44px tall on a tablet, and nothing
      // else; 1280 unchanged.
      768: '80b40d69b819575022357a8aca7e3c3c0ed2b9d5873ac89380c9442dbc3feb78',
      1280: '6f98689634c5e5e4a6ef5c05d445826c8b99f1cf17c2e0eeb3c9e1c957768e06',
    },
    open: {
      // Re-recorded 2026-11-05 (P19.4-T4 AC-1, ADR-0209 §9): *4a* and *4b* became the objection cards, with *"+ Tambah
      // keberatan"*; the shelf at rest is unchanged.
      768: '13cd17737b4529d587031cb2aecbd638fc0d64f5a5c66b7bc8a27788d124b1eb',
      1280: 'b4ac6ee51c8218d58fde80257fd74d4a2f0fdcd209ad8c98288c61de191cfc6d',
    },
  };

  it.each([768, 1280] as const)('P18.9-T7 AC-6 at %ipx draws the shelf as it was, to the byte', async (px) => {
    atWidth(px);
    render(SHELF);
    await screen.findByText('PRULink');
    // The whole screen: the tabs, the publish bar, the count and every row (`main` is the shell's, which this spec has not).
    const page = () => document.body.firstElementChild!;
    expect(digestAt(page(), px)).toBe(BEFORE_T7.rest[px]);
    await userEvent.click(screen.getAllByRole('button', { name: 'Customize' })[0]);
    await screen.findByLabelText('What your office calls it');
    /*
     * *Amended 2026-11-05 (P19.7-T1 AC-3; ADR-0225 §5, the proposal spec's decision 6):* an opened product gains the
     * office's *Tanya-jawab* and plan highlights above *Documents* (`[data-office-proposal]`). Everything else is drawn
     * as before: the digest is taken with that block lifted out, and still matches.
     */
    const open = page().cloneNode(true) as Element;
    expect(open.querySelector('[data-office-proposal]')).not.toBeNull();
    open.querySelector('[data-office-proposal]')!.remove();
    /*
     * *Amended 2026-11-06 (P19.6-T2 AC-1; ADR-0217 §1):* a document's picker offers an HTML page beside a PDF. That one
     * attribute is the only change: written back as it was, the opened product still matches.
     */
    const pickers = [...open.querySelectorAll('[data-pdf-picker]')];
    expect(pickers.length).toBeGreaterThan(0);
    for (const picker of pickers) {
      expect(picker.getAttribute('accept')).toBe('application/pdf,.pdf,text/html,.html,.htm');
      picker.setAttribute('accept', 'application/pdf,.pdf');
    }
    expect(digestAt(open, px)).toBe(BEFORE_T7.open[px]);
  });
  it.each([375, 767])('P18.9-T7 AC-6 at %ipx makes Agents sell it a 44 × 44px target, the track as drawn', async (px) => {
    atWidth(px);
    render(SHELF);
    // A phone's shelf is rows since P19.2-T3 AC-3 (UI-141): the switch is in each product's sheet.
    await userEvent.click(await screen.findByRole('button', { name: 'PRULink' }));
    for (const toggle of await screen.findAllByRole('switch', { name: 'Agents sell it' })) {
      // The transparent input — what a finger and a screen reader meet — a 44px square on the track.
      expect(wears(toggle, px).split(' ')).toEqual(expect.arrayContaining(['h-11', 'w-11', 'left-1/2', 'top-1/2']));
      // On a tablet too since P19.2-T3 AC-4 (UI-142: *≥ 44px on a phone and a tablet*); from 1024px the switch it was.
      expect(wears(toggle, 768).split(' ')).toEqual(expect.arrayContaining(['h-11', 'w-11']));
      expect(wears(toggle, 1024).split(' ')).toEqual(expect.arrayContaining(['h-full', 'w-full']));
      expect(wears(toggle, 1024).split(' ')).not.toContain('h-11');
      // Its line 44px tall, so the square reaches over nothing above or below; the track itself unchanged.
      const line = toggle.parentElement!.parentElement!;
      expect(wears(line, px).split(' ')).toContain('min-h-11');
      expect(wears(toggle.parentElement!, px)).toBe(wears(toggle.parentElement!, 768));
    }
  });

  it('P18.9-T7 AC-6 makes every button and field of a product, and of the approvals, a 44px target on a phone', async () => {
    atWidth(375);
    render(SHELF);
    // Opened from the product's row since P19.2-T3 AC-3 (UI-141): *Customize* is in its sheet.
    await userEvent.click(await screen.findByRole('button', { name: 'PRULink' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    await screen.findByLabelText('What your office calls it');
    const controls = [
      screen.getByLabelText('What your office calls it'),
      screen.getByLabelText('Code'),
      screen.getByRole('button', { name: 'Save the name' }),
      ...screen.getAllByRole('button', { name: 'Save' }),
    ];
    for (const control of controls) {
      expect(wears(control, 375).split(' ')).toContain('h-11');
      expect(wears(control, 768).split(' ')).not.toContain('h-11');
    }
    // The row's text actions — *Customize*, *Review*, a document's *+ Upload* — are 44 × 44 on a phone already.
    for (const name of ['Review PRULink']) {
      expect(wears(screen.getByRole('button', { name }), 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    }

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    const approve = await screen.findByRole('button', { name: 'Approve' });
    await userEvent.click(screen.getByRole('button', { name: 'Send back' }));
    for (const name of ['Approve', 'Send it back', 'Cancel']) {
      expect(wears(name === 'Approve' ? approve : screen.getByRole('button', { name }), 375).split(' ')).toContain('h-11');
    }
  });
});

/**
 * **The shelf on a phone: one line per product, its controls in its sheet** (P19.2-T3 AC-3; UI-141: *products with
 * "Agent menjualnya" switch and "Sesuaikan" on every row*, 6.1 screens at 375; `kpm-owner-mobile-2026-11-03` 7).
 */
describe('P19.2-T3 AC-3 the products on a phone (UI-141)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SHELF = [
    product(),
    product({ productId: 'p2', code: 'PRUFUTURE', companyName: 'PRUFuture', displayName: field('PRUFuture'), reviewState: 'pending' }),
    product({ productId: 'p3', code: 'PRUANUGERAH', companyName: 'PRUAnugerah', displayName: field('PRUAnugerah'), reviewState: 'rejected', rejectionReason: 'Too long' }),
    product({ productId: 'p4', code: 'PRUHERITAGE', companyName: 'PRUHeritage Syariah', displayName: field('PRUHeritage Syariah'), channel: 'syariah', reviewState: 'approved' }),
    product({ productId: 'p5', code: 'PGB', companyName: 'PGB', displayName: field('PGB'), sellable: false, lifecycle: 'withdrawn' }),
  ];
  const rowOf = (name: string) => screen.getByRole('button', { name }).closest('li')!;

  it('P19.2-T3 AC-3 at 375px draws one 56px row per product — the name, category · channel, one pill only when there is one, ›', async () => {
    atWidth(375);
    render(SHELF);
    await screen.findByRole('button', { name: 'PRUMapan' });
    const rows = document.querySelectorAll('[data-list-row]');
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(wears(row, 375).split(' ')).toContain('min-h-14');
    expect(rowOf('PRUMapan')).toHaveTextContent('PRUMapanLife · Conventional');
    // No pill when there is none; one when there is.
    expect(rowOf('PRUMapan').querySelector('[data-tone]')).toBeNull();
    expect(within(rowOf('PRUFuture')).getByText('Waiting for your approval')).toHaveAttribute('data-tone', 'amber');
    expect(within(rowOf('PRUAnugerah')).getByText('Sent back')).toHaveAttribute('data-tone', 'red');
    expect(within(rowOf('PRUHeritage Syariah')).getByText('Approved')).toHaveAttribute('data-tone', 'green');
    expect(rowOf('PRUHeritage Syariah')).toHaveTextContent('Syariah');
    expect(within(rowOf('PGB')).getByText('Withdrawn by Allianz Life')).toHaveAttribute('data-tone', 'grey');
    // Every row is a tappable row with a ›, its controls nowhere on the shelf.
    for (const row of rows) expect(row.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Customize' })).toBeNull();
    // The count line is kept.
    expect(screen.getByText(/5 products/)).toBeInTheDocument();
  });

  it('P19.2-T3 AC-3 at 375px filters by the chips for what waits on the owner, and by Search products', async () => {
    atWidth(375);
    render(SHELF);
    await screen.findByRole('button', { name: 'PRUMapan' });
    const chips = screen.getByRole('group', { name: 'Filter products' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All5', 'Waiting1', 'Sent back1']);
    const chip = (name: RegExp) => within(chips).getByRole('button', { name });
    for (const chip of within(chips).getAllByRole('button')) expect(wears(chip, 375).split(' ')).toContain('min-h-11');

    await userEvent.click(chip(/^Waiting/));
    expect(chip(/^Waiting/)).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('[data-list-row]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'PRUFuture' })).toBeInTheDocument();

    await userEvent.click(chip(/^All/));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'heritage');
    expect(document.querySelectorAll('[data-list-row]')).toHaveLength(1);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search products' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'nothing like it');
    expect(screen.getByText('No product matches.')).toBeInTheDocument();
  });

  it('P19.2-T3 AC-3 at 375px opens the product’s sheet: its badges, Review, Agents sell it and Customize, each still working', async () => {
    atWidth(375);
    const stub = render(SHELF);
    await userEvent.click(await screen.findByRole('button', { name: 'PRUMapan' }));
    const sheet = await screen.findByRole('dialog', { name: 'PRUMapan' });
    // *Agents sell it* saves itself from the sheet, as it did on the card.
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Agents sell it' }));
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/p1/active'))).toBe(true));
    // *Customize* opens the product's own words in the sheet.
    await userEvent.click(within(sheet).getByRole('button', { name: 'Customize' }));
    expect(await within(sheet).findByLabelText('What your office calls it')).toHaveValue('PRUMapan');
    expect(within(sheet).getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    // The focus went to the words *Customize* opened, so Escape reaches the sheet.
    expect(within(sheet).getByLabelText('What your office calls it')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // A waiting script's *Review* goes to the queue from the sheet, and the sheet closes.
    await userEvent.click(screen.getByRole('button', { name: 'PRUFuture' }));
    const waiting = await screen.findByRole('dialog', { name: 'PRUFuture' });
    expect(within(waiting).getByText('Waiting for your approval')).toBeInTheDocument();
    await userEvent.click(within(waiting).getByRole('button', { name: 'Review PRUFuture' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('P19.2-T3 AC-3 at 375px offers a withdrawn product no switch in its sheet, and a reader a disabled one', async () => {
    atWidth(375);
    render(SHELF, READER);
    await userEvent.click(await screen.findByRole('button', { name: 'PGB' }));
    const sheet = await screen.findByRole('dialog', { name: 'PGB' });
    expect(within(sheet).queryByRole('switch')).toBeNull();
    expect(within(sheet).getByText('Withdrawn by Allianz Life')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'PRUMapan' }));
    expect(within(await screen.findByRole('dialog', { name: 'PRUMapan' })).getByRole('switch', { name: 'Agents sell it' })).toBeDisabled();
  });

  it.each([768, 1024, 1280])('P19.2-T3 AC-3 at %ipx keeps the cards: every switch on the shelf, no rows', async (px) => {
    atWidth(px);
    render(SHELF);
    await screen.findByText('PRUFuture');
    expect(document.querySelectorAll('[data-list-row]')).toHaveLength(0);
    expect(screen.getAllByRole('switch', { name: 'Agents sell it' })).toHaveLength(4);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('P19.2-T3 AC-4 the products’ targets (UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const SHELF = [
    product(),
    product({ productId: 'p2', code: 'PRULINK', companyName: 'PRULink', displayName: field('PRULink'), reviewState: 'pending' }),
  ];

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx finds no target under 44px on the shelf, in a product opened and on the approvals', async (px) => {
    atWidth(px);
    render(SHELF);
    const frame = document.body.firstElementChild!;
    frame.setAttribute('data-surface', 'v1');
    await screen.findByText('PRULink');
    expect(smallTargets(frame, px)).toEqual([]);
    if (px === 375) await userEvent.click(screen.getByRole('button', { name: 'PRUMapan' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Customize' })[0]);
    await screen.findByLabelText('What your office calls it');
    expect(smallTargets(document.body, px)).toEqual([]);
  });
});
