import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderInIndonesian, renderWithSession, resetLanguage, routeParams, stubFetch, type StubReply } from '@test/harness';
import type { MeetingView } from '@/lib/leader-meetings';
import LeaderMeetingPage from './[meetingId]/page';
import {
  AGUS, card, CORE_LEADER_CAN, CORE_LEADER_ME, editors, listView, meetingView, OWNER_ME, SARI, SHELL_STUBS, YOSEF,
} from './forum-fixtures';
import LeaderMeetingsPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => atWidth(375));
afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
  nav.pathname = '/leader-meetings';
});

const CORE = meetingView({ can: CORE_LEADER_CAN });

function openMeeting(meeting: MeetingView = CORE, routes: Record<string, StubReply | StubReply[]> = {}, me = CORE_LEADER_ME) {
  nav.pathname = '/leader-meetings/m-14';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': { body: meeting }, ...routes });
  renderWithSession(<LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />, { me });
  return stub;
}

const writes = (calls: { url: string; init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');

describe('UI-110 the Strategic Leader Forum on a phone in the field shell', () => {
  it('UI-110 the list: cards like Event — the date block, the title, the leaders and Core Leaders, the open items pill — the whole card the link', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView() } });
    renderWithSession(<LeaderMeetingsPage />, { me: CORE_LEADER_ME });

    const card = await waitFor(() => {
      const el = document.querySelector('[data-v1-meeting="m-14"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(card.tagName).toBe('A');
    expect(card).toHaveAttribute('href', '/leader-meetings/m-14');
    expect(card).toHaveTextContent('13');
    expect(card).toHaveTextContent('3 Core Leaders');
    expect(within(card).getByText('4 items not done')).toHaveAttribute('data-tone', 'amber');
    expect(within(document.querySelector('[data-v1-meeting="m-12"]') as HTMLElement).getByText('All clear')).toHaveAttribute('data-tone', 'green');
    // No *Open* button: the card is the link.
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    // Grouped under *Semua*: Upcoming 1, Past 2.
    expect(screen.getByRole('heading', { name: /Upcoming\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Past\s*2/ })).toBeInTheDocument();
  });

  it('UI-110 the meeting header: ‹ back, the title as the page title with its date and state, Share and PDF, the editors as one row — and no Save', async () => {
    openMeeting();
    const head = await waitFor(() => {
      const el = document.querySelector('[data-v1-meeting-head]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(head).getByRole('heading', { level: 1, name: 'Strategic Check-in — #14' })).toBeInTheDocument();
    expect(head).toHaveTextContent(/Tue, 13 Oct 2026 · Upcoming/);
    expect(within(head).getByRole('link', { name: 'All meetings' })).toHaveAttribute('href', '/leader-meetings');
    expect(within(head).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Save as PDF' })).toHaveTextContent('PDF');
    expect(head).toHaveTextContent('5 leaders can edit these minutes');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // The forum's own title row is not drawn over it.
    expect(screen.queryByRole('heading', { level: 1, name: 'Strategic Leader Forum' })).not.toBeInTheDocument();
  });

  it('UI-111 a leader with a saved photo shows it on the list’s card and the meeting’s editors; one without, their initials', async () => {
    const photo = 'https://cdn.test/user/u-agus/avatar/a.jpg?sig=abc';
    const pictured = editors({ coreLeaders: [{ ...AGUS, photoUrl: photo }, SARI, YOSEF] });
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView({ meetings: [card({ editors: pictured })] }) } });
    renderWithSession(<LeaderMeetingsPage />, { me: CORE_LEADER_ME });
    const cardEl = await waitFor(() => {
      const el = document.querySelector('[data-v1-meeting="m-14"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect([...cardEl.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([photo]);
    // Sari has no photo: her initials, on their tint.
    expect(within(cardEl).getByText('SD')).toHaveAttribute('aria-hidden', 'true');
  });

  it('UI-111 the meeting header’s editors: a saved photo where there is one, initials otherwise', async () => {
    const photo = 'https://cdn.test/user/u-sari/avatar/a.jpg?sig=abc';
    openMeeting(meetingView({ can: CORE_LEADER_CAN, editors: editors({ coreLeaders: [AGUS, { ...SARI, photoUrl: photo }, YOSEF] }) }));
    const head = await waitFor(() => {
      const el = document.querySelector('[data-v1-meeting-head]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect([...head.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([photo]);
    // Agus and Yosef have none: their initials (the title row's avatar may draw the reader's too).
    for (const initials of ['AS', 'YP']) expect(within(head).getAllByText(initials)[0]).toHaveAttribute('aria-hidden', 'true');
    expect(within(head).queryByText('SD')).not.toBeInTheDocument();
  });

  it('UI-110 the tabs are one segmented control: Overview | Agenda | Action Items', async () => {
    openMeeting();
    const tabs = await screen.findByRole('tablist');
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Agenda', 'Action Items']);
    expect(tabs).toHaveClass('rounded-pill');
  });

  it('UI-110 Overview: the branch line with its as-of day, the strip, YTD vs last year, a row per metric with its change pill; FLC waits for data', async () => {
    openMeeting();
    const overview = await waitFor(() => {
      const el = document.querySelector('[data-v1-overview-meeting]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(overview).toHaveTextContent(/BSD City Branch · Oct 2026/);
    expect(overview).toHaveTextContent('as of 26 Oct');
    expect(overview).toHaveTextContent(/Manpower\s*28/);
    expect(overview).toHaveTextContent('YTD 2026 vs 2025');
    const manpower = overview.querySelector('[data-metric="manpower"]') as HTMLElement;
    expect(within(manpower).getByText('+4%')).toHaveAttribute('data-tone', 'green');
    expect(manpower).toHaveTextContent('of 28');
    expect(within(overview.querySelector('[data-metric="flc"]') as HTMLElement).getByText('Waiting for data')).toHaveAttribute('data-tone', 'grey');
    // No wide grid: the screen's table is not drawn (the print layout's stays for the PDF).
    expect(overview.querySelector('table')).toBeNull();
  });

  it('UI-110 a metric row opens every figure and the monthly target in a sheet', async () => {
    openMeeting();
    await userEvent.click(await screen.findByRole('button', { name: /Avg\. monthly AA: every figure/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Avg. monthly AA' });
    expect(within(sheet).getByText(/Monthly Target/)).toBeInTheDocument();
  });

  it('UI-110 Agenda: three cards with their done count; every item can be ticked — Persiapan’s too — and shows Saved', async () => {
    const { calls } = openMeeting(CORE, {
      'PATCH /leader-meetings/m-14/agenda-items/a-1': { body: { id: 'a-1', text: 'Compile follow-ups & commitments from prior session', pic: 'Wilson', done: true, version: 2 } },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Agenda' }));
    const agenda = document.querySelector('[data-v1-agenda]') as HTMLElement;
    expect(within(agenda).getByRole('region', { name: 'Preparation' })).toHaveTextContent('0 / 2');
    expect(within(agenda).getByRole('region', { name: 'During' })).toHaveTextContent('1 / 2');

    await userEvent.click(within(agenda).getByRole('checkbox', { name: 'Done: Compile follow-ups & commitments from prior session' }));
    const sent = writes(calls).find((c) => c.url.includes('/agenda-items/a-1'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ done: true, version: 1 });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('UI-110 Agenda: + PIC opens the leaders who edit the minutes; choosing one saves it', async () => {
    const { calls } = openMeeting(CORE, {
      'PATCH /leader-meetings/m-14/agenda-items/a-3': { body: { id: 'a-3', text: 'Process update — review prior follow-ups', pic: 'Sari Dewanti', done: false, version: 2 } },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Agenda' }));
    await userEvent.click(screen.getByRole('button', { name: 'PIC for Process update — review prior follow-ups' }));
    const sheet = await screen.findByRole('dialog', { name: 'Choose a PIC' });
    expect(within(sheet).getByRole('radio', { name: 'Wilson Tanoto' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Sari Dewanti' }));
    const sent = writes(calls).find((c) => c.url.includes('/agenda-items/a-3'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ pic: 'Sari Dewanti', version: 1 });
    expect(screen.getAllByRole('button', { name: /Add item/ })).toHaveLength(3);
  });

  it('UI-110 Action Items: cards grouped by initiative, the measure once, the status pill, PIC and target on one line, the lock line', async () => {
    openMeeting();
    await userEvent.click(await screen.findByRole('tab', { name: 'Action Items' }));
    const actions = document.querySelector('[data-v1-actions]') as HTMLElement;
    const adoption = within(actions).getByRole('region', { name: 'Activity tracking tool adoption' });
    expect(adoption).toHaveTextContent('Adoption 80% (currently 63%)');
    const row = adoption.querySelector('[data-action-item="x-1"]') as HTMLElement;
    expect(within(row).getByText('Planned')).toHaveAttribute('data-tone', 'green');
    expect(row).toHaveTextContent('Amelia');
    expect(row).toHaveTextContent('Scheduled for 2 Sept');
    expect(within(actions.querySelector('[data-action-item="x-2"]') as HTMLElement).getByText('Not yet planned')).toHaveAttribute('data-tone', 'grey');
    expect(actions).toHaveTextContent('Only Wilson Tanoto, Maya Halim and tagged Core Leaders can edit');
    expect(actions.querySelector('table')).toBeNull();
  });

  it('UI-110 tapping an action edits it in a sheet: the status saves at once, the order moves only there', async () => {
    const { calls } = openMeeting(CORE, {
      'PATCH /leader-meetings/m-14/action-items/x-2': { body: { ...CORE.actionItems[1], status: 'planned', version: 2 } },
      'PUT /leader-meetings/m-14/action-items/order': { body: [CORE.actionItems[1], CORE.actionItems[0]] },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Action Items' }));
    expect(screen.queryByRole('button', { name: /Move/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit: Embed into recruitment onboarding' }));
    const sheet = await screen.findByRole('dialog', { name: 'Action' });
    expect(within(sheet).getByLabelText('Key initiative')).toHaveValue('Leads Generation Playbook');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Planned' }));
    const status = writes(calls).find((c) => c.url.includes('/action-items/x-2'))!;
    expect(JSON.parse(String(status.init.body))).toEqual({ status: 'planned', version: 1 });
    expect(within(sheet).getByRole('button', { name: 'Remove action' })).toBeInTheDocument();
  });

  it('UI-110 the Owner on a phone keeps the office console’s meeting page', async () => {
    openMeeting(meetingView(), {}, OWNER_ME);
    await screen.findByRole('heading', { level: 1, name: 'Strategic Leader Forum' });
    expect(document.querySelector('[data-v1-meeting-head]')).toBeNull();
  });

  it('UI-110 in Indonesian: Bagikan, Semua selesai, Tambah item, Menunggu data', async () => {
    nav.pathname = '/leader-meetings/m-14';
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': { body: CORE } });
    renderInIndonesian(<LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />, { me: CORE_LEADER_ME });
    const head = await waitFor(() => {
      const el = document.querySelector('[data-v1-meeting-head]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(head).getByRole('button', { name: 'Bagikan' })).toBeInTheDocument();
    expect(head).toHaveTextContent('5 leader dapat mengubah notulen ini');
    expect(screen.getByText('Menunggu data')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Agenda' }));
    expect(screen.getAllByRole('button', { name: /Tambah item/ })).toHaveLength(3);
  });
});
