import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { GCS_UPLOAD_URL, gcsSignedUpload } from '@test/storage-fixtures';
import type { PitchMaterialsView, PitchSlot } from '@/lib/recruitment-pitch';
import RecruitmentPitchPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/recruitment-pitch',
}));

// ------------------------------------------------------------------------------------- fixtures

const LABELS = {
  'career-path': 'Career Path Ladder (Agent → AAB → AB)',
  income: 'Income Potential / compensation illustration',
  support: 'Support provided (training, coaching, tools)',
  commitment: 'Commitment needed — contract maintenance and required activity',
};
const checklist = (ticked: string[] = []) =>
  Object.entries(LABELS).map(([code, label]) => ({ code, label, ticked: ticked.includes(code) }));
const file = (name: string, mimeType = 'application/pdf', uploadedOn = '2026-10-01') =>
  ({ name, bytes: 2.4 * 1024 * 1024, uploadedOn, mimeType });
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const slotOf = (slot: PitchSlot['slot'], title: string, over: Partial<PitchSlot> = {}): PitchSlot => ({
  slot, title, line: `${title}'s line`, required: !['company', 'agency'].includes(slot), state: 'missing',
  file: null, link: null, checklist: [], version: 0, ...over,
});

/** The server's counts, worked out here only to keep each fixture consistent with its slots. */
function view(slots: PitchSlot[]): PitchMaterialsView {
  const required = slots.filter((x) => x.required);
  const count = (list: PitchSlot[], ...s: PitchSlot['state'][]) => list.filter((x) => s.includes(x.state)).length;
  return {
    slots,
    summary: {
      done: count(required, 'complete', 'uploaded'), total: 4, missing: count(required, 'missing'), unconfirmed: count(required, 'partial'),
      all: { ready: count(slots, 'complete', 'uploaded'), total: 6, missing: count(slots, 'missing'), unconfirmed: count(slots, 'partial') },
    },
  };
}

/** The mockup's own example (frame 22): two ready, one to check, three missing — and a PowerPoint. */
const MOCKUP = view([
  slotOf('opportunity', 'Opportunity Overview', {
    state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path']), version: 1,
  }),
  slotOf('proof', 'Proof & Credibility', { state: 'uploaded', file: file('Proof_and_Credibility_2026.pptx', PPTX, '2026-09-18'), version: 1 }),
  slotOf('faq', 'FAQ'),
  slotOf('howtojoin', 'How to Join'),
  slotOf('company', 'Company Profile', { state: 'uploaded', file: file('Company_Profile_2026.pdf', 'application/pdf', '2026-09-25'), version: 1 }),
  slotOf('agency', 'Agency Profile'),
]);
const TITLES = ['Opportunity Overview', 'Proof & Credibility', 'FAQ', 'How to Join', 'Company Profile', 'Agency Profile'];
const VIDEO = 'https://www.youtube.com/watch?v=abc123';

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});
const OFFICE_READ = ['member:read_profile', 'kpm:read_profile', 'tenant_config:read', 'recruitment:read'];
const OWNER = makeMe({ membership: member({ isKpmOwner: true }), permissions: [...OFFICE_READ, 'tenant_config:write'] });
/** A core leader holds the Owner's rights in Pengaturan (ADR-0268). */
const CORE_LEADER = makeMe({ membership: member({ isCoreLeader: true }), permissions: [...OFFICE_READ, 'tenant_config:write'] });
const SUPPORT_READ_ONLY = makeMe({
  membership: member({ isKpmOwner: true }), permissions: OFFICE_READ,
  isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support',
});
const AGENT = makeMe({
  membership: member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' }),
  permissions: ['member:read_profile', 'tenant_config:read', 'recruitment:read'],
});

const SIGNED = gcsSignedUpload('dev/kpm-1/recruitment-pitch/01NEW');

function render(read: StubReply | StubReply[] = { body: MOCKUP }, me = OWNER, extra: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({ 'GET /recruitment/pitch-materials': read, ...extra });
  renderWithSession(<RecruitmentPitchPage />, { me });
  return stub;
}

const row = (title: string) => screen.getByText(title, { selector: 'p' }).closest('li') as HTMLElement;
const picker = (title: string) => row(title).querySelector('input[type=file]') as HTMLInputElement;
const calls = (stub: ReturnType<typeof stubFetch>, fragment: string, method = 'GET') =>
  stub.calls.filter((c) => c.url.includes(fragment) && (c.init.method ?? 'GET') === method);
const fileOf = (name: string, type: string, size = 1024) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

// ---------------------------------------------------------------------------------------- specs

