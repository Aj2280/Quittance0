/**
 * Horizon transaction explorer URL builder.
 *
 * Returns a direct link to the Stellar Expert transaction viewer for a given
 * network. Keeps the network-specific base URLs in one place so UI components
 * do not hardcode them.
 *
 * Note: This mirrors frontend/lib/explorer-tx-link.ts for server-side use.
 */

import { explorerSegmentFor, resolveStellarNetwork } from '../../../shared/network';

const EXPLORER_TX_URLS: Record<string, string> = {
  public: 'https://stellar.expert/explorer/public/tx',
  testnet: 'https://stellar.expert/explorer/testnet/tx',
};

/**
 * Build a Horizon transaction explorer URL for a transaction hash.
 *
 * @param txHash - Stellar transaction hash (64-character hex string).
 * @param network - Explorer network segment. When absent or unrecognised the
 *   server-resolved STELLAR_NETWORK decides — never a hardcoded 'public',
 *   which would send a testnet seller to a mainnet page that can never show
 *   their transaction (issue #511).
 * @returns Full explorer URL, or null when the hash is missing or malformed.
 */
export function buildHorizonTxUrl(
  txHash: unknown,
  network?: string
): string | null {
  if (typeof txHash !== 'string') {
    return null;
  }

  const normalizedHash = txHash.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(normalizedHash)) {
    return null;
  }

  const segment =
    network && EXPLORER_TX_URLS[network]
      ? network
      : explorerSegmentFor(resolveStellarNetwork(process.env.STELLAR_NETWORK));
  return `${EXPLORER_TX_URLS[segment]}/${normalizedHash}`;
}

export default {
  buildHorizonTxUrl,
  EXPLORER_TX_URLS,
};
