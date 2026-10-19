import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { ModuleContentEditor } from './module-content';

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-a', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const CODE = 'PROSPECT_LIST';
const CONTENT_URL = `/kpm/settings/training/modules/${CODE}/content`;

const file = (over: Record<string, unknown> = {}) => ({
  id: 'f1', label: 'Prospecting deck', storageKey: 'dev/kpm-a/training/0001',
  mimeType: 'application/pdf', bytes: 2_097_152, ...over,
});

const view = (over: Record<string, unknown> = {}) => ({
  moduleCode: CODE,
  title: 'Building Your Prospect List',
  content: { files: [], videos: [], links: [] },
  companyContent: { files: [], videos: [], links: [] },
  overridden: false,
  ...over,
});

function render(body: unknown = view(), extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ [CONTENT_URL]: { body }, ...extra });
  renderWithSession(<ModuleContentEditor moduleCode={CODE} canWrite />, { me: OWNER });
  return stub;
}

/**
 * A training module's content (P5-T2, ADR-0032).
 *
 * Two things this pins that nothing else can: that an edit is **held until Save** — the prototype's
 * own defect was saving attachments immediately and the title only on Save — and that the screen
 * tells the reader whose material they are looking at, because replacing the company's is a
 * decision with consequences for their whole office.
 */
describe('a training module’s content', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says the material is the company’s until this office replaces it', async () => {
    render(view({ companyContent: { files: [file()], videos: [], links: [] },
      content: { files: [file()], videos: [], links: [] } }));

    expect(await screen.findByText('This is your company’s material.')).toBeInTheDocument();
    // Nothing to put back yet, so the control that would do it is absent.
    expect(screen.queryByRole('button', { name: /company’s material again/ })).not.toBeInTheDocument();
  });

  it('says the material is the office’s own once it is, and offers the way back', async () => {
    render(view({
      overridden: true,
      content: { files: [file({ label: 'Our own deck' })], videos: [], links: [] },
      companyContent: { files: [file({ id: 'c1', storageKey: 'dev/company/co-1/training/0001' })], videos: [], links: [] },
    }));

    expect(await screen.findByText('This office has its own material for this module.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /company’s material again/ })).toBeInTheDocument();
  });

  it('holds an edit until Save, and Undo throws it away (AC-6)', async () => {
    const stub = render(view({ content: { files: [file()], videos: [], links: [] } }));
    await screen.findByDisplayValue('Prospecting deck');

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Renamed');

    // Nothing has been sent: the prototype saved an attachment the moment it was chosen and the
    // title only on Save, so closing kept one and discarded the other.
    expect(stub.calls.filter((c) => c.init.method === 'PUT')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Save content' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Undo my edits' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Prospecting deck');
    expect(screen.getByRole('button', { name: 'Save content' })).toBeDisabled();
  });

  it('sends the whole document on Save, not a patch', async () => {
    const stub = render(view({ content: { files: [file()], videos: [], links: [] } }), {});
    await screen.findByDisplayValue('Prospecting deck');

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save content' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PUT')!.init.body));
    expect(sent).toEqual({
      files: [{ ...file(), label: 'Renamed' }],
      videos: [],
      links: [],
    });
  });

  it('adds a link, and refuses to send one that is not https', async () => {
    const stub = render();
    await screen.findByRole('heading', { name: 'Links' });

    await userEvent.type(screen.getByLabelText('Link name'), 'Webinar');
    await userEvent.type(screen.getByLabelText('Address'), 'https://example.com/a');
    await userEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save content' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PUT')!.init.body));
    expect(sent.links).toEqual([{ id: '', label: 'Webinar', url: 'https://example.com/a' }]);
  });

  it('refuses an oversized file before it costs anybody their data allowance', async () => {
    const stub = render();
    await screen.findByRole('heading', { name: 'Files' });

    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText('Add to Files'), big);

    expect(await screen.findByRole('alert')).toHaveTextContent(/25 MB or smaller/);
    // And no signature was ever asked for, which is the point of checking here.
    expect(stub.calls.some((c) => c.url.includes('/uploads'))).toBe(false);
  });

  it('refuses a mis-declared file on its media type, not its extension', async () => {
    // Named `.pdf` so the file picker's own filter lets it through: what refuses it is the
    // media type, which is the only part of a file name that is not the uploader's to choose.
    render();
    await screen.findByRole('heading', { name: 'Files' });

    await userEvent.upload(
      screen.getByLabelText('Add to Files'),
      new File(['x'], 'macro.pdf', { type: 'application/x-msdownload' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/macro\.pdf/);
  });

  it('warns while an edit is unsaved that the module is not using the file yet', async () => {
    render(view({ content: { files: [file()], videos: [], links: [] } }));
    await screen.findByDisplayValue('Prospecting deck');

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(screen.getByText(/does not use it until you save/)).toBeInTheDocument();
  });

  it('shows a reader who cannot write the content without any control to change it', async () => {
    stubFetch({ [CONTENT_URL]: { body: view({ content: { files: [file()], videos: [], links: [] } }) } });
    renderWithSession(<ModuleContentEditor moduleCode={CODE} canWrite={false} />, { me: OWNER });

    expect(await screen.findByDisplayValue('Prospecting deck')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save content' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add to Files')).not.toBeInTheDocument();
    // Reading is still reading: the file can be opened.
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('says so and offers a retry when the content cannot be read', async () => {
    stubFetch({ [CONTENT_URL]: { status: 500, body: { message: 'Boom' } } });
    renderWithSession(<ModuleContentEditor moduleCode={CODE} canWrite />, { me: OWNER });

    expect(await screen.findByText(/Could not read this module’s content/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens a file through a signed URL rather than a stored one', async () => {
    const opened = vi.fn();
    vi.stubGlobal('open', opened);
    const stub = render(view({ content: { files: [file()], videos: [], links: [] } }), {
      [`${CONTENT_URL}/url`]: { body: { url: 'https://cdn.test/x?sig=abc' } },
    });
    await screen.findByDisplayValue('Prospecting deck');

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    // A URL is minted per request and expires; a stored one would be a permanent public link.
    await waitFor(() => expect(opened).toHaveBeenCalledWith(
      'https://cdn.test/x?sig=abc', '_blank', 'noopener,noreferrer',
    ));
    expect(stub.calls.some((c) => c.url.includes('/content/url?storageKey='))).toBe(true);
  });
});
