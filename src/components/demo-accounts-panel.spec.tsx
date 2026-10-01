import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { DemoAccountsPanel } from './demo-accounts-panel';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

function inDevelopment() {
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
}

async function expand() {
  await userEvent.click(screen.getByRole('button', { name: /Show all \d+ accounts/ }));
}

describe('DemoAccountsPanel', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  });

  it('renders nothing in production', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { container } = render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders on staging, which runs against the same seeded tenant', () => {
    // Staging is tried by people who are not developers and has no other way in. It was
    // unreachable before: the list was gated on NODE_ENV, and `next build` sets that to
    // production for every deployment, staging included (ADR-0041).
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Development accounts' })).toBeInTheDocument();
  });

  it('renders nothing for an unrecognised environment — failing closed', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging-2';
    const { container } = render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the environment is unset — failing closed', () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { container } = render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts collapsed, so fifteen accounts do not push the form off the screen', () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: /Show all \d+ accounts/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('superadmin@agencyboost.test · demo super admin')).not.toBeInTheDocument();
  });

  it('lists each account with its credentials and where it lands', async () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    await expand();

    expect(screen.getByText('superadmin@agencyboost.test · demo super admin')).toBeInTheDocument();
    expect(screen.getByText(/platform console/)).toBeInTheDocument();
    expect(screen.getByText('rina@kpm0417.test · demo password rina')).toBeInTheDocument();
  });

  it('groups them by office, so it is obvious which two are different tenants', async () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    await expand();

    for (const label of ['Platform', 'KPM 0417 · BSD City Branch', 'KPM 0555 · Kelapa Gading Branch', 'Edge cases']) {
      expect(screen.getByRole('heading', { name: label, level: 3 })).toBeInTheDocument();
    }
  });

  it('offers the states a role alone cannot reach', async () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    await expand();

    expect(screen.getByText('Associate AB · leads nobody')).toBeInTheDocument();
    expect(screen.getByText('Waiting on a leader')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Office suspended')).toBeInTheDocument();
  });

  it('says where the accounts come from, so a mismatch is self-diagnosing', () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(screen.getByText(/pnpm seed:demo/)).toBeInTheDocument();
    // Staging shows it too (ADR-0041), and a staging tester reads this sentence.
    expect(screen.getByText(/development and staging only/)).toBeInTheDocument();
  });

  it('hands the whole account back on a choice', async () => {
    inDevelopment();
    const onChoose = vi.fn();
    render(<DemoAccountsPanel onChoose={onChoose} />);
    await expand();
    await userEvent.click(screen.getByRole('button', { name: /KPM Owner.*owner@kpm0417/s }));

    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@kpm0417.test', password: 'demo password 0417' }),
    );
  });

  it('locks while a sign-in is already in flight', async () => {
    inDevelopment();
    const onChoose = vi.fn();
    render(<DemoAccountsPanel onChoose={onChoose} disabled />);
    await expand();

    const account = screen.getByRole('button', { name: /Super Admin.*superadmin@/s });
    expect(account).toBeDisabled();
    await userEvent.click(account);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('has no axe violations, collapsed or expanded', async () => {
    inDevelopment();
    const { container } = render(
      // A heading needs something above it in the document order to be valid at h2.
      <div>
        <h1>AgencyBoost</h1>
        <DemoAccountsPanel onChoose={vi.fn()} />
      </div>,
    );
    const clean = async () =>
      expect(
        (await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? [],
      ).toHaveLength(0);

    await clean();
    await expand();
    await clean();
  });
});
