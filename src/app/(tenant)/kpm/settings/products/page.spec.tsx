import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { GCS_UPLOAD_URL, gcsSignedUpload } from '@test/storage-fixtures';
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

  describe('P18.95-T1 AC-5 — the switch says it is saved, beside it', () => {
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

    it('P18.95-T1 AC-5: says Saved ✓ beside the switch once it is kept, and beside no other', async () => {
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

    it('P18.95-T1 AC-5: a refused switch says Couldn’t save — retry, and the retry sends the same value again', async () => {
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
    /** A GCS signed POST policy, as the API answers since Phase 18.7 (ADR-0153). */
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

      expect(await within(row('Product Document')).findByText('“sheet.xlsx” is not a PDF. Only a PDF can be uploaded here.')).toBeInTheDocument();
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
