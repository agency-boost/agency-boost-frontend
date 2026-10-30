import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { AgentSearch } from './agent-search';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/unit/dashboard',
}));

const hit = (membershipId: string, fullName: string, agentCode: string | null) => ({
  membershipId, fullName, preferredName: null, agentCode, role: 'agent', orgLevelCode: 'AGENT',
});

const ALL = { members: [hit('m-1', 'Indah Permatasari', '80003'), hit('m-2', 'Novi Andriani', '80011'), hit('m-3', 'Wahyu Saputra', null)] };

describe('AgentSearch (UI V1, UI-012; D-14)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('D-14 a pill field with an orange outline on focus; focusing lists the first people the reader may see', async () => {
    const { calls } = stubFetch({ '/members/search': { body: ALL } });
    renderWithSession(<AgentSearch />);
    const field = screen.getByRole('combobox', { name: 'Search agent' });
    expect(field.parentElement).toHaveClass('rounded-pill', 'focus-within:border-amber', 'h-10');
    await userEvent.click(field);
    const list = await screen.findByRole('listbox', { name: 'Agents found' });
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    expect(calls[0].url).toMatch(/\/members\/search\?limit=10$/);
    expect(field).toHaveAttribute('aria-expanded', 'true');
  });

  it('D-14 each person’s NAME in capitals on the left and their agent code on the right', async () => {
    stubFetch({ '/members/search': { body: ALL } });
    renderWithSession(<AgentSearch />);
    await userEvent.click(screen.getByRole('combobox'));
    const option = (await screen.findAllByRole('option'))[0];
    expect(within(option).getByText('Indah Permatasari')).toHaveClass('uppercase', 'font-bold');
    expect(within(option).getByText('80003')).toBeInTheDocument();
  });

  it('UI-012 filters by name or agent code as the reader types — the server’s search, the query in the URL', async () => {
    const { calls } = stubFetch({ '/members/search': { body: { members: [ALL.members[1]] } } });
    renderWithSession(<AgentSearch />);
    await userEvent.type(screen.getByRole('combobox'), '80011');
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=80011'))).toBe(true));
    expect(await screen.findByText('Novi Andriani')).toBeInTheDocument();
  });

  it('UI-012 picking somebody opens their agent dashboard, /coaching/{id}/summary — by click and by keyboard', async () => {
    stubFetch({ '/members/search': { body: ALL } });
    renderWithSession(<AgentSearch />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Novi Andriani'));
    expect(push).toHaveBeenCalledWith('/coaching/m-2/summary');
    await userEvent.click(screen.getByRole('combobox'));
    await screen.findAllByRole('option');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(push).toHaveBeenLastCalledWith('/coaching/m-3/summary');
  });

  it('D-14 the caller’s pick in place of the dashboard (Calendar’s Pick who to coach)', async () => {
    stubFetch({ '/members/search': { body: ALL } });
    const onPick = vi.fn();
    renderWithSession(<AgentSearch onPick={onPick} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Indah Permatasari'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ membershipId: 'm-1' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('UI-012 nobody found says so; Escape closes the list, then clears the field', async () => {
    stubFetch({ '/members/search': { body: { members: [] } } });
    renderInIndonesian(<AgentSearch />);
    const field = screen.getByRole('combobox', { name: 'Search agent' });
    await userEvent.type(field, 'zzz');
    expect(await screen.findByText('Tidak ada yang ditemukan')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(field).toHaveValue('');
  });
});
