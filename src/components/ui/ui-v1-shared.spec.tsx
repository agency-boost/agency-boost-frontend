import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, renderInIndonesian } from '@test/harness';
import { ActionMenu } from './action-menu';
import { ActionRow, actionDay } from './action-row';
import { ActivityPill } from './activity-pill';
import { AutoMarker } from './auto-marker';
import { destructiveLast, useDestructiveAction } from './destructive-action';
import { EmptyState } from './empty-state';
import { Avatar, AVATAR_MIN_TEXT_PX, initialsFor, PersonRow, tintFor, TreeIndent, TreeNode, TreeToggle } from './person-row';
import { CenterPopup, ResponsiveSheet } from './responsive-sheet';
import { FloatingSavePill, LeaveGuard, sameValue, SaveStateLabel, useSaveState } from './save-state';
import { SliderWithValue } from './slider-with-value';
import { StatTile } from './stat-tile';
import { StepperRow } from './stepper-row';
import { TonePill } from './tone-pill';

afterEach(() => vi.unstubAllGlobals());

describe('ResponsiveSheet (UI V1, UI-011 / UI-035; D-01)', () => {
  function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <ResponsiveSheet
        open={open}
        title="Isi nomor WhatsApp"
        description="Ibu Melati"
        onClose={() => { onClose(); setOpen(false); }}
        footer={<button type="button">Simpan</button>}
      >
        <input aria-label="Nomor" />
      </ResponsiveSheet>
    );
  }

  it('UI-011 a bottom sheet below 1024px and a ~560px centred modal from it, one box, the width deciding', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Isi nomor WhatsApp' });
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'responsive');
    expect(dialog.parentElement!.className).toContain('max-lg:items-end');
    expect(dialog.parentElement!.className).toContain('lg:items-center');
    expect(dialog.className).toContain('max-lg:max-h-[90dvh]');
    expect(dialog.className).toContain('max-lg:rounded-t-lg');
    expect(dialog.className).toContain('lg:max-w-[35rem]');
  });

  it('UI-011 a drag handle on the sheet only, and a ✕ of 44px that closes it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(document.querySelector('[data-modal-handle]')).toHaveClass('lg:hidden');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('h-11', 'w-11');
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UI-011 a swipe down from the head closes it; a short pull springs back', () => {
    // jsdom has no PointerEvent, so a pointer event would carry no `clientY`: a mouse event's shape stands in.
    if (!('PointerEvent' in window)) Object.assign(window, { PointerEvent: class extends MouseEvent {} });
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const head = document.querySelector('[data-modal-head]')!;
    fireEvent.pointerDown(head, { clientY: 100 });
    fireEvent.pointerMove(head, { clientY: 120 });
    expect((screen.getByRole('dialog') as HTMLElement).style.transform).toBe('translateY(20px)');
    fireEvent.pointerUp(head, { clientY: 120 });
    expect((screen.getByRole('dialog') as HTMLElement).style.transform).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(head, { clientY: 100 });
    fireEvent.pointerUp(head, { clientY: 260 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UI-011 a swipe does not close it on a desktop, where it is a modal', () => {
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: q === '(min-width: 1024px)', media: q })));
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const head = document.querySelector('[data-modal-head]')!;
    fireEvent.pointerDown(head, { clientY: 100 });
    fireEvent.pointerUp(head, { clientY: 400 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('D-01 the main action pinned at the foot, clear of the home indicator on a sheet; Escape and the backdrop close', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const foot = document.querySelector('[data-modal-foot]')!;
    expect(foot.className).toContain('sticky');
    expect(foot.className).toContain('max-lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UI-011 in Indonesian, the ✕ is "Tutup"', () => {
    renderInIndonesian(<Harness />);
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
  });
});

describe('CenterPopup (UI V1, UI-104 the Tugas popup)', () => {
  it('UI-104 centred at every width, 16px from the edges, at most 60% tall and scrolling inside; ✕ and outside close', async () => {
    const onClose = vi.fn();
    render(<CenterPopup open title="Tugas · Jum, 31 Okt (3)" onClose={onClose}><p>row</p></CenterPopup>);
    const dialog = screen.getByRole('dialog', { name: 'Tugas · Jum, 31 Okt (3)' });
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'popup');
    expect(dialog.parentElement!.className).toContain('items-center');
    expect(dialog.parentElement!.className).toContain('p-4');
    expect(dialog.className).toContain('max-h-[60dvh]');
    expect(dialog.className).toContain('overflow-y-auto');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('PersonRow, Avatar, TreeToggle, TreeIndent (UI V1, UI-059 / UI-073; D-05, D-09)', () => {
  it('UI-059 the whole row is the link, named by the person; NAME in capitals; meta under it; › on a tappable row', () => {
    render(<PersonRow name="Indah Permatasari" href="/coaching/m-1/summary" meta="Agent" chevron />);
    const link = screen.getByRole('link', { name: 'Indah Permatasari' });
    expect(link).toHaveAttribute('href', '/coaching/m-1/summary');
    expect(link.className).toContain('after:inset-0');
    expect(link).toHaveClass('uppercase', 'font-bold', 'truncate');
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(document.querySelector('[data-person-row] svg:last-child')).not.toBeNull();
  });

  it('UI-008 an avatar’s initials are never under 12px, however small the circle', () => {
    const { container } = render(<><Avatar name="Wilson Tanoto" seed="m1" size={24} /><Avatar name="Agus Prasetyo" seed="m2" size={44} /></>);
    const [small, large] = [...container.querySelectorAll('span')].filter((el) => /^[A-Z]{2}$/.test(el.textContent ?? ''));
    expect(small.style.fontSize).toBe(`${AVATAR_MIN_TEXT_PX}px`);
    expect(large.style.fontSize).toBe('16px');
  });

  it('UI-059 a trailing control is its own target, above the row, never inside the link', async () => {
    const onSelect = vi.fn();
    const onWa = vi.fn();
    render(<PersonRow name="Siti" onSelect={onSelect} trailing={<button type="button" onClick={onWa}>WA</button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'WA' }));
    expect(onWa).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'WA' }).closest('a')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Siti' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('UI-059 the upline is muted, 48px, its avatar at 60% — and never a link', () => {
    render(<PersonRow name="Wilson Tanoto" tone="muted" meta="AB · Leader Anda" href="/somewhere" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const row = document.querySelector('[data-person-row]')!;
    expect(row).toHaveClass('border', 'border-line', 'min-h-12');
    expect(row.querySelector('[aria-hidden="true"]')).toHaveClass('opacity-60');
  });

  it('UI-059 the reader’s own row navy with white words; an AAB tinted; an agent white with the desktop hover', () => {
    const { rerender } = render(<PersonRow name="Agus" tone="self" href="/unit/dashboard" />);
    expect(document.querySelector('[data-person-row]')).toHaveClass('bg-navy');
    expect(screen.getByRole('link')).toHaveClass('text-white');
    rerender(<PersonRow name="Sari" tone="tinted" href="/x" />);
    expect(document.querySelector('[data-person-row]')!.className).toContain('bg-amber/[0.12]');
    rerender(<PersonRow name="Dimas" href="/x" />);
    expect(document.querySelector('[data-person-row]')).toHaveClass('bg-card', 'lg:hover:bg-hover-row');
  });

  it('UI-059 the photo when there is one; initials on a tint that stays the person’s when it fails or is absent', () => {
    const { rerender } = render(<Avatar name="Agus Prasetyo" photoUrl="/p.jpg" />);
    const img = document.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/p.jpg');
    fireEvent.error(img);
    expect(screen.getByText('AP')).toBeInTheDocument();
    rerender(<Avatar name="Agus Prasetyo" seed="m-1" />);
    expect(screen.getByText('AP').className).toContain(tintFor('m-1').split(' ')[0]);
    expect(tintFor('m-1')).toBe(tintFor('m-1'));
    expect(initialsFor('Ki Hajar Dewantara')).toBe('KD');
    expect(initialsFor('Dewi')).toBe('D');
  });

  it('UI-073 the ⌄ at the right toggles the team and never opens the person; ⌄ closed, ⌃ open; named for whose team', async () => {
    const onSelect = vi.fn();
    function Tree() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <PersonRow
            name="Sari Puspita"
            onSelect={onSelect}
            trailing={<TreeToggle name="Sari Puspita" open={open} onToggle={() => setOpen(!open)} controls="team-sari" />}
          />
          {open && (
            <TreeIndent id="team-sari" label="Tim Sari Puspita">
              <TreeNode><PersonRow name="Rina" href="/r" /></TreeNode>
              <TreeNode><PersonRow name="Budi" href="/b" /></TreeNode>
            </TreeIndent>
          )}
        </>
      );
    }
    render(<Tree />);
    const toggle = screen.getByRole('button', { name: 'Show Sari Puspita’s team' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('h-11', 'w-11', 'md:max-lg:h-12', 'lg:h-8');
    await userEvent.click(toggle);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hide Sari Puspita’s team' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list', { name: 'Tim Sari Puspita' })).toHaveAttribute('id', 'team-sari');
  });

  it('UI-073 36px a level with a 2px line in the tree colour, and an elbow into every child (└ for the last)', () => {
    render(
      <TreeIndent>
        <TreeNode>a</TreeNode>
        <TreeNode>b</TreeNode>
      </TreeIndent>,
    );
    const list = document.querySelector('ul')!;
    // 17 + 19 = 36px from the parent's edge.
    expect(list).toHaveClass('ml-[17px]', 'pl-[19px]');
    const node = document.querySelector('[data-tree-node]')!;
    expect(node.className).toContain('before:w-0.5');
    expect(node.className).toContain('before:bg-line');
    expect(node.className).toContain('after:bg-line');
    expect(node.className).toContain('last:before:bottom-auto');
  });
});

