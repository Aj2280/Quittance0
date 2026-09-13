// Typed wrapper around the CommonJS implementation. The URL table and the hash
// validation live in explorer-tx-link.js so the runtime tests and the app share
// exactly one builder.

import { buildHorizonTxUrl as buildHorizonTxUrlImpl } from './explorer-tx-link.js';

/**
 * Build a Horizon transaction explorer URL for a transaction hash.
 *
 * @param txHash - Stellar transaction hash (64-character hex string).
 * @param network - Network name; defaults to 'public'.
 * @returns Full explorer URL, or null when the hash is missing or malformed.
 */
export function buildHorizonTxUrl(
  txHash: unknown,
  network: string = 'public'
): string | null {
  return buildHorizonTxUrlImpl(txHash, network);
}
