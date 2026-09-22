/**
 * The pay page's resumable session (issue #516), mirroring `invoice-draft`.
 *
 * A mobile wallet handoff can kill the tab's state: the page remounts, the
 * polling timer is gone, and the person is asked to paste a hash they may no
 * longer have. This module persists exactly the two non-secret fields needed
 * to resume — the invoice id and the last transaction hash attempted — in
 * sessionStorage (per tab, gone when the tab closes).
 *
 * A transaction hash is public ledger data and the invoice id is the link
 * the payer already holds, so nothing here is a secret. No public keys, no
 * signatures, no wallet tokens are ever stored. A malformed entry is ignored
 * rather than thrown, and a save without both fields clears the entry so a
 * finished session does not leak into the next visit.
 */

const PAY_SESSION_KEY = 'quittance.pay-session.v1';

/** The only fields that may be persisted: invoice id and last tx hash. */
const PAY_SESSION_FIELDS = Object.freeze(['invoiceId', 'txHash']);

function paySessionStorage() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    // A browser with storage disabled throws on access; resume is optional.
    return null;
  }
}

function pickSessionFields(values) {
  const session = {};

  for (const field of PAY_SESSION_FIELDS) {
    const value = values ? values[field] : undefined;
    if (typeof value === 'string' && value !== '') {
      session[field] = value;
    }
  }

  return session;
}

/** The stored session, or an empty object when there is none or it is unusable. */
function loadPaySession() {
  const store = paySessionStorage();
  if (!store) return {};

  try {
    const raw = store.getItem(PAY_SESSION_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return pickSessionFields(parsed);
  } catch {
    return {};
  }
}

/** Store the session; missing fields clear it instead of writing blanks. */
function savePaySession(values) {
  const store = paySessionStorage();
  if (!store) return;

  const session = pickSessionFields(values);

  try {
    // Both fields are required for a useful resume; anything less clears.
    if (PAY_SESSION_FIELDS.some((field) => session[field] === undefined)) {
      store.removeItem(PAY_SESSION_KEY);
      return;
    }
    store.setItem(PAY_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota or a privacy mode that refuses writes: the page still works.
  }
}

function clearPaySession() {
  const store = paySessionStorage();
  if (!store) return;
  try {
    store.removeItem(PAY_SESSION_KEY);
  } catch {
    // Nothing to do: the session was never a requirement.
  }
}

module.exports = {
  PAY_SESSION_FIELDS,
  PAY_SESSION_KEY,
  clearPaySession,
  loadPaySession,
  savePaySession,
};
