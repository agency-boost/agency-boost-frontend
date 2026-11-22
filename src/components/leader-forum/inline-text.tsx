'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * **A text edited on a tap** (P19.22-T8 AC-3, AC-4: *ketuk teks untuk mengedit*): the words, as a button that names what
 * it edits; tapped, a field in their place — Enter or leaving it saves what changed, Escape puts it back. A new line
 * (`startEditing`) begins in the field, and leaving it empty is cancelling it. Read-only, the words alone.
 */
export function InlineText({
  value,
  editable,
  label,
  onSave,
  onCancel,
  startEditing = false,
  placeholder,
  maxLength,
  className,
}: {
  value: string;
  editable: boolean;
  /** The button's and the field's accessible name: *Ubah: Aktifkan 3 agent*. */
  label: string;
  onSave: (text: string) => Promise<unknown> | void;
  onCancel?: () => void;
  startEditing?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      done.current = false;
      field.current?.focus();
    }
  }, [editing]);

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    const text = draft.trim();
    if (!save || text === value.trim()) {
      setDraft(value);
      if (startEditing) onCancel?.();
      return;
    }
    if (startEditing && text === '') {
      onCancel?.();
      return;
    }
    void onSave(text);
  }

  if (editing) {
    return (
      <input
        ref={field}
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        }}
        className={cn('min-h-10 rounded-md border border-input-focus bg-card px-2 text-ink', className)}
      />
    );
  }
  if (!editable) return <span className={cn('break-words', className)}>{value}</span>;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setEditing(true)}
      className={cn('min-h-10 rounded-md px-1 text-left break-words hover:bg-hover-row', className)}
    >
      {value}
    </button>
  );
}
