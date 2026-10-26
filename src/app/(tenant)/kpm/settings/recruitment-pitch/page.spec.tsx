import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
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
const file = (name: string, bytes = 2.4 * 1024 * 1024, uploadedOn = '2026-09-12') => ({ name, bytes, uploadedOn });

const opportunity = (over: Partial<PitchSlot> = {}): PitchSlot => ({
  slot: 'opportunity', title: 'Opportunity Overview',
  line: 'The core pitch: the role, what it pays, and what it takes.',
  state: 'missing', file: null, checklist: checklist(), version: 0, ...over,
});
const plain = (slot: PitchSlot['slot'], title: string, over: Partial<PitchSlot> = {}): PitchSlot => ({
  slot, title, line: `${title}'s line`, state: 'missing', file: null, checklist: [], version: 0, ...over,
});

/** The server's counts, worked out here only to keep each fixture consistent with its slots. */
function view(slots: PitchSlot[]): PitchMaterialsView {
  const count = (...s: PitchSlot['state'][]) => slots.filter((x) => s.includes(x.state)).length;
  return {
    slots,
    summary: { done: count('complete', 'uploaded'), total: 4, missing: count('missing'), unconfirmed: count('partial') },
  };
}

/** The prototype's own demonstration state (`:626-661`): one partly confirmed, one uploaded, two missing. */
const DEMO = view([
  opportunity({
    state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path', 'support']), version: 1,
  }),
  plain('proof', 'Proof & Credibility', { state: 'uploaded', file: file('Proof_and_Credibility_2026.pdf', 1.1 * 1024 * 1024, '2026-08-30'), version: 1 }),
  plain('faq', 'FAQ'),
  plain('howtojoin', 'How to Join'),
]);
const EMPTY = view([opportunity(), plain('proof', 'Proof & Credibility'), plain('faq', 'FAQ'), plain('howtojoin', 'How to Join')]);
const COMPLETE = view([
  opportunity({ state: 'complete', file: file('o.pdf'), checklist: checklist(Object.keys(LABELS)), version: 2 }),
  plain('proof', 'Proof & Credibility', { state: 'uploaded', file: file('p.pdf'), version: 1 }),
  plain('faq', 'FAQ', { state: 'uploaded', file: file('f.pdf'), version: 1 }),
  plain('howtojoin', 'How to Join', { state: 'uploaded', file: file('h.pdf'), version: 1 }),
]);

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});
const OFFICE_READ = ['member:read_profile', 'kpm:read_profile', 'tenant_config:read', 'recruitment:read'];
const OWNER = makeMe({ membership: member({ isKpmOwner: true }), permissions: [...OFFICE_READ, 'tenant_config:write'] });
const ADMIN = makeMe({ membership: member({ isKpmAdmin: true }), permissions: [...OFFICE_READ, 'tenant_config:write'] });
/** A read-only support session as the Owner: the server resolves every write permission away. */
const SUPPORT_READ_ONLY = makeMe({
  membership: member({ isKpmOwner: true }), permissions: OFFICE_READ,
  isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support',
});
const field = (orgLevelCode: string, hierarchyRole: 'ab' | 'aab' | 'agent') => makeMe({
  membership: member({ orgLevelCode, hierarchyRole }),
  permissions: ['member:read_profile', 'tenant_config:read', 'recruitment:read'],
});

/** A GCS signed POST policy, as the API answers since Phase 18.7 (ADR-0153). */
const SIGNED = gcsSignedUpload('dev/kpm-1/recruitment-pitch/01NEW');

function render(read: StubReply | StubReply[] = { body: DEMO }, me = OWNER, extra: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({ 'GET /recruitment/pitch-materials': read, ...extra });
  renderWithSession(<RecruitmentPitchPage />, { me });
  return stub;
}