describe('P19.21-T3 AC-6 Pengaturan › Recruitment pitch — one list, any format or a link (ADR-0274)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the list, as frame 22 draws it', () => {
    it('P19.21-T3 AC-6 counts all six — “2/6 materi siap” — read from the server, named for a screen reader', async () => {
      render();
      const count = await screen.findByLabelText('2 of 6 materials ready');
      expect(count).toHaveTextContent('2/6');
      expect(screen.getAllByText('materials ready · used by agents in Recruitment › Pitch Materials')[0]).toBeInTheDocument();
    });

    it('P19.21-T3 AC-6 draws the six in the server’s order, in one list with no required/optional split', async () => {
      render();
      await screen.findByText('FAQ');
      const list = screen.getByRole('list', { name: /materials ready/ });
      expect(within(list).getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent)).toEqual(TITLES);
      expect(screen.queryByText('Optional')).not.toBeInTheDocument();
      expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });

    it('P19.21-T3 AC-6 each row: its file and day or “Not uploaded yet”, its state in words, and one button', async () => {
      render();
      await screen.findByText('FAQ');
      expect(within(row('Opportunity Overview')).getByText('Opportunity_Overview_v3.pdf · 1 Oct 2026')).toBeInTheDocument();
      expect(within(row('Opportunity Overview')).getByText('Needs checking')).toBeInTheDocument();
      expect(within(row('Opportunity Overview')).getByRole('button', { name: /^View Opportunity Overview/ })).toHaveTextContent('View');
      expect(within(row('Proof & Credibility')).getByText('Ready')).toBeInTheDocument();
      expect(within(row('Proof & Credibility')).getByRole('button', { name: 'Replace, Proof & Credibility' })).toHaveTextContent('Replace');
      expect(within(row('FAQ')).getByText('Not uploaded yet')).toBeInTheDocument();
      expect(within(row('FAQ')).getByText('Missing')).toBeInTheDocument();
      expect(within(row('FAQ')).getByRole('button', { name: 'Upload file, FAQ' })).toHaveTextContent('Upload file');
      expect(screen.getByText('Any format: PDF, PowerPoint, Word, image, video, or a link')).toBeInTheDocument();
    });

    it('P19.21-T3 AC-6 a material given as a link reads “Link · day” and counts as ready', async () => {
      const linked = view(MOCKUP.slots.map((s) => (s.slot === 'faq'
        ? { ...s, state: 'uploaded' as const, link: { url: VIDEO, addedOn: '2026-11-18' }, version: 1 } : s)));
      render({ body: linked });
      expect(await within(await screen.findByText('FAQ').then(() => row('FAQ'))).findByText('Link · 18 Nov 2026')).toBeInTheDocument();
      expect(within(row('FAQ')).getByText('Ready')).toBeInTheDocument();
      expect(screen.getByLabelText('3 of 6 materials ready')).toHaveTextContent('3/6');
    });

    it('P19.21-T3 AC-6 renders a file’s name as text, never as markup', async () => {
      const hostile = view(MOCKUP.slots.map((s) => (s.slot === 'faq'
        ? { ...s, state: 'uploaded' as const, file: file('<img src=x onerror=alert(1)>.pdf'), version: 1 } : s)));
      render({ body: hostile });
      await screen.findByText('FAQ');
      expect(within(row('FAQ')).getByText(/<img src=x onerror=alert\(1\)>\.pdf/)).toBeInTheDocument();
      expect(document.querySelector('img[src="x"]')).toBeNull();
    });
  });

  describe('any format (P19.21-T3 AC-6)', () => {
    it('P19.21-T3 AC-6 signs a PowerPoint as what it is, sends it to storage and attaches it; the list is read again', async () => {
      const faq = slotOf('faq', 'FAQ', { state: 'uploaded', file: file('FAQ.pptx', PPTX, '2026-11-20'), version: 1 });
      const after = view(MOCKUP.slots.map((s) => (s.slot === 'faq' ? faq : s)));
      const stub = render([{ body: MOCKUP }, { body: after }], OWNER, {
        'POST /kpm/settings/recruitment-pitch/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/recruitment-pitch/faq': { body: faq },
      });
      await screen.findByText('FAQ');
      await userEvent.upload(picker('FAQ'), fileOf('FAQ.pptx', PPTX, 14_336));

      expect(await within(row('FAQ')).findByText('FAQ.pptx · 20 Nov 2026')).toBeInTheDocument();
      expect(JSON.parse(calls(stub, '/recruitment-pitch/uploads', 'POST')[0].init.body as string))
        .toEqual({ filename: 'FAQ.pptx', mimeType: PPTX, bytes: 14_336 });
      expect(JSON.parse(calls(stub, '/recruitment-pitch/faq', 'PUT')[0].init.body as string)).toEqual({ storageKey: SIGNED.storageKey });
      expect(await screen.findByLabelText('3 of 6 materials ready')).toBeInTheDocument();
    });

    it.each([
      ['a Word file a desktop reports with no type', 'FAQ.docx', '', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a video', 'walkthrough.mp4', 'video/mp4', 'video/mp4'],
      ['a QuickTime video', 'walkthrough.mov', 'video/quicktime', 'video/quicktime'],
      ['an image', 'poster.png', 'image/png', 'image/png'],
    ])('P19.21-T3 AC-6 takes %s, signed as its type', async (_n, name, type, signedAs) => {
      const stub = render({ body: MOCKUP }, OWNER, {
        'POST /kpm/settings/recruitment-pitch/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/recruitment-pitch/faq': { body: MOCKUP.slots[2] },
      });
      await screen.findByText('FAQ');
      await userEvent.upload(picker('FAQ'), fileOf(name, type), { applyAccept: false });
      await waitFor(() => expect(calls(stub, '/recruitment-pitch/uploads', 'POST')).toHaveLength(1));
      expect(JSON.parse(calls(stub, '/recruitment-pitch/uploads', 'POST')[0].init.body as string).mimeType).toBe(signedAs);
    });

    it('P19.21-T3 AC-6 refuses what is no pitch format before anything is sent, saying a link would do', async () => {
      const stub = render();
      await screen.findByText('FAQ');
      await userEvent.upload(picker('FAQ'), fileOf('setup.exe', 'application/x-msdownload'), { applyAccept: false });
      expect(await within(row('FAQ')).findByText(
        '“setup.exe” is not a pitch format. Upload a PDF, PowerPoint, Word file, image or video — or give a link.',
      )).toBeInTheDocument();
      expect(calls(stub, '/recruitment-pitch/uploads', 'POST')).toEqual([]);
    });

    it('P19.21-T3 AC-6 refuses a file over 25 MB before anything is sent, pointing a long video to a link', async () => {
      const stub = render();
      await screen.findByText('FAQ');
      await userEvent.upload(picker('FAQ'), fileOf('long.mp4', 'video/mp4', 26 * 1024 * 1024));
      expect(await within(row('FAQ')).findByText(/A file can be 25 MB at most — give a longer video as a link\./)).toBeInTheDocument();
      expect(calls(stub, '/recruitment-pitch/uploads', 'POST')).toEqual([]);
    });

    it('P19.21-T3 AC-6 the picker offers every pitch format', async () => {
      render();
      await screen.findByText('FAQ');
      const accept = picker('FAQ').getAttribute('accept') ?? '';
      for (const ext of ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.png', '.jpg', '.mp4', '.webm', '.mov', '.html']) {
        expect([ext, accept.split(',').includes(ext)]).toEqual([ext, true]);
      }
    });
  });

  describe('a link (P19.21-T3 AC-6)', () => {
    it('P19.21-T3 AC-6 ⋯ › Use a link saves an https address, and the row reads the link', async () => {
      const linked = slotOf('faq', 'FAQ', { state: 'uploaded', link: { url: VIDEO, addedOn: '2026-11-20' }, version: 1 });
      const stub = render([{ body: MOCKUP }, { body: view(MOCKUP.slots.map((s) => (s.slot === 'faq' ? linked : s))) }], OWNER, {
        'PUT /kpm/settings/recruitment-pitch/faq/link': { body: linked },
      });
      await screen.findByText('FAQ');
      await userEvent.click(within(row('FAQ')).getByRole('button', { name: 'More for FAQ' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use a link' }));
      const dialog = await screen.findByRole('dialog', { name: 'A link for FAQ' });
      await userEvent.type(within(dialog).getByLabelText('Address (https://)'), VIDEO);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(row('FAQ')).findByText('Link · 20 Nov 2026')).toBeInTheDocument();
      expect(JSON.parse(calls(stub, '/recruitment-pitch/faq/link', 'PUT')[0].init.body as string)).toEqual({ url: VIDEO });
    });

    it('P19.21-T3 AC-6 shows the server’s refusal of a link in the sheet, and keeps what was typed', async () => {
      render({ body: MOCKUP }, OWNER, {
        'PUT /kpm/settings/recruitment-pitch/faq/link': {
          status: 400,
          body: { error: { code: 'VALIDATION_FAILED', message: 'A link must be a full https:// address of at most 2,000 characters, with no user name or password in it.', requestId: 'r-1' } },
        },
      });
      await screen.findByText('FAQ');
      await userEvent.click(within(row('FAQ')).getByRole('button', { name: 'More for FAQ' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use a link' }));
      const dialog = await screen.findByRole('dialog', { name: 'A link for FAQ' });
      await userEvent.type(within(dialog).getByLabelText('Address (https://)'), 'http://example.com');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(await within(dialog).findByText(/must be a full https:\/\/ address/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Address (https://)')).toHaveValue('http://example.com');
    });

    it('P19.21-T3 AC-6 opens a link in a new tab cut from this page, never through the API', async () => {
      const linked = view(MOCKUP.slots.map((s) => (s.slot === 'faq'
        ? { ...s, state: 'uploaded' as const, link: { url: VIDEO, addedOn: '2026-11-18' }, version: 1 } : s)));
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const stub = render({ body: linked });
      await screen.findByText('FAQ');
      await userEvent.click(within(row('FAQ')).getByRole('button', { name: 'More for FAQ' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Open link' }));
      expect(open).toHaveBeenCalledWith(VIDEO, '_blank', 'noopener,noreferrer');
      expect(calls(stub, '/url')).toEqual([]);
    });
  });

  describe('what the cards held stays, behind View', () => {
    it('P19.21-T3 AC-6 View opens the material’s sheet: its checklist ticks, pinned to the file’s version', async () => {
      const ticked = { ...MOCKUP.slots[0], checklist: checklist(['career-path', 'income']) };
      const stub = render({ body: MOCKUP }, OWNER, {
        'PUT /kpm/settings/recruitment-pitch/opportunity/confirmations/income': { body: ticked },
      });
      await screen.findByText('FAQ');
      await userEvent.click(within(row('Opportunity Overview')).getByRole('button', { name: /^View Opportunity Overview/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Opportunity Overview' });
      await userEvent.click(within(sheet).getByRole('checkbox', { name: LABELS.income }));
      await waitFor(() => expect(calls(stub, '/confirmations/income', 'PUT')).toHaveLength(1));
      expect(JSON.parse(calls(stub, '/confirmations/income', 'PUT')[0].init.body as string)).toEqual({ ticked: true, version: 1 });
    });
  });

  describe('who writes (positive and negative)', () => {
    it.each([['the Owner', OWNER], ['a core leader', CORE_LEADER]])('P19.21-T3 AC-6 %s is offered upload, replace and a link', async (_n, me) => {
      render({ body: MOCKUP }, me);
      await screen.findByText('FAQ');
      expect(within(row('FAQ')).getByRole('button', { name: 'Upload file, FAQ' })).toBeInTheDocument();
      await userEvent.click(within(row('FAQ')).getByRole('button', { name: 'More for FAQ' }));
      expect(screen.getByRole('menuitem', { name: 'Use a link' })).toBeInTheDocument();
    });

    it('P19.21-T3 AC-6 a read-only support session reads the list with nothing to change: View only', async () => {
      render({ body: MOCKUP }, SUPPORT_READ_ONLY);
      await screen.findByText('FAQ');
      expect(within(row('FAQ')).queryByRole('button', { name: /Upload/ })).not.toBeInTheDocument();
      expect(within(row('FAQ')).queryByRole('button', { name: 'More for FAQ' })).not.toBeInTheDocument();
      expect(within(row('Proof & Credibility')).getByRole('button', { name: /^View Proof/ })).toBeInTheDocument();
      expect(document.querySelectorAll('input[type=file]')).toHaveLength(0);
    });

    it('P19.21-T3 AC-6 a field member is refused the page', async () => {
      render({ body: MOCKUP }, AGENT);
      await waitFor(() => expect(screen.queryByText('FAQ')).not.toBeInTheDocument());
    });
  });

  describe('the states the mockup lacks (Fills)', () => {
    it('shows a skeleton while the materials load', async () => {
      stubFetch({ 'GET /recruitment/pitch-materials': { body: MOCKUP } });
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
      renderWithSession(<RecruitmentPitchPage />, { me: OWNER });
      expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Loading the pitch documents…');
    });

    it('says the read failed, and reads again on Try again', async () => {
      const stub = render([
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The server stumbled.', requestId: 'r-9' } } },
        { body: MOCKUP },
      ]);
      expect(await screen.findByText('Could not read the pitch documents.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('FAQ')).toBeInTheDocument();
      expect(calls(stub, '/recruitment/pitch-materials')).toHaveLength(2);
    });

    it('asks only by slot code: no office, member or company is named in a request', async () => {
      const stub = render();
      await screen.findByText('FAQ');
      for (const c of stub.calls) expect(c.url).not.toMatch(/kpm-1|mem-1/);
    });
  });
});

describe('P19.2-T3 AC-4 the recruitment pitch’s targets (UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([390, 768])('P19.21-T3 AC-6 at %ipx finds no target under 44px', async (px) => {
    atWidth(px);
    render();
    const frame = document.body.firstElementChild!;
    frame.setAttribute('data-surface', 'v1');
    await screen.findByText('FAQ');
    expect(smallTargets(frame, px)).toEqual([]);
  });
});
