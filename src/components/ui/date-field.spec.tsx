import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATE_FIELD_EMPTY, DateField } from './date-field';
import { Field } from './field';

/** The face — what a reader sees — of the field labelled `label`. */
const faceOf = (label: string) => screen.getByLabelText(label).nextElementSibling as HTMLElement;

function Controlled({ initial = '', onChange, ...props }: { initial?: string } & Partial<React.ComponentProps<typeof DateField>>) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Join date" htmlFor="jd">
      <DateField {...props} id="jd" value={value} onChange={(next) => { setValue(next); onChange?.(next); }} />
    </Field>
  );
}

describe('DateField (P18.96-T2 AC-4)', () => {
  afterEach(() => {
    delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
  });

  it('P18.96-T2 AC-4 shows the date as the app writes it — 22 Jul 2026 — never the browser’s mm/dd/yyyy', () => {
    render(<Controlled initial="2026-07-22" />);
    const face = faceOf('Join date');
    expect(face).toHaveTextContent('22 Jul 2026');
    expect(face).toHaveAttribute('aria-hidden', 'true');
    expect(face.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    // Indonesian months, as every date the app writes (ADR-0167 §1).
    render(<Field label="Other" htmlFor="o"><DateField id="o" value="2026-10-05" onChange={() => undefined} /></Field>);
    expect(faceOf('Other')).toHaveTextContent('5 Okt 2026');
  });

  it('P18.96-T2 AC-4 the native field is the control: labelled, typed date, holding the office date as YYYY-MM-DD', () => {
    render(<Controlled initial="2026-07-22" />);
    const field = screen.getByLabelText('Join date');
    expect(field.tagName).toBe('INPUT');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveValue('2026-07-22');
  });

  it('P18.96-T2 AC-4 says *Choose a date* when empty; a table cell says nothing', () => {
    render(<Controlled />);
    expect(faceOf('Join date')).toHaveTextContent(DATE_FIELD_EMPTY);
    render(<DateField aria-label="Next action date" density="cell" value={null} onChange={() => undefined} />);
    expect(faceOf('Next action date').textContent).toBe('');
  });

  it('P18.96-T2 AC-4 waits for a whole year before it prints one: a year still being typed is not a date', () => {
    render(<Controlled initial="0002-08-01" />);
    expect(faceOf('Join date')).toHaveTextContent(DATE_FIELD_EMPTY);
  });

  it('P18.96-T2 AC-4 a click opens the device’s picker', async () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    render(<Controlled initial="2026-07-22" />);
    await userEvent.click(screen.getByLabelText('Join date'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('P18.96-T2 AC-4 falls back to the focused field where there is no picker to show', async () => {
    // jsdom has no `showPicker`: the refusal is caught, and the field keeps the focus to take digits.
    render(<Controlled initial="2026-07-22" />);
    await userEvent.click(screen.getByLabelText('Join date'));
    expect(screen.getByLabelText('Join date')).toHaveFocus();
  });

  it('P18.96-T2 AC-4 is reached by Tab, and Enter, Space or Alt+↓ open the picker without submitting the form', async () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Controlled initial="2026-07-22" /></form>);
    await userEvent.tab();
    expect(screen.getByLabelText('Join date')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(showPicker).toHaveBeenCalledTimes(3);
    expect(onSubmit).not.toHaveBeenCalled();
    // The focus ring is drawn on the face, from the field's own focus.
    expect(faceOf('Join date').className).toContain('peer-focus-visible:outline-amber');
  });

  it('P18.96-T2 AC-4 passes min and max to the picker', () => {
    render(<Controlled initial="2026-07-22" min="2025-10-27" max="2026-10-27" />);
    const field = screen.getByLabelText('Join date');
    expect(field).toHaveAttribute('min', '2025-10-27');
    expect(field).toHaveAttribute('max', '2026-10-27');
  });

  it('P18.96-T2 AC-4 answers the date chosen as YYYY-MM-DD, and the face follows', () => {
    const onChange = vi.fn();
    render(<Controlled initial="2026-07-22" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Join date'), { target: { value: '2026-08-03' } });
    expect(onChange).toHaveBeenCalledWith('2026-08-03');
    expect(faceOf('Join date')).toHaveTextContent('3 Agu 2026');
    // The picker's *Clear* empties it.
    fireEvent.change(screen.getByLabelText('Join date'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(faceOf('Join date')).toHaveTextContent(DATE_FIELD_EMPTY);
  });

  it('P18.96-T2 AC-4 a read-only or disabled field opens nothing, and looks it', async () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    render(
      <>
        <DateField aria-label="Locked" value="2026-07-22" readOnly onChange={() => undefined} />
        <DateField aria-label="Off" value="2026-07-22" disabled onChange={() => undefined} />
      </>,
    );
    await userEvent.click(screen.getByLabelText('Locked'));
    expect(showPicker).not.toHaveBeenCalled();
    expect(faceOf('Off').className).toContain('text-muted');
  });

  it('P18.96-T2 AC-4 carries a field’s hint and error to the control, and marks it invalid', () => {
    render(
      <Field label="Starts" htmlFor="s" hint="From a 1st." error="Choose a start.">
        <DateField id="s" value="" invalid onChange={() => undefined} />
      </Field>,
    );
    const field = screen.getByLabelText('Starts');
    expect(field).toHaveAttribute('aria-describedby', 's-hint s-error');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(faceOf('Starts').className).toContain('border-alert');
  });

  it('P18.96-T2 AC-4 reads 16px on a phone, as every field does (UI-014)', () => {
    render(<Controlled initial="2026-07-22" />);
    expect(faceOf('Join date').className).toContain('max-md:text-lg');
  });
});

/**
 * The structural half of "no screen shows mm/dd/yyyy" (P18.96-T2 AC-4): a native date input writes its value in the
 * browser's locale, so none is drawn outside the shared field — read from the source, as `password-input.spec.tsx`
 * reads it for passwords.
 */
describe('every date field goes through DateField', () => {
  const SRC = join(__dirname, '../..');
  const files = readdirSync(SRC, { encoding: 'utf8', recursive: true })
    .filter((f) => f.endsWith('.tsx') && !f.includes('.spec.'))
    .map((f) => join(SRC, f));

  it('finds the screens at all, so a silent zero cannot pass', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('P18.96-T2 AC-4 no screen declares type="date" itself', () => {
    const offenders = files
      .filter((f) => !f.endsWith(join('ui', 'date-field.tsx')))
      .filter((f) => /type=["']date["']|type:\s*["']date["']/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });
});
