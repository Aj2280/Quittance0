/**
 * The create form's draft (issue #442).
 *
 * The landing page renders the form only while the wallet gate is ready, so a
 * Freighter disconnect or lock unmounts it - and the amount, client email and
 * description the person had typed went with it. The epic asks for those fields
 * to survive, explicitly without storing secrets, and allows sessionStorage.
 *
 * So this module keeps exactly the fields a person types, in sessionStorage
 * (per tab, gone when the tab closes), and nothing else: no public key, no
 * signature, no balance, no invoice id. An unknown or malformed entry is
 * ignored rather than thrown, and a fully empty draft removes the entry so a
 * finished invoice does not come back to haunt the next visit.
 */

const DRAFT_KEY = 'quittance.create-draft.v1';

/** The only fields that may be persisted: all of them are typed by a person. */
const DRAFT_FIELDS = Object.freeze([
  'amount',
  'assetCode',
  'description',
  'sellerName',
  'sellerEmail',
  'customerName',
  'customerEmail',
  'expiresInDays',
]);

const EXPIRY_MIN = 1;
const EXPIRY_MAX = 30;

function draftStorage() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    // A browser with storage disabled throws on access; a draft is optional.
    return null;
  }
}

function pickDraftFields(values) {
  const draft = {};

  for (const field of DRAFT_FIELDS) {
    const value = values ? values[field] : undefined;

    if (field === 'expiresInDays') {
      if (Number.isInteger(value) && value >= EXPIRY_MIN && value <= EXPIRY_MAX) {
        draft[field] = value;
      }
      continue;
    }

    if (typeof value === 'string' && value !== '') {
      draft[field] = value;
    }
  }

  return draft;
}

/** The stored draft, or an empty object when there is none or it is unusable. */
function loadInvoiceDraft() {
  const store = draftStorage();
  if (!store) return {};

  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return pickDraftFields(parsed);
  } catch {
    return {};
  }
}

/** Store the draft; an empty draft clears it instead of writing blanks. */
function saveInvoiceDraft(values) {
  const store = draftStorage();
  if (!store) return;

  const draft = pickDraftFields(values);

  try {
    if (Object.keys(draft).length === 0) {
      store.removeItem(DRAFT_KEY);
      return;
    }
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota or a privacy mode that refuses writes: the form still works.
  }
}

function clearInvoiceDraft() {
  const store = draftStorage();
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do: the draft was never a requirement.
  }
}

module.exports = {
  DRAFT_FIELDS,
  DRAFT_KEY,
  clearInvoiceDraft,
  loadInvoiceDraft,
  saveInvoiceDraft,
};
