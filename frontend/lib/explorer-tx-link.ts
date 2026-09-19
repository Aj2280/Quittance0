// Typed facade over the single implementation in ./stellar-explorer.js.
// Keeping this module means existing "@/lib/explorer-tx-link" imports stay put
// while the URL table, the hash validation and the network rule live in
// exactly one file.
//
// The wrappers below exist because the implementation is plain JS: without
// them the inferred signatures demand a literal `{ network }` property, which
// a PayPageInvoice does not have even though an invoice record is exactly what
// callers pass.

import {
  buildHorizonTxUrl as buildHorizonTxUrlImpl,
  resolveExplorerNetwork as resolveExplorerNetworkImpl,
} from './stellar-explorer.js';

/** The two Stellar networks the explorer serves. */
export type ExplorerNetwork = 'public' | 'testnet';

/**
 * Build a Horizon transaction explorer URL for a transaction hash.
 *
 * @param txHash Stellar transaction hash (64-character hex string).
 * @param network Network name; defaults to 'public'.
 * @returns Full explorer URL, or null when the hash is missing or malformed.
 */
export function buildHorizonTxUrl(
  txHash: unknown,
  network?: ExplorerNetwork | string | null
): string | null {
  return buildHorizonTxUrlImpl(txHash, network ?? undefined);
}

/**
 * Which explorer a payment's transaction lives on: the record's own network,
 * then the app configuration, then the app default (TESTNET).
 *
 * @param source An invoice-like record, a bare network name, or nothing.
 */
export function resolveExplorerNetwork(source?: unknown): ExplorerNetwork {
  return resolveExplorerNetworkImpl(source as { network?: string } | string | null);
}