describe('TonePill and ActivityPill (UI V1, UI-005, UI-059, UI-101; D-27)', () => {
  it('UI-005 four tinted tones with their words, never a dot', () => {
    render(
      <>
        <TonePill tone="red">Perlu perhatian</TonePill>
        <TonePill tone="amber">Perlu dipantau</TonePill>
        <TonePill tone="green">Sesuai target</TonePill>
        <TonePill tone="grey">Goal belum diatur</TonePill>
      </>,
    );
    expect(screen.getByText('Perlu perhatian')).toHaveClass('bg-pill-red', 'text-pill-red-ink', 'text-xs');
    expect(screen.getByText('Perlu dipantau')).toHaveClass('bg-pill-amber', 'text-pill-amber-ink');
    expect(screen.getByText('Sesuai target')).toHaveClass('bg-pill-green', 'text-pill-green-ink');
    expect(screen.getByText('Goal belum diatur')).toHaveClass('bg-pill-grey', 'text-pill-grey-ink');
    expect(document.querySelector('.rounded-full')).toBeNull();
  });

  it('UI-059 / UI-101 "n aktivitas" on the accent when they logged; "Belum lapor" in grey when not, 0 included', () => {
    renderInIndonesian(
      <>
        <ActivityPill count={5} />
        <ActivityPill count={0} />
        <ActivityPill count={null} onTint />
      </>,
    );
    expect(screen.getByText('5 aktivitas')).toHaveClass('bg-amber', 'text-navy', 'font-bold');
    const [none, tinted] = screen.getAllByText('Belum lapor');
    expect(none).toHaveClass('bg-base', 'text-muted');
    expect(tinted).toHaveClass('bg-card');
  });

  it('UI-101 the number alone under a day’s header, named in full; "Belum lapor" on two lines in a narrow cell', () => {
    render(
      <>
        <ActivityPill count={1} short />
        <ActivityPill count={0} stacked />
      </>,
    );
    expect(screen.getByLabelText('1 activity')).toHaveTextContent('1');
    expect(screen.getByText('Not reported')).toHaveClass('whitespace-normal', 'max-w-[3.25rem]');
  });
});

