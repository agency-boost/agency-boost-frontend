import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Modal } from './modal';

function Harness({ onClose = vi.fn(), focusLast = false, focusDialog = false }: { onClose?: () => void; focusLast?: boolean; focusDialog?: boolean }) {
  const [open, setOpen] = useState(false);
  const last = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open it</button>
      <Modal
        open={open}
        title="Rina Wijaya — Activity Dashboard"
        description="Last 7 days · category breakdown"
        initialFocus={focusLast ? last : undefined}
        focusDialog={focusDialog}
        onClose={() => { onClose(); setOpen(false); }}
      >
        <input aria-label="first field" />
        <button type="button" ref={last}>Close</button>
      </Modal>
    </>
  );
}

/**
 * The titled dialog with content (P11-T8 AC-6, AC-10): the Activity drill and *Edit again*'s reason.
 * Named by its title and described by its line, focus in, held, and returned.
 */
describe('Modal (P11-T8)', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is named by its title, described by its line, and takes the focus to its first control', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'open it' }));

    const dialog = screen.getByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Last 7 days · category breakdown');
    expect(screen.getByLabelText('first field')).toHaveFocus();
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('starts on the control it is told to', async () => {
    render(<Harness focusLast />);
    await userEvent.click(screen.getByRole('button', { name: 'open it' }));
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('starts on the box itself when it is read rather than filled in, so it opens at its title', async () => {
    render(<Harness focusDialog />);
    await userEvent.click(screen.getByRole('button', { name: 'open it' }));
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('holds Tab inside, both ways', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'open it' }));

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('first field')).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('closes on Escape and on the backdrop, not on a click inside, and gives the focus back', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'open it' });
    await userEvent.click(opener);

    await userEvent.click(screen.getByText('Last 7 days · category breakdown'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('draws an eyebrow above its title, outside its name — the calendar detail’s badge (P12-T2 AC-7)', () => {
    render(
      <Modal open title="Weekly unit standup" eyebrow={<span>Meeting</span>} onClose={() => {}}>
        <p>When</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
    const [badge, title] = [screen.getByText('Meeting'), screen.getByRole('heading', { name: 'Weekly unit standup' })];
    expect(dialog).toContainElement(badge);
    expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P18.95-T4 AC-1: rises from the foot of the screen as a sheet, with the same manners as the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal open placement="sheet" title="Edit Pak Budi" focusDialog onClose={onClose}>
        <input aria-label="Remarks" />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit Pak Budi' });

    // The full width, anchored to the foot, its top corners rounded and clear of the home indicator.
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'sheet');
    expect(dialog.parentElement!.className).toContain('items-end');
    expect(dialog.className).toContain('rounded-t-lg');
    expect(dialog.className).toContain('max-h-[90dvh]');
    expect(dialog.className).not.toContain('max-w-[26rem]');
    expect(dialog).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('P18.95-T4: keeps the centred box by default', () => {
    render(<Modal open title="Edit again" onClose={() => {}}><p>Why</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Edit again' });
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'center');
    expect(dialog.className).toContain('max-w-[26rem]');
    expect(dialog.className).toContain('rounded-lg');
  });
});
