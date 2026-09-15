/**
 * Seller invoice workspace authorization, lifecycle actions, and timeline models.
 */

const { effectiveInvoiceStatus } = require('./invoice-lifecycle.js');
const { buildHorizonTxUrl } = require('./stellar-explorer.js');

const LATE_PAYMENT_WARNINGS = {
  PAYMENT_RECEIVED_AFTER_EXPIRY: 'Payment was received after this invoice expired.',
  PAYMENT_RECEIVED_AFTER_CANCEL: 'Payment was received after this invoice was cancelled.',
};

function canAccessInvoiceWorkspace(invoice, userWallet) {
  if (!invoice) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }
  if (!userWallet) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }
  if (invoice.sellerPublicKey && invoice.sellerPublicKey !== userWallet) {
    return {
      allowed: false,
      reason: 'FORBIDDEN',
      expectedSeller: invoice.sellerPublicKey,
    };
  }
  return { allowed: true };
}

function workspaceActionVisibility(invoice, now = Date.now()) {
  if (!invoice) {
    return {
      canCancel: false,
      canShare: false,
      canEmailInvoice: false,
      canDownloadProof: false,
      canEmailProof: false,
      canViewExplorer: false,
      effectiveStatus: 'UNKNOWN',
    };
  }

  const effectiveStatus = effectiveInvoiceStatus(invoice, now) || invoice.status;
  const isPaid = effectiveStatus === 'PAID' || Boolean(invoice.paidAt) || Boolean(invoice.paymentTxHash && invoice.status === 'PAID');
  const isPending = effectiveStatus === 'PENDING' && !isPaid;

  return {
    canCancel: isPending,
    canShare: true,
    canEmailInvoice: isPending && Boolean(invoice.customerEmail),
    canDownloadProof: isPaid,
    canEmailProof: isPaid && Boolean(invoice.customerEmail || invoice.payerEmail),
    canViewExplorer: isPaid && Boolean(invoice.paymentTxHash),
    effectiveStatus,
  };
}

function buildInvoiceTimeline(invoice, network = 'testnet', now = Date.now()) {
  if (!invoice) return [];

  const timeline = [];
  const effectiveStatus = effectiveInvoiceStatus(invoice, now) || invoice.status;

  // 1. Creation event
  timeline.push({
    id: 'created',
    label: 'Invoice Created',
    timestamp: invoice.createdAt,
    status: 'completed',
    description: `Created for ${invoice.amount} ${invoice.assetCode || 'XLM'}`,
  });

  // 2. Lifecycle state progression
  if (effectiveStatus === 'CANCELLED') {
    timeline.push({
      id: 'cancelled',
      label: 'Invoice Cancelled',
      timestamp: invoice.cancelledAt || invoice.updatedAt || null,
      status: 'cancelled',
      description: 'Invoice was cancelled by the seller',
    });
  } else if (effectiveStatus === 'EXPIRED') {
    timeline.push({
      id: 'expired',
      label: 'Invoice Expired',
      timestamp: invoice.expiresAt,
      status: 'expired',
      description: 'Payment window expired without receipt',
    });
  } else if (effectiveStatus === 'PENDING') {
    timeline.push({
      id: 'pending',
      label: 'Awaiting Payment',
      timestamp: null,
      status: 'active',
      description: 'Waiting for on-chain Stellar transaction',
      expiresAt: invoice.expiresAt,
    });
  }

  // 3. Payment settlement (can exist even after cancel/expire in late-pay edge cases)
  if (effectiveStatus === 'PAID' || invoice.paidAt || invoice.paymentTxHash) {
    const explorerUrl = invoice.paymentTxHash
      ? buildHorizonTxUrl(invoice.paymentTxHash, network)
      : null;

    timeline.push({
      id: 'settled',
      label: 'Payment Settled',
      timestamp: invoice.settledAt || invoice.paidAt || null,
      status: 'completed',
      description: 'Payment verified on Stellar network',
      txHash: invoice.paymentTxHash,
      explorerUrl,
      payerPublicKey: invoice.payerPublicKey,
    });

    if (invoice.latePaymentWarningCode) {
      timeline.push({
        id: 'late-payment-warning',
        label: 'Late Settlement Notice',
        status: 'warning',
        warningCode: invoice.latePaymentWarningCode,
        description:
          LATE_PAYMENT_WARNINGS[invoice.latePaymentWarningCode] ||
          'Payment was detected after the invoice closed.',
      });
    }
  }

  return timeline;
}

module.exports = {
  LATE_PAYMENT_WARNINGS,
  canAccessInvoiceWorkspace,
  workspaceActionVisibility,
  buildInvoiceTimeline,
};
