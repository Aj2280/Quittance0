/**
 * Issue #442 - the create draft survives a disconnect, and holds no secrets.
 *
 * The page unmounts the form whenever the wallet gate is not ready, so these
 * cases are about what a person gets back when it remounts: the fields they
 * typed, and nothing about their wallet.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DRAFT_FIELDS,
  DRAFT_KEY,
  clearInvoiceDraft,
  loadInvoiceDraft,
  saveInvoiceDraft,
} = require('../lib/invoice-draft');

function installFakeStorage() {
  const entries = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => (entries.has(key) ? entries.get(key) : null),
      setItem: (key, value) => {
        entries.set(key, String(value));
      },
      removeItem: (key) => {
        entries.delete(key);
      },
    },
  };
  return entries;
}

function removeFakeStorage() {
  delete globalThis.window;
}

const draft = () => ({
  amount: '25.50',
  assetCode: 'USDC',
  description: 'Design work',
  sellerName: 'Rudra',
  sellerEmail: 'me@example.com',
  customerName: 'Client',
  customerEmail: 'client@example.com',
  expiresInDays: 14,
});

test('a typed draft survives a remount', () => {
  const entries = installFakeStorage();
  try {
    saveInvoiceDraft(draft());
    assert.deepEqual(loadInvoiceDraft(), draft());
    assert.ok(entries.has(DRAFT_KEY));
  } finally {
    removeFakeStorage();
  }
});

test('only the fields a person types are ever written', () => {
  const entries = installFakeStorage();
  try {
    saveInvoiceDraft({
      ...draft(),
      publicKey: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      sellerSecretKey: 'SAAAA',
      balance: '100.00',
      invoiceId: 'inv_123',
    });

    const stored = JSON.parse(entries.get(DRAFT_KEY));
    assert.deepEqual(Object.keys(stored).sort(), [...DRAFT_FIELDS].sort());
    assert.equal(JSON.stringify(stored).includes('GA5ZSEY'), false, 'no wallet key is stored');
    assert.equal(JSON.stringify(stored).includes('SAAAA'), false, 'no secret is stored');
  } finally {
    removeFakeStorage();
  }
});

test('a finished invoice clears the draft instead of leaving blanks', () => {
  const entries = installFakeStorage();
  try {
    saveInvoiceDraft(draft());
    assert.ok(entries.has(DRAFT_KEY));

    saveInvoiceDraft({ amount: '', description: '', expiresInDays: 0 });
    assert.equal(entries.has(DRAFT_KEY), false);

    saveInvoiceDraft(draft());
    clearInvoiceDraft();
    assert.equal(entries.has(DRAFT_KEY), false);
    assert.deepEqual(loadInvoiceDraft(), {});
  } finally {
    removeFakeStorage();
  }
});

test('a malformed or hostile entry is ignored, not thrown', () => {
  const entries = installFakeStorage();
  try {
    entries.set(DRAFT_KEY, 'not json');
    assert.deepEqual(loadInvoiceDraft(), {});

    entries.set(DRAFT_KEY, JSON.stringify(['an', 'array']));
    assert.deepEqual(loadInvoiceDraft(), {});

    entries.set(
      DRAFT_KEY,
      JSON.stringify({ amount: 12, description: 42, expiresInDays: 999, assetCode: 'XLM' })
    );
    assert.deepEqual(loadInvoiceDraft(), { assetCode: 'XLM' });
  } finally {
    removeFakeStorage();
  }
});

test('without sessionStorage the draft is simply unavailable', () => {
  assert.deepEqual(loadInvoiceDraft(), {});
  saveInvoiceDraft(draft());
  clearInvoiceDraft();
});
