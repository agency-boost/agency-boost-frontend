import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import { LINK, requestedTransfer, shared, TODAY } from '@test/joining-fixtures';
import { inviteMessage } from '@/lib/invites';
import { AddAgentDialog } from './add-agent-form';

const fill = async (over: Partial<Record<'code' | 'name' | 'phone', string>> = {}) => {
  await userEvent.type(screen.getByLabelText('Agent code'), over.code ?? '80777');
  await userEvent.type(screen.getByLabelText('Name'), over.name ?? 'Yusuf Hidayat');
  await userEvent.type(screen.getByLabelText('WhatsApp number'), over.phone ?? '0812-8077-7001');
};

const open = (props: Partial<Parameters<typeof AddAgentDialog>[0]> = {}) => {
  const onAdded = vi.fn();
  const onClose = vi.fn();
  renderWithSession(<AddAgentDialog open today={TODAY} onAdded={onAdded} onClose={onClose} {...props} />);
  return { onAdded, onClose };
};

describe('+ Add agent, the one form (P18.96-T3 AC-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.96-T3 AC-1 asks for the agent code, the name, the WhatsApp number and the join date — today, and not after it', () => {
    stubFetch({});
    open();
    const dialog = screen.getByRole('dialog', { name: 'Add agent' });
    expect(within(dialog).getByLabelText('Agent code')).toHaveAttribute('inputmode', 'numeric');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('');
    expect(within(dialog).getByLabelText('WhatsApp number')).toHaveAttribute('type', 'tel');
    const date = within(dialog).getByLabelText('Join date');
    expect(date).toHaveValue(TODAY);
    expect(date).toHaveAttribute('max', TODAY);
  });

  it('P18.96-T3 AC-1 holds Add agent until every field is given, and says which are missing', async () => {
    stubFetch({});
    open();
    expect(screen.getByRole('button', { name: 'Add & send invite' })).toBeDisabled();
    // UI-024: grey until filled, with no *Still needed…* line on the screen — a screen reader still hears why.
    expect(screen.getByText('Still needed: Agent code, Name and WhatsApp number.')).toHaveClass('sr-only');
    await fill();
    expect(screen.getByRole('button', { name: 'Add & send invite' })).toBeEnabled();
  });

  it('P18.96-T3 AC-1 says a code with letters, a number WhatsApp cannot open and a later day under their own fields', async () => {
    stubFetch({});
    open();
    await fill({ code: 'PRU-1', phone: '123' });
    expect(screen.getByText('Digits only, as on their contract.')).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('WhatsApp number'));
    expect(await screen.findByText('Enter 9 to 13 digits after +62.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Join date'), { target: { value: '2026-10-28' } });
    expect(screen.getByText(/^The join date cannot be after today, 27 Oct 2026\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add & send invite' })).toBeDisabled();
  });

  it('P18.96-T3 AC-2 an invite turns the dialog into its share step: WhatsApp with the message, the link to copy, a QR', async () => {
    const { calls } = stubFetch({ '/join/my-code': { body: { code: 'ME01', url: 'https://app.test/join?code=ME01' } }, 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared({ leader: { membershipId: 'mem-me', name: 'Me' } }) } } });
    const { onAdded, onClose } = open();
    await fill();
    fireEvent.change(screen.getByLabelText('Join date'), { target: { value: '2026-10-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));

    const post = calls.find((c) => c.url.includes('/new-hires/agents'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({
      agentCode: '80777', fullName: 'Yusuf Hidayat', phone: '+6281280777001', joinDate: '2026-10-20',
    });
    const dialog = await screen.findByRole('dialog', { name: 'Invite Yusuf Hidayat' });
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'invited', link: LINK }));
    // The wa.me link is the invitee's number, as WhatsApp takes it, with the message and the link filled in.
    expect(within(dialog).getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute(
      'href', `https://wa.me/6281280777001?text=${encodeURIComponent(inviteMessage('Yusuf Hidayat', LINK))}`,
    );
    expect(within(dialog).getByText(LINK)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(await within(dialog).findByAltText('QR code for this invite link')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('P18.96-T3 AC-3 a linked account and a transfer requested close the dialog, for the screen to say so', async () => {
    stubFetch({
      'POST /new-hires/agents': [
        { body: { outcome: 'linked', member: { membershipId: 'mem-putri', fullName: 'Putri Anggraini' } } },
        { body: { outcome: 'transfer_requested', transfer: requestedTransfer() } },
      ],
    });
    const { onAdded, onClose } = open();
    await fill({ code: '80008' });
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    expect(onAdded).toHaveBeenLastCalledWith({ outcome: 'linked', member: { membershipId: 'mem-putri', fullName: 'Putri Anggraini' } });
    expect(onClose).toHaveBeenCalledTimes(1);
    await fill({ code: '87014' });
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    expect(onAdded).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'transfer_requested' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('P18.96-T3 AC-2 a refusal stays in the dialog, in the server’s words', async () => {
    stubFetch({
      'POST /new-hires/agents': {
        status: 409,
        body: { error: { code: 'ORG_INVITE_PENDING', message: 'Agent code 80777 already has an invite waiting to be accepted. Resend that one, or cancel it first.', requestId: 'r' } },
      },
    });
    const { onAdded } = open();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has an invite waiting');
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add agent' })).toBeInTheDocument();
  });

  it('P18.96-T3 AC-1 for the Owner or an Admin on somebody’s unit: titled with it, and sends whose unit', async () => {
    const { calls } = stubFetch({ '/join/my-code': { body: { code: 'ME01', url: 'https://app.test/join?code=ME01' } }, 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } } });
    open({ leader: { membershipId: 'mem-sari', name: 'Sari Puspita' } });
    expect(screen.getByRole('dialog', { name: 'Add agent to Sari Puspita’s unit' })).toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    const post = calls.find((c) => c.url.includes('/new-hires/agents'))!;
    expect(JSON.parse(post.init.body as string)).toMatchObject({ leaderMembershipId: 'mem-sari' });
  });

  it('P18.96-T3 AC-2 an invite for an existing account says the link asks them to sign in, and a number WhatsApp cannot open offers no button', async () => {
    stubFetch({ 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared({ existingAccount: true, phone: '12345678' }) } } });
    open();
    await fill({ phone: '0812-8077-7001' });
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    expect(await screen.findByText('Yusuf Hidayat already has an account, so the link asks them to sign in and accept.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Share on WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByText('That number is not one WhatsApp can open. Copy the link and send it another way.')).toBeInTheDocument();
  });

  it('UI-024 the modal opens on the reader’s leader code: Kode leader, Salin tautan · Salin kode · QR · WhatsApp, then atau kirim undangan langsung', async () => {
    stubFetch({ '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } } });
    open();
    const dialog = screen.getByRole('dialog', { name: 'Add agent' });
    expect(await within(dialog).findByText('AGUS01')).toBeInTheDocument();
    const block = dialog.querySelector('[data-invite-share="modal"]') as HTMLElement;
    expect(within(block).getAllByRole('button').map((b) => b.textContent)).toEqual(['Copy link', 'Copy code', 'QR']);
    expect(within(block).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/?text='));
    expect(within(dialog).getByText('or send an invite directly')).toBeInTheDocument();
    // The fixed +62 before the number, and the mockup's examples in the fields.
    expect(within(dialog).getByText('+62')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Agent code')).toHaveAttribute('placeholder', 'e.g. 70012345');
  });

  it('UI-024 on somebody else’s unit (the Owner’s choice) there is no leader code to share: the form alone', async () => {
    const { calls } = stubFetch({});
    open({ leader: { membershipId: 'mem-arief', name: 'Arief Hidayat' } });
    await screen.findByRole('dialog');
    expect(document.querySelector('[data-invite-share]')).toBeNull();
    expect(calls.filter((c) => c.url.includes('/join/my-code'))).toEqual([]);
  });

  it('UI-024 sending the invite on WhatsApp closes the modal and hands the name back for the toast', async () => {
    stubFetch({ 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } } });
    const onSent = vi.fn();
    const { onClose } = open({ onSent });
    await fill({ phone: '812 8077 7001' });
    await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
    const share = await screen.findByRole('link', { name: 'Share on WhatsApp' });
    fireEvent.click(share);
    expect(onClose).toHaveBeenCalled();
    expect(onSent).toHaveBeenCalledWith('Yusuf Hidayat');
  });
});
