// Implementation of the Horizon transaction explorer URL builder.
// explorer-tx-link.ts is a thin typed wrapper around this file, so the two
// cannot drift: the URL table and the hash validation live here only.

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

module.exports = { buildHorizonTxUrl };
