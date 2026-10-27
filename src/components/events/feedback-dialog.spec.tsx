import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  feedbackRow, feedbackSummary, OWNER_ME, READ_ONLY_OWNER, rollCall, serverError, TOWN_HALL_SUMMARY,
} from '@test/events-fixtures';
import { FeedbackDialog } from './feedback-dialog';
import { FeedbackSummaryCard } from './feedback-summary';

type Routes = Record<string, StubReply | StubReply[]>;

const ATTENDANCE = 'GET /kpm/settings/events/ev-prulink/attendance';
const FEEDBACK = 'GET /kpm/settings/events/ev-prulink/feedback';

function open(routes: Routes = {}, me = OWNER_ME) {
  const onClose = vi.fn();
  const stub = stubFetch({ [ATTENDANCE]: { body: rollCall() }, [FEEDBACK]: { body: feedbackSummary() }, ...routes });
  renderWithSession(<FeedbackDialog eventId="ev-prulink" title="PRULink briefing" onClose={onClose} />, { me });
  return { ...stub, onClose };
}

const dialog = () => screen.findByRole('dialog', { name: 'PRULink briefing' });
/** The *Feedback summary* tab, opened (P18.8-T13). */
const toSummary = async () => userEvent.click(await screen.findByRole('tab', { name: 'Feedback summary' }));
const rollCallReady = () => screen.findByRole('table');
const row = (name: string) => screen.getByRole('rowheader', { name }).closest('tr')!;
const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));

