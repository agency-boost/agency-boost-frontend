import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { FORUM_COPY, type MeetingView, type MeetingWriter } from '@/lib/leader-meetings';
import { meetingView } from '@/app/leader-meetings/forum-fixtures';
import { MeetingWriterProvider, useMeetingSave, useMeetingWriter } from './meeting-writer';

const conflict = () => new ApiRequestError(409, { code: 'VERSION_CONFLICT', message: 'Changed.', requestId: 'r-1' });
const failure = () => new ApiRequestError(500, { code: 'INTERNAL_ERROR', message: 'Broke.', requestId: 'r-2' });

let writer: MeetingWriter;
let flush: () => Promise<void>;
let held: MeetingView;

function Probe() {
  writer = useMeetingWriter();
  const save = useMeetingSave();
  flush = save.flush;
  return <p data-testid="line">{save.line ?? ''}</p>;
}

function Host({ initial, reread, children }: { initial: MeetingView; reread: () => Promise<MeetingView>; children?: React.ReactNode }) {
  const [meeting, setMeeting] = useState(initial);
  held = meeting;
  return (
    <MeetingWriterProvider meeting={meeting} setMeeting={(change) => setMeeting(change)} reread={reread}>
      <Probe />
      <p data-testid="title">{meeting.title}</p>
      {children}
    </MeetingWriterProvider>
  );
}

const toast = () => screen.getByRole('status');

describe('the meeting writer (P18.1-T2, Saving)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('P18.1-T2 AC-3: a write that lands says Saved, or what the tab asks it to say, and hands back the answer', async () => {
    render(<Host initial={meetingView()} reread={vi.fn()} />);
    let answer: unknown;
    await act(async () => { answer = await writer.run(async () => ({ id: 'x' })); });
    expect(answer).toEqual({ id: 'x' });
    expect(toast()).toHaveTextContent('Saved');

    await act(async () => { await writer.run(async () => 1, { done: 'Status updated' }); });
    expect(toast()).toHaveTextContent('Status updated');
    expect(screen.getByTestId('line')).toHaveTextContent('');
  });

  it('P18.1-T2 AC-3: on 409 VERSION_CONFLICT it reads the meeting again, shows what was saved, and says so', async () => {
    const reread = vi.fn(async () => meetingView({ title: 'Saved by Maya', version: 9 }));
    render(<Host initial={meetingView()} reread={reread} />);
    let answer: unknown = 'unset';
    await act(async () => { answer = await writer.run(async () => { throw conflict(); }); });

    expect(answer).toBeUndefined();
    expect(reread).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('title')).toHaveTextContent('Saved by Maya');
    expect(held.version).toBe(9);
    expect(toast()).toHaveTextContent(FORUM_COPY.conflict);
    expect(screen.getByTestId('line')).toHaveTextContent(FORUM_COPY.conflict);
  });

  it('P18.1-T2 AC-3: any other failure says it failed, never throws, and the line stays until a write lands', async () => {
    render(<Host initial={meetingView()} reread={vi.fn()} />);
    await act(async () => { await writer.run(async () => { throw failure(); }); });
    expect(toast()).toHaveTextContent("Couldn't save that change. It's still here — try again.");
    expect(screen.getByTestId('line')).toHaveTextContent(FORUM_COPY.failed);

    await act(async () => { await writer.run(async () => 'ok'); });
    expect(screen.getByTestId('line')).toHaveTextContent('');
  });

  it('a conflict whose read again fails too says the write failed', async () => {
    render(<Host initial={meetingView()} reread={vi.fn(async () => { throw failure(); })} />);
    await act(async () => { await writer.run(async () => { throw conflict(); }); });
    expect(toast()).toHaveTextContent(FORUM_COPY.failed);
  });

  it('update replaces the meeting the page holds; announce speaks without touching the line', async () => {
    render(<Host initial={meetingView()} reread={vi.fn()} />);
    act(() => writer.update((m) => ({ ...m, title: 'Renamed' })));
    expect(screen.getByTestId('title')).toHaveTextContent('Renamed');
    act(() => writer.announce('Reordered'));
    expect(toast()).toHaveTextContent('Reordered');
  });

  it('readOnly is the server’s can.edit', () => {
    const { unmount } = render(<Host initial={meetingView()} reread={vi.fn()} />);
    expect(writer.readOnly).toBe(false);
    unmount();
    render(<Host initial={meetingView({ can: { ...meetingView().can, edit: false } })} reread={vi.fn()} />);
    expect(writer.readOnly).toBe(true);
  });

  it('P18.1-T2 AC-3: Save leaves the field being edited, waits for every write in flight, then says All changes saved', async () => {
    let land!: () => void;
    const slow = vi.fn(() => new Promise<string>((resolve) => { land = () => resolve('done'); }));
    function Field() {
      const w = useMeetingWriter();
      return <input aria-label="Agenda item 1" defaultValue="x" onBlur={() => void w.run(slow)} />;
    }
    render(<Host initial={meetingView()} reread={vi.fn()}><Field /></Host>);
    await userEvent.click(screen.getByRole('textbox', { name: 'Agenda item 1' }));

    let saved = false;
    let pending!: Promise<void>;
    act(() => { pending = flush().then(() => { saved = true; }); });
    // The blur started the write, and Save is waiting on it.
    expect(slow).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Agenda item 1' })).not.toHaveFocus();
    await act(async () => { await Promise.resolve(); });
    expect(saved).toBe(false);

    await act(async () => { land(); await pending; });
    expect(saved).toBe(true);
    expect(toast()).toHaveTextContent('All changes saved');
  });

  it('Save says the failed write’s line when one fails, and keeps saying it while that change is unsaved', async () => {
    render(<Host initial={meetingView()} reread={vi.fn()} />);
    await act(async () => {
      void writer.run(async () => { throw failure(); });
      await flush();
    });
    expect(toast()).toHaveTextContent(FORUM_COPY.failed);
    await act(async () => { await flush(); });
    expect(toast()).toHaveTextContent(FORUM_COPY.failed);
  });

  it('Save with nothing in flight says All changes saved at once', async () => {
    render(<Host initial={meetingView()} reread={vi.fn()} />);
    await act(async () => { await flush(); });
    await waitFor(() => expect(toast()).toHaveTextContent('All changes saved'));
  });

  it('a tab outside the page’s writer is a mistake that says so', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Orphan() { useMeetingWriter(); return null; }
    expect(() => render(<Orphan />)).toThrow(/MeetingWriterProvider/);
  });
});
