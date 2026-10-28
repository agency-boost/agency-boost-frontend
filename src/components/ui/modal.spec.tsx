import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Dialog } from './dialog';
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

  describe('its height, its foot and the page behind (P18.96-T1 AC-2)', () => {
    afterEach(() => {
      document.body.style.overflow = '';
    });

    it('P18.96-T1 AC-2 never taller than the dynamic viewport: the box scrolls inside, and hands nothing on to the page', () => {
      render(<Modal open title="Edit subscription" onClose={() => {}}><p>Fields</p></Modal>);
      const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
      expect(dialog).toHaveClass('max-h-[calc(100dvh-2.5rem)]', 'overflow-y-auto', 'overscroll-contain');
      // `vh` is the large viewport on a phone, taller than what shows while the browser's bar is out.
      expect(dialog.className).not.toContain('100vh');
    });

    it('P18.96-T1 AC-2 the title stays at the top as the content scrolls under it', () => {
      render(
        <Modal open title="Edit subscription" description="KPM 0417 · BSD" eyebrow={<span>Badge</span>} onClose={() => {}}>
          <p>Fields</p>
        </Modal>,
      );
      const head = screen.getByRole('heading', { name: 'Edit subscription' }).parentElement!;
      expect(head).toHaveAttribute('data-modal-head');
      expect(head).toHaveClass('sticky', 'top-0', 'bg-card');
      expect(head).toContainElement(screen.getByText('KPM 0417 · BSD'));
      expect(head).toContainElement(screen.getByText('Badge'));
      expect(head).not.toContainElement(screen.getByText('Fields'));
    });

    it('P18.96-T1 AC-2 a footer is held at the foot, after the content, on the card colour; a form’s submit still submits', async () => {
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <Modal
          open
          title="Edit subscription"
          onClose={() => {}}
          footer={<button type="submit" form="the-form">Save</button>}
        >
          <form id="the-form" onSubmit={onSubmit}><input aria-label="Price" /></form>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
      const save = screen.getByRole('button', { name: 'Save' });
      const foot = save.parentElement!;
      expect(foot).toHaveAttribute('data-modal-foot');
      expect(foot).toHaveClass('sticky', 'bottom-0', 'bg-card');
      expect(foot.parentElement).toBe(dialog);
      expect(dialog.lastElementChild).toBe(foot);
      // The foot holds the bottom padding, so nothing sits under it; the box itself has none.
      expect(foot).toHaveClass('pb-6');
      expect(dialog.className).not.toMatch(/(^|\s)pb-/);

      await userEvent.click(save);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);
    });

    it('P18.96-T1 AC-2 a sheet’s footer clears the home indicator; without one, the box keeps the padding', () => {
      const { unmount } = render(
        <Modal open placement="sheet" title="Edit Pak Budi" onClose={() => {}} footer={<button type="button">Close</button>}>
          <p>Remarks</p>
        </Modal>,
      );
      const foot = screen.getByRole('button', { name: 'Close' }).parentElement!;
      expect(foot.className).toContain('pb-[max(1.5rem,env(safe-area-inset-bottom))]');
      unmount();

      render(<Modal open placement="sheet" title="Edit Pak Budi" onClose={() => {}}><p>Remarks</p></Modal>);
      expect(screen.getByRole('dialog').className).toContain('pb-[max(1.5rem,env(safe-area-inset-bottom))]');
      expect(document.querySelector('[data-modal-foot]')).toBeNull();
    });

    it('P18.96-T1 AC-2 the page behind holds still while it is open, and gets its scroll back as it was', async () => {
      document.body.style.overflow = 'auto';
      render(<Harness />);
      expect(document.body.style.overflow).toBe('auto');
      await userEvent.click(screen.getByRole('button', { name: 'open it' }));
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.keyboard('{Escape}');
      expect(document.body.style.overflow).toBe('auto');
    });

    it('P18.96-T1 AC-2 a confirmation over an open Modal nests the lock: closing it leaves the page held', async () => {
      function Stack() {
        const [asking, setAsking] = useState(false);
        const [open, setOpen] = useState(true);
        return (
          <>
            <Modal open={open} title="Meeting details" onClose={() => setOpen(false)}>
              <button type="button" onClick={() => setAsking(true)}>Delete</button>
            </Modal>
            <Dialog
              open={asking}
              message="Delete this meeting?"
              confirmLabel="Delete meeting"
              onConfirm={() => setAsking(false)}
              onCancel={() => setAsking(false)}
            />
            <button type="button" onClick={() => setOpen(false)}>shut the modal</button>
          </>
        );
      }
      render(<Stack />);
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('dialog', { name: 'Delete this meeting?' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog', { name: 'Delete this meeting?' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
