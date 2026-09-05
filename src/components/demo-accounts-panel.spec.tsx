import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { DemoAccountsPanel } from './demo-accounts-panel';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

function inDevelopment() {
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
}

describe('DemoAccountsPanel', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  });

  it('renders nothing outside development', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { container } = render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the environment is unset — failing closed', () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { container } = render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each account with its credentials and where it lands', () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('Super Admin');
    expect(buttons[0]).toHaveTextContent('superadmin@agencyboost.test · demo super admin');
    expect(buttons[0]).toHaveTextContent('platform console');
    expect(buttons[2]).toHaveTextContent('no office yet');
  });

  it('says where the accounts come from, so a mismatch is self-diagnosing', () => {
    inDevelopment();
    render(<DemoAccountsPanel onChoose={vi.fn()} />);
    expect(screen.getByText(/pnpm seed:demo/)).toBeInTheDocument();
    expect(screen.getByText(/development only/)).toBeInTheDocument();
  });

  it('hands the whole account back on a choice', () => {
    inDevelopment();
    const onChoose = vi.fn();
    render(<DemoAccountsPanel onChoose={onChoose} />);
    void userEvent.click(screen.getByRole('button', { name: /KPM Owner/ }));
    return vi.waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'owner@kpm0417.test', password: 'demo password 0417' }),
      ),
    );
  });

  it('locks while a sign-in is already in flight', async () => {
    inDevelopment();
    const onChoose = vi.fn();
    render(<DemoAccountsPanel onChoose={onChoose} disabled />);

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('has no axe violations, and is a labelled region rather than loose text', async () => {
    inDevelopment();
    const { container } = render(
      // A heading needs something above it in the document order to be valid at h2.
      <div>
        <h1>AgencyBoost</h1>
        <DemoAccountsPanel onChoose={vi.fn()} />
      </div>,
    );
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toHaveLength(0);
  });
});
