/**
 * The mobile pay return contract (issue #516).
 *
 * A wallet that leaves the browser to sign can bring the payer back to the
 * same invoice page:
 *
 *   <origin>/pay/<invoiceId>?tx=<64-hex transaction hash>
 *
 * That is the only return this module trusts. `tx` must pass `checkTxHash`
 * before the page will auto-verify it, and any return-style parameter
 * (`return_url`, `callback`, `redirect`, `redirect_uri`) is honoured only
 * when it points back at this origin's `/pay/` path — a crafted off-origin
 * value is reported as ignored, never navigated to, so the pay page can
 * never become an open redirect.
 *
 * Nothing here stores or reads secrets: a transaction hash is public ledger
 * data and an invoice id is the link the payer already holds.
 */

const { checkTxHash } = require('./verification');

/** Query parameters a wallet or link may use to name a return location. */
const RETURN_URL_KEYS = Object.freeze([
  'return_url',
  'callback',
  'redirect',
  'redirect_uri',
]);

/**
 * The callback we hand to SEP-0007 wallets: this origin's pay page for the
 * invoice, nothing else. Returns null when the origin or id is unusable so a
 * caller fails closed instead of embedding a nonsense callback.
 */
function buildPayCallbackUrl(origin, invoiceId) {
  if (typeof invoiceId !== 'string' || invoiceId.trim() === '') return null;
  try {
    const url = new URL(`/pay/${encodeURIComponent(invoiceId)}`, origin);
    if (url.origin !== new URL(origin).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * True when `candidate` is a URL on `origin` pointing at this app's `/pay/`
 * path. Everything else — another origin, another path, a non-URL string —
 * is rejected. This is the whole open-redirect guard: it is deliberately
 * small and total.
 */
function isAllowedPayReturnUrl(candidate, origin) {
  if (typeof candidate !== 'string' || candidate.trim() === '') return false;
  try {
    const url = new URL(candidate);
    const expected = new URL(origin);
    if (url.origin !== expected.origin) return false;
    return /^\/pay\/[^/?#]+/.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Classify the query string of a pay-page return.
 *
 * @param {string} search - `window.location.search` or an equivalent string,
 *   with or without the leading `?`.
 * @param {string} origin - the trusted origin, e.g. `window.location.origin`.
 * @returns {{ txHash: string | null, ignored: string[] }} `txHash` is the
 *   validated transaction hash to auto-verify, or null when absent/invalid.
 *   `ignored` names the parameters that were present but rejected.
 */
function parsePayReturnSearch(search, origin) {
  const ignored = [];
  let txHash = null;

  let params;
  try {
    params = new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return { txHash, ignored };
  }

  const rawTx = params.get('tx');
  if (rawTx !== null) {
    const checked = checkTxHash(rawTx);
    if (checked.ok) {
      txHash = checked.value;
    } else {
      ignored.push('tx');
    }
  }

  for (const key of RETURN_URL_KEYS) {
    const value = params.get(key);
    if (value === null) continue;
    // A same-origin /pay/ return is allowed by the contract but carries no
    // action of its own; anything else is refused outright.
    if (!isAllowedPayReturnUrl(value, origin)) ignored.push(key);
  }

  return { txHash, ignored };
}

module.exports = {
  RETURN_URL_KEYS,
  buildPayCallbackUrl,
  isAllowedPayReturnUrl,
  parsePayReturnSearch,
};
