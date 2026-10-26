import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { notFound, readOnlySession, ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import NewHiresPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = SARI_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, '/new-hires': { body: ROSTER }, ...routes });
  const view = renderInLayout(AgentLayout, <NewHiresPage />, { me });
  return { ...stub, ...view };
};

const card = (name: string) => screen.findByRole('region', { name });

describe('/new-hires, the leader’s roster (P13-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P13-T5 AC-2 is titled verbatim and reads the roster once', async () => {
    const { calls } = show();
    await card('Direct Unit');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Your New Hires$/);
    expect(screen.getByText('Track your new agents\' 90-day activation progress.')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/new-hires')).map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires']);
  });

  it('P13-T5 AC-2 a card per group, in the order served: Direct Unit, then AAB: {name}', async () => {
    show();
    await card('Direct Unit');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Direct Unit', 'AAB: Sari Puspita', 'AAB: Arief Hidayat',
    ]);
  });

  it('P13-T5 AC-2 the columns Name · Joined · Progress · Day · Active Agent, and each row as served', async () => {
    show();
    const direct = within(await card('Direct Unit'));
    const table = direct.getByRole('table', { name: 'Direct Unit' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name', 'Joined', 'Progress', 'Day', 'Active Agent',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    // By day, highest first, as the server orders them; *Joined* is the start date, `MMM d, yyyy`.
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Indah Permata', 'Dimas Saputra']);
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['28 Jun 2026', '94,0%', '90+ /90, overdue', '']);
  });

  it('Phase 13 exit review: an overdue Day says so in words to a screen reader, and adds nothing visible', async () => {
    // Colour is never the only cue (`frontend/CLAUDE.md`): the red and the bold say *overdue* to the eye,
    // and *", overdue"* after the day says it to everybody else (*The module's own strings*).
    show();
    const direct = within(await card('Direct Unit'));
    const day = within(direct.getByRole('row', { name: /Indah Permata/ })).getAllByRole('cell')[2];
    expect(day).toHaveTextContent(/^90\+ \/90, overdue$/);
    const word = within(day).getByText(', overdue');
    expect(word).toHaveClass('sr-only');
    // The row reads with it, so a screen reader moving across the table hears it with the day. (jsdom
    // cannot tell an inline span from a block, so its name puts a space before the comma; a browser does not.)
    expect(direct.getByRole('row', { name: /Indah Permata/ })).toHaveAccessibleName(/90\+ \/90\s?, overdue/);

    // A hire within the window has no such word.
    const sari = within(screen.getByRole('region', { name: 'AAB: Sari Puspita' }));
    const budi = within(sari.getByRole('row', { name: /Budi Hartono/ })).getAllByRole('cell')[2];
    expect(budi).toHaveTextContent(/^62 \/90$/);
    expect(budi).not.toHaveTextContent(/overdue/);
  });

  it('P13-T5 AC-2 Day is red and bold when overdue, plain otherwise', async () => {
    show();
    const direct = within(await card('Direct Unit'));
    const indah = direct.getByRole('row', { name: /Indah Permata/ });
    const day = within(indah).getAllByRole('cell')[2];
    expect(day).toHaveAttribute('data-overdue', 'true');
    expect(day.className).toContain('text-alert');
    expect(day.className).toContain('font-bold');

    const sari = within(screen.getByRole('region', { name: 'AAB: Sari Puspita' }));
    const budi = within(sari.getByRole('row', { name: /Budi Hartono/ })).getAllByRole('cell')[2];
    expect(budi).toHaveTextContent('62 /90');
    expect(budi).not.toHaveAttribute('data-overdue');
    expect(budi.className).not.toContain('text-alert');
  });

  it('P13-T5 AC-2 Active Agent: a ✓ titled “Closed first case”, also its name, or “—”', async () => {
    show();
    const direct = within(await card('Direct Unit'));
    const indah = direct.getByRole('row', { name: /Indah Permata/ });
    const check = within(indah).getByRole('img', { name: 'Closed first case' });
    expect(check).toHaveAttribute('title', 'Closed first case');
    const dimas = direct.getByRole('row', { name: /Dimas Saputra/ });
    expect(within(dimas).getAllByRole('cell')[3]).toHaveTextContent(/^—$/);
    expect(within(dimas).queryByRole('img')).not.toBeInTheDocument();
  });

  it('P13-T5 AC-4 each name is a link to the hire’s detail', async () => {
    show();
    const sari = within(await card('AAB: Sari Puspita'));
    expect(sari.getByRole('link', { name: 'Rina Wijaya' })).toHaveAttribute('href', '/new-hires/mem-rina');
  });

  it('P13-T5 AC-9 each table scrolls inside its card, at the prototype’s minimum width', async () => {
    show();
    const table = within(await card('Direct Unit')).getByRole('table');
    expect(table.className).toContain('min-w-[480px]');
    expect(table.parentElement?.className).toContain('overflow-x-auto');
  });

  it('P13-T5 AC-3 a reader who reaches no open activation meets an empty roster, not an error', async () => {
    show({ '/new-hires': notFound });
    expect(await screen.findByText('No one you lead is in their 90-day activation right now.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('P13-T5 AC-3 groups served empty are not drawn', async () => {
    show({ '/new-hires': { body: { ...ROSTER, groups: [{ kind: 'direct', leader: null, hires: [] }, ROSTER.groups[1]] } } });
    await card('AAB: Sari Puspita');
    expect(screen.queryByRole('region', { name: 'Direct Unit' })).not.toBeInTheDocument();
  });

  it('shows a skeleton while the roster is read', async () => {
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your new hires…');
    await card('Direct Unit');
  });

  it('a failed read says why, and Try again reads again', async () => {
    const { calls } = show({
      '/new-hires': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } },
        { body: ROSTER },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await card('Direct Unit');
    expect(calls.filter((c) => c.url.endsWith('/new-hires'))).toHaveLength(2);
  });

  it('P13-T5 AC-8 a read-only support session reads the roster: it has no write control to draw', async () => {
    show({}, readOnlySession(SARI_ME));
    await card('Direct Unit');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Indah Permata' })).toBeInTheDocument();
  });

  it('P13-T5 AC-8 is refused, with no read, to a reader without new_hires:read_roster', async () => {
    const { calls } = show({}, { ...SARI_ME, permissions: ['activation:read'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'new_hires:read_roster');
    expect(calls.some((c) => c.url.includes('/new-hires'))).toBe(false);
  });
});
