'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiErrorMessage, invoiceApi, isApiUnavailableError } from '@/lib/api';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import PaymentStatus from '@/components/PaymentStatus';
import WalletConnect from '@/components/WalletConnect';
import UserProfile from '@/components/UserProfile';
import FreighterInstallPrompt from '@/components/FreighterInstallPrompt';
import PaymentReceipt from '@/components/PaymentReceipt';
import AssetLogo from '@/components/AssetLogo';
import InvoiceTimeline from '@/components/InvoiceTimeline';
import InvoiceWorkspaceActions from '@/components/InvoiceWorkspaceActions';
import { formatAmount, formatDate, getTimeRemaining, shortenAddress } from '@/lib/utils';
import { MAIN_CONTENT_ID, describeAmount, statusText } from '@/lib/a11y';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useWalletStore } from '@/lib/store';
import ApiErrorState from '@/components/ApiErrorState';
import { effectiveInvoiceStatus } from '@/lib/invoice-lifecycle';
import { EXPECTED_WALLET_NETWORK } from '@/lib/stellar';
import { walletGate } from '@/lib/freighter-availability';
import {
  canAccessInvoiceWorkspace,
  workspaceActionVisibility,
  buildInvoiceTimeline,
} from '@/lib/invoice-workspace';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { publicKey, connected, network, freighterAvailable } = useWalletStore();
  const [invoice, setInvoice] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lifecycleNow, setLifecycleNow] = useState(() => Date.now());
  const statusPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setLifecycleNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadInvoice = useCallback(async () => {
    setLoadError(null);
    try {
      const [invoiceResult, paymentResult] = await Promise.allSettled([
        invoiceApi.getById(id),
        invoiceApi.getPaymentInfo(id),
      ]);

      if (invoiceResult.status === 'rejected') throw invoiceResult.reason;
      setInvoice(invoiceResult.value.data);
      if (paymentResult.status === 'fulfilled') {
        setPaymentInfo(paymentResult.value.data);
      } else {
        setLoadError(apiErrorMessage(paymentResult.reason));
      }
    } catch (error) {
      const message = apiErrorMessage(error, 'Failed to load invoice');
      if (isApiUnavailableError(error)) setLoadError(message);
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const gate = walletGate(
    { freighterAvailable, connected, publicKey, network },
    EXPECTED_WALLET_NETWORK
  );
  const activeWallet = gate.ready ? publicKey : null;

  const handleCancel = async () => {
    if (!window.confirm('Cancel this invoice?')) return;
    setCancelling(true);
    try {
      await invoiceApi.cancel(id, activeWallet || invoice?.sellerPublicKey);
      toast.success('Invoice cancelled');
      await loadInvoice();
      statusPanelRef.current?.focus();
    } catch (error) {
      const message = apiErrorMessage(error, 'Failed to cancel invoice');
      if (isApiUnavailableError(error)) setLoadError(message);
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="min-h-screen bg-logo-pattern relative flex items-center justify-center"
      >
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="relative" role="status" aria-live="polite">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full blur-2xl opacity-30"></div>
          <Loader2 className="w-16 h-16 animate-spin text-teal-800 relative z-10" aria-hidden="true" />
          <span className="sr-only">Loading this invoice.</span>
        </div>
      </main>
    );
  }

  if (!invoice) {
    if (loadError) {
      return (
        <div className="min-h-screen bg-logo-pattern flex items-center justify-center px-4">
          <div className="max-w-lg w-full">
            <ApiErrorState message={loadError} onRetry={() => void loadInvoice()} />
          </div>
        </div>
      );
    }
    return (
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="min-h-screen bg-logo-pattern relative flex items-center justify-center"
      >
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="card text-center max-w-md relative z-10" role="alert">
          <h1 className="text-2xl font-bold text-red-700 mb-2">Invoice Not Found</h1>
          <p className="text-gray-700">
            {loadError ?? 'The invoice you are looking for does not exist.'}
          </p>
        </div>
      </main>
    );
  }

  // Seller workspace authorization checks
  const access = canAccessInvoiceWorkspace(invoice, activeWallet);

  if (!activeWallet) {
    return (
      <div className="min-h-screen bg-logo-pattern flex items-center justify-center px-4">
        <div className="card text-center max-w-md w-full relative z-10 p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Seller Authentication Required</h1>
          <p className="text-gray-600 mb-6">
            Connect your seller wallet to view, manage, and track this invoice workspace.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <WalletConnect />
            <Link href={`/pay/${invoice.id}`} className="text-sm text-teal-700 hover:text-teal-900 underline mt-2">
              Looking to pay this invoice instead? Open Pay Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!access.allowed && access.reason === 'FORBIDDEN') {
    return (
      <div className="min-h-screen bg-logo-pattern flex items-center justify-center px-4">
        <div className="card text-center max-w-lg w-full relative z-10 p-8 shadow-xl" role="alert">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-6">
            This invoice workspace belongs to another seller wallet (
            <span className="font-mono text-xs font-semibold">
              {shortenAddress(access.expectedSeller || invoice.sellerPublicKey)}
            </span>
            ). Other sellers cannot view or manage foreign invoices.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <WalletConnect />
            <Link href="/dashboard" className="btn btn-outline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const effectiveStatus = (effectiveInvoiceStatus(invoice, lifecycleNow) || invoice.status) as
    'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  const actions = workspaceActionVisibility(invoice, lifecycleNow);
  const timelineItems = buildInvoiceTimeline(invoice, network || 'testnet', lifecycleNow);

  return (
    <div className="min-h-screen bg-logo-pattern relative py-8 sm:py-12 px-4">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <header className="fixed top-0 left-0 right-0 z-50 premium-header border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="btn btn-outline flex items-center gap-2"
              aria-label="Go back to the previous page"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <span className="font-display text-xl tracking-tight text-[var(--ink)]">Quittance</span>
            </Link>
          </div>

          <nav className="flex items-center gap-3" aria-label="Invoice workspace actions">
            {!publicKey ? <WalletConnect /> : <UserProfile userWallet={publicKey} />}
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto relative z-10 pt-16">
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/dashboard" className="hover:underline">Dashboard</Link>
                <span>/</span>
                <span className="font-mono text-xs">{invoice.id}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Seller Invoice Workspace
              </h1>
            </div>

            <InvoiceWorkspaceActions
              invoice={invoice}
              actions={actions}
              network={network || 'testnet'}
              onCancel={handleCancel}
              cancelling={cancelling}
            />
          </div>

          {loadError && (
            <div className="mb-6">
              <ApiErrorState message={loadError} onRetry={() => void loadInvoice()} compact />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Invoice Details</h2>

                <dl className="space-y-5">
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-5 rounded-2xl border border-gray-200/50">
                    <dt className="text-xs text-gray-600 mb-2 font-semibold uppercase tracking-wide">Invoice ID</dt>
                    <dd className="font-mono text-sm text-gray-900 break-all">{invoice.id}</dd>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-2xl border-2 border-cyan-200/50 shadow-lg">
                    <dt className="text-xs text-gray-600 mb-3 font-semibold uppercase tracking-wide">Amount</dt>
                    <dd className="flex items-center gap-3 text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                      <AssetLogo code={invoice.assetCode || 'XLM'} size={32} showName={false} decorative />
                      <span aria-hidden="true">
                        {formatAmount(invoice.amount, 7)} <span className="text-2xl">{invoice.assetCode || 'XLM'}</span>
                      </span>
                      <span className="sr-only">
                        {describeAmount(formatAmount(invoice.amount, 7), invoice.assetCode || 'XLM')}
                      </span>
                    </dd>
                  </div>

                  {invoice.description && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Description</dt>
                      <dd className="text-gray-900">{invoice.description}</dd>
                    </div>
                  )}

                  {invoice.customerName && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Client</dt>
                      <dd className="text-gray-900">{invoice.customerName}</dd>
                    </div>
                  )}

                  {invoice.customerEmail && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Client Email</dt>
                      <dd className="text-gray-900">{invoice.customerEmail}</dd>
                    </div>
                  )}

                  <div className="border-b pb-4">
                    <dt className="text-sm text-gray-600 mb-1">Payment Memo</dt>
                    <dd className="font-mono text-sm text-gray-900">{invoice.memo}</dd>
                  </div>

                  <div className="border-b pb-4">
                    <dt className="text-sm text-gray-600 mb-1">Status</dt>
                    <dd className="text-gray-900 font-semibold">
                      {statusText(effectiveStatus).label}
                    </dd>
                  </div>

                  {effectiveStatus === 'PENDING' && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Expires In</dt>
                      <dd className="text-gray-900 font-semibold">
                        {getTimeRemaining(invoice.expiresAt)}
                      </dd>
                    </div>
                  )}

                  {effectiveStatus === 'EXPIRED' && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Expired At</dt>
                      <dd className="text-red-700 font-semibold">{formatDate(invoice.expiresAt)}</dd>
                    </div>
                  )}

                  {invoice.paidAt && (
                    <div className="border-b pb-4">
                      <dt className="text-sm text-gray-600 mb-1">Paid At</dt>
                      <dd className="text-gray-900">{formatDate(invoice.paidAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Lifecycle Event Timeline */}
              <InvoiceTimeline items={timelineItems} />
            </div>

            <div className="space-y-6" ref={statusPanelRef} tabIndex={-1}>
              {effectiveStatus !== 'PAID' && (
                <PaymentStatus status={effectiveStatus} txHash={invoice.paymentTxHash} />
              )}

              {effectiveStatus === 'PAID' && (
                <PaymentReceipt invoice={invoice} />
              )}

              {effectiveStatus === 'PENDING' && paymentInfo?.paymentAvailable !== false && (
                <div className="card">
                  {!gate.ready && (
                    <FreighterInstallPrompt
                      gate={gate}
                      action={<WalletConnect />}
                      compact
                      className="mb-4"
                    />
                  )}
                  <h3 className="text-lg font-semibold mb-4 text-center">
                    Payment QR Code
                  </h3>
                  <QRCodeDisplay
                    value={paymentInfo.paymentUrl}
                    size={200}
                    showCopy={true}
                    description={`a payment link for ${describeAmount(
                      formatAmount(invoice.amount, 7),
                      invoice.assetCode
                    )}`}
                  />
                  <Link
                    href={`/pay/${invoice.id}`}
                    className="btn btn-primary w-full mt-4"
                  >
                    Go to Payment Page
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