describe('StatTile (UI V1, UI-003)', () => {
  it('UI-003 a 12px label, one number with its unit, chips; the whole tile a link with a ›', () => {
    render(
      <StatTile
        label="Tim Anda"
        value="12"
        unit="agent"
        chips={[{ key: 'u', label: <><b>4</b> langsung</> }, { key: 'a', label: <><b>8</b> AAB</> }]}
        href="/unit/dashboard"
      />,
    );
    const tile = screen.getByRole('link');
    expect(tile).toHaveAttribute('href', '/unit/dashboard');
    expect(within(tile).getByText('Tim Anda')).toHaveClass('text-sm');
    expect(within(tile).getByText('12')).toHaveClass('whitespace-nowrap', 'text-[1.625rem]');
    expect(within(tile).getByText('agent')).toBeInTheDocument();
    expect(within(tile).getAllByRole('listitem')).toHaveLength(2);
  });

  it('UI-003 a ring with its whole percentage, the badge, the bar and the line under it', () => {
    render(
      <InLanguage language="id">
        <StatTile label="Active Agent Oktober" value="4" unit="dari 12" ring={{ percent: 33 }} />
        <StatTile label="Produksi Group" value="Rp 333,5" unit="jt" badge="54%" bar={54} sub="dari Rp 612,3 jt" />
      </InLanguage>,
    );
    expect(screen.getByRole('img', { name: '33% dari keseluruhan' })).toBeInTheDocument();
    expect(screen.getByText('54%')).toBeInTheDocument();
    expect(screen.getByText('dari Rp 612,3 jt')).toBeInTheDocument();
    expect(document.querySelector('[style*="width: 54%"]')).not.toBeNull();
  });
});

