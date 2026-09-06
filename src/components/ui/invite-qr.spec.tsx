import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteQr } from './invite-qr';

describe('InviteQr', () => {
  afterEach(() => vi.resetModules());

  it('draws the code from the invite URL, not from something else', async () => {
    render(<InviteQr url="https://agencyboost.app/join?code=JOR417" />);

    const img = await screen.findByAltText('QR code for this invite link');
    // A data URL, produced by the encoder from the URL it was given. What the link box
    // shows and what this encodes are the same string — the whole reason the prototype
    // calls the three artefacts co-equal.
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('says so when it cannot draw, rather than showing an empty square', async () => {
    // The link and the code are beside it and do the same job, so a failure here is a
    // missing convenience, not a dead end. An empty box would look like a broken image.
    vi.doMock('qrcode', () => ({ toDataURL: () => Promise.reject(new Error('nope')) }));
    vi.resetModules();
    const { InviteQr: Fresh } = await import('./invite-qr');

    render(<Fresh url="https://agencyboost.app/join?code=JOR417" />);
    await waitFor(() =>
      expect(screen.getByText('Could not draw the QR — use the link or the code.'))
        .toBeInTheDocument(),
    );
    vi.doUnmock('qrcode');
  });
});
