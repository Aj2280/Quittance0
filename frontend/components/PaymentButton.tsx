'use client';

import { useState } from 'react';
import {
  EXPECTED_WALLET_NETWORK,
  checkWalletConnection,
  requestWalletAccess,
  getFreighterNetwork,
  isWrongNetwork,
  NETWORK_DISPLAY_NAME,
} from '@/lib/stellar';
import {
  buildInvoicePayment,
  submitBuiltPayment,
  makePaymentError,
  isTransportError,
  shortenAddress,
  type BuiltPayment,
  type InvoicePaymentError,
} from '@/lib/invoice-payment-builder';
import { toast } from 'sonner';
import { Wallet, Loader2, CheckCircle, X } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Payment review dialog
// ---------------------------------------------------------------------------

interface PaymentReviewProps {
  review: BuiltPayment['review'];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function PaymentReview({ review, onConfirm, onCancel, loading }: PaymentReviewProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="card w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="review-title" className="text-lg font-semibold text-[var(--ink)]">
            Review payment
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel payment"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)] font-medium">Destination</dt>
            <dd
              className="font-mono text-[var(--ink)] text-right"
              title={review.destination}
              aria-label={`Destination: ${review.destination}`}
            >
              {review.displayDestination}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)] font-medium">Amount</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {review.amount} {review.assetCode}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)] font-medium">Memo</dt>
            <dd className="font-mono text-[var(--ink)] text-right break-all">
              {review.memo}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-[var(--muted)] mb-4">
          These are the exact values that will be signed in Freighter.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Signing…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                Confirm & sign
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaymentButton
// ---------------------------------------------------------------------------

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
  const [pendingBuilt, setPendingBuilt] = useState<BuiltPayment | null>(null);
  const [signing, setSigning] = useState(false);

  const { publicKey, connected, network, freighterAvailable } = useWalletStore();
  // Same session, same gate as the create form and the dashboard: a mismatch
  // blocks all three from one place (issue #442).
  const gate = walletSessionGate(
    { freighterAvailable, connected, publicKey, network },
    EXPECTED_WALLET_NETWORK
  );

  // ── Freighter prereq check ────────────────────────────────────────────────
  // Run before build: surface wallet problems immediately without touching the
  // builder.

  const checkFreighterPrerequisites = async (): Promise<InvoicePaymentError | null> => {
    const freighterInstalled = await checkWalletConnection();
    if (!freighterInstalled) {
      showFreighterInstallPrompt();
      return makePaymentError(
        'wallet',
        'FREIGHTER_NOT_INSTALLED',
        'Freighter is not installed. Please install the extension and try again.'
      );
    }

    const allowed = await requestWalletAccess();
    if (!allowed) {
      return makePaymentError(
        'wallet',
        'FREIGHTER_ACCESS_DENIED',
        'Wallet connection failed. Please reconnect Freighter and try again.'
      );
    }

    const netDetails = await getFreighterNetwork();
    const wrong = isWrongNetwork(netDetails?.networkPassphrase || netDetails?.network);
    if (wrong) {
      showFreighterWrongNetworkPrompt(NETWORK_DISPLAY_NAME);
      return makePaymentError(
        'network',
        'NETWORK_MISMATCH',
        `Your wallet is connected to the wrong network. Please switch to ${NETWORK_DISPLAY_NAME} in Freighter.`
      );
    }

    return null;
  };

  // ── Build phase ───────────────────────────────────────────────────────────

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

    try {
      // Check Freighter prerequisites before invoking the builder.
      const prereqError = await checkFreighterPrerequisites();
      if (prereqError) {
        toast.error(prereqError.message, { id: PAY_TOAST_ID });
        onError?.(prereqError.message);
        return;
      }

      // Build transaction with full validation. Network mismatch and memo
      // safety are enforced inside the builder — not here.
      const buildResult = await buildInvoicePayment(
        {
          sellerPublicKey: destination,
          amount,
          assetCode,
          assetIssuer,
          memo,
        },
        {
          publicKey: publicKey!,
          network,
          networkPassphrase: null,
        }
      );

      if ('category' in buildResult) {
        // Builder rejected the payment — surface the specific reason.
        const errMsg = buildResult.message;
        toast.error(errMsg, { id: PAY_TOAST_ID });
        onError?.(errMsg);
        return;
      }

      // Show review dialog before Freighter prompt.
      setPendingBuilt(buildResult);
    } finally {
      setLoading(false);
    }
  };

  // ── Sign + submit phase (called after user confirms review) ───────────────

  const handleConfirmReview = async () => {
    if (!pendingBuilt) return;

    const payer = normalizePayerDetails({ payerName, payerEmail });
    if (!payer.ok) {
      toast.error(payer.error);
      return;
    }

    setSigning(true);
    const built = pendingBuilt;
    setPendingBuilt(null);

    try {
      toast.loading('Confirm in wallet…', { id: PAY_TOAST_ID });

      const submitResult = await submitBuiltPayment(built);

      if ('category' in submitResult) {
        const errMsg = submitResult.message;
        const isUserRejection = submitResult.code === 'USER_REJECTED';
        if (isUserRejection) {
          toast.dismiss(PAY_TOAST_ID);
        } else {
          toast.error(
            isTransportError(submitResult)
              ? 'The transaction could not be submitted.'
              : 'Payment failed.',
            { id: PAY_TOAST_ID, description: errMsg }
          );
        }
        onError?.(errMsg);
        return;
      }

      const { txHash } = submitResult;

      // ── Automatic verify handoff ──────────────────────────────────────────
      // The exact hash returned by submitBuiltPayment is passed directly into
      // invoice verification. The user never needs to paste it.
      if (invoiceId) {
        toast.loading('Verifying payment…', { id: PAY_TOAST_ID });
        try {
          await invoiceApi.verify(invoiceId, txHash, payer.value);
          toast.success('Payment verified', {
            id: PAY_TOAST_ID,
            description: `TX: ${txHash.slice(0, 8)}…${txHash.slice(-8)}`,
          });
        } catch (error) {
          // The payment is on the ledger even though verification did not
          // complete, so this is a warning and the flow still reports success.
          // Transport failures and verification rejects are presented
          // differently so the payer can tell which problem occurred.
          console.error('Verification failed:', error);
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
          description: `TX: ${txHash.slice(0, 8)}…${txHash.slice(-8)}`,
        });
      }

      onSuccess?.(txHash);
    } catch (error: unknown) {
      const err = error as { message?: string };
      const missingTrustline =
        assetCode !== 'XLM' && (
          err.message?.toLowerCase().includes('trustline') ||
          err.message?.toLowerCase().includes('op_no_trust')
        );
      const title = missingTrustline ? `${assetCode} trustline required` : 'Payment failed';
      toast.error(title, {
        id: PAY_TOAST_ID,
        description: missingTrustline
          ? `Please add a trustline for ${assetCode} in your wallet before paying.`
          : (err.message || 'Try again'),
        duration: missingTrustline ? 10000 : undefined,
      });
      onError?.(title);
    } finally {
      setSigning(false);
    }
  };

  const handleCancelReview = () => {
    setPendingBuilt(null);
    toast.dismiss(PAY_TOAST_ID);
  };

  const isProcessing = loading || signing;

  return (
    <>
      {pendingBuilt && (
        <PaymentReview
          review={pendingBuilt.review}
          onConfirm={handleConfirmReview}
          onCancel={handleCancelReview}
          loading={signing}
        />
      )}

      {/*
       * The accessible name spells out the amount and asset (issue #289). "Pay
       * with Freighter" on its own does not say what is about to leave the
       * payer's wallet, and the amount lives in a separate panel rendered with
       * `bg-clip-text`, so a screen-reader user confirming a payment had no way
       * to hear the figure from the control itself.
       *
       * `aria-busy` reports the in-flight attempt; the label change to
       * "Processing..." covers the visual side.
       */}
      <button
        type="button"
        onClick={handlePayment}
        disabled={isProcessing || !destination || !amount || invoiceStatus !== 'PENDING'}
        aria-disabled={!gate.ready}
        aria-busy={isProcessing}
        data-payment-state={isProcessing ? 'processing' : gate.status}
        aria-label={
          isProcessing
            ? `Processing payment of ${amount} ${assetCode}`
            : gate.ready
              ? `Pay ${amount} ${assetCode} with Freighter`
              : gate.message
        }
        className="btn btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            Processing…
          </>
        ) : (
          <>
            <Wallet className="w-6 h-6" aria-hidden="true" />
            Pay with Freighter
          </>
        )}
      </button>
    </>
  );
}
