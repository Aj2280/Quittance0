import type { InvoiceStatus } from '../storage/invoice-storage';

export type SettlementContext = 'ON_TIME' | 'AFTER_EXPIRY' | 'AFTER_CANCEL';
export type LatePaymentWarningCode =
  | 'PAYMENT_RECEIVED_AFTER_EXPIRY'
  | 'PAYMENT_RECEIVED_AFTER_CANCEL';

export const LATE_PAYMENT_WARNINGS: Record<LatePaymentWarningCode, string> = {
  PAYMENT_RECEIVED_AFTER_EXPIRY: 'Payment was received after this invoice expired.',
  PAYMENT_RECEIVED_AFTER_CANCEL: 'Payment was received after this invoice was cancelled.',
};

export interface SettlementFields {
  settledAt: Date;
  settlementContext: SettlementContext;
  priorStatus?: InvoiceStatus;
  latePaymentWarningCode?: LatePaymentWarningCode;
}

export interface SettlementInvoiceState {
  status: InvoiceStatus;
  cancelledAt?: Date | string | null;
  expiresAt?: Date | string | null;
}

export class SettlementTimeUnavailableError extends Error {
  readonly code = 'TRANSACTION_CLOSE_TIME_UNAVAILABLE';

  constructor(message = 'Transaction close time is unavailable; try verification again later') {
    super(message);
    this.name = 'SettlementTimeUnavailableError';
  }
}

export function parseSettlementTime(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function warningForLatePayment(code: LatePaymentWarningCode): string {
  return LATE_PAYMENT_WARNINGS[code];
}

export function settlementFieldsForInvoice(
  invoice: SettlementInvoiceState,
  settledAtInput: unknown
): SettlementFields {
  const settledAt = parseSettlementTime(settledAtInput);
  if (!settledAt) {
    throw new SettlementTimeUnavailableError();
  }

  if (invoice.status === 'CANCELLED') {
    const cancelledAt = parseSettlementTime(invoice.cancelledAt);
    if (!cancelledAt) {
      throw new SettlementTimeUnavailableError(
        'Invoice cancellation time is unavailable; try verification again later'
      );
    }

    const afterCancel = settledAt.getTime() >= cancelledAt.getTime();
    return {
      settledAt,
      settlementContext: afterCancel ? 'AFTER_CANCEL' : 'ON_TIME',
      priorStatus: 'CANCELLED',
      latePaymentWarningCode: afterCancel ? 'PAYMENT_RECEIVED_AFTER_CANCEL' : undefined,
    };
  }

  // PENDING or EXPIRED: the ledger close time, not the detection time, decides
  // whether the payment landed inside the invoice's lifetime.
  const expiresAt = parseSettlementTime(invoice.expiresAt);
  const afterExpiry = expiresAt
    ? settledAt.getTime() >= expiresAt.getTime()
    : invoice.status === 'EXPIRED';

  return {
    settledAt,
    settlementContext: afterExpiry ? 'AFTER_EXPIRY' : 'ON_TIME',
    priorStatus:
      invoice.status === 'EXPIRED' || afterExpiry ? invoice.status : undefined,
    latePaymentWarningCode: afterExpiry ? 'PAYMENT_RECEIVED_AFTER_EXPIRY' : undefined,
  };
}
