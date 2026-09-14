// Typed facade over the single implementation in ./stellar-explorer.js.
// Keeping this module means existing "@/lib/explorer-tx-link" imports stay put
// while the URL table and the hash validation live in exactly one file.

export { buildHorizonTxUrl } from './stellar-explorer.js';
