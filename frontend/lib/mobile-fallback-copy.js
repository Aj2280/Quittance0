const MOBILE_FALLBACK_COPY = Object.freeze({
  badge: 'Mobile Device Detected',
  headline: 'Freighter is a desktop extension',
  description:
    'Mobile browsers cannot run the Freighter extension to sign transactions directly. Use one of the fallback options below to complete payment.',
  noAuthNote:
    'No account or Google login required. Payment verifies directly on the Stellar ledger.',
  options: {
    mobileWallet: {
      title: 'Pay with Mobile Wallet',
      description:
        'Scan the SEP-0007 QR code using a Stellar mobile wallet like LOBSTR or xBull, or tap the button if your wallet supports Stellar deep links.',
      cta: 'Open in Stellar Wallet',
    },
    manualTransfer: {
      title: 'Copy Payment Details',
      description:
        'Transfer the exact amount from any Stellar wallet or exchange. The memo is required for automatic payment verification.',
      memoWarning:
        'Always include the exact memo. Verification will fail without it.',
    },
    desktopHandoff: {
      title: 'Open on Desktop',
      description:
        'Copy this payment link and open it in a desktop browser with Freighter installed to sign with one click.',
      cta: 'Copy Payment Link',
    },
  },
  unsupportedNotice:
    'Freighter does not currently support mobile apps, mobile in-app browsers, or custom deep-link transaction signing.',
});

module.exports = {
  MOBILE_FALLBACK_COPY,
};
