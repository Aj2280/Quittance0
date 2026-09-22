'use client';

import { useState } from 'react';
import {
  EXPECTED_WALLET_NETWORK,
  sendPayment,
  checkWalletConnection,
  requestWalletAccess,
  getFreighterNetwork,
  isWrongNetwork,
  readFreighterSession,
  NETWORK_DISPLAY_NAME,
} from '@/lib/stellar';
import { toast } from 'sonner';
import { Wallet, Loader2 } from 'lucide-react';
import { invoiceApi } from '@/lib/api';
import { showFreighterInstallPrompt, showFreighterWrongNetworkPrompt } from '@/components/FreighterInstallPrompt';
import { describeVerifyError, normalizePayerDetails } from '@/lib/payment-page-state';
import { resolveVerificationError } from '@/lib/verification';
import { useWalletStore } from '@/lib/store';
import { walletSessionGate } from '@/lib/wallet-session';

interface PaymentButtonProps {
  destination: string;
  amount: string;
  memo: string;
  assetCode?: string;
  assetIssuer?: string;
  invoiceId?: string;
  payerName?: string;
  payerEmail?: string;
  invoiceStatus?: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  /** Fired when the payer commits to paying, before the wallet is opened. */
  onStart?: () => void;
  onSuccess?: (txHash: string) => void;
  /** Fired when the attempt ends without a confirmed payment. */
  onError?: (message: string) => void;
}

const PAY_TOAST_ID = 'payment-flow';

