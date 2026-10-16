import { Injectable } from '@angular/core';

export interface KycVerification {
  id: string;
  wallet_id: string;
  scenario: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
}

export interface WalletState {
  id: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  balance: number;
  reserved: number;
  available: number;
  currency: 'PEN';
}

@Injectable({ providedIn: 'root' })
export class WalletApiService {
  private readonly baseUrl = '/api';

  createWallet(documentNumber: string): Promise<KycVerification> {
    return this.request<KycVerification>('/crear-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: 'TEST',
        document: `TEST-${documentNumber}`
      })
    });
  }

  consultVerification(verificationId: string): Promise<KycVerification> {
    return this.request<KycVerification>(`/consultar-kyc/${encodeURIComponent(verificationId)}`);
  }

  consultWallet(walletId: string): Promise<WalletState> {
    return this.request<WalletState>(`/consulta-estado-saldos/${encodeURIComponent(walletId)}`);
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, options);
    } catch {
      throw new Error('No se pudo conectar con el backend de wallet.');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('El backend devolvió una respuesta inválida.');
    }

    if (!response.ok) {
      const errorMessage = typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : `Error HTTP ${response.status}.`;
      throw new Error(errorMessage);
    }

    return body as T;
  }
}