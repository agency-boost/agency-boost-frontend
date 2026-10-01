import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './field';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('starts masked, and the toggle says what pressing it will do', () => {
    render(
      <Field label="Password" htmlFor="p">
        <PasswordInput id="p" defaultValue="correct horse battery" />
      </Field>,
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // The visible word is contained in the accessible name (WCAG 2.5.3), so a person
    // reading the screen and a person hearing it are told the same thing.
    expect(toggle).toHaveTextContent('Show');
  });

  it('reveals the value, and says so both ways', async () => {
    render(
      <Field label="Password" htmlFor="p">
        <PasswordInput id="p" defaultValue="correct horse battery" />
      </Field>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    const toggle = screen.getByRole('button', { name: 'Hide password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('Hide');
  });

  it('does not submit the form it sits in', async () => {
    // A `<button>` with no `type` submits. On the sign-in page that would reveal the
    // password *and* attempt to log in, which is the worst of both.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Field label="Password" htmlFor="p"><PasswordInput id="p" /></Field>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is reachable by keyboard, because it is a real button', async () => {
    render(
      <Field label="Password" htmlFor="p"><PasswordInput id="p" /></Field>,
    );
    await userEvent.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('keeps each field to itself', async () => {
    // Revealing your current password must not also reveal the new one two boxes down.
    render(
      <>
        <Field label="Current" htmlFor="a"><PasswordInput id="a" /></Field>
        <Field label="New" htmlFor="b"><PasswordInput id="b" /></Field>
      </>,
    );
    const [first] = screen.getAllByRole('button', { name: 'Show password' });
    await userEvent.click(first);

    expect(screen.getByLabelText('Current')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('New')).toHaveAttribute('type', 'password');
  });
});

/**
 * The structural half of "every password field has a toggle".
 *
 * The behaviour above proves the component works; nothing in it stops the next screen
 * writing `<TextInput type="password">` and quietly having no toggle at all. That is how
 * six of them came to exist. This reads the source, in the same spirit as the backend's
 * `raw-writes.tenancy.spec.ts`: the guarantee is about how the field is *written*.
 */
describe('every password field goes through PasswordInput', () => {
  const SRC = join(__dirname, '../..');
  // `readdirSync(…, { recursive })`, not `globSync`: CI runs Node 20, and `globSync` is Node 22's.
  const files = readdirSync(SRC, { encoding: 'utf8', recursive: true })
    .filter((f) => f.endsWith('.tsx') && !f.includes('.spec.'))
    .map((f) => join(SRC, f));

  it('finds the screens at all, so a silent zero cannot pass', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no screen declares type="password" itself', () => {
    const offenders = files
      .filter((f) => !f.endsWith('password-input.tsx'))
      .filter((f) => /type=["']password["']/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));

    expect(offenders).toEqual([]);
  });
});