export default function PaymentButton({
  destination,
  amount,
  memo,
  assetCode = 'XLM',
  assetIssuer,
  invoiceId,
  payerName,
  payerEmail,
  invoiceStatus = 'PENDING',
  onStart,
  onSuccess,
  onError,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { publicKey, connected, network, freighterAvailable } = useWalletStore();
  // Same session, same gate as the create form and the dashboard: a mismatch
  // blocks all three from one place (issue #442).
  const gate = walletSessionGate(
    { freighterAvailable, connected, publicKey, network },
    EXPECTED_WALLET_NETWORK
  );

  const handlePayment = async () => {
    if (!gate.ready) {
      showFreighterInstallPrompt(gate);
      onError?.(gate.message);
      return;
    }

    if (invoiceStatus !== 'PENDING') {
      const message = invoiceStatus === 'EXPIRED'
        ? 'This invoice has expired and cannot be paid'
        : invoiceStatus === 'CANCELLED'
        ? 'This invoice was cancelled by the seller and cannot be paid'
        : 'This invoice is not available for payment';
      toast.error(message);
      onError?.(message);
      return;
    }

    // Payer details are validated by the shared state module, so the button,
    // the page and the tests all agree on what a valid email is.
    const payer = normalizePayerDetails({ payerName, payerEmail });
    if (!payer.ok) {
      toast.error(payer.error);
      onError?.(payer.error);
      return;
    }

    setLoading(true);
    onStart?.();

    // The whole attempt is bound to the key that started it (issue #508). If
    // the wallet underneath changes while Freighter is open or the verify
    // request is in flight, the result belongs to the previous session and
    // must not be attributed to the new one.
    const sessionPublicKey = publicKey;
    const sessionLost = () => useWalletStore.getState().publicKey !== sessionPublicKey;
    const reportSessionLost = () => {
      // No onError dispatch: the page already reset the session for the new
      // key, and an error written into it would belong to the previous one.
      toast.warning('Wallet changed during payment', {
        id: PAY_TOAST_ID,
        description: 'The previous wallet submitted the transaction. Reconnect it to verify here.',
      });
    };

    try {
      const freighterInstalled = await checkWalletConnection();
      if (!freighterInstalled) {
        showFreighterInstallPrompt();
        onError?.('Freighter is not installed');
        return;
      }

      const allowed = await requestWalletAccess();
      if (!allowed) {
        toast.error('Freighter access was denied');
        onError?.('Freighter access was denied');
        return;
      }

      const netDetails = await getFreighterNetwork();
      const wrong = isWrongNetwork(netDetails?.networkPassphrase || netDetails?.network);
      if (wrong) {
        showFreighterWrongNetworkPrompt(NETWORK_DISPLAY_NAME);
        const wrongMsg = `Wallet is connected to the wrong network. Please switch to ${NETWORK_DISPLAY_NAME} in Freighter.`;
        toast.error(wrongMsg);
        onError?.(wrongMsg);
        return;
      }

      toast.loading('Confirm in wallet...', { id: PAY_TOAST_ID });
      const txHash = await sendPayment(destination, amount, memo, assetCode, assetIssuer);

      // A switch while the Freighter prompt was open means the signing key is
      // no longer the connected session: the hash belongs to the previous
      // wallet's session, so stop instead of reporting success — or pushing
      // the previous session's payer details — under the new key. The live
      // Freighter key is checked as well because the store can lag a switch
      // the user made inside the wallet itself.
      const liveSession = await readFreighterSession().catch(() => null);
      const signerChanged = Boolean(
        liveSession?.publicKey && liveSession.publicKey !== sessionPublicKey
      );
      if (sessionLost() || signerChanged) {
        reportSessionLost();
        return;
      }

      if (invoiceId) {
        toast.loading('Verifying payment...', { id: PAY_TOAST_ID });
        try {
          await invoiceApi.verify(invoiceId, txHash, payer.value);
          toast.success('Payment verified', {
            id: PAY_TOAST_ID,
            description: `TX: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
          });
        } catch (error) {
          // The payment is on the ledger even though verification did not
          // complete, so this is a warning and the flow still reports success.
          console.error('Verification failed:', error);
          // Surface the shared rejection message rather than a generic warning.
          toast.warning('Payment sent but verification failed', {
            id: PAY_TOAST_ID,
            description: resolveVerificationError(
              error,
              'Refresh the page or wait for status to update'
            ),
          });
        }
      } else {
        toast.success('Payment successful', {
          id: PAY_TOAST_ID,
          description: `TX: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
        });
      }

      // A switch during the in-flight verify belongs to the old session as
      // well — the page must not record the hash under the new key.
      if (sessionLost()) {
        reportSessionLost();
        return;
      }

      onSuccess?.(txHash);
    } catch (error: any) {
      // A failure thrown while the wallet underneath changed belongs to the
      // old session — report the switch instead of an error the new key owns.
      if (sessionLost()) {
        reportSessionLost();
        return;
      }

      const missingTrustline =
        assetCode !== 'XLM' && (
          error.message?.toLowerCase().includes('trustline') ||
          error.message?.toLowerCase().includes('op_no_trust')
        );
      const title = missingTrustline ? `${assetCode} trustline required` : 'Payment failed';
      toast.error(title, {
        id: PAY_TOAST_ID,
        description: missingTrustline
          ? `Please add a trustline for ${assetCode} in your wallet before paying.`
          : (error.message || 'Try again'),
        duration: missingTrustline ? 10000 : undefined,
      });
      onError?.(title);
    } finally {
      setLoading(false);
    }
  };

  return (
    /*
     * The accessible name spells out the amount and asset (issue #289). "Pay
     * with Freighter" on its own does not say what is about to leave the
     * payer's wallet, and the amount lives in a separate panel rendered with
     * `bg-clip-text`, so a screen-reader user confirming a payment had no way
     * to hear the figure from the control itself.
     *
     * `aria-busy` reports the in-flight attempt; the label change to
     * "Processing..." covers the visual side.
     */
    <button
      type="button"
      onClick={handlePayment}
      disabled={loading || !destination || !amount || invoiceStatus !== 'PENDING'}
      aria-disabled={!gate.ready}
      aria-busy={loading}
      data-payment-state={loading ? 'processing' : gate.status}
      aria-label={
        loading
          ? `Processing payment of ${amount} ${assetCode}`
          : gate.ready
            ? `Pay ${amount} ${assetCode} with Freighter`
            : gate.message
      }
      className="btn btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
    >
      {loading ? (
        <>
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
          Processing...
        </>
      ) : (
        <>
          <Wallet className="w-6 h-6" aria-hidden="true" />
          Pay with Freighter
        </>
      )}
    </button>
  );
}
