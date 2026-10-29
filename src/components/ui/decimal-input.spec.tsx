import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserChose, InLanguage, resetLanguage } from '@test/harness';
import { LanguageProvider } from '@/i18n/language-provider';
import { DecimalInput } from './decimal-input';

/** P18.95-T1 AC-3 (ADR-0167 §1): a decimal typed with a comma or a point. */
describe('DecimalInput', () => {
  function Harness({ initial = null as number | null, onValue = (_: number | null) => {} }) {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <>
        <label htmlFor="d">Closing rate</label>
        <DecimalInput id="d" value={value} onValueChange={(v) => { setValue(v); onValue(v); }} suffix="%" />
        <output>{value === null ? 'empty' : String(value)}</output>
        <button type="button" onClick={() => setValue(42.5)}>Reset</button>
      </>
    );
  }

  it('is text with the decimal keypad, so a comma can be typed at all', () => {
    render(<Harness initial={30} />);
    const field = screen.getByLabelText('Closing rate');
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    expect(field).toHaveValue('30');
  });

  it('reads a comma or a point as the decimal, and keeps what was typed while it is typed', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.type(field, '27,5');
    expect(field).toHaveValue('27,5');
    expect(screen.getByRole('status')).toHaveTextContent('27.5');
    // *27,* on its way to *27,5* was read as 27 and stayed on screen as typed.
    expect(onValue).toHaveBeenCalledWith(27);
    await userEvent.clear(field);
    await userEvent.type(field, '33.5');
    expect(screen.getByRole('status')).toHaveTextContent('33.5');
  });

  it('reports an emptied box as null, and keeps no character a decimal cannot hold', async () => {
    render(<Harness initial={30} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.clear(field);
    expect(screen.getByRole('status')).toHaveTextContent('empty');
    await userEvent.type(field, '1a2');
    expect(field).toHaveValue('12');
  });

  it('leaves the value alone while the text is not a number yet', async () => {
    const onValue = vi.fn();
    render(<Harness initial={5} onValue={onValue} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.type(field, ',2,');
    expect(field).toHaveValue('5,2,');
    expect(onValue).not.toHaveBeenCalledWith(Number.NaN);
    expect(screen.getByRole('status')).toHaveTextContent('5.2');
  });

  it('P18.98-T3 AC-3 writes a value set from outside in the reader’s mark: a point in English, the specs’ default', async () => {
    render(<Harness initial={3.1} />);
    expect(screen.getByLabelText('Closing rate')).toHaveValue('3.1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('Closing rate')).toHaveValue('42.5');
  });

  it('P18.98-T3 AC-3 writes a value set from outside with a comma in Indonesian, as before', async () => {
    render(<InLanguage language="id"><Harness initial={3.1} /></InLanguage>);
    expect(screen.getByLabelText('Closing rate')).toHaveValue('3,1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('Closing rate')).toHaveValue('42,5');
  });

  it.each(['id', 'en'] as const)('P18.98-T3 AC-3 reads a comma and a point alike in %s, keeping what was typed', async (language) => {
    const onValue = vi.fn();
    render(<InLanguage language={language}><Harness onValue={onValue} /></InLanguage>);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.type(field, '17,6');
    expect(field).toHaveValue('17,6');
    expect(onValue).toHaveBeenLastCalledWith(17.6);
    await userEvent.clear(field);
    await userEvent.type(field, '17.6');
    expect(field).toHaveValue('17.6');
    expect(onValue).toHaveBeenLastCalledWith(17.6);
  });
});

/**
 * **P18.98-T3 figures: a value set from outside in the figures' mark** — the reader's chosen language, and Indonesian
 * with no choice, whether or not the switch is live (`useFigureLanguage`). Until it is, a reader with no choice sees
 * *3,1* in a field whose label is English, as before T3. Under the app's own provider.
 */
describe('P18.98-T3 figures DecimalInput', () => {
  afterEach(() => resetLanguage());

  function Rate() {
    const [value, setValue] = useState<number | null>(3.1);
    return (
      <>
        <label htmlFor="r">Closing rate</label>
        <DecimalInput id="r" value={value} onValueChange={setValue} suffix="%" />
        <button type="button" onClick={() => setValue(42.5)}>Reset</button>
      </>
    );
  }

  /**
   * The field mounted once the page is up, as a screen's field mounts: behind the session, after the provider's first
   * commit has read the browser's choice. The box keeps the text it was first written in (a change of language leaves
   * it alone), so it is never mounted in the provider's own first frame.
   */
  function open(live: boolean) {
    const { rerender } = render(<LanguageProvider live={live}>{null}</LanguageProvider>);
    rerender(<LanguageProvider live={live}><Rate /></LanguageProvider>);
    return screen.getByLabelText('Closing rate');
  }

  it('P18.98-T3 figures, unchosen and not live: 3,1 and 42,5 with a comma, under an English label', async () => {
    const field = open(false);
    expect(field).toHaveValue('3,1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(field).toHaveValue('42,5');
  });

  it('P18.98-T3 figures, chosen English by the browser, not live: 3.1 and 42.5 with a point', async () => {
    browserChose('en');
    const field = open(false);
    expect(field).toHaveValue('3.1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(field).toHaveValue('42.5');
  });

  it('P18.98-T3 figures, chosen Indonesian by the browser, not live: 3,1', () => {
    browserChose('id');
    expect(open(false)).toHaveValue('3,1');
  });

  it('P18.98-T3 figures, live and unchosen: 3,1, in a screen whose language is Indonesian', () => {
    expect(open(true)).toHaveValue('3,1');
    expect(document.documentElement.lang).toBe('id');
  });
});
