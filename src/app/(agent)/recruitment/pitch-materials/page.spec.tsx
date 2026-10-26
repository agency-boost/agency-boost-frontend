import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import type { PitchMaterialsView, PitchSlot } from '@/lib/recruitment-pitch';
import PitchMaterialsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/recruitment/pitch-materials',
}));

// ------------------------------------------------------------------------------------- fixtures

const LABELS = ['career-path', 'income', 'support', 'commitment'];
const checklist = (ticked: string[] = []) =>
  LABELS.map((code) => ({ code, label: `Item ${code}`, ticked: ticked.includes(code) }));
const file = (name: string, bytes = 2.4 * 1024 * 1024, uploadedOn = '2026-09-12') => ({ name, bytes, uploadedOn });
const slot = (code: PitchSlot['slot'], title: string, over: Partial<PitchSlot> = {}): PitchSlot => ({
  slot: code, title, line: `${title}'s line`, state: 'missing', file: null,
  checklist: code === 'opportunity' ? checklist() : [], version: 0, ...over,
});
function view(slots: PitchSlot[]): PitchMaterialsView {
  const count = (...s: PitchSlot['state'][]) => slots.filter((x) => s.includes(x.state)).length;
  return { slots, summary: { done: count('complete', 'uploaded'), total: 4, missing: count('missing'), unconfirmed: count('partial') } };
}

/** 0417's state in the seed's shape: one partly confirmed, one uploaded, two missing. */
const PARTLY = view([
  slot('opportunity', 'Opportunity Overview', {
    state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path', 'support']), version: 1,
  }),
  slot('proof', 'Proof & Credibility', { state: 'uploaded', file: file('Proof_and_Credibility_2026.pdf', 1.1 * 1024 * 1024, '2026-08-30'), version: 1 }),
  slot('faq', 'FAQ'),
  slot('howtojoin', 'How to Join'),
]);
const NONE = view([slot('opportunity', 'Opportunity Overview'), slot('proof', 'Proof & Credibility'), slot('faq', 'FAQ'), slot('howtojoin', 'How to Join')]);
const ALL = view([
  slot('opportunity', 'Opportunity Overview', { state: 'complete', file: file('o.pdf'), checklist: checklist(LABELS), version: 1 }),
  slot('proof', 'Proof & Credibility', { state: 'uploaded', file: file('p.pdf'), version: 1 }),
  slot('faq', 'FAQ', { state: 'uploaded', file: file('f.pdf'), version: 1 }),
  slot('howtojoin', 'How to Join', { state: 'uploaded', file: file('h.pdf'), version: 1 }),
]);

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const,
  status: 'active' as const, isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});
const FIELD = ['member:read_profile', 'tenant_config:read', 'recruitment:read'];
const AGENT = makeMe({ membership: member(), permissions: FIELD });
const AAB = makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }), permissions: FIELD });
const AB = makeMe({ membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 }), permissions: FIELD });
/** The Owner and the Admin in their field view (ADR-0114) hold the office's write too — and it changes nothing here. */
const OWNER = makeMe({
  membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true }),
  permissions: [...FIELD, 'kpm:read_profile', 'tenant_config:write'],
});
const ADMIN = makeMe({
  membership: member({ isKpmAdmin: true }), permissions: [...FIELD, 'kpm:read_profile', 'tenant_config:write'],
});
const SUPPORT_READ_ONLY = makeMe({
  membership: member(), permissions: FIELD, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support',
});

function render(read: StubReply | StubReply[] = { body: PARTLY }, me = AGENT, extra: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({ 'GET /recruitment/pitch-materials': read, ...extra });
  renderWithSession(<PitchMaterialsPage />, { me });
  return stub;
}
const card = (title: string) => screen.getByRole('article', { name: title });
const urlCalls = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((c) => c.url.endsWith('/url'));

// ---------------------------------------------------------------------------------------- specs

