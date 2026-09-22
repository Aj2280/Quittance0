/**
 * UTC date formatters for exported documents (issue #509).
 *
 * `date-fns/format` renders in the host's local timezone, so the same paid
 * invoice printed "Sep 13" on one machine and "Sep 12" on another. Proof and
 * invoice documents must hash identically on every host, so every timestamp
 * they print goes through these helpers — UTC only, no locale calls.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * "Sep 22, 2026" — UTC calendar date, month name spelled out.
 * Returns null for missing or unparseable input.
 */
export function formatUtcDate(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${MONTHS[date.getUTCMonth()]} ${pad(date.getUTCDate())}, ${date.getUTCFullYear()}`;
}

/**
 * "Sep 22, 2026, 18:04 UTC" — UTC date plus HH:mm, explicitly labelled.
 * Returns null for missing or unparseable input.
 */
export function formatUtcDateTime(value) {
  const date = toDate(value);
  if (!date) return null;
  const datePart = `${MONTHS[date.getUTCMonth()]} ${pad(date.getUTCDate())}, ${date.getUTCFullYear()}`;
  return `${datePart}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
