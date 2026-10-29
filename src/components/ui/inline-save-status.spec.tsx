import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useState } from 'react';
import { InLanguage } from '@test/harness';
import {
  INLINE_SAVE_COPY, INLINE_SAVED_MS, InlineSaveField, InlineSaveStatus, useInlineSave, type InlineSaveOutcome,
} from './inline-save-status';

/** A write the test answers when it chooses: `answer(true)`, `answer(false)`, `answer(null)`, or `fail()`. */
function controlled() {
  const sent: string[] = [];
  let settle: ((outcome: InlineSaveOutcome) => void) | null = null;
  let reject: ((error: Error) => void) | null = null;
  const send = (value: string) => () => new Promise<InlineSaveOutcome>((resolve, fail) => {
    sent.push(value);
    settle = resolve;
    reject = fail;
  });
  return {
    sent,
    send,
    answer: async (outcome: InlineSaveOutcome) => { await act(async () => { settle?.(outcome); }); },
    fail: async () => { await act(async () => { reject?.(new Error('network')); }); },
  };
}

/** One remark that saves as it is left, as a lead's cell does. */
function Remark({ write }: { write: ReturnType<typeof controlled> }) {
  const inline = useInlineSave();
  const [value, setValue] = useState('');
  return (
    <InlineSaveField status={inline.statusOf('remarks')} label="Remarks, row 1">
      <textarea
        aria-label="Remarks, row 1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void inline.save('remarks', write.send(value))}
      />
    </InlineSaveField>
  );
}

const field = () => screen.getByLabelText('Remarks, row 1');
const status = () => screen.queryByRole('status');
const leave = (text: string) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.blur(field());
};

/**
 * **A field that saves itself says so** (P18.95-T1 AC-5, AC-12; ADR-0167 §5; the client's UI review of 2026-10-26,
 * UI-007): idle, *Saving…*, *Saved ✓* for two seconds, *Couldn't save — retry*.
 */
