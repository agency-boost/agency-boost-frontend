import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import KpmProductsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/products',
}));

const member = (over: Record<string, unknown>) => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
    status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write', 'sales_script:approve'],
  ...over,
});
const OWNER = member({});
/** A reader who may read the office's settings and write none (a read-only support session). */
const READER = member({ permissions: ['tenant_config:read', 'product_settings:read'] });

const field = <T,>(value: T, overridden = false) => ({ value, overridden });
const FAQ = [{ question: 'Ada masa tunggu?', answer: 'Ya, 30 hari.' }];
const row = (over: Record<string, unknown> = {}) => ({
  productId: 'p1', code: 'PRUWELL_MEDICAL', companyName: 'PRUWell Medical', channel: 'conventional', category: 'health',
  kind: 'base', attachesTo: [], lifecycle: 'active', sellable: true, active: field(true),
  displayName: field('PRUWell Medical'), description: field('Rawat inap.'),
  script: {
    goodFit: field(''), opening: field(''), benefits: field([]), fullScript: field(''), objections: field([]), nextAction: field(''),
  },
  faq: field(FAQ),
  plans: [
    { name: 'Silver', popular: false, highlights: field([{ label: 'Kamar', value: 'Rp 1 Jt' }]) },
    { name: 'Gold', popular: true, highlights: field([{ label: 'Kamar', value: 'Rp 1,5 Jt' }]) },
  ],
  reviewState: 'none', rejectionReason: null, documents: [],
  ...over,
});

function render(rows: unknown[] = [row()], extra: Record<string, unknown> = {}, me = OWNER, indonesian = false) {
  const stub = stubFetch({
    '/kpm/settings/products': { body: rows },
    '/kpm/settings/products/script-reviews': { body: rows.filter((r) => (r as { reviewState: string }).reviewState === 'pending') },
    '/kpm/settings/branch-info': { body: { _id: 'k1', companyId: 'c1', companyName: 'Prudential', code: '0417' } },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    '/effective-script': { body: { source: 'company', script: {}, description: '' } },
    ...extra,
  } as Parameters<typeof stubFetch>[0]);
  (indonesian ? renderInIndonesian : renderWithSession)(<KpmProductsPage />, { me });
  return stub;
}
const sent = (stub: ReturnType<typeof stubFetch>) =>
  stub.calls.filter((c) => c.init.method && c.init.method !== 'GET').map((c) => ({
    call: `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')}`,
    body: c.init.body ? JSON.parse(String(c.init.body)) : null,
  }));
const customize = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
  return within(document.querySelector('[data-office-proposal]') as HTMLElement);
};

/**
 * **P19.7-T1 AC-3 — an office's own FAQ and plan highlights** (ADR-0225 §5; the proposal spec's decision 6): on
 * `/kpm/settings/products`, the company's until the office writes its own, saved as a whole list or by plan, held for
 * approval with the script, *Use Prudential's* an unset.
 */
