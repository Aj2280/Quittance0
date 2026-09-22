export const PAY_SESSION_KEY: string;
export const PAY_SESSION_FIELDS: readonly string[];

export interface PaySession {
  invoiceId?: string;
  txHash?: string;
}

export function loadPaySession(): PaySession;
export function savePaySession(values: PaySession): void;
export function clearPaySession(): void;
