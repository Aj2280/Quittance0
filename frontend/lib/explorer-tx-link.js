// CommonJS twin of explorer-tx-link.ts.
//
// The Node test runner loads plain .js helpers (see lib/payment-proof-policy.js
// and the mailto helpers), while the app imports the typed module. Both keep the
// same base URLs and the same hash validation - update them together if the
// explorer bases ever change.

const EXPLORER_TX_URLS = {
  public: 'https://stellar.expert/explorer/public/tx',
  testnet: 'https://stellar.expert/explorer/testnet/tx',
};

/**
 * Build a Horizon transaction explorer URL for a transaction hash.
 *
 * @param {unknown} txHash - Stellar transaction hash (64-character hex string).
 * @param {string} [network] - Network name; defaults to 'public'.
 * @returns {string|null} Full explorer URL, or null when the hash is missing or malformed.
 */
function buildHorizonTxUrl(txHash, network = 'public') {
  if (typeof txHash !== 'string') {
    return null;
  }

  const normalizedHash = txHash.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(normalizedHash)) {
    return null;
  }

  const baseUrl = EXPLORER_TX_URLS[network] ?? EXPLORER_TX_URLS.public;
  return `${baseUrl}/${normalizedHash}`;
}

/**
 * Normalize the many spellings of a network name to an explorer key.
 * 'TESTNET', 'testnet' and 'Test SDF Network' all mean testnet; anything else
 * (including an absent value) falls back to public.
 *
 * @param {unknown} network
 * @returns {'public'|'testnet'}
 */
function resolveExplorerNetwork(network) {
  if (typeof network !== 'string') {
    return 'public';
  }
  return network.trim().toLowerCase().includes('test') ? 'testnet' : 'public';
}

module.exports = { buildHorizonTxUrl, resolveExplorerNetwork };
