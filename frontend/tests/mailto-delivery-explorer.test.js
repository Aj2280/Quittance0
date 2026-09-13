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

function decodeBody(mailto) {
  const bodyPart = mailto.split('&body=')[1];
  return decodeURIComponent(bodyPart);
}

test('paid proof carries the transaction hash and the public explorer link', () => {
  const mailto = buildProofMailto({ ...baseInvoice, network: 'PUBLIC' }, 'https://quittance.example.com');

  assert.ok(mailto.includes(encodeURIComponent(`Transaction Hash: ${TX_HASH}`)));
  assert.ok(
    mailto.includes(
      encodeURIComponent(`Explorer: https://stellar.expert/explorer/public/tx/${TX_HASH}`)
    )
  );
});

test('testnet invoices get the testnet explorer link', () => {
  const mailto = buildProofMailto({ ...baseInvoice, network: 'TESTNET' }, 'https://quittance.example.com');

  assert.ok(
    mailto.includes(
      encodeURIComponent(`Explorer: https://stellar.expert/explorer/testnet/tx/${TX_HASH}`)
    )
  );
  assert.ok(!mailto.includes(encodeURIComponent('https://stellar.expert/explorer/public/tx')));
});

test('a malformed or missing hash adds no explorer link and does not throw', () => {
  const shortHash = buildProofMailto(
    { ...baseInvoice, paymentTxHash: 'deadbeef' },
    'https://quittance.example.com'
  );
  assert.ok(!decodeBody(shortHash).includes('Explorer:')); 

  const noHash = buildProofMailto(
    { ...baseInvoice, paymentTxHash: undefined },
    'https://quittance.example.com'
  );
  const body = decodeBody(noHash);
  assert.ok(!body.includes('Explorer:'));
  assert.ok(!body.includes('Transaction Hash:'));
});

test('special characters in the body survive the mailto round trip', () => {
  const memo = 'INV & co? = 100% #tag/é';
  const description = 'Deposit 50% upfront';
  const mailto = buildProofMailto(
    { ...baseInvoice, memo, description, network: 'PUBLIC' },
    'https://quittance.example.com'
  );

  // Two separators only: everything user-supplied is percent-encoded.
  assert.equal(mailto.split('&').length, 2);

  const body = decodeBody(mailto);
  assert.ok(body.includes(`Memo: ${memo}`));
  assert.ok(body.includes(`Explorer: https://stellar.expert/explorer/public/tx/${TX_HASH}`));
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
