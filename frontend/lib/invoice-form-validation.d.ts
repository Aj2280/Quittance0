export const FIELD_INPUT_IDS: Record<string, string>;
export const FIELD_ORDER: readonly string[];

export function formFieldErrors(values?: Record<string, unknown>): Record<string, string>;
export function fieldErrorsFromApiError(error: unknown): Record<string, string>;
export function fieldErrorSummary(fieldErrors: Record<string, string>): string | null;
export function firstInvalidFieldId(fieldErrors: Record<string, string>): string | null;
