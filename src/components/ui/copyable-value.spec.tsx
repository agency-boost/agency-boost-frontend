import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyableValue } from './copyable-value';

describe('CopyableValue', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the value it will copy, in full', () => {
    // The prototype shows a truncated string and copies a different, longer one — the
    // truncation is literal markup, so what you read is not what you get.
    const url = 'https://agencyboost.app/join?code=JOR417';
    render(<CopyableValue label="Invite link" value={url} copied="Link copied ✓" />);
    expect(screen.getByText(url)).toBeInTheDocument();
  });

  it('copies exactly that value', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<CopyableValue label="Leader code" value="JOR417" mono copied="Code copied ✓" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('JOR417');
    expect(await screen.findByText('Copied.')).toHaveAttribute('role', 'status');
  });

  it('P18.95-T1 AC-6: toasts the caller’s words once the copy has worked, and nothing when it has not', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } });
    const { unmount } = render(<CopyableValue label="Leader code" value="JOR417" mono copied="Code copied ✓" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect((await screen.findByText('Code copied ✓')).closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    unmount();

    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
    render(<CopyableValue label="Leader code" value="JOR417" mono copied="Code copied ✓" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
    expect(screen.queryByText('Code copied ✓')).not.toBeInTheDocument();
  });

  it('says it failed instead of claiming success', async () => {
    // The prototype swallows the rejection and shows the toast anyway, so somebody
    // pastes nothing having been told it worked.
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
    });

    render(<CopyableValue label="Leader code" value="JOR417" copied="Code copied ✓" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(/Could not copy/)).toHaveAttribute('role', 'status');
  });

  it('says so when there is no clipboard at all', async () => {
    // Absent in an insecure context and in some in-app browsers — which is exactly where
    // a field team reads this.
    vi.stubGlobal('navigator', {});
    render(<CopyableValue label="Leader code" value="JOR417" copied="Code copied ✓" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(/select the text above/)).toHaveAttribute('role', 'status');
  });
});
