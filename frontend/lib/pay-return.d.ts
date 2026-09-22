export const RETURN_URL_KEYS: readonly string[];

export interface PayReturnParse {
  txHash: string | null;
  ignored: string[];
}

export function buildPayCallbackUrl(origin: string, invoiceId: string): string | null;
export function isAllowedPayReturnUrl(candidate: string, origin: string): boolean;
export function parsePayReturnSearch(search: string, origin: string): PayReturnParse;