describe('the inline save confirmation (P18.95-T1 AC-5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('P18.95-T1 AC-5: draws nothing, and no live region, while the field is idle', () => {
    render(<Remark write={controlled()} />);
    expect(status()).toBeNull();
  });

  it('P18.95-T1 AC-5: says Saving… as the field is left, then Saved ✓ for two seconds, then nothing', async () => {
    const write = controlled();
    render(<Remark write={write} />);

    leave('Call back Tuesday');
    expect(status()).toHaveTextContent(INLINE_SAVE_COPY.saving);
    expect(status()).toHaveTextContent('Saving…');
    expect(status()).toHaveAttribute('data-state', 'saving');
    expect(write.sent).toEqual(['Call back Tuesday']);

    await write.answer(true);
    expect(status()).toHaveTextContent('Saved ✓');
    expect(status()).toHaveClass('text-success');

    act(() => { vi.advanceTimersByTime(INLINE_SAVED_MS - 1); });
    expect(status()).toHaveTextContent('Saved ✓');
    act(() => { vi.advanceTimersByTime(1); });
    expect(status()).toBeNull();
    expect(INLINE_SAVED_MS).toBe(2000);
  });

  it('P18.95-T1 AC-5: says Couldn’t save — retry on a failure, which stays, and whose retry sends the same value again', async () => {
    const write = controlled();
    render(<Remark write={write} />);

    leave('Call back Tuesday');
    await write.answer(false);
    const retry = screen.getByRole('button', { name: "Couldn't save — retry: Remarks, row 1" });
    expect(retry).toHaveTextContent("Couldn't save — retry");
    expect(status()).toHaveClass('text-alert');
    act(() => { vi.advanceTimersByTime(INLINE_SAVED_MS * 5); });
    expect(status()).toHaveTextContent("Couldn't save — retry");

    // Typed over meanwhile, the box holds something else; the retry still sends what failed.
    fireEvent.change(field(), { target: { value: 'something else' } });
    fireEvent.click(retry);
    expect(write.sent).toEqual(['Call back Tuesday', 'Call back Tuesday']);
    expect(status()).toHaveTextContent('Saving…');
    // The button that was pressed has gone; the focus is back in the field it retried.
    expect(field()).toHaveFocus();

    await write.answer(true);
    expect(status()).toHaveTextContent('Saved ✓');
  });

  it('P18.95-T1 AC-5: a thrown write is a failure like a refused one', async () => {
    const write = controlled();
    render(<Remark write={write} />);
    leave('x');
    await write.fail();
    expect(screen.getByRole('button', { name: /^Couldn't save — retry/ })).toBeInTheDocument();
  });

  it('P18.95-T1 AC-5: goes back to nothing when there is nothing left to retry', async () => {
    const write = controlled();
    render(<Remark write={write} />);
    leave('x');
    await write.answer(null);
    expect(status()).toBeNull();
  });

  it('P18.95-T1 AC-5: shows the latest save of a field, and drops an earlier one’s late answer', async () => {
    const answers: ((outcome: InlineSaveOutcome) => void)[] = [];
    function Twice() {
      const inline = useInlineSave();
      const send = () => new Promise<InlineSaveOutcome>((resolve) => { answers.push(resolve); });
      return (
        <>
          <button type="button" onClick={() => void inline.save('k', send)}>save</button>
          <InlineSaveStatus {...inline.statusOf('k')} />
        </>
      );
    }
    render(<Twice />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await act(async () => { answers[0](false); });
    expect(status()).toHaveTextContent('Saving…');
    await act(async () => { answers[1](true); });
    expect(status()).toHaveTextContent('Saved ✓');
  });

  it('P18.95-T1 AC-5: a cleared field drops its status and an answer still on its way', async () => {
    let answer!: (outcome: InlineSaveOutcome) => void;
    function Cleared() {
      const inline = useInlineSave();
      return (
        <>
          <button type="button" onClick={() => void inline.save('k', () => new Promise((r) => { answer = r; }))}>save</button>
          <button type="button" onClick={() => inline.clear('k')}>clear</button>
          <InlineSaveStatus {...inline.statusOf('k')} />
        </>
      );
    }
    render(<Cleared />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(status()).toBeNull();
    await act(async () => { answer(false); });
    expect(status()).toBeNull();
  });

  it('P18.95-T1 AC-5: a failure with no retry says Couldn’t save, with nothing to press', () => {
    render(<InlineSaveStatus state="failed" />);
    expect(status()).toHaveTextContent("Couldn't save");
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('P18.95-T1 AC-5: mounts its polite region before its words, so the first state is announced', () => {
    const { rerender } = render(<InlineSaveStatus state="idle" />);
    rerender(<InlineSaveStatus state="saving" />);
    // `render` flushes the effect that puts the words in; the region and its words are one node.
    expect(status()).toHaveTextContent('Saving…');
    expect(status()!.getAttribute('role')).toBe('status');
  });

  it('P18.95-T1 AC-5: stops its clock when the screen goes', async () => {
    const write = controlled();
    const { unmount } = render(<Remark write={write} />);
    leave('x');
    await write.answer(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('P18.95-T1 AC-5: passes axe in each state', async () => {
    vi.useRealTimers();
    for (const state of ['saving', 'saved', 'failed'] as const) {
      const { container, unmount } = render(
        <InlineSaveField status={{ state, onRetry: () => undefined }} label="Remarks, row 1">
          <textarea aria-label="Remarks, row 1" />
        </InlineSaveField>,
      );
      const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);
      unmount();
    }
  });
});

/**
 * **P18.98-T2: its words are the catalogue's** (`messages/inline-save.ts`, the approved glossary's §B.2), moved with
 * *Language* on *Your account*, which saves itself this way and changes the language as it does. English is unchanged;
 * in Indonesian, *Menyimpan…*, *Tersimpan ✓* and *Gagal menyimpan — coba lagi*.
 */
describe('P18.98-T2 the inline save in each language', () => {
  it('AC-4 keeps its English as it was', () => {
    expect(INLINE_SAVE_COPY).toMatchObject({
      saving: 'Saving…', saved: 'Saved ✓', failed: "Couldn't save — retry", failedFinal: "Couldn't save",
    });
  });

  it.each([
    ['saving', 'Menyimpan…'],
    ['saved', 'Tersimpan ✓'],
  ] as const)('AC-4 says %s in Indonesian: %s', (state, words) => {
    render(<InLanguage language="id"><InlineSaveStatus state={state} /></InLanguage>);
    expect(screen.getByRole('status')).toHaveTextContent(words);
  });

  it('AC-4 offers the retry in Indonesian, named for its field', () => {
    render(<InLanguage language="id"><InlineSaveStatus state="failed" onRetry={vi.fn()} label="Bahasa" /></InLanguage>);
    expect(screen.getByRole('button', { name: 'Gagal menyimpan — coba lagi: Bahasa' })).toHaveTextContent('Gagal menyimpan — coba lagi');
  });

  it('AC-4 says a failure with nothing to retry in Indonesian', () => {
    render(<InLanguage language="id"><InlineSaveStatus state="failed" /></InLanguage>);
    expect(screen.getByRole('status')).toHaveTextContent('Gagal menyimpan');
  });
});
