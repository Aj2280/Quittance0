export type LatePaymentWarningCode =
  | 'PAYMENT_RECEIVED_AFTER_EXPIRY'
  | 'PAYMENT_RECEIVED_AFTER_CANCEL';

export interface WorkspaceAccessResult {
  allowed: boolean;
  reason?: 'NOT_FOUND' | 'UNAUTHENTICATED' | 'FORBIDDEN';
  expectedSeller?: string;
}

export interface WorkspaceActionVisibility {
  canCancel: boolean;
  canShare: boolean;
  canEmailInvoice: boolean;
  canDownloadProof: boolean;
  canEmailProof: boolean;
  canViewExplorer: boolean;
  effectiveStatus: string;
}

export interface TimelineItem {
  id: string;
  label: string;
  timestamp?: string | Date | null;
  status: 'completed' | 'active' | 'cancelled' | 'expired' | 'warning';
  description?: string;
  expiresAt?: string | Date;
  txHash?: string;
  explorerUrl?: string | null;
  payerPublicKey?: string;
  warningCode?: string;
}

export declare const LATE_PAYMENT_WARNINGS: Record<LatePaymentWarningCode, string>;

export declare function canAccessInvoiceWorkspace(
  invoice: any,
  userWallet: string | null | undefined
): WorkspaceAccessResult;

export declare function workspaceActionVisibility(
  invoice: any,
  now?: number
): WorkspaceActionVisibility;

export declare function buildInvoiceTimeline(
  invoice: any,
  network?: string,
  now?: number
): TimelineItem[];
