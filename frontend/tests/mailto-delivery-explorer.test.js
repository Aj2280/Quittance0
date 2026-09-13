const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canSendProofEmail,
  buildProofMailto,
} = require('../lib/mailto-delivery.js');

const TX_HASH = 'b'.repeat(64);

const baseInvoice = {
  id: '01234567-89ab-cdef-0123-456789abcdef',
  amount: 150.5,
  assetCode: 'USDC',
  status: 'PAID',
  customerName: 'Alice Customer',
  customerEmail: 'alice@example.com',
  sellerPublicKey: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  paymentTxHash: TX_HASH,
};

const PUBLIC_URL = `https://stellar.expert/explorer/public/tx/${TX_HASH}`;
const TESTNET_URL = `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`;

function bodyOf(mailto) {
  return decodeURIComponent(mailto.split('&body=')[1]);
}

function withEnv(value, run) {
  const previous = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  } else {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = value;
  }
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = previous;
    }
  }
}

test('an invoice without a network falls back to the app default (testnet)', () => {
  const body = withEnv(undefined, () => bodyOf(buildProofMailto({ ...baseInvoice })));

  assert.ok(body.includes(`Explorer: ${TESTNET_URL}`));
  assert.ok(!body.includes(PUBLIC_URL));
});

test('the app network configuration decides when the invoice has none', () => {
  const publicBody = withEnv('PUBLIC', () => bodyOf(buildProofMailto({ ...baseInvoice })));
  assert.ok(publicBody.includes(`Explorer: ${PUBLIC_URL}`));

  const testnetBody = withEnv('TESTNET', () => bodyOf(buildProofMailto({ ...baseInvoice })));
  assert.ok(testnetBody.includes(`Explorer: ${TESTNET_URL}`));

  const mainnetBody = withEnv('MAINNET', () => bodyOf(buildProofMailto({ ...baseInvoice })));
  assert.ok(mainnetBody.includes(`Explorer: ${PUBLIC_URL}`));
});

test("an invoice's own network wins over the app configuration", () => {
  const body = withEnv('TESTNET', () =>
    bodyOf(buildProofMailto({ ...baseInvoice, network: 'PUBLIC' }))
  );

  assert.ok(body.includes(`Explorer: ${PUBLIC_URL}`));
  assert.ok(!body.includes(TESTNET_URL));
});

test('the mailto carries the transaction hash next to the explorer link', () => {
  const body = withEnv('TESTNET', () => bodyOf(buildProofMailto({ ...baseInvoice })));

  assert.ok(body.includes(`Transaction Hash: ${TX_HASH}`));
  assert.ok(body.includes(`Explorer: ${TESTNET_URL}`));
});

test('a malformed or missing hash adds no explorer link and does not throw', () => {
  const shortHash = withEnv('TESTNET', () =>
    bodyOf(buildProofMailto({ ...baseInvoice, paymentTxHash: 'deadbeef' }))
  );
  assert.ok(!shortHash.includes('Explorer:'));

  const noHash = withEnv('TESTNET', () =>
    bodyOf(buildProofMailto({ ...baseInvoice, paymentTxHash: undefined }))
  );
  assert.ok(!noHash.includes('Explorer:'));
  assert.ok(!noHash.includes('Transaction Hash:'));
});

test('special characters in the body survive the mailto round trip', () => {
  const memo = 'INV & co? = 100% #tag/é';
  const mailto = withEnv('TESTNET', () =>
    buildProofMailto({ ...baseInvoice, memo })
  );

  // Two separators only: everything user-supplied is percent-encoded.
  assert.equal(mailto.split('&').length, 2);
  assert.ok(bodyOf(mailto).includes(`Memo: ${memo}`));
});

test('unpaid invoices and missing recipients stay unavailable', () => {
  assert.equal(canSendProofEmail({ ...baseInvoice, status: 'PENDING' }), false);
  assert.equal(
    canSendProofEmail({ ...baseInvoice, customerEmail: '', payerEmail: '' }),
    false
  );
  assert.throws(
    () => buildProofMailto({ ...baseInvoice, status: 'PENDING' }),
    /Payment proof is available only after the invoice is paid/
  );
  assert.throws(
    () => buildProofMailto({ ...baseInvoice, customerEmail: '', payerEmail: '' }),
    /Client or payer email is required to email payment proof/
  );
});
