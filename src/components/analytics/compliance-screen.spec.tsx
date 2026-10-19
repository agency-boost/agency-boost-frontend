import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { OWNER_ME } from '@test/kpm-analytics-fixtures';
import { complianceView, SERVER_ERROR } from '@test/kpm-compliance-fixtures';
import type { ComplianceSelection } from '@/lib/kpm-compliance';
import { SessionContext } from '@/lib/session';
import { ComplianceScreen } from './compliance-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/analytics/compliance',
}));

/**
 * The *Achieved* cell is the override's (FE-override's `AchievedCell`, its own spec): here it is a stand-in that
 * says a standing changed, so what is tested is the screen's half — it re-reads the tree and keeps it on screen.
 */
vi.mock('./standing-override', () => ({
  AchievedCell: ({ row, onChanged }: { row: { name: string }; onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>{`Changed ${row.name}`}</button>
  ),
}));

const READ = 'GET /kpm/analytics/compliance';

function open(replies: StubReply[], selection: ComplianceSelection) {
  const stub = stubFetch({ [READ]: replies });
  renderWithSession(<ComplianceScreen selection={selection} />, { me: OWNER_ME });
  return stub;
}

const reads = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/kpm/analytics/compliance')).map((c) => c.url);

describe('the compliance screen’s reads (P18.6-T1 AC-10, P18.6-T2 AC-8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('re-reads the tree when the Achieved cell says a standing changed, the tree staying on screen meanwhile', async () => {
    const before = complianceView('campaigns', 'PERSISTENCY_PUSH');
    const after = complianceView('campaigns', 'PERSISTENCY_PUSH', {
      summary: before.summary.map((c) => (c.category === 'campaigns' ? { ...c, count: c.count + 1 } : c)),
    });
    let release: (() => void) | null = null;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { calls } = open([{ body: before }, () => ({ body: after })], { category: 'campaigns', item: 'PERSISTENCY_PUSH' });
    await screen.findAllByRole('region');

    const stub = vi.mocked(fetch);
    const answer = stub.getMockImplementation()!;
    stub.mockImplementation(async (...args) => { await held; return answer(...args); });

    const cell = screen.getByRole('button', { name: 'Changed Rina Agustina' });
    await userEvent.click(cell);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('region').length).toBeGreaterThan(0);

    release!();
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Campaigns$/ }))
      .toHaveTextContent('5/ 8'));
    // The same cell, never unmounted: its toast and the focus its dialog returns survive the new answer.
    expect(screen.getByRole('button', { name: 'Changed Rina Agustina' })).toBe(cell);
    expect(reads(calls)).toHaveLength(2);
    expect(new Set(reads(calls)).size).toBe(1);
  });

  it('keeps the tree, and the same cell, under the error when a re-read after a change fails; Try again keeps it too', async () => {
    const view = complianceView('campaigns', 'PERSISTENCY_PUSH');
    const { calls } = open([{ body: view }, SERVER_ERROR, { body: view }], { category: 'campaigns', item: 'PERSISTENCY_PUSH' });
    await screen.findAllByRole('region');
    const cell = screen.getByRole('button', { name: 'Changed Rina Agustina' });

    await userEvent.click(cell);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Changed Rina Agustina' })).toBe(cell);
    expect(alert.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Changed Rina Agustina' })).toBe(cell);
    expect(reads(calls)).toHaveLength(3);
    expect(new Set(reads(calls)).size).toBe(1);
  });

  it('keeps the chips and tabs when a new choice fails, and retries that choice', async () => {
    const { calls } = open(
      [{ body: complianceView('training') }, SERVER_ERROR, { body: complianceView('goals') }],
      { category: 'training', item: null },
    );
    await screen.findAllByRole('region');

    await userEvent.click(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Goal Setting$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Goal Setting$/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByRole('region')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findAllByRole('region');
    expect(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Goal Setting$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(reads(calls).map((u) => new URL(u).search)).toEqual(['?category=training', '?category=goals', '?category=goals']);
  });

  it('draws the tree in outline while a new choice is read, the chips staying', async () => {
    open([{ body: complianceView('training') }], { category: 'training', item: null });
    await screen.findAllByRole('region');
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    await userEvent.click(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Events$/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading each unit’s statuses…');
    expect(screen.getByRole('group', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('discards an older read that answers after a newer selection (the `live` guard)', async () => {
    const gates = new Map<string, () => void>();
    const stub = stubFetch({});
    stub.mock.mockImplementation(async (url: string) => {
      const category = new URL(url).searchParams.get('category')!;
      await new Promise<void>((resolve) => gates.set(category, resolve));
      return { ok: true, status: 200, json: async () => complianceView(category as 'training' | 'goals') } as Response;
    });
    const session = { me: OWNER_ME };
    const { rerender, session: value } = renderWithSession(<ComplianceScreen selection={{ category: 'training', item: null }} />, session);
    await waitFor(() => expect(gates.has('training')).toBe(true));

    // The address moves on before the first answer arrives.
    rerender(
      <SessionContext.Provider value={value}>
        <Suspense fallback={null}><ComplianceScreen selection={{ category: 'goals', item: null }} /></Suspense>
      </SessionContext.Provider>,
    );
    await waitFor(() => expect(gates.has('goals')).toBe(true));
    gates.get('goals')!();
    await screen.findAllByRole('region');
    gates.get('training')!();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Still the newer selection's tree: the late Training answer was dropped, not drawn, and no outline came back.
    expect(within(screen.getByRole('group', { name: 'Categories' })).getByRole('button', { name: /Goal Setting$/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: 'Training categories' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('region').length).toBeGreaterThan(0);
  });
});
