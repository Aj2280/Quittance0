/**
 * The one Stellar network resolver (issue #511).
 *
 * TESTNET vs PUBLIC used to be read independently in the backend config, the
 * frontend env var, the proof builder and explorer links. A mixed deploy —
 * frontend PUBLIC, API TESTNET — produced pay URIs and proofs that could not
 * verify, which is exactly the "online demo + testnet evidence" failure mode.
 *
 * Everything downstream of the network choice resolves here: the canonical
 * name, the network passphrase Freighter must report, the Horizon URL, and
 * the stellar.expert path segment. The backend resolves once from
 * STELLAR_NETWORK; the frontend once from NEXT_PUBLIC_STELLAR_NETWORK; proofs
 * follow the server's resolved network rather than a caller-supplied hint.
 */

import { SUPPORTED_STELLAR_NETWORKS } from './invoice-validation';

export type StellarNetwork = (typeof SUPPORTED_STELLAR_NETWORKS)[number];

/** Passphrases the Stellar protocol defines — the values `Networks.TESTNET`
 *  and `Networks.PUBLIC` in the SDK, declared here so the shared contract does
 *  not depend on the SDK (the frontend bundle already carries it elsewhere). */
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const NETWORK_TABLE: Record<
  StellarNetwork,
  { passphrase: string; horizonUrl: string; explorerSegment: 'testnet' | 'public' }
> = {
  TESTNET: {
    passphrase: TESTNET_PASSPHRASE,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    explorerSegment: 'testnet',
  },
  PUBLIC: {
    passphrase: PUBLIC_PASSPHRASE,
    horizonUrl: 'https://horizon.stellar.org',
    explorerSegment: 'public',
  },
};

/**
 * Resolve a raw env/config value to a supported network. Defaults to TESTNET
 * when unset — the safe choice for a demo — and throws on anything
 * unrecognized rather than silently picking a network.
 */
export function resolveStellarNetwork(raw: string | null | undefined): StellarNetwork {
  const normalized = (raw ?? 'TESTNET').trim().toUpperCase();
  if ((SUPPORTED_STELLAR_NETWORKS as readonly string[]).includes(normalized)) {
    return normalized as StellarNetwork;
  }
  throw new Error(
    `Stellar network must be one of ${SUPPORTED_STELLAR_NETWORKS.join(', ')}; got "${raw}"`
  );
}

/** The passphrase a Freighter wallet must report for this network. */
export function passphraseFor(network: StellarNetwork): string {
  return NETWORK_TABLE[network].passphrase;
}

/** Default Horizon URL for a network (env may still override the backend's). */
export function defaultHorizonUrl(network: StellarNetwork): string {
  return NETWORK_TABLE[network].horizonUrl;
}

/** The stellar.expert path segment for a network: 'testnet' | 'public'. */
export function explorerSegmentFor(network: StellarNetwork): 'testnet' | 'public' {
  return NETWORK_TABLE[network].explorerSegment;
}

/**
 * Whether a wallet-reported network value names the same network — by exact
 * passphrase match when a passphrase is supplied, else by name. A custom
 * network can call itself "TESTNET"; its passphrase cannot lie.
 */
export function walletNetworkMatches(
  network: StellarNetwork,
  reported: { network?: string | null; networkPassphrase?: string | null }
): boolean {
  if (reported.networkPassphrase) {
    return reported.networkPassphrase === passphraseFor(network);
  }
  return (reported.network ?? '').trim().toUpperCase() === network;
}