describe('Recruitment › Pitch Materials (P17-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe.each([
    ['an agent', AGENT], ['an AAB', AAB], ['an AB', AB],
    ['the Owner in the field view', OWNER], ['the Admin in the field view', ADMIN],
    ['a read-only support session', SUPPORT_READ_ONLY],
  ])('read by %s (AC-1, AC-3)', (_who, me) => {
    it('draws the banner and the four cards, each Missing or Uploaded, with nothing to change', async () => {
      render({ body: PARTLY }, me);
      await screen.findByRole('article', { name: 'FAQ' });

      expect(screen.getByRole('img', { name: '1 of 4 documents complete' })).toHaveTextContent('1/4');
      expect(screen.getByText(
        '2 not uploaded, 1 uploaded but not fully confirmed — not yet ready to rely on for candidates.',
      )).toBeInTheDocument();
      // The agent's two badges (`:696`): a partly confirmed document reads Uploaded here.
      expect(within(card('Opportunity Overview')).getByText('Uploaded')).toBeInTheDocument();
      expect(screen.queryByText(/confirmed$/)).not.toBeInTheDocument();
      expect(within(card('Proof & Credibility')).getByText('Uploaded')).toBeInTheDocument();
      expect(within(card('FAQ')).getByText('Missing')).toBeInTheDocument();
      expect(within(card('How to Join')).getByText('Missing')).toBeInTheDocument();

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirm this PDF actually includes')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Replace/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Upload PDF/ })).not.toBeInTheDocument();
      expect(document.querySelector('input[type=file]')).toBeNull();
    });

    it('offers View PDF on every uploaded card, whatever its ticks, and nothing on a missing one (OD-141)', async () => {
      render({ body: PARTLY }, me);
      await screen.findByRole('article', { name: 'FAQ' });
      expect(within(card('Opportunity Overview')).getByRole('button', { name: 'View PDF, Opportunity Overview — opens in a new tab' })).toBeInTheDocument();
      expect(within(card('Proof & Credibility')).getByRole('button', { name: /^View PDF/ })).toBeInTheDocument();
      expect(within(card('FAQ')).queryByRole('button')).not.toBeInTheDocument();
      expect(within(card('How to Join')).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('refuses a member without recruitment:read, and asks the API for nothing', async () => {
    const stub = render({ body: PARTLY }, makeMe({ membership: member(), permissions: ['member:read_profile'] }));
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'recruitment:read');
    expect(stub.calls).toEqual([]);
  });

  it('shows the file’s name, size and day, the missing line, and the dashed border', async () => {
    render();
    await screen.findByRole('article', { name: 'FAQ' });
    expect(within(card('Opportunity Overview')).getByText('Opportunity_Overview_v3.pdf')).toBeInTheDocument();
    expect(within(card('Opportunity Overview')).getByText('2,4 MB · updated 12 Sep 2026')).toBeInTheDocument();
    expect(within(card('FAQ')).getByText('No PDF uploaded yet — candidates can\'t be shown this document.')).toBeInTheDocument();
    expect(card('FAQ').className).toContain('border-dashed');
  });

  it('renders a file’s name as text', async () => {
    const name = '<b>x</b><script>window.hacked=1</script>.pdf';
    render({ body: view([PARTLY.slots[0], slot('proof', 'Proof & Credibility', { state: 'uploaded', file: file(name), version: 1 }), ...PARTLY.slots.slice(2)]) });
    expect(await screen.findByText(name)).toBeInTheDocument();
    expect(card('Proof & Credibility').querySelector('b, script')).toBeNull();
  });

  it('writes none of OD-39’s six words of its own (AC-7, D-copy)', async () => {
    render({ body: PARTLY });
    await screen.findByRole('article', { name: 'FAQ' });
    expect(document.body.textContent).not.toMatch(/\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i);
  });

  it('says so when every document is ready', async () => {
    render({ body: ALL });
    expect(await screen.findByText('Recruitment Pitch is complete')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^View PDF/ })).toHaveLength(4);
  });

  it('draws an office with nothing uploaded, and never asks for a link (AC-4)', async () => {
    const stub = render({ body: NONE });
    await screen.findByRole('article', { name: 'FAQ' });
    expect(screen.getAllByText('Missing')).toHaveLength(4);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(
      '4 not uploaded — not yet ready to rely on for candidates.',
    )).toBeInTheDocument();
    expect(urlCalls(stub)).toEqual([]);
  });

  describe('opening a document (AC-2, AC-5)', () => {
    it('asks for a link signed for a few minutes, and opens it in a new tab', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const open = vi.fn(() => tab);
      vi.stubGlobal('open', open);
      const stub = render({ body: PARTLY }, AGENT, {
        '/recruitment/pitch-materials/opportunity/url': { body: { url: 'https://cdn.test/o?sig=1', expiresAt: '2999-01-01T00:00:00Z' } },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.click(within(card('Opportunity Overview')).getByRole('button', { name: /^View PDF/ }));

      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/o?sig=1'));
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(tab.opener).toBeNull();
      expect(urlCalls(stub).map((c) => c.url)).toEqual([expect.stringMatching(/\/recruitment\/pitch-materials\/opportunity\/url$/)]);
    });

    it('opens the link itself when the browser gave no tab', async () => {
      const open = vi.fn(() => null);
      vi.stubGlobal('open', open);
      render({ body: PARTLY }, AGENT, {
        '/recruitment/pitch-materials/proof/url': { body: { url: 'https://cdn.test/p', expiresAt: '2999-01-01T00:00:00Z' } },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.click(within(card('Proof & Credibility')).getByRole('button', { name: /^View PDF/ }));
      await waitFor(() => expect(open).toHaveBeenLastCalledWith('https://cdn.test/p', '_blank', 'noopener'));
    });

    it('says in the card when the link is refused, and closes the tab it opened', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      vi.stubGlobal('open', vi.fn(() => tab));
      render({ body: PARTLY }, AGENT, {
        '/recruitment/pitch-materials/proof/url': {
          status: 404, body: { error: { code: 'NOT_FOUND', message: 'Document not found.', requestId: 'r-4' } },
        },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.click(within(card('Proof & Credibility')).getByRole('button', { name: /^View PDF/ }));

      expect(await within(card('Proof & Credibility')).findByText('Could not open this PDF.')).toBeInTheDocument();
      expect(within(card('Proof & Credibility')).getByText('Document not found.')).toBeInTheDocument();
      expect(tab.close).toHaveBeenCalled();
      expect(tab.location.href).toBe('');
    });

    it('opens a fresh link as it comes, whatever this device’s clock says', async () => {
      // A phone whose clock runs fast would read every 300-second link as expired: no clock is consulted.
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      vi.stubGlobal('open', vi.fn(() => tab));
      render({ body: PARTLY }, AGENT, {
        '/recruitment/pitch-materials/proof/url': { body: { url: 'https://cdn.test/p', expiresAt: '2000-01-01T00:00:00Z' } },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.click(within(card('Proof & Credibility')).getByRole('button', { name: /^View PDF/ }));

      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/p'));
      expect(tab.close).not.toHaveBeenCalled();
    });

    it('asks once while a link is on its way, however often it is pressed', async () => {
      let answer: (v: unknown) => void = () => undefined;
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      vi.stubGlobal('open', vi.fn(() => tab));
      const stub = render({ body: PARTLY });
      await screen.findByRole('article', { name: 'FAQ' });
      const base = globalThis.fetch;
      vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => (url.endsWith('/url')
        ? new Promise((resolve) => { answer = resolve; })
        : base(url, init))));
      const view = within(card('Proof & Credibility')).getByRole('button', { name: /^View PDF/ });
      await userEvent.click(view);
      expect(view).toHaveTextContent('Opening…');
      await userEvent.click(view);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).endsWith('/url'))).toHaveLength(1);
      answer({ ok: true, status: 200, json: async () => ({ url: 'https://cdn.test/p', expiresAt: '2999-01-01T00:00:00Z' }) });
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/p'));
      expect(urlCalls(stub)).toEqual([]);
    });
  });

  describe('the states the prototype lacks (AC-5, Fills)', () => {
    it('shows a skeleton shaped like what is coming', async () => {
      stubFetch({});
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
      renderWithSession(<PitchMaterialsPage />, { me: AGENT });
      expect(await screen.findByText('Loading the pitch documents…')).toHaveClass('sr-only');
    });

    it('says the read failed, and reads again on Try again', async () => {
      render([
        { status: 503, body: { error: { code: 'UNAVAILABLE', message: 'Try later.', requestId: 'r-5' } } },
        { body: PARTLY },
      ]);
      expect(await screen.findByText('Could not read the pitch documents.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('article', { name: 'FAQ' })).toBeInTheDocument();
    });
  });
});
