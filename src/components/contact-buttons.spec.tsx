import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ContactButtons, LeadContactButtons, MemberContactButtons, whatsAppHref } from './contact-buttons';

/** A tab WhatsApp's chat is pointed at once the number lands, as the sheet opens it during the tap. */
function stubTab() {
  const tab = { location: { href: '' }, close: vi.fn(), opener: {} as unknown };
  vi.stubGlobal('open', vi.fn(() => tab));
  return tab;
}

describe('ContactButtons (UI V1, UI-081; D-22)', () => {
  beforeEach(() => { window.location.hash = ''; });
  afterEach(() => vi.unstubAllGlobals());

  it('UI-081 with a number: one tap opens WhatsApp or the dialler — plain links, never disabled, line icons', () => {
    renderWithSession(<ContactButtons name="Ibu Melati" phone="0812-1100-2200" onSave={vi.fn()} />);
    const wa = screen.getByRole('link', { name: 'Send a WhatsApp message to Ibu Melati' });
    expect(wa).toHaveAttribute('href', 'https://wa.me/6281211002200');
    expect(wa).toHaveAttribute('target', '_blank');
    expect(wa.querySelector('.bg-whatsapp')).not.toBeNull();
    const call = screen.getByRole('link', { name: 'Call Ibu Melati' });
    expect(call).toHaveAttribute('href', 'tel:+6281211002200');
    expect(call.querySelector('.bg-navy')).not.toBeNull();
    expect(document.querySelector('[disabled]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/📞/);
  });

  it('UI-081 36–40px circles inside a 44px target', () => {
    renderWithSession(<ContactButtons name="Ibu Melati" phone="0812-1100-2200" onSave={vi.fn()} size={36} />);
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    expect(wa).toHaveClass('h-11', 'w-11');
    expect(wa.firstElementChild).toHaveClass('h-9', 'w-9');
  });

  it('UI-101 the reminder’s message typed in, encoded; WhatsApp only where the caller says', () => {
    renderWithSession(
      <ContactButtons name="Ugiek" phone="+6281311002203" whatsAppText="Halo Ugiek 👋 Yuk lapor" channels={['whatsapp']} onSave={vi.fn()} />,
    );
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href', `https://wa.me/6281311002203?text=${encodeURIComponent('Halo Ugiek 👋 Yuk lapor')}`,
    );
    expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
    expect(whatsAppHref(null)).toBeNull();
  });

  it('UI-081 without a number: the button stays live and opens "Isi nomor WhatsApp" with the name under it', async () => {
    renderInIndonesian(<ContactButtons name="Ibu Shinta" phone={null} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kirim pesan WhatsApp ke Ibu Shinta' }));
    // The sheet's module is fetched on the first tap that needs it (P18.99-T16).
    const sheet = await screen.findByRole('dialog', { name: 'Isi nomor WhatsApp' });
    expect(sheet).toHaveAccessibleDescription('Ibu Shinta');
    const field = within(sheet).getByLabelText('Nomor WhatsApp');
    expect(field).toHaveAttribute('inputmode', 'tel');
    expect(field).toHaveClass('text-[1rem]');
    expect(field).toHaveFocus();
    expect(within(sheet).getByText('+62')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });

  it('UI-081 an invalid number shows the inline error under the field, and nothing is sent', async () => {
    const onSave = vi.fn();
    renderInIndonesian(<ContactButtons name="Ibu Shinta" phone={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    // The sheet's module is fetched on the first tap that needs it (P18.99-T16).
    await userEvent.type(await screen.findByLabelText('Nomor WhatsApp'), '0812-345');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByText('Isi 9 sampai 13 digit setelah +62.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nomor WhatsApp')).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('UI-081 saved: 0 / spaces / dashes stripped to +62…, the toast says "Tersimpan", WhatsApp opens; the next tap goes straight through', async () => {
    const tab = stubTab();
    const onSave = vi.fn(async (phone: string) => phone);
    const onSaved = vi.fn();
    renderInIndonesian(<ContactButtons name="Ibu Shinta" phone={null} onSave={onSave} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await userEvent.type(screen.getByLabelText('Nomor WhatsApp'), '0812 1100-2299');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onSave).toHaveBeenCalledWith('+6281211002299');
    expect(await screen.findByText('Tersimpan')).toBeInTheDocument();
    expect(tab.location.href).toBe('https://wa.me/6281211002299');
    expect(tab.opener).toBeNull();
    expect(onSaved).toHaveBeenCalledWith('+6281211002299');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6281211002299');
  });

  it('UI-081 a failed save says why in the sheet and closes the tab it opened', async () => {
    const tab = stubTab();
    const onSave = vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'NOT_FOUND', status: 404 }); });
    renderWithSession(<ContactButtons name="Ibu Shinta" phone={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '81211002299');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(tab.close).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('the wired buttons (UI-081: a lead’s number; D-22: a member’s)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-081 a lead’s number saves to the lead, the pair with its email, pinned by its version', async () => {
    stubTab();
    const { calls } = stubFetch({
      'PATCH /leads/l-1': ({ body }) => ({ body: { id: 'l-1', name: 'Ibu Melati', contact: (body as { contact: unknown }).contact, version: 4 } }),
    });
    const onSaved = vi.fn();
    renderWithSession(
      <LeadContactButtons lead={{ id: 'l-1', name: 'Ibu Melati', contact: { phone: null, email: 'm@x.test' }, version: 3 }} onSaved={onSaved} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812-1100-2200');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');
    const call = calls.find((c) => c.url.endsWith('/leads/l-1'))!;
    expect(call.init.method).toBe('PATCH');
    expect(JSON.parse(String(call.init.body))).toEqual({ contact: { phone: '+6281211002200', email: 'm@x.test' }, version: 3 });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }));
  });

  it('D-22 a member’s number saves to their account: PUT /members/:membershipId/phone', async () => {
    stubTab();
    const { calls } = stubFetch({ 'PUT /members/m-7/phone': { body: { membershipId: 'm-7', phone: '+6285711002206' } } });
    renderInIndonesian(<MemberContactButtons membershipId="m-7" name="Dimas Pratama" phone={null} channels={['whatsapp']} />);
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await userEvent.type(screen.getByLabelText('Nomor WhatsApp'), '+62 857 1100 2206');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await screen.findByText('Tersimpan');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ phone: '+6285711002206' });
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6285711002206');
  });

  it('M1 a member who already has a number: the server’s 409 is said in the sheet, nothing is saved, WhatsApp does not open', async () => {
    const tab = stubTab();
    stubFetch({
      'PUT /members/m-7/phone': {
        status: 409,
        body: {
          error: {
            code: 'MEMBER_PHONE_ON_FILE',
            message: 'Dia sudah memiliki nomor WhatsApp. Hanya dia yang dapat mengubahnya, di Profil saya.',
            requestId: 'r-9',
            details: { membershipId: 'm-7' },
          },
        },
      },
    });
    renderInIndonesian(<MemberContactButtons membershipId="m-7" name="Dimas Pratama" phone={null} channels={['whatsapp']} />);
    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await userEvent.type(screen.getByLabelText('Nomor WhatsApp'), '0857 1100 2206');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Dia sudah memiliki nomor WhatsApp. Hanya dia yang dapat mengubahnya, di Profil saya.',
    );
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
    expect(screen.queryByText('Tersimpan')).not.toBeInTheDocument();
  });
});