describe('View feedback: the roll call and the Feedback Summary (P18.5-T5 AC-7, P18.5-T6 AC-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.8-T13 AC-1 one dialog named by the event, its two parts as tabs: Roll call first and open', async () => {
    open();
    const box = await dialog();
    await rollCallReady();
    const strip = within(box).getByRole('tablist', { name: 'Roll call and feedback' });
    expect(within(strip).getAllByRole('tab').map((t) => [t.textContent, t.getAttribute('aria-selected')]))
      .toEqual([['Roll call', 'true'], ['Feedback summary', 'false']]);
    const panel = within(box).getByRole('tabpanel', { name: 'Roll call' });
    expect(within(panel).getByRole('table')).toBeInTheDocument();
    // The tab names the part, so its heading is for assistive technology alone.
    expect(within(panel).getByRole('heading', { name: 'Roll call' })).toHaveClass('sr-only');
    expect(within(box).queryByRole('heading', { name: 'PRULink briefing — Feedback Summary' })).not.toBeInTheDocument();
  });

  it('P18.8-T13 AC-1 the Feedback summary tab shows the summary in place of the roll call', async () => {
    open();
    const box = await dialog();
    await rollCallReady();
    await toSummary();

    const panel = within(box).getByRole('tabpanel', { name: 'Feedback summary' });
    expect(await within(panel).findByRole('heading', { name: 'PRULink briefing — Feedback Summary' })).toBeInTheDocument();
    expect(within(box).queryByRole('table')).not.toBeInTheDocument();
    // The arrow keys move between the two, as a tablist's do.
    await userEvent.keyboard('{ArrowLeft}');
    expect(within(box).getByRole('tab', { name: 'Roll call' })).toHaveAttribute('aria-selected', 'true');
    expect(within(box).getByRole('table')).toBeInTheDocument();
  });

  it('P18.8-T13 AC-1 marks not yet saved survive a look at the summary', async () => {
    const { calls } = open();
    await rollCallReady();
    await userEvent.click(screen.getByRole('button', { name: 'Attended — Indah Permata' }));
    await toSummary();
    await userEvent.click(screen.getByRole('tab', { name: 'Roll call' }));

    expect(screen.getByRole('button', { name: 'Attended — Indah Permata' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeEnabled();
    // Each part was read once: switching tabs asks the server for nothing.
    expect(calls.filter((c) => c.url.endsWith('/attendance'))).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith('/feedback'))).toHaveLength(1);
  });

  it('P18.5-T5 AC-7 the audience as at the start: name, role, what they said, and the confirmation', async () => {
    open();
    await rollCallReady();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Role', 'Response', 'Attendance']);
    expect(within(row('Budi Santoso')).getByText('RSVP’d')).toBeInTheDocument();
    expect(within(row('Indah Permata')).getByText('Said they came')).toBeInTheDocument();
    expect(within(row('Siti Rahma')).getAllByRole('cell')[1]).toHaveTextContent('—');
    // The rung by its badge's name (P18.95-T9 AC-1), whatever label the server sends beside the code.
    expect(within(row('Maya Halim')).getByText('AB')).toBeInTheDocument();
    const pressed = (name: string) => within(row(name)).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
    expect(pressed('Budi Santoso')).toEqual([['Attended', 'true'], ['Absent', 'false']]);
    expect(pressed('Dimas Pratama')).toEqual([['Attended', 'false'], ['Absent', 'true']]);
    expect(pressed('Indah Permata')).toEqual([['Attended', 'false'], ['Absent', 'false']]);
  });

  it('P18.5-T5 AC-7 each mark is named for its person, and the one on is navy (ADR-0137 §2)', async () => {
    open();
    await rollCallReady();
    const mark = screen.getByRole('button', { name: 'Attended — Budi Santoso' });
    expect(mark).toHaveClass('bg-navy', 'text-white');
    expect(screen.getByRole('button', { name: 'Absent — Budi Santoso' })).not.toHaveClass('bg-navy');
  });

  it('P18.5-T5 AC-7 nobody confirms their own: the caller’s row has no control, and says why', async () => {
    open();
    await rollCallReady();
    expect(within(row('Maya Halim')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(row('Maya Halim')).getByText('You can’t confirm your own attendance.')).toBeInTheDocument();
  });

  it('P18.5-T5 AC-7 saving writes only the rows that changed; confirming and clearing', async () => {
    const saved = rollCall({
      people: rollCall().people.map((p) => (p.membershipId === 'mem-indah' ? { ...p, attended: true, status: 'attended' as const }
        : p.membershipId === 'mem-dimas' ? { ...p, attended: null, status: 'unconfirmed' as const } : p)),
    });
    const { calls } = open({ 'PUT /kpm/settings/events/ev-prulink/attendance': { body: saved } });
    await rollCallReady();
    const save = screen.getByRole('button', { name: 'Save attendance' });
    expect(save).toBeDisabled();
    expect(save).toHaveClass('bg-amber');

    await userEvent.click(screen.getByRole('button', { name: 'Attended — Indah Permata' }));
    // Pressing the mark that is on takes it back: Dimas returns to not confirmed.
    await userEvent.click(screen.getByRole('button', { name: 'Absent — Dimas Pratama' }));
    expect(screen.getByRole('button', { name: 'Absent — Dimas Pratama' })).toHaveAttribute('aria-pressed', 'false');
    // A mark pressed twice is no change at all.
    await userEvent.click(screen.getByRole('button', { name: 'Absent — Siti Rahma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Absent — Siti Rahma' }));
    await userEvent.click(save);

    await screen.findByText('Attendance saved.');
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(bodyOf(put)).toEqual({
      entries: [{ membershipId: 'mem-indah', attended: true }, { membershipId: 'mem-dimas', attended: null }],
    });
    expect(screen.getByRole('button', { name: 'Attended — Indah Permata' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeDisabled();
  });

  it('P18.5-T6 AC-6 a saved roll call reads the summary again: a confirmation moves an answer into the NPS', async () => {
    const after = feedbackSummary({ nps: 0, counted: 2, awaitingConfirmation: 0 });
    const { calls } = open({
      [FEEDBACK]: [{ body: feedbackSummary() }, { body: after }],
      'PUT /kpm/settings/events/ev-prulink/attendance': { body: rollCall() },
    });
    await rollCallReady();
    expect(await screen.findByText(/· 1 awaiting attendance confirmation/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Attended — Indah Permata' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/feedback'))).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText(/awaiting attendance confirmation/)).not.toBeInTheDocument());
    await toSummary();
    expect(screen.getByText(/· 2 responses/)).toBeVisible();
  });

  it('P18.5-T5 AC-7 a refusal on save is said beside the button', async () => {
    open({
      'PUT /kpm/settings/events/ev-prulink/attendance': {
        status: 400, body: { error: { code: 'EVENT_ATTENDANCE_SELF', message: 'Nobody confirms their own attendance.', requestId: 'r-1' } },
      },
    });
    await rollCallReady();
    await userEvent.click(screen.getByRole('button', { name: 'Attended — Indah Permata' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nobody confirms their own attendance.');
  });

  it('P18.5-T5 AC-1, P18.8-T13 AC-1 a read-only support session as the Owner: no roll call, the summary alone with no strip', async () => {
    // The roll call's read is guarded by `event_attendance:confirm` (contract, final): the server answers this
    // session 403, so the screen neither asks nor draws it.
    const { calls } = open({ [ATTENDANCE]: { status: 403, body: { error: { code: 'PERM_DENIED', message: 'No.', requestId: 'r' } } } }, READ_ONLY_OWNER);
    await screen.findByRole('heading', { name: 'PRULink briefing — Feedback Summary' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Roll call' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/attendance'))).toBe(false);
  });

  it('P18.5-T5 AC-7 a roll call the server says cannot be confirmed yet reads each row in words, with no control', async () => {
    open({ [ATTENDANCE]: { body: rollCall({ ended: false, phase: 'running', can: { confirm: false } }) } });
    await rollCallReady();
    expect(within(screen.getByRole('table')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument();
    expect(within(row('Budi Santoso')).getByText('Attended')).toBeInTheDocument();
    expect(within(row('Dimas Pratama')).getByText('Absent')).toBeInTheDocument();
  });

  it('P18.5-T5 AC-7 a save before the end (409 EVENT_NOT_ENDED) is said in the spec’s words', async () => {
    open({ 'PUT /kpm/settings/events/ev-prulink/attendance': { status: 409, body: { error: { code: 'EVENT_NOT_ENDED', message: 'Attendance is confirmed once the event has ended.', requestId: 'r-2' } } } });
    await rollCallReady();
    await userEvent.click(screen.getByRole('button', { name: 'Attended — Indah Permata' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This event hasn’t ended yet.');
    // The marks are kept for another try.
    expect(screen.getByRole('button', { name: 'Attended — Indah Permata' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('P18.5-T5 AC-7 an audience of nobody says so', async () => {
    open({ [ATTENDANCE]: { body: rollCall({ people: [] }) } });
    expect(await screen.findByText('Nobody was invited to this event.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument();
  });

  it('P18.5-T5 AC-7 the roll call’s error, with a retry', async () => {
    open({ [ATTENDANCE]: [serverError, { body: rollCall() }] });
    await dialog();
    const retry = await screen.findAllByRole('button', { name: 'Try again' });
    await userEvent.click(retry[0]);
    await rollCallReady();
  });

  it('closes on Close, and on Escape', async () => {
    const { onClose } = open();
    const box = await dialog();
    await userEvent.click(within(box).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('draws only the parts the reader may read', async () => {
    const { calls } = open({}, { ...OWNER_ME, permissions: ['event_feedback:read'] });
    await screen.findByRole('heading', { name: 'PRULink briefing — Feedback Summary' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/attendance'))).toBe(false);
  });

  it('P18.8-T13 AC-1 a reader who may confirm and not read the summary sees the roll call alone, its heading shown, no strip', async () => {
    const { calls } = open({}, { ...OWNER_ME, permissions: ['event_attendance:confirm'] });
    await rollCallReady();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roll call' })).not.toHaveClass('sr-only');
    expect(calls.some((c) => c.url.endsWith('/feedback'))).toBe(false);
  });
});

describe('the Feedback Summary card (P18.5-T6 AC-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const card = (summary = feedbackSummary()) => renderWithSession(<FeedbackSummaryCard summary={summary} />);

  it('P18.5-T6 AC-5 the title, the NPS, the formula verbatim, the responses and those awaiting confirmation', () => {
    card();
    expect(screen.getByRole('heading', { name: 'PRULink briefing — Feedback Summary' })).toBeInTheDocument();
    const nps = document.querySelector('[data-part="nps"]')!;
    expect(nps.querySelector('strong')).toHaveTextContent('100');
    // *"· 1 response"*, singular for one (`functional/events.md`, *The module's own strings*).
    expect(nps).toHaveTextContent('100 NPS = % Promoters (9–10) − % Detractors (0–6) · 1 response · 1 awaiting attendance confirmation');
    expect(nps).not.toHaveTextContent('1 responses');
  });

  it('P18.5-T6 AC-5 the Town Hall as drawn: NPS 0 over eight, no awaiting line, no Overall columns (D-insights)', () => {
    card(TOWN_HALL_SUMMARY);
    const nps = document.querySelector('[data-part="nps"]')!;
    expect(nps.querySelector('strong')).toHaveTextContent(/^0$/);
    expect(nps).toHaveTextContent('· 8 responses');
    expect(nps).not.toHaveTextContent(/awaiting/);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(document.body).not.toHaveTextContent(/Overall/);
  });

  it('P18.5-T6 AC-5 each answer with its author’s name (OD-151), its score tinted by bucket, Why: and How to improve:', () => {
    card(TOWN_HALL_SUMMARY);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.querySelector('span')!.textContent)).toEqual([
      'Wilson Tanoto', 'Putri Ramadhani', 'Rina Agustina', 'Fajar Nugroho', 'Yoga Pratama', 'Ika Wirawan', 'Putri Lestari', 'Dewi Anggraini',
    ]);
    expect(within(items[0]).getByText('10/10')).toHaveClass('bg-success/10', 'text-success');
    expect(within(items[3]).getByText('8/10')).toHaveClass('bg-amber/[0.14]', 'text-navy');
    expect(within(items[5]).getByText('6/10')).toHaveClass('bg-alert/10', 'text-alert');
    expect(items[0]).toHaveTextContent('Why: Great energy — the recognition segment really landed.');
    expect(items[0]).toHaveTextContent('How to improve: Keep leaning into recognition moments — repeat this format.');
  });

  it('P18.5-T6 AC-5 a line not given is not drawn', () => {
    card(feedbackSummary({ rows: [feedbackRow({ membershipId: 'm', name: 'Budi Santoso', score: 9 })] }));
    expect(screen.queryByText('Why:')).not.toBeInTheDocument();
    expect(screen.queryByText('How to improve:')).not.toBeInTheDocument();
  });

  it('P18.5-T6 AC-5 an answer outside the NPS carries an icon saying why', () => {
    card(feedbackSummary({
      rows: [
        ...feedbackSummary().rows,
        feedbackRow({ membershipId: 'mem-dimas', name: 'Dimas Pratama', score: 2, attendance: 'absent', counted: false }),
      ],
    }));
    expect(screen.getByRole('button', { name: 'Attendance not confirmed — not counted in the NPS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marked absent — not counted in the NPS' })).toBeInTheDocument();
    const budi = screen.getByText('Budi Santoso').closest('li')!;
    expect(within(budi).queryByRole('button')).not.toBeInTheDocument();
  });

  it('P18.5-T6 AC-5 with nobody to count: — and No feedback yet., never 0', () => {
    card(feedbackSummary({ nps: null, counted: 0, responses: 0, awaitingConfirmation: 0, rows: [] }));
    expect(document.querySelector('[data-part="nps"] strong')).toHaveTextContent('—');
    expect(screen.getByText('No feedback yet.')).toBeInTheDocument();
  });

  it('P18.5-T6 AC-5 the formula and the scores carry the served constants', () => {
    card(feedbackSummary({ constants: { scaleMin: 0, scaleMax: 5, promoterMin: 5, detractorMax: 3 } }));
    expect(document.querySelector('[data-part="nps"]')).toHaveTextContent('= % Promoters (5–5) − % Detractors (0–3)');
    expect(screen.getByText('9/5')).toBeInTheDocument();
  });

  it('P18.5-T6 contradiction 25: a member’s words are text', () => {
    card(feedbackSummary({
      rows: [feedbackRow({ membershipId: 'm', name: '<b>Budi</b>', score: 9, why: '<script>alert(1)</script>', improve: '<img src=x>' })],
    }));
    expect(screen.getByText('<b>Budi</b>')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Why: <script>alert(1)</script>');
    expect(document.querySelector('script, img, b')).toBeNull();
  });

  it('P18.5-T6 AC-5 its own states: a skeleton and an error with a retry', async () => {
    const { calls } = open({ [FEEDBACK]: [serverError, { body: feedbackSummary() }] });
    await rollCallReady();
    await toSummary();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    await screen.findByRole('heading', { name: 'PRULink briefing — Feedback Summary' });
    expect(calls.filter((c) => c.url.endsWith('/feedback'))).toHaveLength(2);
  });
});
