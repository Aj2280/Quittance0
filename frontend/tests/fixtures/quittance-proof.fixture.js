const fs = require('fs');
const path = require('path');

const NETWORK = 'testnet';

const TX_HASH = 'a'.repeat(64);

const FIXED_NOW = new Date('2026-09-13T12:00:00.000Z');

const paidInvoice = {
  id: 'inv_8Qm2',
  status: 'PAID',
  sellerPublicKey: 'G' + 'B'.repeat(55),
  payerPublicKey: 'G' + 'C'.repeat(55),
  amount: '250.5',
  assetCode: 'USDC',
  assetIssuer: 'G' + 'D'.repeat(55),
  memo: 'QUIT-8QM2',
  paymentTxHash: TX_HASH,
  createdAt: '2026-09-10T09:00:00.000Z',
  expiresAt: '2026-09-17T09:00:00.000Z',
  paidAt: '2026-09-13T09:21:44.000Z',
};

const pendingInvoice = {
  id: 'inv_8Qm3',
  status: 'PENDING',
  sellerPublicKey: 'G' + 'B'.repeat(55),
  amount: '12',
  assetCode: 'XLM',
  memo: 'QUIT-8QM3',
  createdAt: '2026-09-13T09:00:00.000Z',
  expiresAt: '2026-09-20T09:00:00.000Z',
};

const goldenProofJson = [
  '{',
  '  "schemaVersion": "quittance.v1",',
  '  "invoiceId": "inv_8Qm2",',
  '  "network": "testnet",',
  '  "status": "PAID",',
  '  "issuedAt": "2026-09-10T09:00:00.000Z",',
  '  "dueAt": "2026-09-17T09:00:00.000Z",',
  '  "settledAt": "2026-09-13T09:21:44.000Z",',
  '  "seller": "' + paidInvoice.sellerPublicKey + '",',
  '  "payer": "' + paidInvoice.payerPublicKey + '",',
  '  "payment": {',
  '    "txHash": "' + TX_HASH + '",',
  '    "memo": "QUIT-8QM2",',
  '    "amount": "250.5000000",',
  '    "asset": {',
  '      "code": "USDC",',
  '      "issuer": "' + paidInvoice.assetIssuer + '"',
  '    },',
  '    "explorerUrl": "https://stellar.expert/explorer/testnet/tx/' + TX_HASH + '"',
  '  },',
  '  "verification": {',
  '    "status": "verified",',
  '    "method": "memo-and-amount",',
  '    "checkedAt": "2026-09-13T09:21:44.000Z",',
  '    "settlementContext": "ON_TIME",',
  '    "latePaymentWarningCode": null',
  '  },',
  '  "document": {',
  '    "generatedAtUtc": "2026-09-13T12:00:00.000Z",',
  '    "generatedBy": "quittance-web"',
  '  }',
  '}',
  '',
].join(String.fromCharCode(10));

const goldenProofHtml = fs.readFileSync(path.join(__dirname, 'golden-proof.html'), 'utf8');

const goldenProofPdfBuffer = fs.readFileSync(path.join(__dirname, 'golden-proof.pdf'));

module.exports = {
  NETWORK,
  TX_HASH,
  FIXED_NOW,
  paidInvoice,
  pendingInvoice,
  goldenProofJson,
  goldenProofHtml,
  goldenProofPdfBuffer,
};
