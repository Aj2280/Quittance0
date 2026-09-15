const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAccessInvoiceWorkspace,
  workspaceActionVisibility,
  buildInvoiceTimeline,
  LATE_PAYMENT_WARNINGS,
} = require('../lib/invoice-workspace.js');

const SELLER_1 = 'GAA5INZB2GO3FJN4VXJYJSSIQXN4EKQTZWTR6R566TR3IMTXHSUDORLI';
const SELLER_2 = 'GBZXN7PIRZGNMHGA72UDEL52OQK6ICNJPF37ACNO42P7J7W4TX225656';
const TX_HASH = 'a'.repeat(64);

test('canAccessInvoiceWorkspace authorization rules', () => {
  const invoice = {
    id: 'inv-1',
    sellerPublicKey: SELLER_1,
    status: 'PENDING',
  };

  // 1. Missing invoice
  const notFound = canAccessInvoiceWorkspace(null, SELLER_1);
  assert.equal(notFound.allowed, false);
  assert.equal(notFound.reason, 'NOT_FOUND');

  // 2. Unauthenticated (no connected wallet)
  const unauth = canAccessInvoiceWorkspace(invoice, null);
  assert.equal(unauth.allowed, false);
  assert.equal(unauth.reason, 'UNAUTHENTICATED');

  // 3. Foreign seller connected (mismatch)
  const forbidden = canAccessInvoiceWorkspace(invoice, SELLER_2);
  assert.equal(forbidden.allowed, false);
  assert.equal(forbidden.reason, 'FORBIDDEN');
  assert.equal(forbidden.expectedSeller, SELLER_1);

  // 4. Matching seller connected
  const authorized = canAccessInvoiceWorkspace(invoice, SELLER_1);
  assert.equal(authorized.allowed, true);
  assert.equal(authorized.reason, undefined);

  // 5. Legacy invoice without explicit sellerPublicKey allows connected wallet
  const legacy = canAccessInvoiceWorkspace({ id: 'inv-legacy', status: 'PENDING' }, SELLER_1);
  assert.equal(legacy.allowed, true);
});

test('workspaceActionVisibility action matrix by lifecycle status', () => {
  // Pending invoice with customer email
  const pendingInvoice = {
    id: 'inv-pending',
    amount: 100,
    assetCode: 'USDC',
    status: 'PENDING',
    customerEmail: 'client@example.com',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  const pendingActions = workspaceActionVisibility(pendingInvoice);
  assert.equal(pendingActions.canCancel, true, 'Pending invoice must be cancellable');
  assert.equal(pendingActions.canShare, true, 'Share must be available');
  assert.equal(pendingActions.canEmailInvoice, true, 'Email invoice must be available with customerEmail');
  assert.equal(pendingActions.canDownloadProof, false, 'Proof cannot be downloaded when unpaid');
  assert.equal(pendingActions.canEmailProof, false, 'Proof cannot be emailed when unpaid');
  assert.equal(pendingActions.canViewExplorer, false, 'Explorer link unavailable without payment');

  // Paid invoice
  const paidInvoice = {
    id: 'inv-paid',
    amount: 50,
    assetCode: 'XLM',
    status: 'PAID',
    paymentTxHash: TX_HASH,
    customerEmail: 'client@example.com',
    paidAt: new Date().toISOString(),
  };

  const paidActions = workspaceActionVisibility(paidInvoice);
  assert.equal(paidActions.canCancel, false, 'PAID invoice must NEVER be cancellable');
  assert.equal(paidActions.canShare, true);
  assert.equal(paidActions.canEmailInvoice, false, 'Invoice email is superseded by payment proof');
  assert.equal(paidActions.canDownloadProof, true, 'Paid invoice allows proof PDF download');
  assert.equal(paidActions.canEmailProof, true, 'Paid invoice allows proof email');
  assert.equal(paidActions.canViewExplorer, true, 'Paid invoice enables Stellar Expert link');

  // Cancelled invoice
  const cancelledInvoice = {
    id: 'inv-cancelled',
    status: 'CANCELLED',
  };

  const cancelledActions = workspaceActionVisibility(cancelledInvoice);
  assert.equal(cancelledActions.canCancel, false, 'Cancelled invoice cannot be cancelled again');
  assert.equal(cancelledActions.canDownloadProof, false);

  // Expired invoice (time-elapsed)
  const expiredInvoice = {
    id: 'inv-expired',
    status: 'PENDING',
    expiresAt: new Date(Date.now() - 10_000).toISOString(),
  };

  const expiredActions = workspaceActionVisibility(expiredInvoice);
  assert.equal(expiredActions.canCancel, false, 'Expired invoice is not actionable for cancellation');
  assert.equal(expiredActions.canDownloadProof, false);
});

test('buildInvoiceTimeline generates sequential lifecycle events', () => {
  const createdAt = new Date('2026-09-15T10:00:00Z');
  const paidAt = new Date('2026-09-15T10:15:00Z');

  const invoice = {
    id: 'inv-timeline',
    amount: 25,
    assetCode: 'XLM',
    status: 'PAID',
    createdAt,
    paidAt,
    paymentTxHash: TX_HASH,
    payerPublicKey: 'GPAX...',
    latePaymentWarningCode: 'PAYMENT_RECEIVED_AFTER_EXPIRY',
  };

  const timeline = buildInvoiceTimeline(invoice, 'testnet');
  assert.ok(Array.isArray(timeline));

  // Event 1: Created
  const created = timeline.find((e) => e.id === 'created');
  assert.ok(created);
  assert.equal(created.status, 'completed');
  assert.ok(created.description.includes('25 XLM'));

  // Event 2: Settled
  const settled = timeline.find((e) => e.id === 'settled');
  assert.ok(settled);
  assert.equal(settled.status, 'completed');
  assert.equal(settled.txHash, TX_HASH);
  assert.ok(settled.explorerUrl.includes(TX_HASH));
  assert.ok(settled.explorerUrl.includes('testnet'));

  // Event 3: Late payment warning flag
  const warning = timeline.find((e) => e.id === 'late-payment-warning');
  assert.ok(warning);
  assert.equal(warning.status, 'warning');
  assert.equal(warning.warningCode, 'PAYMENT_RECEIVED_AFTER_EXPIRY');
  assert.equal(warning.description, LATE_PAYMENT_WARNINGS.PAYMENT_RECEIVED_AFTER_EXPIRY);
});

test('buildInvoiceTimeline handles cancelled and expired status events', () => {
  const cancelledInv = {
    id: 'inv-c',
    amount: 10,
    assetCode: 'USDC',
    status: 'CANCELLED',
    createdAt: new Date(),
    cancelledAt: new Date(),
  };

  const cTimeline = buildInvoiceTimeline(cancelledInv);
  assert.ok(cTimeline.some((e) => e.id === 'cancelled' && e.status === 'cancelled'));

  const expiredInv = {
    id: 'inv-e',
    amount: 10,
    assetCode: 'USDC',
    status: 'EXPIRED',
    createdAt: new Date(),
    expiresAt: new Date(),
  };

  const eTimeline = buildInvoiceTimeline(expiredInv);
  assert.ok(eTimeline.some((e) => e.id === 'expired' && e.status === 'expired'));
});
