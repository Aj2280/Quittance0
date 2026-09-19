export const VALID_TX_HASH = 'a'.repeat(64);

export const VALID_TESTNET_TX_HASH = 'b'.repeat(64);

export const INVALID_HASH = 'not-a-valid-hash';

export const explorerTxLinkFixture = [
  {
    name: 'public network default',
    txHash: VALID_TX_HASH,
    network: 'public',
    expected: `https://stellar.expert/explorer/public/tx/${VALID_TX_HASH}`,
  },
  {
    name: 'testnet network',
    txHash: VALID_TESTNET_TX_HASH,
    network: 'testnet',
    expected: `https://stellar.expert/explorer/testnet/tx/${VALID_TESTNET_TX_HASH}`,
  },
  {
    name: 'trims whitespace from hash',
    txHash: `  ${VALID_TX_HASH}  `,
    network: 'public',
    expected: `https://stellar.expert/explorer/public/tx/${VALID_TX_HASH}`,
  },
  {
    name: 'defaults to public network',
    txHash: VALID_TX_HASH,
    network: undefined,
    expected: `https://stellar.expert/explorer/public/tx/${VALID_TX_HASH}`,
  },
  {
    name: 'falls back to public for unknown network',
    txHash: VALID_TX_HASH,
    network: 'unknown',
    expected: `https://stellar.expert/explorer/public/tx/${VALID_TX_HASH}`,
  },
];

/**
 * `resolveExplorerNetwork` cases: the invoice's own network wins, then the
 * app configuration, then the app default. `network` is the value of
 * NEXT_PUBLIC_STELLAR_NETWORK, which the test sets around each case.
 */
export const explorerNetworkFixture = [
  {
    name: 'an invoice without a network falls back to the app default (testnet)',
    invoice: { id: 'inv_1' },
    network: undefined,
    expected: 'testnet',
  },
  {
    name: 'the app configuration decides when the invoice has none',
    invoice: { id: 'inv_1' },
    network: 'PUBLIC',
    expected: 'public',
  },
  {
    name: 'MAINNET is the public network under another name',
    invoice: { id: 'inv_1' },
    network: 'MAINNET',
    expected: 'public',
  },
  {
    name: "an invoice's own network wins over the app configuration",
    invoice: { id: 'inv_1', network: 'PUBLIC' },
    network: 'TESTNET',
    expected: 'public',
  },
  {
    name: 'a bare network name is accepted too',
    invoice: 'PUBLIC',
    network: 'TESTNET',
    expected: 'public',
  },
  {
    name: 'an unrecognised network is treated as testnet, never as mainnet',
    invoice: { id: 'inv_1', network: 'FUTURENET' },
    network: 'PUBLIC',
    expected: 'testnet',
  },
  {
    name: 'no argument at all still resolves, so a link is never built for the wrong chain',
    invoice: undefined,
    network: 'TESTNET',
    expected: 'testnet',
  },
];

export const explorerTxLinkErrorFixture = [
  {
    name: 'returns null for empty hash',
    txHash: '',
    network: 'public',
  },
  {
    name: 'returns null for null hash',
    txHash: null,
    network: 'public',
  },
  {
    name: 'returns null for undefined hash',
    txHash: undefined,
    network: 'public',
  },
  {
    name: 'returns null for invalid hash format',
    txHash: INVALID_HASH,
    network: 'public',
  },
  {
    name: 'returns null for short hash',
    txHash: 'a'.repeat(63),
    network: 'public',
  },
  {
    name: 'returns null for number hash',
    txHash: 123,
    network: 'public',
  },
];
