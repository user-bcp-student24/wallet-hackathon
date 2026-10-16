export type DemoQrPayment = { customer: string; amount: string };

export function isValidDni(value: string): boolean {
  return /^\d{8}$/.test(value);
}

export function isValidPenAmount(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 500;
}

export function parseDemoPaymentQr(rawValue: string): DemoQrPayment | null {
  try {
    const parsed = new URL(rawValue);
    const amount = parsed.searchParams.get('amount') ?? '';
    const customer = parsed.searchParams.get('customer') ?? '';
    if (parsed.protocol !== 'wallet:' || parsed.hostname !== 'pay' || !customer || !isValidPenAmount(amount)) {
      return null;
    }
    return { customer, amount };
  } catch {
    return null;
  }
}