const card = (title: string) => screen.getByRole('article', { name: title });
const pdf = (name: string, size = 1024) => {
  const f = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const picker = (title: string) => card(title).querySelector('input[type=file]') as HTMLInputElement;
const calls = (stub: ReturnType<typeof stubFetch>, fragment: string, method = 'GET') =>
  stub.calls.filter((c) => c.url.includes(fragment) && (c.init.method ?? 'GET') === method);

// ---------------------------------------------------------------------------------------- specs

describe('Settings › Recruitment pitch (P17-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the page, verbatim (AC-2, D-settings)', () => {
    it('is titled Recruitment pitch, with no sub-line and no toggle', async () => {
      render();
      expect(await screen.findByRole('heading', { level: 1, name: 'Recruitment pitch' })).toBeInTheDocument();
      await screen.findByRole('article', { name: 'FAQ' });
      expect(screen.getByRole('heading', { level: 1 }).parentElement?.querySelector('p')).toBeNull();
      expect(screen.queryByText(/Viewing as/)).not.toBeInTheDocument();
    });

    it('draws the banner from the server’s counts, its ring named for somebody who cannot see it', async () => {
      render();
      const ring = await screen.findByRole('img', { name: '1 of 4 documents complete' });
      expect(ring).toHaveTextContent('1/4');
      expect(screen.getByText('Recruitment Pitch is incomplete')).toBeInTheDocument();
      expect(screen.getByText(
        '2 not uploaded, 1 uploaded but not fully confirmed — not yet ready to rely on for candidates.',
      )).toBeInTheDocument();
    });

    it('says when it is complete, in the prototype’s words', async () => {
      render({ body: COMPLETE });
      expect(await screen.findByRole('img', { name: '4 of 4 documents complete' })).toHaveTextContent('4/4');
      expect(screen.getByText('Recruitment Pitch is complete')).toBeInTheDocument();
      expect(screen.getByText(
        'All 4 documents are uploaded and fully confirmed — ready to show or send to a candidate.',
      )).toBeInTheDocument();
      expect(within(card('Opportunity Overview')).getByText('Complete')).toBeInTheDocument();
    });

    it('draws the four cards in the server’s order, each with its badge in words', async () => {
      render();
      await screen.findByRole('article', { name: 'FAQ' });
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
        .toEqual(['Opportunity Overview', 'Proof & Credibility', 'FAQ', 'How to Join']);
      expect(within(card('Opportunity Overview')).getByText('2/4 confirmed')).toBeInTheDocument();
      expect(within(card('Proof & Credibility')).getByText('Uploaded')).toBeInTheDocument();
      expect(within(card('FAQ')).getByText('Missing')).toBeInTheDocument();
      expect(within(card('How to Join')).getByText('Missing')).toBeInTheDocument();
    });

    it('shows a file’s own name, size and day, and the missing line on a dashed card', async () => {
      render();
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      expect(within(opp).getByText('Opportunity_Overview_v3.pdf')).toBeInTheDocument();
      expect(within(opp).getByText('2,4 MB · updated 12 Sep 2026')).toBeInTheDocument();
      expect(within(card('Proof & Credibility')).getByText('1,1 MB · updated 30 Agu 2026')).toBeInTheDocument();
      expect(within(card('FAQ')).getByText('No PDF uploaded yet — candidates can\'t be shown this document.')).toBeInTheDocument();
      expect(card('FAQ').className).toContain('border-dashed');
      expect(opp.className).not.toContain('border-dashed');
    });

    it('writes none of OD-39’s six words of its own, refusals included (AC-8, D-copy)', async () => {
      render({ body: DEMO }, OWNER, {
        'PUT /confirmations/income': { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'x', requestId: 'r' } } },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));
      await within(opp).findByText(/replaced while the page was open/);
      fireEvent.change(picker('FAQ'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await within(card('FAQ')).findByText(/is not a PDF/);
      expect(document.body.textContent).not.toMatch(/\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i);
    });

    it('does not draw a slot’s line, which the prototype defines and never renders', async () => {
      render();
      await screen.findByRole('article', { name: 'FAQ' });
      expect(screen.queryByText(/The core pitch/)).not.toBeInTheDocument();
    });

    it('renders a file’s name as text, never as markup (contradiction 3)', async () => {
      const name = '<b>bold</b><script>window.hacked=1</script>.pdf';
      render({ body: view([opportunity({ state: 'partial', file: file(name), version: 1 }), ...DEMO.slots.slice(1)]) });
      expect(await screen.findByText(name)).toBeInTheDocument();
      expect(card('Opportunity Overview').querySelector('b')).toBeNull();
      expect(card('Opportunity Overview').querySelector('script')).toBeNull();
    });
  });

  describe('who reaches it, and who writes (AC-5, AC-8)', () => {
    it.each([['the Owner', OWNER], ['the Admin', ADMIN]])('gives %s every control', async (_who, me) => {
      render({ body: DEMO }, me);
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      expect(within(opp).getByRole('group', { name: 'Confirm this PDF actually includes' })).toBeInTheDocument();
      for (const box of within(opp).getAllByRole('checkbox')) expect(box).toBeEnabled();
      expect(within(opp).getByRole('button', { name: /^View PDF, Opportunity Overview/ })).toBeInTheDocument();
      expect(within(opp).getByRole('button', { name: 'Replace, Opportunity Overview' })).toBeInTheDocument();
      expect(within(card('FAQ')).getByRole('button', { name: 'Upload PDF, FAQ' })).toBeInTheDocument();
      expect(within(card('FAQ')).queryByRole('button', { name: /View PDF/ })).not.toBeInTheDocument();
    });

    it('draws a read-only support session with nothing to change, the boxes disabled', async () => {
      render({ body: DEMO }, SUPPORT_READ_ONLY);
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      for (const box of within(opp).getAllByRole('checkbox')) expect(box).toBeDisabled();
      expect(within(opp).getByRole('button', { name: /^View PDF/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Replace/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Upload PDF/ })).not.toBeInTheDocument();
      expect(document.querySelector('input[type=file]')).toBeNull();
    });

    it.each([['an AB', field('AB', 'ab')], ['an AAB', field('AAB', 'aab')], ['an agent', field('AGENT', 'agent')]])(
      'refuses %s, and asks the API for nothing',
      async (_who, me) => {
        const stub = render({ body: DEMO }, me);
        expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'kpm:read_profile');
        expect(screen.getByText('Not available to you')).toBeInTheDocument();
        expect(stub.calls).toEqual([]);
      },
    );

    it('asks only by slot code: no office, member or company is ever named in a request', async () => {
      const stub = render({ body: DEMO }, OWNER, {
        '/kpm/settings/recruitment-pitch/opportunity/confirmations/income': {
          body: opportunity({ state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path', 'support', 'income']), version: 1 }),
        },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));
      await waitFor(() => expect(calls(stub, '/confirmations/income', 'PUT')).toHaveLength(1));
      for (const c of stub.calls) expect(c.url).not.toMatch(/kpm-1|mem-1|kpmId|companyId/);
    });
  });

  describe('the checklist (AC-3, D-replace)', () => {
    it('writes a tick at once, pinned to the file’s version, and the banner is the server’s again', async () => {
      const after = opportunity({
        state: 'complete', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(Object.keys(LABELS)), version: 1,
      });
      const stub = render([{ body: DEMO }, { body: view([after, ...DEMO.slots.slice(1)]) }], OWNER, {
        'PUT /kpm/settings/recruitment-pitch/opportunity/confirmations/income': {
          body: opportunity({ state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path', 'support', 'income']), version: 1 }),
        },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));

      const [put] = calls(stub, '/confirmations/income', 'PUT');
      expect(JSON.parse(put.init.body as string)).toEqual({ ticked: true, version: 1 });
      await waitFor(() => expect(calls(stub, '/recruitment/pitch-materials')).toHaveLength(2));
      expect(await screen.findByRole('img', { name: '2 of 4 documents complete' })).toBeInTheDocument();
    });

    it('unticks with ticked false', async () => {
      const stub = render({ body: DEMO }, OWNER, {
        'PUT /confirmations/support': { body: DEMO.slots[0] },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.support }));
      await waitFor(() => expect(calls(stub, '/confirmations/support', 'PUT')).toHaveLength(1));
      expect(JSON.parse(calls(stub, '/confirmations/support', 'PUT')[0].init.body as string))
        .toEqual({ ticked: false, version: 1 });
    });

    it('reads the slot again and says so when the file was replaced since (409)', async () => {
      const replaced = opportunity({ state: 'partial', file: file('Opportunity_Overview_v4.pdf'), version: 2 });
      const stub = render([{ body: DEMO }, { body: view([replaced, ...DEMO.slots.slice(1)]) }], OWNER, {
        'PUT /confirmations/income': {
          status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'The slot changed.', requestId: 'r-1' } },
        },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));

      expect(await within(opp).findByText(/This PDF was replaced while the page was open/)).toBeInTheDocument();
      expect(await within(opp).findByText('Opportunity_Overview_v4.pdf')).toBeInTheDocument();
      for (const box of within(opp).getAllByRole('checkbox')) expect(box).not.toBeChecked();
      expect(calls(stub, '/recruitment/pitch-materials')).toHaveLength(2);
    });

    it('says when a tick could not be saved for another reason, and the box goes back', async () => {
      render({ body: DEMO }, OWNER, {
        'PUT /confirmations/income': {
          status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r-2' } },
        },
      });
      const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));
      expect(await within(opp).findByText('Could not save that tick.')).toBeInTheDocument();
      expect(within(opp).getByText('Something broke.')).toBeInTheDocument();
      expect(within(opp).getByRole('checkbox', { name: LABELS.income })).not.toBeChecked();
    });

    it('draws no checklist on a slot that has none, nor on one with no file', async () => {
      render({ body: EMPTY });
      await screen.findByRole('article', { name: 'FAQ' });
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirm this PDF actually includes')).not.toBeInTheDocument();
    });

    describe('P18.95-T1 AC-5 — each tick says it is saved, beside its box', () => {
      /** The save confirmation in the box's own row: the nearest ancestor with a status for a child. */
      const besides = (el: HTMLElement) => {
        for (let box = el.parentElement; box; box = box.parentElement) {
          const own = [...box.children].find((c) => c.getAttribute('role') === 'status');
          if (own) return own as HTMLElement;
          if (box.tagName === 'FIELDSET') break;
        }
        return null;
      };
      const ticked = opportunity({
        state: 'partial', file: file('Opportunity_Overview_v3.pdf'), checklist: checklist(['career-path', 'support', 'income']), version: 1,
      });
      const RETRY = `Couldn't save — retry: ${LABELS.income}, Opportunity Overview`;

      it('P18.95-T1 AC-5: a tick says Saved ✓ beside its box once it is kept, and nowhere else', async () => {
        render([{ body: DEMO }, { body: view([ticked, ...DEMO.slots.slice(1)]) }], OWNER, {
          'PUT /confirmations/income': { body: ticked },
        });
        const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
        const box = within(opp).getByRole('checkbox', { name: LABELS.income });

        await userEvent.click(box);

        await waitFor(() => expect(besides(box)).toHaveTextContent('Saved ✓'));
        expect(besides(box)).toHaveClass('text-success');
        expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
        expect(besides(within(opp).getByRole('checkbox', { name: LABELS.support }))).toBeNull();
      });

      it('P18.95-T1 AC-5: a tick that fails says Couldn’t save — retry, and the retry sends the same tick again', async () => {
        const stub = render([{ body: DEMO }, { body: view([ticked, ...DEMO.slots.slice(1)]) }], OWNER, {
          'PUT /confirmations/income': [
            { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r-3' } } },
            { body: ticked },
          ],
        });
        const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
        const box = within(opp).getByRole('checkbox', { name: LABELS.income });
        await userEvent.click(box);

        const retry = await within(opp).findByRole('button', { name: RETRY });
        expect(besides(box)).toContainElement(retry);
        // What the card said before still stands where it did, and the box still goes back.
        expect(within(opp).getByText('Could not save that tick.')).toBeInTheDocument();
        expect(box).not.toBeChecked();

        await userEvent.click(retry);

        await waitFor(() => expect(calls(stub, '/confirmations/income', 'PUT')).toHaveLength(2));
        const [first, again] = calls(stub, '/confirmations/income', 'PUT');
        expect(JSON.parse(again.init.body as string)).toEqual({ ticked: true, version: 1 });
        expect(again.init.body).toBe(first.init.body);
        await waitFor(() => expect(besides(box)).toHaveTextContent('Saved ✓'));
        expect(box).toBeChecked();
        expect(box).toHaveFocus();
        expect(within(opp).queryByText('Could not save that tick.')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
      });

      it('P18.95-T1 AC-5: a tick refused because the file was replaced (409) leaves nothing to retry', async () => {
        const replaced = opportunity({ state: 'partial', file: file('Opportunity_Overview_v4.pdf'), version: 2 });
        render([{ body: DEMO }, { body: view([replaced, ...DEMO.slots.slice(1)]) }], OWNER, {
          'PUT /confirmations/income': {
            status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'The slot changed.', requestId: 'r-4' } },
          },
        });
        const opp = await screen.findByRole('article', { name: 'Opportunity Overview' });
        await userEvent.click(within(opp).getByRole('checkbox', { name: LABELS.income }));

        expect(await within(opp).findByText(/This PDF was replaced while the page was open/)).toBeInTheDocument();
        expect(await within(opp).findByText('Opportunity_Overview_v4.pdf')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
        expect(besides(within(opp).getByRole('checkbox', { name: LABELS.income }))).toBeNull();
      });
    });
  });

  describe('uploading and replacing (AC-4)', () => {
    it('refuses a file too large in its own words, before anything is sent', async () => {
      const stub = render();
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.upload(picker('FAQ'), pdf('huge.pdf', 26 * 1024 * 1024));

      expect(await within(card('FAQ')).findByText('“huge.pdf” is 26,0 MB. A PDF can be 25 MB at most.')).toBeInTheDocument();
      expect(calls(stub, '/uploads', 'POST')).toEqual([]);
    });

    it('refuses a file that is not a PDF, before anything is sent', async () => {
      const stub = render();
      await screen.findByRole('article', { name: 'FAQ' });
      fireEvent.change(picker('FAQ'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });

      expect(await within(card('FAQ')).findByText('“photo.png” is not a PDF. Only a PDF can be uploaded here.')).toBeInTheDocument();
      expect(calls(stub, '/uploads', 'POST')).toEqual([]);
    });

    it('signs, sends to storage, attaches, and the card and the banner show the new file', async () => {
      const faq = plain('faq', 'FAQ', { state: 'uploaded', file: file('faq.pdf', 14_336, '2026-10-09'), version: 1 });
      const stub = render([{ body: DEMO }, { body: view([DEMO.slots[0], DEMO.slots[1], faq, DEMO.slots[3]]) }], OWNER, {
        'POST /kpm/settings/recruitment-pitch/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/recruitment-pitch/faq': { body: faq },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.upload(picker('FAQ'), pdf('faq.pdf', 14_336));

      expect(await within(card('FAQ')).findByText('faq.pdf')).toBeInTheDocument();
      expect(within(card('FAQ')).getByText('14 KB · updated 9 Okt 2026')).toBeInTheDocument();
      expect(JSON.parse(calls(stub, '/recruitment-pitch/uploads', 'POST')[0].init.body as string))
        .toEqual({ filename: 'faq.pdf', mimeType: 'application/pdf', bytes: 14_336 });
      // The signed policy's own fields, then the file — what storage checks the upload against.
      const sent = calls(stub, GCS_UPLOAD_URL, 'POST')[0].init.body as FormData;
      expect(sent.get('key')).toBe(SIGNED.storageKey);
      expect(sent.get('x-goog-signature')).toBe(SIGNED.fields['x-goog-signature']);
      expect([...sent.keys()].at(-1)).toBe('file');
      expect(JSON.parse(calls(stub, '/recruitment-pitch/faq', 'PUT')[0].init.body as string))
        .toEqual({ storageKey: SIGNED.storageKey });
      expect(await screen.findByRole('img', { name: '2 of 4 documents complete' })).toBeInTheDocument();
      expect(screen.getByText('“faq.pdf” attached.')).toHaveClass('sr-only');
    });

    it('shows the upload in progress in the card', async () => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => { release = resolve; });
      stubFetch({
        'GET /recruitment/pitch-materials': { body: DEMO },
        'POST /kpm/settings/recruitment-pitch/uploads': { body: SIGNED },
        'PUT /kpm/settings/recruitment-pitch/faq': { body: DEMO.slots[2] },
      });
      const base = globalThis.fetch;
      vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith(GCS_UPLOAD_URL)) { await held; return { ok: true, status: 204 } as Response; }
        return base(url, init);
      }));
      renderWithSession(<RecruitmentPitchPage />, { me: OWNER });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.upload(picker('FAQ'), pdf('faq.pdf'));

      expect(await within(card('FAQ')).findByText('Uploading “faq.pdf”…')).toBeInTheDocument();
      expect(within(card('FAQ')).getByRole('button', { name: 'Upload PDF, FAQ' })).toHaveAttribute('aria-disabled', 'true');
      release();
      await waitFor(() => expect(within(card('FAQ')).queryByText('Uploading “faq.pdf”…')).not.toBeInTheDocument());
    });

    it('says what the server refused, in the card, and attaches nothing', async () => {
      const stub = render({ body: DEMO }, OWNER, {
        'POST /kpm/settings/recruitment-pitch/uploads': {
          status: 400, body: { error: { code: 'ASSET_TOO_LARGE', message: 'Files must be 25 MB or smaller.', requestId: 'r-3' } },
        },
      });
      await screen.findByRole('article', { name: 'FAQ' });
      await userEvent.upload(picker('FAQ'), pdf('faq.pdf'));

      expect(await within(card('FAQ')).findByText('Files must be 25 MB or smaller.')).toBeInTheDocument();
      expect(calls(stub, '/recruitment-pitch/faq', 'PUT')).toEqual([]);
    });

    it('the walk: upload, tick two, replace — every box clear, 0/4 confirmed, the banner recounted (exit criterion 1)', async () => {
      const v1 = file('Opportunity_Overview_v3.pdf');
      const v2 = file('Opportunity_Overview_v4.pdf', 3 * 1024 * 1024, '2026-10-09');
      const s = (state: PitchSlot['state'], f: typeof v1 | null, ticks: string[], version: number) =>
        opportunity({ state, file: f, checklist: checklist(ticks), version });
      const rest = EMPTY.slots.slice(1);
      const at = (o: PitchSlot) => ({ body: view([o, ...rest]) });

      const stub = render([
        at(s('missing', null, [], 0)),
        at(s('partial', v1, [], 1)),
        at(s('partial', v1, ['career-path'], 1)),
        at(s('partial', v1, ['career-path', 'income'], 1)),
        at(s('partial', v2, [], 2)),
      ], OWNER, {
        'POST /kpm/settings/recruitment-pitch/uploads': { body: SIGNED },
        [GCS_UPLOAD_URL]: { status: 204 },
        'PUT /kpm/settings/recruitment-pitch/opportunity': [
          { body: s('partial', v1, [], 1) },
          { body: s('partial', v2, [], 2) },
        ],
        'PUT /confirmations/career-path': { body: s('partial', v1, ['career-path'], 1) },
        'PUT /confirmations/income': { body: s('partial', v1, ['career-path', 'income'], 1) },
      });

      await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.upload(picker('Opportunity Overview'), pdf('Opportunity_Overview_v3.pdf'));
      const opp = () => card('Opportunity Overview');
      expect(await within(opp()).findByText('0/4 confirmed')).toBeInTheDocument();

      await userEvent.click(within(opp()).getByRole('checkbox', { name: LABELS['career-path'] }));
      expect(await within(opp()).findByText('1/4 confirmed')).toBeInTheDocument();
      await userEvent.click(within(opp()).getByRole('checkbox', { name: LABELS.income }));
      expect(await within(opp()).findByText('2/4 confirmed')).toBeInTheDocument();
      expect(within(opp()).getByRole('checkbox', { name: LABELS.income })).toBeChecked();

      await userEvent.upload(picker('Opportunity Overview'), pdf('Opportunity_Overview_v4.pdf'));
      expect(await within(opp()).findByText('Opportunity_Overview_v4.pdf')).toBeInTheDocument();
      expect(within(opp()).getByText('0/4 confirmed')).toBeInTheDocument();
      for (const box of within(opp()).getAllByRole('checkbox')) expect(box).not.toBeChecked();
      await waitFor(() => expect(calls(stub, '/recruitment/pitch-materials')).toHaveLength(5));
      expect(screen.getByText(
        '3 not uploaded, 1 uploaded but not fully confirmed — not yet ready to rely on for candidates.',
      )).toBeInTheDocument();
      expect(screen.getByText('“Opportunity_Overview_v4.pdf” attached. Its ticks are cleared.')).toBeInTheDocument();
    });
  });

  describe('View PDF (contradiction 6)', () => {
    it('asks for a signed link when pressed, and opens it in a new tab cut from this page', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      vi.stubGlobal('open', vi.fn(() => tab));
      const stub = render({ body: DEMO }, OWNER, {
        '/recruitment/pitch-materials/proof/url': { body: { url: 'https://cdn.test/proof?sig=1', expiresAt: '2999-01-01T00:00:00Z' } },
      });
      const proof = await screen.findByRole('article', { name: 'Proof & Credibility' });
      await userEvent.click(within(proof).getByRole('button', { name: 'View PDF, Proof & Credibility — opens in a new tab' }));

      await waitFor(() => expect(tab.location.href).toBe('https://cdn.test/proof?sig=1'));
      expect(tab.opener).toBeNull();
      expect(calls(stub, '/url')).toHaveLength(1);
    });
  });

  describe('the states the prototype lacks (AC-6, Fills)', () => {
    it('shows a skeleton while the slots load', async () => {
      stubFetch({ 'GET /recruitment/pitch-materials': { body: DEMO } });
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
      renderWithSession(<RecruitmentPitchPage />, { me: OWNER });
      expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Loading the pitch documents…');
    });

    it('says the read failed, and reads again on Try again', async () => {
      const stub = render([
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The server stumbled.', requestId: 'r-9' } } },
        { body: DEMO },
      ]);
      expect(await screen.findByText('Could not read the pitch documents.')).toBeInTheDocument();
      expect(screen.getByText('The server stumbled.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('article', { name: 'FAQ' })).toBeInTheDocument();
      expect(calls(stub, '/recruitment/pitch-materials')).toHaveLength(2);
    });
  });
});
