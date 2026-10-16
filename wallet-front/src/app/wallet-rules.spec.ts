import { describe, expect, it } from 'vitest';
import { isValidDni, isValidPenAmount, parseDemoPaymentQr } from './wallet-rules';

describe('isValidDni', () => {
  it('accepts exactly eight digits', () => {
    expect(isValidDni('12345678')).toBe(true);
  });

  it.each(['1234567', '123456789', '1234abcd', ''])('rejects invalid DNI: %s', (value) => {
    expect(isValidDni(value)).toBe(false);
  });
});

describe('isValidPenAmount', () => {
  it.each(['0.01', '250', '499.99', '500.00'])('accepts a valid amount: %s', (value) => {
    expect(isValidPenAmount(value)).toBe(true);
  });

  it.each(['0', '0.00', '500.01', '-1', '1.001', 'abc', ''])('rejects an invalid amount: %s', (value) => {
    expect(isValidPenAmount(value)).toBe(false);
  });
});

describe('parseDemoPaymentQr', () => {
  it('reads the merchant and amount from the expected demo QR format', () => {
    expect(parseDemoPaymentQr('wallet://pay?customer=Caf%C3%A9%20Origen&amount=16.50')).toEqual({
      customer: 'Café Origen',
      amount: '16.50'
    });
  });

  it.each([
    'https://pay?customer=Comercio&amount=10.00',
    'wallet://pay?amount=10.00',
    'wallet://pay?customer=Comercio&amount=501.00',
    'not a URL'
  ])('rejects unsupported QR data: %s', (value) => {
    expect(parseDemoPaymentQr(value)).toBeNull();
  });
});
