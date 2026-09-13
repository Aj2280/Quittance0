'use client';

import { useState, useMemo } from 'react';
import { Copy, CheckCircle, AlertCircle, Smartphone, Download } from 'lucide-react';
import { toast } from 'sonner';
import { copyWithFeedback } from '@/lib/clipboard-feedback';
import {
  detectDeviceContext,
  buildLOBSTRDeepLink,
  buildXBullDeepLink,
  attemptDeepLink,
  MOBILE_WALLETS,
  getRecommendedMobileWallets,
} from '@/lib/mobile-detection';

interface MobilePaymentFallbackProps {
  /**
   * Payment destination (seller's public key)
   */
  destination: string;
  /**
   * Payment amount
   */
  amount: string;
  /**
   * Invoice memo
   */
  memo: string;
  /**
   * Asset code (default: XLM)
   */
  assetCode?: string;
  /**
   * Asset issuer (for non-native assets)
   */
  assetIssuer?: string;
  /**
   * Payment URL to fall back to (for manual entry)
   */
  paymentUrl: string;
  /**
   * SEP-0007 payment URI for QR code
   */
  stellarUri?: string;
}

export default function MobilePaymentFallback({
  destination,
  amount,
  memo,
  assetCode = 'XLM',
  assetIssuer,
  paymentUrl,
  stellarUri = '',
}: MobilePaymentFallbackProps) {
  const [attemptedWallet, setAttemptedWallet] = useState<string | null>(null);
  const deviceContext = useMemo(() => detectDeviceContext(), []);

  const platform = deviceContext.isIOS ? 'ios' : 'android';
  const recommendedWallets = useMemo(
    () => (deviceContext.isMobile ? getRecommendedMobileWallets(platform) : []),
    [deviceContext.isMobile, platform]
  );

  const handleWalletDeepLink = async (walletId: string) => {
    setAttemptedWallet(walletId);

    // Build the appropriate deep link
    let deepLink = '';
    if (walletId === 'lobstr') {
      deepLink = buildLOBSTRDeepLink({ destination, amount, memo, assetCode, assetIssuer });
    } else if (walletId === 'xbull') {
      deepLink = buildXBullDeepLink({ destination, amount, memo, assetCode, assetIssuer });
    }

    if (!deepLink) {
      toast.error(`${walletId} deep links not available`);
      return;
    }

    // Attempt to open the wallet
    await attemptDeepLink(
      deepLink,
      () => {
        // Fallback: show installation prompt
        toast.info(`${walletId} might not be installed. Please install it or use manual payment below.`);
      },
      1500
    );
  };

  const handleCopyAddress = async () => {
    if (await copyWithFeedback(destination)) {
      toast.success('Destination address copied');
    } else {
      toast.error('Failed to copy address');
    }
  };

  const handleCopyMemo = async () => {
    if (await copyWithFeedback(memo)) {
      toast.success('Memo copied');
    } else {
      toast.error('Failed to copy memo');
    }
  };

  const handleCopyPaymentUrl = async () => {
    if (await copyWithFeedback(paymentUrl)) {
      toast.success('Payment link copied');
    } else {
      toast.error('Failed to copy payment link');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile Wallet Options */}
      {deviceContext.isMobile && recommendedWallets.length > 0 && (
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-5" aria-label="Mobile wallet options">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-blue-900">Pay with Mobile Wallet</h3>
          </div>

          <p className="text-sm text-blue-800 mb-4">
            If you have a Stellar wallet app installed, tap the button below to pay directly:
          </p>

          <div className="space-y-3">
            {recommendedWallets.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleWalletDeepLink(wallet.id)}
                aria-busy={attemptedWallet === wallet.id}
                className="w-full bg-white border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-900 font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" aria-hidden="true" />
                Pay with {wallet.name}
              </button>
            ))}
          </div>

          <p className="text-xs text-blue-700 mt-4">
            Don't have a Stellar wallet? Download one of the apps above or scroll down for other payment methods.
          </p>
        </section>
      )}

      {/* Manual Payment Instructions */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-5" aria-label="Manual payment instructions">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-gray-700" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900">Manual Payment</h3>
        </div>

        <p className="text-sm text-gray-700 mb-5">
          If you don't have a wallet app, open your Stellar wallet and send payment using these details:
        </p>

        {/* Payment Details Cards */}
        <div className="space-y-4">
          {/* Destination */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
              Send To (Destination)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-gray-900 font-mono break-all bg-gray-50 p-2 rounded">
                {destination}
              </code>
              <button
                onClick={handleCopyAddress}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition-colors"
                aria-label="Copy destination address"
                title="Copy address"
              >
                <Copy className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
              Amount
            </label>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">
                {amount} {assetCode}
              </span>
            </div>
          </div>

          {/* Memo */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
              Memo (Important: Required for payment verification)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {memo}
              </code>
              <button
                onClick={handleCopyMemo}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition-colors"
                aria-label="Copy memo"
                title="Copy memo"
              >
                <Copy className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Asset Info for Non-XLM */}
          {assetCode !== 'XLM' && assetIssuer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <label className="text-xs font-semibold text-amber-800 uppercase block mb-2">
                Asset Issuer
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-amber-900 font-mono break-all bg-amber-100 p-2 rounded">
                  {assetIssuer}
                </code>
                <button
                  onClick={() => copyWithFeedback(assetIssuer)}
                  className="flex-shrink-0 p-2 hover:bg-amber-100 rounded transition-colors"
                  aria-label="Copy asset issuer"
                  title="Copy issuer"
                >
                  <Copy className="w-5 h-5 text-amber-700" />
                </button>
              </div>
              <p className="text-xs text-amber-700 mt-2">
                Make sure your wallet has a trustline for {assetCode} from this issuer before paying.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Desktop/Browser Fallback */}
      <section className="bg-green-50 border border-green-200 rounded-lg p-5" aria-label="Desktop fallback">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-700" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-green-900">Use Desktop Wallet</h3>
        </div>

        <p className="text-sm text-green-800 mb-4">
          For the smoothest experience, open this payment link on a desktop or laptop computer where you have a Stellar wallet extension installed:
        </p>

        <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-green-700 uppercase mb-2">Payment Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-green-900 font-mono break-all bg-green-50 p-2 rounded">
              {paymentUrl}
            </code>
            <button
              onClick={handleCopyPaymentUrl}
              className="flex-shrink-0 p-2 hover:bg-green-100 rounded transition-colors"
              aria-label="Copy payment link"
              title="Copy payment link"
            >
              <Copy className="w-5 h-5 text-green-700" />
            </button>
          </div>
        </div>

        <div className="text-sm text-green-800">
          <p className="font-semibold mb-2">Steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Copy the payment link above</li>
            <li>Open it on your desktop/laptop browser</li>
            <li>Your wallet will automatically handle the payment</li>
          </ol>
        </div>
      </section>

      {/* Accessibility Note */}
      <p className="text-xs text-gray-600 italic">
        All payment information is also shown in copyable form above. You can copy any field and paste it into your Stellar wallet application.
      </p>
    </div>
  );
}
