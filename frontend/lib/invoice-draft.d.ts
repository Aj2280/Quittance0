export const DRAFT_KEY: string;
export const DRAFT_FIELDS: readonly string[];

export interface InvoiceDraft {
  amount?: string;
  assetCode?: string;
  description?: string;
  sellerName?: string;
  sellerEmail?: string;
  customerName?: string;
  customerEmail?: string;
  expiresInDays?: number;
}

export function loadInvoiceDraft(): InvoiceDraft;
export function saveInvoiceDraft(values?: Partial<InvoiceDraft>): void;
export function clearInvoiceDraft(): void;
