import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletApiService } from './wallet-api.service';

describe('WalletApiService', () => {
  const fetchMock = vi.fn();
  const api = new WalletApiService();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a wallet using a TEST document', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: 'verification-1',
      wallet_id: 'wallet-1',
      scenario: 'APPROVED',
      status: 'ACTIVE'
    }), { status: 201 }));

    await api.createWallet('12345678');

    expect(fetchMock).toHaveBeenCalledWith('/api/crear-wallet', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ documentType: 'TEST', document: 'TEST-12345678' })
    }));
  });

  it('consults a KYC verification by its ID', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: 'verification/1',
      wallet_id: 'wallet-1',
      scenario: 'APPROVED',
      status: 'ACTIVE'
    })));

    await api.consultVerification('verification/1');

    expect(fetchMock).toHaveBeenCalledWith('/api/consultar-kyc/verification%2F1', undefined);
  });

  it('consults wallet balances by wallet ID', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: 'wallet-1',
      status: 'ACTIVE',
      balance: 260080,
      reserved: 15000,
      available: 245080,
      currency: 'PEN'
    })));

    await api.consultWallet('wallet-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/consulta-estado-saldos/wallet-1', undefined);
  });
});