describe('P19.7-T1 AC-3 the office’s FAQ and plan highlights', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T1 AC-3 shows the company’s FAQ and each plan’s highlights, marked as following the company', async () => {
    render();
    const block = await customize();
    expect(block.getByRole('heading', { name: 'Proposal' })).toBeInTheDocument();
    expect(block.getByRole('textbox', { name: 'Question 1' })).toHaveValue('Ada masa tunggu?');
    expect(block.getAllByText('Following Prudential.').length).toBeGreaterThanOrEqual(3);
    const gold = block.getByText('Gold').closest('[data-office-plan]') as HTMLElement;
    expect(within(gold).getByText('Most chosen')).toBeInTheDocument();
    expect(within(gold).getByRole('textbox', { name: 'Gold, highlight 1, value' })).toHaveValue('Rp 1,5 Jt');
  });

  it('P19.7-T1 AC-3 saves the office’s whole FAQ, its line breaks as typed', async () => {
    const stub = render([row()], { 'PATCH /kpm/settings/products/p1/overrides': { body: row({ reviewState: 'pending' }) } });
    const block = await customize();
    await userEvent.click(block.getByRole('button', { name: '+ Add question' }));
    await userEvent.type(block.getByRole('textbox', { name: 'Question 2' }), 'Bisa dicicil?');
    await userEvent.type(block.getByRole('textbox', { name: 'Answer 2' }), 'Bisa,{enter}bulanan.');
    await userEvent.click(block.getByRole('button', { name: 'Save questions and answers' }));
    await waitFor(() => expect(sent(stub)).toEqual([{
      call: 'PATCH /kpm/settings/products/p1/overrides',
      body: { faq: [...FAQ, { question: 'Bisa dicicil?', answer: 'Bisa,\nbulanan.' }] },
    }]));
  });

  it('P19.7-T1 AC-3 saves only the plans the office changed, never a copy of the company’s for the others', async () => {
    const stub = render([row()], { 'PATCH /kpm/settings/products/p1/overrides': { body: row() } });
    const block = await customize();
    const value = block.getByRole('textbox', { name: 'Gold, highlight 1, value' });
    await userEvent.clear(value);
    await userEvent.type(value, 'VIP');
    await userEvent.click(block.getByRole('button', { name: 'Save plan highlights' }));
    await waitFor(() => expect(sent(stub)).toEqual([{
      call: 'PATCH /kpm/settings/products/p1/overrides',
      body: { planHighlights: { Gold: [{ label: 'Kamar', value: 'VIP' }] } },
    }]));
  });

  it('P19.7-T1 AC-3 gives each back to the company with an unset, not a copy', async () => {
    const own = row({
      faq: field([{ question: 'Q?', answer: 'Kami.' }], true),
      plans: [{ name: 'Gold', popular: true, highlights: field([{ label: 'Kamar', value: 'VIP' }], true) }],
    });
    const stub = render([own], {
      'DELETE /kpm/settings/products/p1/overrides/faq': { body: row() },
      'DELETE /kpm/settings/products/p1/overrides/planHighlights': { body: row() },
    });
    const block = await customize();
    expect(block.getAllByText('Yours.').length).toBe(2);
    const resets = block.getAllByRole('button', { name: 'Use Prudential’s' });
    await userEvent.click(resets[0]);
    await waitFor(() => expect(sent(stub).map((c) => c.call)).toEqual(['DELETE /kpm/settings/products/p1/overrides/faq']));
  });

  it('P19.7-T1 AC-3 lists a pending FAQ and highlights on Script approvals, to decide with the script', async () => {
    const pending = row({
      reviewState: 'pending',
      faq: field([{ question: 'Bisa dicicil?', answer: 'Bisa.' }], true),
      plans: [{ name: 'Gold', popular: true, highlights: field([{ label: 'Kamar', value: 'VIP' }], true) }],
    });
    render([pending]);
    await screen.findByText('PRUWell Medical');
    await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    await screen.findByText('Waiting for your approval');
    const card = screen.getByRole('heading', { name: 'PRUWell Medical', level: 2 }).closest('li')!;
    expect(within(card).getByText(/Bisa dicicil\? — Bisa\./)).toBeInTheDocument();
    expect(within(card).getByText('Highlights of Gold:')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('P19.7-T1 AC-3 a reader who may not write sees them, with nothing to save', async () => {
    render([row()], {}, READER);
    const block = await customize();
    expect(block.getByRole('textbox', { name: 'Question 1' })).toBeDisabled();
    expect(block.queryByRole('button', { name: 'Save questions and answers' })).not.toBeInTheDocument();
    expect(block.queryByRole('button', { name: 'Save plan highlights' })).not.toBeInTheDocument();
  });

  it('P19.7-T1 AC-3 speaks Indonesian: Tanya-jawab, Angka utama plan, Paling banyak dipilih', async () => {
    render([row()], {}, OWNER, true);
    await userEvent.click(await screen.findByRole('button', { name: 'Sesuaikan' }));
    const block = within(document.querySelector('[data-office-proposal]') as HTMLElement);
    expect(block.getByRole('heading', { name: 'Tanya-jawab' })).toBeInTheDocument();
    expect(block.getByText('Angka utama plan')).toBeInTheDocument();
    expect(block.getByText('Paling banyak dipilih')).toBeInTheDocument();
  });
});