describe('ActionRow (UI V1, UI-061)', () => {
  it('UI-061 one date format: "30 Okt", the year only when it is not this year', () => {
    expect(actionDay('2026-10-30', 'id', '2026-10-30')).toBe('30 Okt');
    expect(actionDay('2025-12-30', 'id', '2026-10-30')).toBe('30 Des 2025');
  });

  it('UI-061 date, the whole text with the lead after it, and a 20px checkbox named for the action', async () => {
    const onChange = vi.fn();
    renderInIndonesian(
      <ActionRow
        date="2026-10-30"
        text="Collect the signed SPAJ."
        person="Ibu Melati Kusumawardani"
        control={{ kind: 'check', checked: false, onChange }}
      />,
    );
    const text = screen.getByText('Collect the signed SPAJ.');
    expect(text).not.toHaveClass('truncate');
    expect(text).toHaveClass('break-words', 'text-md');
    expect(screen.getByText('Ibu Melati Kusumawardani')).toHaveClass('text-sm');
    expect(screen.getByText(/^30 Okt/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selesai: Collect the signed SPAJ.' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('UI-061 an editable date is the app’s date field, plain words with a dotted underline; a lead’s action shows the link and ›', () => {
    const onDate = vi.fn();
    render(
      <>
        <ActionRow date="2026-10-30" onDateChange={onDate} text="Call back" control={{ kind: 'remove', onRemove: vi.fn() }} />
        <ActionRow date="2026-11-02" text="Send the brochure" control={{ kind: 'lead', name: 'Ibu Shinta', href: '/leads?lead=l-1' }} />
      </>,
    );
    const field = screen.getByLabelText('Change the date: Call back');
    expect(field).toHaveAttribute('type', 'date');
    expect(field.nextElementSibling!.className).toContain('decoration-dotted');
    expect(field.nextElementSibling).toHaveTextContent(/^30 Oct$/);
    fireEvent.change(field, { target: { value: '2026-11-05' } });
    expect(onDate).toHaveBeenCalledWith('2026-11-05');
    expect(screen.getByRole('button', { name: 'Remove: Call back' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Ibu Shinta’s lead' })).toHaveAttribute('href', '/leads?lead=l-1');
  });
});

describe('SliderWithValue and StepperRow (UI V1, UI-016)', () => {
  function Slider() {
    const [v, setV] = useState(500);
    return <SliderWithValue label="Annual APE target" value={v} onChange={setV} min={0} max={2000} step={10} format={(n) => `Rp ${n} jt`} />;
  }

  it('UI-016 every value set without the keyboard: the slider moves it by its step; the value reads 28px/800', () => {
    render(<Slider />);
    const range = screen.getByRole('slider', { name: 'Annual APE target' });
    expect(range).toHaveAttribute('aria-valuetext', 'Rp 500 jt');
    fireEvent.change(range, { target: { value: '620' } });
    expect(screen.getByRole('button', { name: 'Type an exact amount for Annual APE target' })).toHaveTextContent('Rp 620 jt');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveClass('text-[1.75rem]', 'font-extrabold');
  });

  it('UI-016 tapping the value types an exact amount (clamped, not stepped); Escape leaves it as it was', async () => {
    render(<Slider />);
    await userEvent.click(screen.getByRole('button', { name: /Type an exact amount/ }));
    const field = screen.getByRole('textbox', { name: /Type an exact amount/ });
    expect(field).toHaveAttribute('inputmode', 'decimal');
    await userEvent.clear(field);
    await userEvent.type(field, '733{Enter}');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 733 jt');
    await userEvent.click(screen.getByRole('button', { name: /Type an exact amount/ }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), '99999{Enter}');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 2000 jt');
    await userEvent.click(screen.getByRole('button', { name: /Type an exact amount/ }));
    await userEvent.type(screen.getByRole('textbox'), '1{Escape}');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 2000 jt');
  });

  it('UI-016 the rates: round − / + of 44px around a whole percentage, by 5, held at 0 and 100', async () => {
    function Rate() {
      const [v, setV] = useState(95);
      return <StepperRow label="Closing rate" value={v} onChange={setV} />;
    }
    renderInIndonesian(<Rate />);
    const plus = screen.getByRole('button', { name: 'Tambah Closing rate' });
    expect(plus).toHaveClass('h-11', 'w-11', 'rounded-full');
    await userEvent.click(plus);
    expect(screen.getByRole('status')).toHaveTextContent('100%');
    expect(plus).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Kurangi Closing rate' }));
    expect(screen.getByRole('status')).toHaveTextContent('95%');
  });
});

describe('Save state (UI V1, UI-019, UI-039, UI-015)', () => {
  it('UI-019 compares what is held with what was saved: a change undone, or a mode switched and back, is saved', () => {
    expect(sameValue({ mode: 'ape', target: 500, rates: [50, 30] }, { target: 500, rates: [50, 30], mode: 'ape' })).toBe(true);
    expect(sameValue({ target: 500 }, { target: 510 })).toBe(false);
    expect(sameValue({ note: 'x', extra: undefined }, { note: 'x' })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });

  function Form({ saved = 'Rencana' }: { saved?: string }) {
    const [text, setText] = useState(saved);
    const { state, guard } = useSaveState(text, saved);
    return (
      <>
        <input aria-label="Catatan" value={text} onChange={(e) => setText(e.target.value)} />
        <SaveStateLabel state={state} />
        <Link href="/coaching">Coaching</Link>
        {guard}
      </>
    );
  }

  it('UI-039 typing shows "Belum disimpan" in amber; typing it back shows "Tersimpan ✓" in green', async () => {
    renderInIndonesian(<Form />);
    expect(screen.getByRole('status')).toHaveTextContent('Tersimpan ✓');
    await userEvent.type(screen.getByLabelText('Catatan'), ' x');
    expect(screen.getByRole('status')).toHaveTextContent('Belum disimpan');
    expect(screen.getByRole('status')).toHaveClass('text-pill-amber-ink');
    await userEvent.type(screen.getByLabelText('Catatan'), '{Backspace}{Backspace}');
    expect(screen.getByRole('status')).toHaveTextContent('Tersimpan ✓');
    expect(screen.getByRole('status')).toHaveClass('text-signal-green');
  });

  it('UI-039 leaving with unsaved text warns: the browser on unload, the product’s dialog on a link; leaving follows it', async () => {
    const followed = vi.fn((e: Event) => e.preventDefault());
    render(<Form />);
    await userEvent.type(screen.getByLabelText('Catatan'), ' x');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const link = screen.getByRole('link', { name: 'Coaching' });
    link.addEventListener('click', followed);
    await userEvent.click(link);
    expect(followed).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('You have changes that are not saved yet. Leave anyway?');
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(followed).toHaveBeenCalledTimes(1);
  });

  it('UI-039 nothing to save, nothing held: no warning and the link goes', async () => {
    const followed = vi.fn((e: Event) => e.preventDefault());
    render(<LeaveGuard active={false} />);
    const a = document.createElement('a');
    a.href = '/home';
    a.textContent = 'Home';
    document.body.appendChild(a);
    a.addEventListener('click', followed);
    await userEvent.click(a);
    expect(followed).toHaveBeenCalled();
    a.remove();
  });

  it('UI-015 the floating pill: the state on the left, the 44px save on the right, above the tab bar, below 1024px', async () => {
    const onSave = vi.fn();
    renderInIndonesian(<FloatingSavePill state="unsaved" label="Simpan goal" onSave={onSave} />);
    const pill = document.querySelector('[data-floating-save]')!;
    expect(pill.className).toContain('fixed');
    expect(pill.className).toContain('var(--tab-bar-space)');
    expect(pill).toHaveClass('lg:hidden', 'inset-x-3');
    expect(within(pill as HTMLElement).getByRole('status')).toHaveTextContent('Belum disimpan');
    const save = screen.getByRole('button', { name: 'Simpan goal' });
    expect(save).toHaveClass('min-h-11', 'bg-amber');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalled();
  });
});

describe('AutoMarker (UI V1, UI-027 / UI-061; D-25)', () => {
  it('UI-027 a small ⚡ named "Otomatis", and the explanation behind ⓘ — never the uppercase sentence', async () => {
    renderInIndonesian(<AutoMarker name="Close first case independently" explanation="Selesai saat rekrut melakukan penjualan pertama." />);
    expect(screen.getByText('Otomatis')).toHaveClass('sr-only');
    await userEvent.click(screen.getByRole('button', { name: 'Kenapa Close first case independently otomatis' }));
    expect(await screen.findByText('Selesai saat rekrut melakukan penjualan pertama.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/OTOMATIS/);
  });
});

describe('A destructive action (UI V1, UI-024 / UI-083)', () => {
  function Row({ onRemove }: { onRemove: () => void }) {
    const remove = useDestructiveAction({
      label: 'Keluarkan', message: 'Keluarkan Siti dari tim Anda?', confirmLabel: 'Keluarkan', onConfirm: onRemove,
    });
    return (
      <>
        <ActionMenu label="Tindakan untuk Siti" items={destructiveLast([remove.item, { label: 'Ubah peran', onSelect: vi.fn() }])} />
        {remove.row}
        {remove.dialog}
      </>
    );
  }

  it('UI-083 last in the ⋯, red, and only the confirmation acts', async () => {
    const onRemove = vi.fn();
    render(<Row onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tindakan untuk Siti' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Ubah peran', 'Keluarkan']);
    await userEvent.click(items[1]);
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Keluarkan Siti dari tim Anda?');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keluarkan' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('UI-083 in a sheet: the red row last, asking first', async () => {
    const onRemove = vi.fn();
    render(<Row onRemove={onRemove} />);
    const row = screen.getAllByRole('button', { name: 'Keluarkan' })[0];
    expect(row).toHaveClass('text-signal-red', 'min-h-11');
    await userEvent.click(row);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe('EmptyState with Boost (UI V1, UI-102)', () => {
  it('UI-102 a fully empty page draws Boost thinking above its one line and its action; sleeping for nothing logged', () => {
    const { rerender } = render(<EmptyState title="Belum ada permintaan." boost="thinking" action={<button type="button">Undang</button>} />);
    expect(document.querySelector('[data-boost="thinking"]')).toHaveAttribute('src', expect.stringContaining('boost-thinking'));
    expect(screen.getByText('Belum ada permintaan.')).toBeInTheDocument();
    rerender(<EmptyState title="Belum ada aktivitas 7 hari terakhir" boost="sleeping" />);
    expect(document.querySelector('[data-boost="sleeping"]')).toBeInTheDocument();
  });

  it('UI-102 a filtered list keeps the plain line, no mascot', () => {
    render(<EmptyState title="Tidak ada yang cocok." variant="filtered" />);
    expect(document.querySelector('[data-boost]')).toBeNull();
  });
});

describe('the shared pieces are announced', () => {
  it('a ResponsiveSheet’s focus goes in and comes back', async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <ResponsiveSheet open={open} title="Peran" onClose={() => setOpen(false)}>
            <button type="button">Agent</button>
          </ResponsiveSheet>
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'open' });
    await userEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await act(async () => { await userEvent.keyboard('{Escape}'); });
    expect(opener).toHaveFocus();
  });
});

/**
 * **The shared components' colours, read from the tokens** (jsdom paints nothing, so contrast is pinned here, as
 * `a11y.spec.tsx` pins the app's): every pair these components draw, against WCAG 2.1 AA — 4.5:1 for words, 3:1 for a
 * line icon on its button.
 */
describe('UI V1 the shared components’ contrast (WCAG 2.1 AA)', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'styles', 'globals.css'), 'utf8');
  const token = (name: string) => {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
    if (!m) throw new Error(`no token --color-${name}`);
    return m[1];
  };
  const luminance = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1).slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const WHITE = '#ffffff';

  it.each([
    ['the ratio card’s Target X on navy', 'on-navy-muted', 'navy'],
    ['a met ratio on navy', 'on-navy-green', 'navy'],
    ['a missed ratio on navy', 'on-navy-red', 'navy'],
    ['–, too little data, on navy', 'on-navy-lavender', 'navy'],
    ['Selling n% and the activity pill: navy on the accent', 'navy', 'amber'],
    ['the goal card’s badge: amber-ink on white', 'amber-ink', 'card'],
    ['Belum disimpan on white', 'pill-amber-ink', 'card'],
    ['Tersimpan ✓ on white', 'signal-green', 'card'],
    ['the Anda pill', 'pill-blue-ink', 'pill-blue'],
    ['a status pill, red', 'pill-red-ink', 'pill-red'],
    ['a status pill, amber', 'pill-amber-ink', 'pill-amber'],
    ['a status pill, green', 'pill-green-ink', 'pill-green'],
    ['a status pill, grey', 'pill-grey-ink', 'pill-grey'],
    ['a row’s chevron and a lead’s name on white', 'signal-grey', 'card'],
  ])('%s clears 4.5:1', (_name, fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('Recruitment n% in white on lavender clears 4.5:1; WhatsApp’s white line icon on its green clears a graphic’s 3:1', () => {
    expect(ratio(WHITE, token('lavender'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(WHITE, token('whatsapp'))).toBeGreaterThanOrEqual(3);
    expect(ratio(WHITE, token('navy'))).toBeGreaterThanOrEqual(4.5);
  });

  it('why the accent carries navy words: white on it would not clear even large text’s 3:1', () => {
    expect(ratio(WHITE, token('amber'))).toBeLessThan(3);
  });
});

