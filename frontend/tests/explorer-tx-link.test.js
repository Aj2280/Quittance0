const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHorizonTxUrl, resolveExplorerNetwork } = require('../lib/explorer-tx-link.ts');
const {
  explorerTxLinkFixture,
  explorerTxLinkErrorFixture,
  explorerNetworkFixture,
} = require('./fixtures/explorer-tx-link.fixture');

for (const { name, txHash, network, expected } of explorerTxLinkFixture) {
  test(`buildHorizonTxUrl ${name}`, () => {
    assert.equal(buildHorizonTxUrl(txHash, network), expected);
  });
}

for (const { name, txHash, network } of explorerTxLinkErrorFixture) {
  test(`buildHorizonTxUrl ${name}`, () => {
    assert.equal(buildHorizonTxUrl(txHash, network), null);
  });
}

/**
 * The network rule has one implementation, shared by the receipt, the proof
 * email and the printed proof (issue #431). A hardcoded 'public' in any of
 * them would send a testnet seller to a page that never shows their
 * transaction, so the precedence is pinned here.
 */
for (const { name, invoice, network, expected } of explorerNetworkFixture) {
  test(`resolveExplorerNetwork ${name}`, () => {
    const previous = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    if (network === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = network;
    }

    try {
      assert.equal(resolveExplorerNetwork(invoice), expected);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
      } else {
        process.env.NEXT_PUBLIC_STELLAR_NETWORK = previous;
      }
    }
  });
}
