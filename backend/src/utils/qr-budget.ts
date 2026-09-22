import QRCode from 'qrcode';

/**
 * QR payload budget for SEP-0007 payment URIs (issue #510).
 *
 * Dense QRs fail on mobile cameras even when the URI is spec-valid: the pay
 * page renders the code at ~220px, so each module drops below ~3px once the
 * version grows past ~12. The budget therefore caps the encoded URI at QR
 * version 12 under error-correction level H (~175 byte-mode bytes in this
 * build of `qrcode`), which an XLM invoice with a memo fits and a USDC URI
 * with code + issuer + memo exceeds.
 *
 * When a URI is over budget the QR must fall back to the short HTTPS pay
 * link — never a truncated memo or a dropped asset issuer.
 */
export const SEP7_QR_MAX_VERSION = 12;

/**
 * The minimal QR version `qrcode` would encode `text` at, under the same
 * error-correction level the payment QR is generated with.
 */
export const qrVersionFor = (text: string): number =>
  QRCode.create(text, { errorCorrectionLevel: 'H' }).version;

/** Whether a SEP-0007 URI stays inside the scannable QR budget. */
export const fitsSep7QrBudget = (uri: string): boolean =>
  qrVersionFor(uri) <= SEP7_QR_MAX_VERSION;
