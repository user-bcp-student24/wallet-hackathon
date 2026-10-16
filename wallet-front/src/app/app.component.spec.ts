import '@angular/compiler';
import { ChangeDetectorRef } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { KycVerification, WalletApiService } from './wallet-api.service';

describe('AppComponent registration', () => {
  const walletApi = {
    createWallet: vi.fn(),
    consultVerification: vi.fn(),
    consultWallet: vi.fn()
  };
  let component: AppComponent;

  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => key === 'plata-demo-wallet-context'
        ? JSON.stringify({ documentNumber: '12345678', verificationId: 'kyc-1', walletId: 'wallet-1' })
        : null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    walletApi.createWallet.mockReset().mockResolvedValue({
      id: 'kyc-1',
      wallet_id: 'wallet-1',
      scenario: 'APPROVED',
      status: 'ACTIVE'
    } satisfies KycVerification);
    walletApi.consultVerification.mockReset().mockResolvedValue({
      id: 'kyc-1',
      wallet_id: 'wallet-1',
      scenario: 'APPROVED',
      status: 'ACTIVE'
    } satisfies KycVerification);
    walletApi.consultWallet.mockReset().mockResolvedValue({
      id: 'wallet-1',
      status: 'ACTIVE',
      balance: 1000,
      reserved: 0,
      available: 1000,
      currency: 'PEN'
    });
    component = new AppComponent({ markForCheck: vi.fn() } as unknown as ChangeDetectorRef, walletApi as unknown as WalletApiService);
    component.documentNumber = '12345678';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers and enters the app from an ACTIVE response without calling GET endpoints', async () => {
    component.hasVerification = true;
    component.verificationId = 'previous-kyc';
    component.walletId = 'previous-wallet';

    await component.registerCustomer();

    expect(walletApi.createWallet).toHaveBeenCalledWith('12345678');
    expect(walletApi.consultVerification).not.toHaveBeenCalled();
    expect(walletApi.consultWallet).not.toHaveBeenCalled();
    expect(component.onboardingState).toBe('success');
    expect(component.signedIn).toBe(true);
    expect(component.page).toBe('home');
  });

  it('checks the saved verification ID before allowing login', async () => {
    component.loginDocumentNumber = '12345678';

    await component.attemptLogin();

    expect(walletApi.consultVerification).toHaveBeenCalledWith('kyc-1');
    expect(walletApi.consultWallet).toHaveBeenCalledWith('wallet-1');
    expect(component.signedIn).toBe(true);
  });

  it('does not allow login while KYC is pending', async () => {
    walletApi.consultVerification.mockResolvedValue({
      id: 'kyc-1',
      wallet_id: 'wallet-1',
      scenario: 'MANUAL_REVIEW',
      status: 'PENDING'
    });
    component.loginDocumentNumber = '12345678';

    await component.attemptLogin();

    expect(walletApi.consultVerification).toHaveBeenCalledWith('kyc-1');
    expect(walletApi.consultWallet).not.toHaveBeenCalled();
    expect(component.signedIn).toBe(false);
    expect(component.loginMessage).toContain('pendiente');
  });
});